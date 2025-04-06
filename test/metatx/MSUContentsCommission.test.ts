import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { sendMetaTransaction } from "../lib/metatx";
import nxErrors from "../lib/nx-errors";

describe("meta-transaction MSUContentsCommission", function () {
  async function fixture() {
    const [owner, forwarder, user, nexonCommissionWallet] = await ethers.getSigners();
    const userAddress = await user.getAddress();
    const nexonCommissionWalletAddress = await nexonCommissionWallet.getAddress();
    const commissionInformation = (commissionAmount: bigint) => {
      return {
        commissionFrom: userAddress,
        commissionTo: nexonCommissionWalletAddress,
        commissionAmount: commissionAmount,
        dAppId: 0,
        reason: "",
      };
    };

    const [MSUContentsCommission, ERC20PresetFixedSupply, Commission] = await Promise.all([
      ethers.getContractFactory("MSUContentsCommission", owner),
      ethers.getContractFactory("ERC20PresetFixedSupply", owner),
      ethers.getContractFactory("Commission", owner),
    ]);

    const neso = await ERC20PresetFixedSupply.deploy("NextMeso", "NESO", 1_000_000n, await owner.getAddress());
    const commission = await Commission.deploy(await forwarder.getAddress(), neso.address);
    const vault = await MSUContentsCommission.deploy(await forwarder.getAddress(), neso.address, commission.address);

    await Promise.all([
      neso.transfer(await user.getAddress(), 1000n),
      neso.connect(user).approve(vault.address, ethers.constants.MaxUint256),
      neso.connect(owner).approve(vault.address, ethers.constants.MaxUint256),
    ]);

    return { vault, forwarder, owner, user, nexonCommissionWallet, commissionInformation };
  }

  before(async function () {
    await loadFixture(fixture);
  });

  describe("depositByOwner", function () {
    it("should not be reverted when the forwarded sender is the owner", async function () {
      const { vault, forwarder, owner, user, commissionInformation } = await loadFixture(fixture);
      await expect(
        sendMetaTransaction(
          forwarder,
          await owner.getAddress(),
          await vault.populateTransaction.depositByOwner(await user.getAddress(), commissionInformation(400n), "TEST")
        )
      )
        .to.emit(vault, "Deposit")
        .withArgs(await user.getAddress(), 400n, "TEST");
    });

    it("should be reverted when the forwarded sender is not the owner", async function () {
      const { vault, forwarder, owner, user, commissionInformation } = await loadFixture(fixture);
      await expect(
        sendMetaTransaction(
          forwarder,
          await user.getAddress(),
          await vault.populateTransaction.depositByOwner(await owner.getAddress(), commissionInformation(400n), "TEST")
        )
      ).to.be.revertedWith(nxErrors.executorForbidden);
    });

    it("should be reverted when illegally forwarded by non-owner", async function () {
      const { vault, owner, user, commissionInformation } = await loadFixture(fixture);
      await expect(
        sendMetaTransaction(
          user,
          await owner.getAddress(),
          await vault.populateTransaction.depositByOwner(await owner.getAddress(), commissionInformation(400n), "TEST")
        )
      ).to.be.revertedWith(nxErrors.executorForbidden);
    });

    it("should not be reverted when illegally forwarded by owner", async function () {
      const { vault, owner, user, commissionInformation } = await loadFixture(fixture);
      await expect(
        sendMetaTransaction(
          owner,
          await user.getAddress(),
          await vault.populateTransaction.depositByOwner(await owner.getAddress(), commissionInformation(400n), "TEST")
        )
      )
        .to.emit(vault, "Deposit")
        .withArgs(await owner.getAddress(), 400n, "TEST");
    });
  });
});
