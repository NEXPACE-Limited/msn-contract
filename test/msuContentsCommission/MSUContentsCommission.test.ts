import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import nxErrors from "../lib/nx-errors";

describe("MSUContentsCommission", function () {
  async function fixture() {
    const [
      controllerOwner,
      nesoOwner,
      vaultOwner,
      commissionOwner,
      user1,
      user2,
      nexonCommissionWallet,
      emittingForwarder,
    ] = await ethers.getSigners();

    const user1Address = await user1.getAddress();
    const nexonCommissionWalletAddress = await nexonCommissionWallet.getAddress();
    const commissionInformation = (commissionAmount: bigint) => {
      return {
        commissionFrom: user1Address,
        commissionTo: nexonCommissionWalletAddress,
        commissionAmount: commissionAmount,
        dAppId: 0,
        reason: "",
      };
    };

    const Contoller = (await ethers.getContractFactory("ApproveController")).connect(controllerOwner);
    const Neso = (await ethers.getContractFactory("NextMeso")).connect(nesoOwner);
    const MSUContentsCommission = (await ethers.getContractFactory("MSUContentsCommission")).connect(vaultOwner);
    const Commission = (await ethers.getContractFactory("Commission")).connect(commissionOwner);

    const controller = await Contoller.deploy(ethers.constants.AddressZero);
    const neso = await Neso.deploy(ethers.constants.AddressZero, controller.address, 100_000);
    const commission = await Commission.deploy(user1.address, neso.address);
    const enhancementVault = await MSUContentsCommission.deploy(
      emittingForwarder.address,
      neso.address,
      commission.address
    );

    await controller.setAllowlist(enhancementVault.address, true);
    await neso.grantExecutor(await nesoOwner.getAddress());
    await neso.approveOperator(enhancementVault.address);

    return {
      controller,
      neso,
      nesoOwner,
      enhancementVault,
      user1,
      user2,
      commissionOwner,
      nexonCommissionWallet,
      commissionInformation,
    };
  }

  describe("deposit from Nexon(contract is not a creator)", function () {
    it("success", async () => {
      const { neso, enhancementVault, user1, commissionInformation } = await loadFixture(fixture);
      await neso.connect(user1).approve(enhancementVault.address, 1000);
      await neso.connect(user1).deposit({ value: 1000 });

      await expect(
        enhancementVault.depositByOwner(
          await user1.getAddress(),
          commissionInformation(300n),
          "MSUContentsCommission: depositByOwner"
        )
      )
        .to.emit(enhancementVault, "Deposit")
        .withArgs(await user1.getAddress(), 300, "MSUContentsCommission: depositByOwner");
    });

    it("fail - not enough neso", async () => {
      const { neso, enhancementVault, user1, commissionInformation } = await loadFixture(fixture);
      await neso.connect(user1).approve(enhancementVault.address, 1000000000n);
      await neso.connect(user1).deposit({ value: 300 });
      await expect(
        enhancementVault.depositByOwner(
          await user1.getAddress(),
          commissionInformation(40000000n),
          "MSUContentsCommission: depositByOwner"
        )
      ).to.be.revertedWith(nxErrors.ERC20.transferNoFund);
    });

    it("fail - not enough allowance", async () => {
      const { neso, enhancementVault, user1, commissionInformation } = await loadFixture(fixture);
      await neso.connect(user1).deposit({ value: 300 });
      await expect(
        enhancementVault.depositByOwner(
          await user1.getAddress(),
          commissionInformation(10_000n),
          "MSUContentsCommission: depositByOwner"
        )
      ).to.be.revertedWith(nxErrors.ERC20.transferForbidden);
    });

    it("fail - not owner", async () => {
      const { neso, enhancementVault, user1, user2, commissionInformation } = await loadFixture(fixture);
      await neso.connect(user1).deposit({ value: 300 });
      await expect(
        enhancementVault
          .connect(user2)
          .depositByOwner(
            await user1.getAddress(),
            commissionInformation(10_000n),
            "MSUContentsCommission: depositByOwner"
          )
      ).to.be.revertedWith(nxErrors.executorForbidden);
    });

    it("fail - user is zero address", async () => {
      const { enhancementVault, commissionInformation } = await loadFixture(fixture);
      await expect(
        enhancementVault.depositByOwner(
          ethers.constants.AddressZero,
          commissionInformation(10_000n),
          "MSUContentsCommission: depositByOwner"
        )
      ).to.be.revertedWith(nxErrors.MSUContentsCommission.validAddress);
    });
  });

  describe("deposit from Nexon(contract is a creator)", function () {
    it("success", async () => {
      const { controller, neso, enhancementVault, user1, nexonCommissionWallet, commissionInformation } =
        await loadFixture(fixture);
      await neso.approveOperator(enhancementVault.address);
      await controller.connect(user1).setApprove(true);
      await neso.connect(user1).deposit({ value: 1 });
      await expect(
        enhancementVault.depositByOwner(
          await user1.getAddress(),
          commissionInformation(40000n),
          "MSUContentsCommission: depositByOwner"
        )
      )
        .emit(enhancementVault, "SendCommission")
        .withArgs(
          await user1.getAddress(),
          await nexonCommissionWallet.getAddress(),
          neso.address,
          40000n,
          0,
          "MSUContentsCommission: depositByOwner"
        )
        .emit(enhancementVault, "Deposit")
        .withArgs(await user1.getAddress(), 40000, "MSUContentsCommission: depositByOwner");
      await expect(
        enhancementVault.depositByOwner(
          await user1.getAddress(),
          commissionInformation(60001n),
          "MSUContentsCommission: depositByOwner"
        )
      ).to.be.revertedWith(nxErrors.ERC20.transferNoFund);
    });

    it("fail - not enough neso", async () => {
      const { controller, neso, enhancementVault, user1, commissionInformation } = await loadFixture(fixture);
      await neso.approveOperator(enhancementVault.address);
      await controller.connect(user1).setApprove(true);
      await neso.connect(user1).deposit({ value: 1 });
      await expect(
        enhancementVault.depositByOwner(
          await user1.getAddress(),
          commissionInformation(100001n),
          "MSUContentsCommission: depositByOwner"
        )
      ).revertedWith(nxErrors.ERC20.transferNoFund);
    });

    it("fail - no allowance", async () => {
      const { neso, enhancementVault, user1, commissionInformation } = await loadFixture(fixture);
      await neso.approveOperator(enhancementVault.address);
      await neso.connect(user1).deposit({ value: 300 });
      await expect(
        enhancementVault.depositByOwner(
          await user1.getAddress(),
          commissionInformation(10_000n),
          "MSUContentsCommission: depositByOwner"
        )
      ).to.be.revertedWith(nxErrors.ERC20.transferForbidden);
    });
  });
});
