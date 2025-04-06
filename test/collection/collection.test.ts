import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import nxErrors from "../lib/nx-errors";
const fakeAddress = "0x0000000000000000000000000000000000000001";

describe("Collection", function () {
  async function fixture() {
    const [owner, executor, ad1, ad2] = await ethers.getSigners();
    const defaultURI = "https://defaultURI.com/";

    const [Equip, Character, ApproveController, Collection] = await Promise.all([
      ethers.getContractFactory("MaplestoryEquip"),
      ethers.getContractFactory("MaplestoryCharacter"),
      ethers.getContractFactory("ApproveController"),
      ethers.getContractFactory("MockCollectionV2"),
    ]);

    const approveController = await ApproveController.deploy(fakeAddress);

    const equip = await Equip.deploy(fakeAddress, approveController.address, fakeAddress, defaultURI);

    await equip.grantExecutor(await executor.getAddress());

    await Promise.all(
      [0x10, 0x11, 0x20, 0x21, 0x30].map((id) => equip.connect(owner).setLimitSupply(id, "0xffffffffffffffff", false))
    );

    await equip.mintBatch(await ad1.getAddress(), [
      { itemId: 0x10, tokenId: 11 },
      { itemId: 0x11, tokenId: 111 },
      { itemId: 0x20, tokenId: 21 },
      { itemId: 0x21, tokenId: 211 },
    ]);

    await equip.mintBatch(await ad2.getAddress(), [
      { itemId: 0x10, tokenId: 12 },
      { itemId: 0x11, tokenId: 121 },
      { itemId: 0x20, tokenId: 22 },
      { itemId: 0x30, tokenId: 32 },
    ]);

    const character = await Character.deploy(fakeAddress, approveController.address, defaultURI);

    const mintTx1 = await character.mint(await ad1.getAddress());
    const receipt1 = await mintTx1.wait();
    const mintEvent1 = receipt1.events!.find((event) => event.event === "Transfer");
    const ad1CharAddr = ethers.utils.getAddress(mintEvent1?.args!.tokenId.toHexString());
    const mintTx2 = await character.mint(await ad2.getAddress());
    const receipt2 = await mintTx2.wait();
    const mintEvent2 = receipt2.events!.find((event) => event.event === "Transfer");
    const ad2CharAddr = ethers.utils.getAddress(mintEvent2?.args!.tokenId.toHexString());
    const mintTx3 = await character.mint(await ad2.getAddress());
    const receipt3 = await mintTx3.wait();
    const mintEvent3 = receipt3.events!.find((event) => event.event === "Transfer");
    const ad2AnotherCharAddr = ethers.utils.getAddress(mintEvent3?.args!.tokenId.toHexString());

    await equip.connect(ad1).transferFrom(await ad1.getAddress(), ad1CharAddr, 21);
    await equip.connect(ad1).transferFrom(await ad1.getAddress(), ad1CharAddr, 211);
    await equip.connect(ad2).transferFrom(await ad2.getAddress(), ad2CharAddr, 22);
    await equip.connect(ad2).transferFrom(await ad2.getAddress(), ad2CharAddr, 32);

    await approveController.setAllowlist(character.address, true);

    const collection = await Collection.deploy(fakeAddress, equip.address, character.address);

    await character.grantExecutor(collection.address);
    await equip.approveOperator(collection.address);
    await equip.approveOperator(character.address);
    await collection.grantExecutor(await executor.getAddress());
    collection.connect(executor);

    await approveController.connect(ad1).setApprove(true);
    await approveController.connect(ad2).setApprove(true);

    const tokenInfo = {
      nftTokenId: 0,
      slotKey: "",
    };

    return {
      owner,
      executor,
      ad1,
      ad2,
      ad1CharAddr,
      ad2CharAddr,
      ad2AnotherCharAddr,
      approveController,
      equip,
      collection: collection.connect(executor),
      character,
      tokenInfo,
    };
  }

  describe("Success case", function () {
    it("addItem", async () => {
      const { ad1, ad2, equip, collection } = await loadFixture(fixture);
      await expect(collection.addItem(await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" }))
        .to.emit(collection, "ItemAdded")
        .withArgs(await ad1.getAddress(), 0x10, 11, "arcane001001");
      const slotInfo = await collection.slotInfo(await ad1.getAddress(), "arcane001001");
      expect(slotInfo.nftTokenId).to.equal(11);
      expect(slotInfo.itemId).to.equal(16);
      expect(slotInfo.valid).to.equal(true);
      expect(await equip.ownerOf(11)).equal(collection.address);
      await expect(collection.addItem(await ad2.getAddress(), { nftTokenId: 12, slotKey: "arcane001001" }))
        .to.emit(collection, "ItemAdded")
        .withArgs(await ad2.getAddress(), 0x10, 12, "arcane001001");
      expect(await equip.ownerOf(12)).equal(collection.address);
    });

    it("addBatchItem", async () => {
      const { ad1, equip, collection, tokenInfo } = await loadFixture(fixture);
      const tokenInfoList = [tokenInfo, tokenInfo];
      tokenInfoList[0] = { nftTokenId: 11, slotKey: "arcane001001" };
      tokenInfoList[1] = { nftTokenId: 111, slotKey: "arcane001002" };
      await expect(collection.addBatchItem(await ad1.getAddress(), tokenInfoList))
        .to.emit(collection, "ItemAdded")
        .withArgs(await ad1.getAddress(), 0x10, 11, "arcane001001")
        .to.emit(collection, "ItemAdded")
        .withArgs(await ad1.getAddress(), 0x11, 111, "arcane001002");
      const slotInfo1 = await collection.slotInfo(await ad1.getAddress(), "arcane001001");
      expect(slotInfo1.nftTokenId).to.equal(11);
      expect(slotInfo1.itemId).to.equal(16);
      expect(slotInfo1.valid).to.equal(true);
      expect(await equip.ownerOf(11)).equal(collection.address);
      const slotInfo2 = await collection.slotInfo(await ad1.getAddress(), "arcane001002");
      expect(slotInfo2.nftTokenId).to.equal(111);
      expect(slotInfo2.itemId).to.equal(17);
      expect(slotInfo2.valid).to.equal(true);
      expect(await equip.ownerOf(111)).equal(collection.address);
    });

    it("addItemChar", async () => {
      const { ad1, ad1CharAddr, ad2, ad2CharAddr, equip, collection } = await loadFixture(fixture);
      await expect(
        collection.addItemByChar(ad1CharAddr, await ad1.getAddress(), { nftTokenId: 21, slotKey: "arcane001001" })
      )
        .to.emit(collection, "ItemAddedByChar")
        .withArgs(await ad1.getAddress(), ad1CharAddr, 0x20, 21, "arcane001001");
      expect(await equip.ownerOf(21)).equal(collection.address);
      await expect(
        collection.addItemByChar(ad2CharAddr, await ad2.getAddress(), { nftTokenId: 22, slotKey: "arcane001001" })
      )
        .to.emit(collection, "ItemAddedByChar")
        .withArgs(await ad2.getAddress(), ad2CharAddr, 0x20, 22, "arcane001001");
      expect(await equip.ownerOf(22)).equal(collection.address);
    });

    it("addBatchItemChar", async () => {
      const { ad1, ad1CharAddr, equip, collection, tokenInfo } = await loadFixture(fixture);
      const tokenInfoList = [tokenInfo, tokenInfo];
      tokenInfoList[0] = { nftTokenId: 21, slotKey: "arcane001001" };
      tokenInfoList[1] = { nftTokenId: 211, slotKey: "arcane001002" };
      await expect(collection.addBatchItemByChar(ad1CharAddr, await ad1.getAddress(), tokenInfoList))
        .to.emit(collection, "ItemAddedByChar")
        .withArgs(await ad1.getAddress(), ad1CharAddr, 0x20, 21, "arcane001001")
        .to.emit(collection, "ItemAddedByChar")
        .withArgs(await ad1.getAddress(), ad1CharAddr, 0x21, 211, "arcane001002");
      expect(await equip.ownerOf(211)).equal(collection.address);
    });

    it("returnItem: Wallet -> Wallet", async () => {
      const { ad1, equip, collection } = await loadFixture(fixture);
      await collection.addItem(await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" });
      await expect(collection.returnItem(await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" }))
        .to.emit(collection, "ItemReturned")
        .withArgs(await ad1.getAddress(), 0x10, 11, "arcane001001");
      expect(await equip.ownerOf(11)).equal(await ad1.getAddress());
    });

    it("returnBatchItem: Wallet -> Wallet", async () => {
      const { ad1, equip, collection, tokenInfo } = await loadFixture(fixture);
      const tokenInfoList = [tokenInfo, tokenInfo];
      tokenInfoList[0] = { nftTokenId: 11, slotKey: "arcane001001" };
      tokenInfoList[1] = { nftTokenId: 111, slotKey: "arcane001002" };
      await collection.addBatchItem(await ad1.getAddress(), tokenInfoList);
      await expect(collection.returnBatchItem(await ad1.getAddress(), tokenInfoList))
        .to.emit(collection, "ItemReturned")
        .withArgs(await ad1.getAddress(), 0x10, 11, "arcane001001")
        .to.emit(collection, "ItemReturned")
        .withArgs(await ad1.getAddress(), 0x11, 111, "arcane001002");
      expect(await equip.ownerOf(11)).equal(await ad1.getAddress());
      expect(await equip.ownerOf(111)).equal(await ad1.getAddress());
    });

    it("returnItemChar: Wallet -> Character", async () => {
      const { ad1, ad1CharAddr, equip, collection } = await loadFixture(fixture);
      await collection.addItem(await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" });
      await expect(
        collection.returnItemByChar(ad1CharAddr, await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" })
      )
        .to.emit(collection, "ItemReturnedByChar")
        .withArgs(await ad1.getAddress(), ad1CharAddr, 0x10, 11, "arcane001001");
      expect(await equip.ownerOf(11)).equal(ad1CharAddr);
    });

    it("returnBatchItemChar: Wallet -> Character", async () => {
      const { ad1, ad1CharAddr, equip, collection, tokenInfo } = await loadFixture(fixture);
      const tokenInfoList = [tokenInfo, tokenInfo];
      tokenInfoList[0] = { nftTokenId: 11, slotKey: "arcane001001" };
      tokenInfoList[1] = { nftTokenId: 111, slotKey: "arcane001002" };
      await collection.addBatchItem(await ad1.getAddress(), tokenInfoList);
      await expect(collection.returnBatchItemByChar(ad1CharAddr, await ad1.getAddress(), tokenInfoList))
        .to.emit(collection, "ItemReturnedByChar")
        .withArgs(await ad1.getAddress(), ad1CharAddr, 0x10, 11, "arcane001001")
        .to.emit(collection, "ItemReturnedByChar")
        .withArgs(await ad1.getAddress(), ad1CharAddr, 0x11, 111, "arcane001002");
      expect(await equip.ownerOf(11)).equal(ad1CharAddr);
    });

    it("returnItem: Character -> Wallet", async () => {
      const { ad1, ad1CharAddr, equip, collection } = await loadFixture(fixture);
      await collection.addItemByChar(ad1CharAddr, await ad1.getAddress(), { nftTokenId: 21, slotKey: "arcane001001" });
      await expect(collection.returnItem(await ad1.getAddress(), { nftTokenId: 21, slotKey: "arcane001001" }))
        .to.emit(collection, "ItemReturned")
        .withArgs(await ad1.getAddress(), 0x20, 21, "arcane001001");
      expect(await equip.ownerOf(21)).equal(await ad1.getAddress());
    });

    it("returnBatchItem: Character -> Wallet", async () => {
      const { ad1, ad1CharAddr, equip, collection, tokenInfo } = await loadFixture(fixture);
      const tokenInfoList = [tokenInfo, tokenInfo];
      tokenInfoList[0] = { nftTokenId: 21, slotKey: "arcane001001" };
      tokenInfoList[1] = { nftTokenId: 211, slotKey: "arcane001002" };
      await collection.addBatchItemByChar(ad1CharAddr, await ad1.getAddress(), tokenInfoList);
      await expect(collection.returnBatchItem(await ad1.getAddress(), tokenInfoList))
        .to.emit(collection, "ItemReturned")
        .withArgs(await ad1.getAddress(), 0x20, 21, "arcane001001")
        .to.emit(collection, "ItemReturned")
        .withArgs(await ad1.getAddress(), 0x21, 211, "arcane001002");
      expect(await equip.ownerOf(21)).equal(await ad1.getAddress());
      expect(await equip.ownerOf(211)).equal(await ad1.getAddress());
    });

    it("returnItemChar: Character -> Character", async () => {
      const { ad1, ad1CharAddr, equip, collection } = await loadFixture(fixture);
      await collection.addItemByChar(ad1CharAddr, await ad1.getAddress(), { nftTokenId: 21, slotKey: "arcane001001" });
      await expect(
        collection.returnItemByChar(ad1CharAddr, await ad1.getAddress(), { nftTokenId: 21, slotKey: "arcane001001" })
      )
        .to.emit(collection, "ItemReturnedByChar")
        .withArgs(await ad1.getAddress(), ad1CharAddr, 0x20, 21, "arcane001001");
      expect(await equip.ownerOf(21)).equal(ad1CharAddr);
    });

    it("returnBatchItemChar: Character -> Character", async () => {
      const { ad1, ad1CharAddr, equip, collection, tokenInfo } = await loadFixture(fixture);
      const tokenInfoList = [tokenInfo, tokenInfo];
      tokenInfoList[0] = { nftTokenId: 21, slotKey: "arcane001001" };
      tokenInfoList[1] = { nftTokenId: 211, slotKey: "arcane001002" };
      await collection.addBatchItemByChar(ad1CharAddr, await ad1.getAddress(), tokenInfoList);
      await expect(collection.returnBatchItemByChar(ad1CharAddr, await ad1.getAddress(), tokenInfoList))
        .to.emit(collection, "ItemReturnedByChar")
        .withArgs(await ad1.getAddress(), ad1CharAddr, 0x20, 21, "arcane001001")
        .to.emit(collection, "ItemReturnedByChar")
        .withArgs(await ad1.getAddress(), ad1CharAddr, 0x21, 211, "arcane001002");
      expect(await equip.ownerOf(21)).equal(ad1CharAddr);
    });

    it("returnItemChar: Character -> Another character", async () => {
      const { ad2, ad2CharAddr, ad2AnotherCharAddr, equip, collection } = await loadFixture(fixture);
      await collection.addItemByChar(ad2CharAddr, await ad2.getAddress(), { nftTokenId: 22, slotKey: "arcane001001" });
      await expect(
        collection.returnItemByChar(ad2AnotherCharAddr, await ad2.getAddress(), {
          nftTokenId: 22,
          slotKey: "arcane001001",
        })
      )
        .to.emit(collection, "ItemReturnedByChar")
        .withArgs(await ad2.getAddress(), ad2AnotherCharAddr, 0x20, 22, "arcane001001");
      expect(await equip.ownerOf(22)).equal(ad2AnotherCharAddr);
    });

    it("returnBatchItemChar: Character -> Another character", async () => {
      const { ad2, ad2CharAddr, ad2AnotherCharAddr, equip, collection, tokenInfo } = await loadFixture(fixture);
      const tokenInfoList = [tokenInfo, tokenInfo];
      tokenInfoList[0] = { nftTokenId: 22, slotKey: "arcane001001" };
      tokenInfoList[1] = { nftTokenId: 32, slotKey: "arcane001002" };
      await collection.addBatchItemByChar(ad2CharAddr, await ad2.getAddress(), tokenInfoList);
      await expect(collection.returnBatchItemByChar(ad2AnotherCharAddr, await ad2.getAddress(), tokenInfoList))
        .to.emit(collection, "ItemReturnedByChar")
        .withArgs(await ad2.getAddress(), ad2AnotherCharAddr, 0x20, 22, "arcane001001")
        .to.emit(collection, "ItemReturnedByChar")
        .withArgs(await ad2.getAddress(), ad2AnotherCharAddr, 0x30, 32, "arcane001002");
      expect(await equip.ownerOf(22)).equal(ad2AnotherCharAddr);
      expect(await equip.ownerOf(32)).equal(ad2AnotherCharAddr);
    });

    it("Pause & Unpause", async () => {
      const { owner, ad1, equip, collection } = await loadFixture(fixture);
      await collection.pause();
      await expect(
        collection.addItem(await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" })
      ).to.be.revertedWith(nxErrors.paused);
      await collection.connect(owner).unpause();
      await collection.addItem(await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" });
      expect(await equip.ownerOf(11)).equal(collection.address);
    });

    describe("addItem at wallet", function () {
      it("reverted case: account is neither the owner nor an executor", async () => {
        const { ad1, collection } = await loadFixture(fixture);
        await expect(
          collection.connect(ad1).addItem(await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" })
        ).to.be.revertedWith(nxErrors.executorForbidden);
      });

      it("reverted case: Slot is already occupied", async () => {
        const { ad1, collection } = await loadFixture(fixture);
        await collection.addItem(await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" });
        await expect(
          collection.addItem(await ad1.getAddress(), { nftTokenId: 111, slotKey: "arcane001001" })
        ).to.be.revertedWith(nxErrors.Collection.slotOccupied);
      });

      it("reverted case: Paused state", async () => {
        const { ad1, collection } = await loadFixture(fixture);
        await collection.pause();
        await expect(
          collection.addItem(await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" })
        ).to.be.revertedWith(nxErrors.paused);
      });

      it("reverted case: Zero address", async () => {
        const { collection } = await loadFixture(fixture);
        await expect(
          collection.addItem(ethers.constants.AddressZero, { nftTokenId: 11, slotKey: "arcane001001" })
        ).to.be.revertedWith(nxErrors.Collection.validAddress);
      });
    });

    describe("addBatchItem at wallet", function () {
      it("reverted case: account is neither the owner nor an executor", async () => {
        const { ad1, collection, tokenInfo } = await loadFixture(fixture);
        const tokenInfoList = [tokenInfo, tokenInfo];
        tokenInfoList[0] = { nftTokenId: 11, slotKey: "arcane001001" };
        tokenInfoList[1] = { nftTokenId: 111, slotKey: "arcane001002" };
        await expect(collection.connect(ad1).addBatchItem(await ad1.getAddress(), tokenInfoList)).to.be.revertedWith(
          nxErrors.executorForbidden
        );
      });

      it("reverted case: Slot is already occupied", async () => {
        const { ad1, collection, tokenInfo } = await loadFixture(fixture);
        const tokenInfoList = [tokenInfo, tokenInfo];
        tokenInfoList[0] = { nftTokenId: 11, slotKey: "arcane001001" };
        tokenInfoList[1] = { nftTokenId: 111, slotKey: "arcane001001" };
        await expect(collection.addBatchItem(await ad1.getAddress(), tokenInfoList)).to.be.revertedWith(
          nxErrors.Collection.slotOccupied
        );
      });

      it("reverted case: Paused state", async () => {
        const { ad1, collection, tokenInfo } = await loadFixture(fixture);
        const tokenInfoList = [tokenInfo, tokenInfo];
        tokenInfoList[0] = { nftTokenId: 11, slotKey: "arcane001001" };
        tokenInfoList[1] = { nftTokenId: 111, slotKey: "arcane001002" };
        await collection.pause();
        await expect(collection.addBatchItem(await ad1.getAddress(), tokenInfoList)).to.be.revertedWith(
          nxErrors.paused
        );
      });

      it("reverted case: Zero address", async () => {
        const { collection, tokenInfo } = await loadFixture(fixture);
        const tokenInfoList = [tokenInfo, tokenInfo];
        tokenInfoList[0] = { nftTokenId: 11, slotKey: "arcane001001" };
        tokenInfoList[1] = { nftTokenId: 111, slotKey: "arcane001001" };
        await expect(collection.addBatchItem(ethers.constants.AddressZero, tokenInfoList)).to.be.revertedWith(
          nxErrors.Collection.validAddress
        );
      });
    });

    describe("addItem at character", function () {
      it("reverted case: Wrong charId - invalid token", async () => {
        const { ad1, collection } = await loadFixture(fixture);
        await expect(
          collection.addItemByChar(await ad1.getAddress(), await ad1.getAddress(), {
            nftTokenId: 11,
            slotKey: "arcane001001",
          })
        ).to.be.revertedWith(nxErrors.MaplestoryCharacter.ownerOfInvalidID);
      });

      it("reverted case: Wrong charId - valid token, but wrong owner address", async () => {
        const { ad1, ad2CharAddr, collection } = await loadFixture(fixture);
        await expect(
          collection.addItemByChar(ad2CharAddr, await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" })
        ).to.be.revertedWith(nxErrors.Collection.invalidID);
      });

      it("reverted case: Slot is already occupied", async () => {
        const { ad1, ad1CharAddr, collection } = await loadFixture(fixture);
        await collection.addItem(await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" });
        await expect(
          collection.addItemByChar(ad1CharAddr, await ad1.getAddress(), { nftTokenId: 211, slotKey: "arcane001001" })
        ).to.be.revertedWith(nxErrors.Collection.slotOccupied);
      });

      it("reverted case: Caller is not owner", async () => {
        const { ad1, collection } = await loadFixture(fixture);
        await expect(
          collection
            .connect(ad1)
            .addItemByChar(await ad1.getAddress(), await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" })
        ).to.be.revertedWith(nxErrors.executorForbidden);
      });

      it("reverted case: Paused state", async () => {
        const { ad1, ad1CharAddr, collection } = await loadFixture(fixture);
        await collection.pause();
        await expect(
          collection.addItemByChar(ad1CharAddr, await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" })
        ).to.be.revertedWith(nxErrors.paused);
      });

      it("reverted case: Zero address", async () => {
        const { ad1CharAddr, collection } = await loadFixture(fixture);
        await expect(
          collection.addItemByChar(ad1CharAddr, ethers.constants.AddressZero, {
            nftTokenId: 11,
            slotKey: "arcane001001",
          })
        ).to.be.revertedWith(nxErrors.Collection.validAddress);
      });
    });

    describe("addBatchItem at character", function () {
      it("reverted case: Wrong charId - invalid token", async () => {
        const { ad1, collection, tokenInfo } = await loadFixture(fixture);
        const tokenInfoList = [tokenInfo, tokenInfo];
        tokenInfoList[0] = { nftTokenId: 11, slotKey: "arcane001001" };
        tokenInfoList[1] = { nftTokenId: 111, slotKey: "arcane001002" };
        await expect(
          collection.addBatchItemByChar(await ad1.getAddress(), await ad1.getAddress(), tokenInfoList)
        ).to.be.revertedWith(nxErrors.MaplestoryCharacter.ownerOfInvalidID);
      });

      it("reverted case: Wrong charId - valid token, but wrong owner address", async () => {
        const { ad1, ad2CharAddr, collection, tokenInfo } = await loadFixture(fixture);
        const tokenInfoList = [tokenInfo, tokenInfo];
        tokenInfoList[0] = { nftTokenId: 11, slotKey: "arcane001001" };
        tokenInfoList[1] = { nftTokenId: 111, slotKey: "arcane001002" };
        await expect(
          collection.addBatchItemByChar(ad2CharAddr, await ad1.getAddress(), tokenInfoList)
        ).to.be.revertedWith(nxErrors.Collection.invalidID);
      });

      it("reverted case: Slot is already occupied", async () => {
        const { ad1, ad1CharAddr, collection, tokenInfo } = await loadFixture(fixture);
        const tokenInfoList = [tokenInfo, tokenInfo];
        tokenInfoList[0] = { nftTokenId: 21, slotKey: "arcane001001" };
        tokenInfoList[1] = { nftTokenId: 211, slotKey: "arcane001001" };
        await expect(
          collection.addBatchItemByChar(ad1CharAddr, await ad1.getAddress(), tokenInfoList)
        ).to.be.revertedWith(nxErrors.Collection.slotOccupied);
      });

      it("reverted case: Caller is not owner", async () => {
        const { ad1, collection, tokenInfo } = await loadFixture(fixture);
        const tokenInfoList = [tokenInfo, tokenInfo];
        tokenInfoList[0] = { nftTokenId: 11, slotKey: "arcane001001" };
        tokenInfoList[1] = { nftTokenId: 111, slotKey: "arcane001002" };
        await expect(
          collection.connect(ad1).addBatchItemByChar(await ad1.getAddress(), await ad1.getAddress(), tokenInfoList)
        ).to.be.revertedWith(nxErrors.executorForbidden);
      });

      it("reverted case: Paused state", async () => {
        const { ad1, ad1CharAddr, collection, tokenInfo } = await loadFixture(fixture);
        const tokenInfoList = [tokenInfo, tokenInfo];
        tokenInfoList[0] = { nftTokenId: 21, slotKey: "arcane001001" };
        tokenInfoList[1] = { nftTokenId: 211, slotKey: "arcane001002" };
        await collection.pause();
        await expect(
          collection.addBatchItemByChar(ad1CharAddr, await ad1.getAddress(), tokenInfoList)
        ).to.be.revertedWith(nxErrors.paused);
      });

      it("reverted case: Zero address", async () => {
        const { ad1CharAddr, collection, tokenInfo } = await loadFixture(fixture);
        const tokenInfoList = [tokenInfo, tokenInfo];
        tokenInfoList[0] = { nftTokenId: 21, slotKey: "arcane001001" };
        tokenInfoList[1] = { nftTokenId: 211, slotKey: "arcane001002" };
        await expect(
          collection.addBatchItemByChar(ad1CharAddr, ethers.constants.AddressZero, tokenInfoList)
        ).to.be.revertedWith(nxErrors.Collection.validAddress);
      });
    });

    describe("returnItem at wallet", function () {
      it("reverted case: Caller is not owner", async () => {
        const { ad1, collection } = await loadFixture(fixture);
        await expect(
          collection.connect(ad1).returnItem(await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" })
        ).to.be.revertedWith(nxErrors.executorForbidden);
      });

      it("reverted case: Wrong itemOwner", async () => {
        const { ad1, ad2, collection } = await loadFixture(fixture);
        await collection.addItem(await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" });
        await expect(
          collection.returnItem(await ad2.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" })
        ).to.be.revertedWith(nxErrors.Collection.slotEmpty);
      });

      it("reverted case: Wrong tokenId", async () => {
        const { ad1, collection } = await loadFixture(fixture);
        await collection.addItem(await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" });
        await expect(
          collection.returnItem(await ad1.getAddress(), { nftTokenId: 12, slotKey: "arcane001001" })
        ).to.be.revertedWith(nxErrors.Collection.slotConflict);
      });

      it("reverted case: tokenId - slotKey mismatch, tokenId existent", async () => {
        const { ad1, collection } = await loadFixture(fixture);
        await collection.addItem(await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" });
        await expect(
          collection.returnItem(await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001002" })
        ).to.be.revertedWith(nxErrors.Collection.slotEmpty);
      });

      it("reverted case: tokenId - slotKey mismatch, tokenId and slotKey existent)", async () => {
        const { ad1, collection } = await loadFixture(fixture);
        await collection.addItem(await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" });
        await collection.addItem(await ad1.getAddress(), { nftTokenId: 111, slotKey: "arcane001002" });
        await expect(
          collection.returnItem(await ad1.getAddress(), { nftTokenId: 111, slotKey: "arcane001001" })
        ).to.be.revertedWith(nxErrors.Collection.slotConflict);
      });

      it("reverted case: tokenId - slotKey mismatch, complex case", async () => {
        const { ad1, collection } = await loadFixture(fixture);
        await collection.addItem(await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" });
        await collection.returnItem(await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" });
        await collection.addItem(await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001002" });
        await expect(
          collection.returnItem(await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" })
        ).to.be.revertedWith(nxErrors.Collection.slotEmpty);
      });

      it("reverted case: Already reuturned)", async () => {
        const { ad1, collection } = await loadFixture(fixture);
        await collection.addItem(await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" });
        await collection.returnItem(await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" });
        await expect(
          collection.returnItem(await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" })
        ).to.be.revertedWith(nxErrors.Collection.slotEmpty);
      });

      it("reverted case: Paused state", async () => {
        const { ad1, collection } = await loadFixture(fixture);
        await collection.pause();
        await expect(
          collection.returnItem(await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" })
        ).to.be.revertedWith(nxErrors.paused);
      });

      it("reverted case: Zero address", async () => {
        const { collection } = await loadFixture(fixture);
        await expect(
          collection.returnItem(ethers.constants.AddressZero, { nftTokenId: 11, slotKey: "arcane001001" })
        ).to.be.revertedWith(nxErrors.Collection.validAddress);
      });
    });

    describe("returnBatchItem at wallet", function () {
      it("reverted case: Caller is not owner", async () => {
        const { ad1, collection, tokenInfo } = await loadFixture(fixture);
        const tokenInfoList = [tokenInfo, tokenInfo];
        tokenInfoList[0] = { nftTokenId: 11, slotKey: "arcane001001" };
        tokenInfoList[1] = { nftTokenId: 111, slotKey: "arcane001002" };
        await expect(collection.connect(ad1).returnBatchItem(await ad1.getAddress(), tokenInfoList)).to.be.revertedWith(
          nxErrors.executorForbidden
        );
      });

      it("reverted case: Wrong itemOwner", async () => {
        const { ad1, ad2, collection, tokenInfo } = await loadFixture(fixture);
        const tokenInfoList = [tokenInfo, tokenInfo];
        tokenInfoList[0] = { nftTokenId: 11, slotKey: "arcane001001" };
        tokenInfoList[1] = { nftTokenId: 111, slotKey: "arcane001002" };
        await collection.addBatchItem(await ad1.getAddress(), tokenInfoList);
        await expect(collection.returnBatchItem(await ad2.getAddress(), tokenInfoList)).to.be.revertedWith(
          nxErrors.Collection.slotEmpty
        );
      });

      it("reverted case: Wrong tokenId", async () => {
        const { ad1, collection, tokenInfo } = await loadFixture(fixture);
        const tokenInfoList = [tokenInfo, tokenInfo];
        tokenInfoList[0] = { nftTokenId: 11, slotKey: "arcane001001" };
        tokenInfoList[1] = { nftTokenId: 12, slotKey: "arcane001002" };
        await collection.addItem(await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" });
        await collection.addItem(await ad1.getAddress(), { nftTokenId: 111, slotKey: "arcane001002" });
        await expect(collection.returnBatchItem(await ad1.getAddress(), tokenInfoList)).to.be.revertedWith(
          nxErrors.Collection.slotConflict
        );
      });

      it("reverted case: tokenId - slotKey mismatch, tokenId existent", async () => {
        const { ad1, collection, tokenInfo } = await loadFixture(fixture);
        const tokenInfoList = [tokenInfo, tokenInfo];
        tokenInfoList[0] = { nftTokenId: 11, slotKey: "arcane001001" };
        tokenInfoList[1] = { nftTokenId: 111, slotKey: "arcane001003" };
        await collection.addItem(await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" });
        await collection.addItem(await ad1.getAddress(), { nftTokenId: 111, slotKey: "arcane001002" });
        await expect(collection.returnBatchItem(await ad1.getAddress(), tokenInfoList)).to.be.revertedWith(
          nxErrors.Collection.slotEmpty
        );
      });

      it("reverted case: tokenId - slotKey mismatch, tokenId and slotKey existent)", async () => {
        const { ad1, collection, tokenInfo } = await loadFixture(fixture);
        const tokenInfoList = [tokenInfo, tokenInfo];
        tokenInfoList[0] = { nftTokenId: 111, slotKey: "arcane001001" };
        tokenInfoList[1] = { nftTokenId: 111, slotKey: "arcane001002" };
        await collection.addItem(await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" });
        await collection.addItem(await ad1.getAddress(), { nftTokenId: 111, slotKey: "arcane001002" });
        await expect(collection.returnBatchItem(await ad1.getAddress(), tokenInfoList)).to.be.revertedWith(
          nxErrors.Collection.slotConflict
        );
      });

      it("reverted case: tokenId - slotKey mismatch, complex case", async () => {
        const { ad1, collection, tokenInfo } = await loadFixture(fixture);
        const tokenInfoList = [tokenInfo, tokenInfo];
        tokenInfoList[0] = { nftTokenId: 11, slotKey: "arcane001001" };
        tokenInfoList[1] = { nftTokenId: 111, slotKey: "arcane001002" };
        await collection.addItem(await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" });
        await collection.returnItem(await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" });
        await collection.addItem(await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001002" });
        await expect(collection.returnBatchItem(await ad1.getAddress(), tokenInfoList)).to.be.revertedWith(
          nxErrors.Collection.slotEmpty
        );
      });

      it("reverted case: Already reuturned)", async () => {
        const { ad1, collection, tokenInfo } = await loadFixture(fixture);
        const tokenInfoList = [tokenInfo, tokenInfo];
        tokenInfoList[0] = { nftTokenId: 11, slotKey: "arcane001001" };
        tokenInfoList[1] = { nftTokenId: 11, slotKey: "arcane001001" };
        await collection.addItem(await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" });
        await expect(collection.returnBatchItem(await ad1.getAddress(), tokenInfoList)).to.be.revertedWith(
          nxErrors.Collection.slotEmpty
        );
      });

      it("reverted case: Paused state", async () => {
        const { ad1, collection, tokenInfo } = await loadFixture(fixture);
        const tokenInfoList = [tokenInfo, tokenInfo];
        tokenInfoList[0] = { nftTokenId: 11, slotKey: "arcane001001" };
        tokenInfoList[1] = { nftTokenId: 111, slotKey: "arcane001002" };
        await collection.pause();
        await expect(collection.returnBatchItem(await ad1.getAddress(), tokenInfoList)).to.be.revertedWith(
          nxErrors.paused
        );
      });

      it("reverted case: Zero address", async () => {
        const { collection, tokenInfo } = await loadFixture(fixture);
        const tokenInfoList = [tokenInfo, tokenInfo];
        tokenInfoList[0] = { nftTokenId: 11, slotKey: "arcane001001" };
        tokenInfoList[1] = { nftTokenId: 111, slotKey: "arcane001002" };
        await expect(collection.returnBatchItem(ethers.constants.AddressZero, tokenInfoList)).to.be.revertedWith(
          nxErrors.Collection.validAddress
        );
      });
    });

    describe("returnItem at character", function () {
      it("reverted case: Caller is not owner", async () => {
        const { ad1, ad1CharAddr, collection } = await loadFixture(fixture);
        await expect(
          collection
            .connect(ad1)
            .returnItemByChar(ad1CharAddr, await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" })
        ).to.be.revertedWith(nxErrors.executorForbidden);
      });

      it("reverted case: Wrong itemOwner", async () => {
        const { ad1, ad2CharAddr, collection } = await loadFixture(fixture);
        await collection.addItem(await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" });
        await expect(
          collection.returnItemByChar(ad2CharAddr, await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" })
        ).to.be.revertedWith(nxErrors.MaplestoryCharacter.wrongRequester);
      });

      it("reverted case: Wrong tokenId", async () => {
        const { ad1, ad1CharAddr, collection } = await loadFixture(fixture);
        await collection.addItem(await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" });
        await expect(
          collection.returnItemByChar(ad1CharAddr, await ad1.getAddress(), { nftTokenId: 12, slotKey: "arcane001001" })
        ).to.be.revertedWith(nxErrors.Collection.slotConflict);
      });

      it("reverted case: tokenId - slotKey mismatch, tokenId existent", async () => {
        const { ad1, ad1CharAddr, collection } = await loadFixture(fixture);
        await collection.addItem(await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" });
        await expect(
          collection.returnItemByChar(ad1CharAddr, await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001002" })
        ).to.be.revertedWith(nxErrors.Collection.slotEmpty);
      });

      it("reverted case: tokenId - slotKey mismatch, tokenId and slotKey existent", async () => {
        const { ad1, ad1CharAddr, collection } = await loadFixture(fixture);
        await collection.addItem(await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" });
        await collection.addItem(await ad1.getAddress(), { nftTokenId: 111, slotKey: "arcane001002" });
        await expect(
          collection.returnItemByChar(ad1CharAddr, await ad1.getAddress(), { nftTokenId: 111, slotKey: "arcane001001" })
        ).to.be.revertedWith(nxErrors.Collection.slotConflict);
      });

      it("reverted case: Already returned", async () => {
        const { ad1, ad1CharAddr, collection } = await loadFixture(fixture);
        await collection.addItem(await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" });
        await collection.returnItemByChar(ad1CharAddr, await ad1.getAddress(), {
          nftTokenId: 11,
          slotKey: "arcane001001",
        });
        await expect(
          collection.returnItemByChar(ad1CharAddr, await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" })
        ).to.be.revertedWith(nxErrors.Collection.slotEmpty);
      });

      it("reverted case: Paused state", async () => {
        const { ad1, ad1CharAddr, collection } = await loadFixture(fixture);
        await collection.pause();
        await expect(
          collection.returnItemByChar(ad1CharAddr, await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" })
        ).to.be.revertedWith(nxErrors.paused);
      });

      it("reverted case: Zero address", async () => {
        const { ad1CharAddr, collection } = await loadFixture(fixture);
        await expect(
          collection.returnItemByChar(ad1CharAddr, ethers.constants.AddressZero, {
            nftTokenId: 11,
            slotKey: "arcane001001",
          })
        ).to.be.revertedWith(nxErrors.Collection.validAddress);
      });
    });

    describe("returnBatchItem at character", function () {
      it("reverted case: Caller is not owner", async () => {
        const { ad1, ad1CharAddr, collection, tokenInfo } = await loadFixture(fixture);
        const tokenInfoList = [tokenInfo, tokenInfo];
        tokenInfoList[0] = { nftTokenId: 11, slotKey: "arcane001001" };
        tokenInfoList[1] = { nftTokenId: 111, slotKey: "arcane001002" };
        await expect(
          collection.connect(ad1).returnBatchItemByChar(ad1CharAddr, await ad1.getAddress(), tokenInfoList)
        ).to.be.revertedWith(nxErrors.executorForbidden);
      });

      it("reverted case: Wrong itemOwner", async () => {
        const { ad1, ad2CharAddr, collection, tokenInfo } = await loadFixture(fixture);
        const tokenInfoList = [tokenInfo, tokenInfo];
        tokenInfoList[0] = { nftTokenId: 11, slotKey: "arcane001001" };
        tokenInfoList[1] = { nftTokenId: 111, slotKey: "arcane001002" };
        await collection.addBatchItem(await ad1.getAddress(), tokenInfoList);
        await expect(
          collection.returnBatchItemByChar(ad2CharAddr, await ad1.getAddress(), tokenInfoList)
        ).to.be.revertedWith(nxErrors.MaplestoryCharacter.wrongRequester);
      });

      it("reverted case: Wrong tokenId", async () => {
        const { ad1, ad1CharAddr, collection, tokenInfo } = await loadFixture(fixture);
        const tokenInfoList = [tokenInfo, tokenInfo];
        tokenInfoList[0] = { nftTokenId: 11, slotKey: "arcane001001" };
        tokenInfoList[1] = { nftTokenId: 12, slotKey: "arcane001002" };
        await collection.addItem(await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" });
        await collection.addItem(await ad1.getAddress(), { nftTokenId: 111, slotKey: "arcane001002" });
        await expect(
          collection.returnBatchItemByChar(ad1CharAddr, await ad1.getAddress(), tokenInfoList)
        ).to.be.revertedWith(nxErrors.Collection.slotConflict);
      });

      it("reverted case: tokenId - slotKey mismatch, tokenId existent", async () => {
        const { ad1, ad1CharAddr, collection, tokenInfo } = await loadFixture(fixture);
        const tokenInfoList = [tokenInfo, tokenInfo];
        tokenInfoList[0] = { nftTokenId: 11, slotKey: "arcane001001" };
        tokenInfoList[1] = { nftTokenId: 111, slotKey: "arcane001003" };
        await collection.addItem(await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" });
        await collection.addItem(await ad1.getAddress(), { nftTokenId: 111, slotKey: "arcane001002" });
        await expect(
          collection.returnBatchItemByChar(ad1CharAddr, await ad1.getAddress(), tokenInfoList)
        ).to.be.revertedWith(nxErrors.Collection.slotEmpty);
      });

      it("reverted case: tokenId - slotKey mismatch, tokenId and slotKey existent", async () => {
        const { ad1, ad1CharAddr, collection, tokenInfo } = await loadFixture(fixture);
        const tokenInfoList = [tokenInfo, tokenInfo];
        tokenInfoList[0] = { nftTokenId: 11, slotKey: "arcane001002" };
        tokenInfoList[1] = { nftTokenId: 111, slotKey: "arcane001001" };
        await collection.addItem(await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" });
        await collection.addItem(await ad1.getAddress(), { nftTokenId: 111, slotKey: "arcane001002" });
        await expect(
          collection.returnBatchItemByChar(ad1CharAddr, await ad1.getAddress(), tokenInfoList)
        ).to.be.revertedWith(nxErrors.Collection.slotConflict);
      });

      it("reverted case: Already returned", async () => {
        const { ad1, ad1CharAddr, collection, tokenInfo } = await loadFixture(fixture);
        const tokenInfoList = [tokenInfo, tokenInfo];
        tokenInfoList[0] = { nftTokenId: 11, slotKey: "arcane001001" };
        tokenInfoList[1] = { nftTokenId: 11, slotKey: "arcane001001" };
        await collection.addItem(await ad1.getAddress(), { nftTokenId: 11, slotKey: "arcane001001" });
        await expect(
          collection.returnBatchItemByChar(ad1CharAddr, await ad1.getAddress(), tokenInfoList)
        ).to.be.revertedWith(nxErrors.Collection.slotEmpty);
      });

      it("reverted case: Paused state", async () => {
        const { ad1, ad1CharAddr, collection, tokenInfo } = await loadFixture(fixture);
        const tokenInfoList = [tokenInfo, tokenInfo];
        tokenInfoList[0] = { nftTokenId: 11, slotKey: "arcane001001" };
        tokenInfoList[1] = { nftTokenId: 111, slotKey: "arcane001002" };
        await collection.pause();
        await expect(
          collection.returnBatchItemByChar(ad1CharAddr, await ad1.getAddress(), tokenInfoList)
        ).to.be.revertedWith(nxErrors.paused);
      });

      it("reverted case: Zero address", async () => {
        const { ad1CharAddr, collection, tokenInfo } = await loadFixture(fixture);
        const tokenInfoList = [tokenInfo, tokenInfo];
        tokenInfoList[0] = { nftTokenId: 11, slotKey: "arcane001001" };
        tokenInfoList[1] = { nftTokenId: 111, slotKey: "arcane001002" };
        await expect(
          collection.returnBatchItemByChar(ad1CharAddr, ethers.constants.AddressZero, tokenInfoList)
        ).to.be.revertedWith(nxErrors.Collection.validAddress);
      });
    });
  });

  describe("Withdraw", () => {
    async function withdrawFixture() {
      const f = await loadFixture(fixture);

      const tv = {
        t20Amount: ethers.BigNumber.from(1_000_000n),
        t721ItemId01: 0x10,
        t721ItemId02: 0x11,
        t721ItemId03: 0x20,
        t721TokenId01: 9,
        t721TokenId02: 99,
        t721TokenId03: 999,
      };

      const ERC20 = await ethers.getContractFactory("NextMeso");
      const erc20 = await ERC20.deploy(ethers.constants.AddressZero, f.approveController.address, 100_000);

      // Deploy another ERC721 Contract
      const ERC721 = await ethers.getContractFactory("MaplestoryEquip");
      const erc721 = await ERC721.deploy(ethers.constants.AddressZero, f.approveController.address, fakeAddress, "");
      await erc721.deployed();

      await erc721.grantExecutor(await f.executor.getAddress());
      await erc721.setLimitSupply(tv.t721ItemId03, "0xffffffffffffffff", false);
      await erc721.approveOperator(f.collection.address);
      await erc721.approveOperator(f.character.address);

      // Mint ERC20
      await erc20.connect(f.ad1).deposit({ value: 1000 });
      await erc20.connect(f.ad1).transfer(f.collection.address, tv.t20Amount);

      // Mint ERC721
      await f.equip.mintBatch(f.ad1.address, [
        { itemId: tv.t721ItemId01, tokenId: tv.t721TokenId01 },
        { itemId: tv.t721ItemId02, tokenId: tv.t721TokenId02 },
      ]);
      await erc721.mintBatch(f.ad1.address, [{ itemId: tv.t721ItemId03, tokenId: tv.t721TokenId03 }]);

      await f.equip.connect(f.ad1).transferFrom(f.ad1.address, f.collection.address, tv.t721TokenId01);
      await f.equip.connect(f.ad1).transferFrom(f.ad1.address, f.collection.address, tv.t721TokenId02);
      await erc721.connect(f.ad1).transferFrom(f.ad1.address, f.collection.address, tv.t721TokenId03);

      // Settings
      f.collection = f.collection.connect(f.owner);

      return { ...f, erc721, tv, erc20 };
    }

    describe("success", () => {
      it("withdraw erc20", async () => {
        const { ad1, ad2, erc20, collection, tv } = await loadFixture(withdrawFixture);
        const ad1Erc20Bal = await erc20.balanceOf(await ad1.getAddress());
        const ad2Erc20Bal = await erc20.balanceOf(await ad2.getAddress());

        await expect(
          collection.withdrawERC20(
            erc20.address,
            [await ad1.getAddress(), await ad2.getAddress()],
            [tv.t20Amount.div(10), tv.t20Amount.div(10)]
          )
        ).not.to.be.reverted;
        expect(await erc20.balanceOf(await ad1.getAddress())).to.be.equal(ad1Erc20Bal.add(tv.t20Amount.div(10)));
        expect(await erc20.balanceOf(await ad2.getAddress())).to.be.equal(ad2Erc20Bal.add(tv.t20Amount.div(10)));
      });
      it("withdraw erc721", async () => {
        const { ad1, erc721, collection, tv } = await loadFixture(withdrawFixture);
        await expect(collection.withdrawERC721(erc721.address, [await ad1.getAddress()], [tv.t721TokenId03])).not.to.be
          .reverted;
        expect(await erc721.ownerOf(tv.t721TokenId03)).to.be.equal(await ad1.getAddress());
      });
    });
    describe("failure", () => {
      describe("erc20", () => {
        it("input length mismatch", async () => {
          const { ad1, ad2, erc20, collection, tv } = await loadFixture(withdrawFixture);
          await expect(
            collection.withdrawERC20(
              erc20.address,
              [await ad1.getAddress(), await ad2.getAddress()],
              [tv.t20Amount.div(10)]
            )
          ).to.be.revertedWith(nxErrors.Collection.mismatch);
        });
        it("called by not owner", async () => {
          const { ad1, ad2, erc20, collection, tv } = await loadFixture(withdrawFixture);
          await expect(
            collection
              .connect(ad1)
              .withdrawERC20(
                erc20.address,
                [await ad1.getAddress(), await ad2.getAddress()],
                [tv.t20Amount.div(10), tv.t20Amount.div(10)]
              )
          ).to.be.revertedWith(nxErrors.ownerForbidden);
        });
      });
      describe("erc721", () => {
        it("input length mismatch", async () => {
          const { ad1, ad2, equip, collection, tv } = await loadFixture(withdrawFixture);
          await expect(
            collection.withdrawERC721(
              equip.address,
              [await ad1.getAddress(), await ad2.getAddress()],
              [tv.t721TokenId01]
            )
          ).to.be.revertedWith(nxErrors.Collection.mismatch);
        });
        it("called by not owner", async () => {
          const { ad1, ad2, equip, collection, tv } = await loadFixture(withdrawFixture);
          await expect(
            collection
              .connect(ad1)
              .withdrawERC721(
                equip.address,
                [await ad1.getAddress(), await ad2.getAddress()],
                [tv.t721TokenId01, tv.t721TokenId02]
              )
          ).to.be.revertedWith(nxErrors.ownerForbidden);
        });
      });
    });
    describe("clearSlot", () => {
      it("success", async () => {
        const { ad1, collection } = await loadFixture(withdrawFixture);
        const account = await ad1.getAddress();
        const slotKey = "arcane001001";
        await expect(collection.addItem(account, { nftTokenId: 11, slotKey: slotKey }))
          .to.emit(collection, "ItemAdded")
          .withArgs(await ad1.getAddress(), 0x10, 11, slotKey);
        expect((await collection.slotInfo(account, slotKey)).valid).is.true;
        await expect(collection.clearSlot(await ad1.getAddress(), "arcane001001")).not.to.be.reverted;
        expect((await collection.slotInfo(account, slotKey)).valid).is.false;
      });
      it("called by not owner", async () => {
        const { ad1, collection } = await loadFixture(withdrawFixture);
        const account = await ad1.getAddress();
        const slotKey = "arcane001001";
        await expect(collection.addItem(account, { nftTokenId: 11, slotKey: slotKey }))
          .to.emit(collection, "ItemAdded")
          .withArgs(await ad1.getAddress(), 0x10, 11, slotKey);
        expect((await collection.slotInfo(account, slotKey)).valid).is.true;
        await expect(collection.connect(ad1).clearSlot(account, slotKey)).to.be.revertedWith(nxErrors.ownerForbidden);
      });
      it("already empty slot", async () => {
        const { ad1, collection } = await loadFixture(withdrawFixture);
        await expect(collection.clearSlot(await ad1.getAddress(), "arcane001001")).to.be.revertedWith(
          nxErrors.Collection.slotEmpty
        );
      });
    });

    describe("fake coverage", () => {
      it("fake", async () => {
        const { collection } = await loadFixture(withdrawFixture);

        collection.fake();
      });
    });
  });
});
