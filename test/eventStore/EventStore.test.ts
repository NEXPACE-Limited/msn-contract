import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import nxErrors from "../lib/nx-errors";

function toBytes32(value: string) {
  return "0x" + value.substring(2).padStart(64, "0");
}

describe("EventStore", function () {
  async function fixture() {
    const [owner, user] = await ethers.getSigners();

    const Summary = (await ethers.getContractFactory("EventStore")).connect(owner);

    const summary = await Summary.deploy(ethers.constants.AddressZero);

    return {
      summary,
      user,
    };
  }

  describe("store event", function () {
    it("success", async () => {
      const { summary } = await loadFixture(fixture);
      await expect(summary.storeEvent({ domainId: 1, eventHash: toBytes32("0x10") }))
        .to.emit(summary, "EventStored")
        .withArgs(1, toBytes32("0x10"));
    });
    it("fail - not owner", async () => {
      const { summary, user } = await loadFixture(fixture);
      await expect(summary.connect(user).storeEvent({ domainId: 1, eventHash: toBytes32("0x10") })).to.be.revertedWith(
        nxErrors.executorForbidden
      );
    });
  });
  describe("store batch events", function () {
    it("success", async () => {
      const { summary } = await loadFixture(fixture);
      await expect(
        summary.storeEventBatch([
          {
            domainId: 1,
            eventHash: toBytes32("0x10"),
          },
        ])
      )
        .to.emit(summary, "EventStored")
        .withArgs(1, toBytes32("0x10"));
      await expect(
        summary.storeEventBatch([
          { domainId: 1, eventHash: toBytes32("0x10") },
          { domainId: 2, eventHash: toBytes32("0x20") },
        ])
      )
        .to.emit(summary, "EventStored")
        .withArgs(1, toBytes32("0x10"))
        .to.emit(summary, "EventStored")
        .withArgs(2, toBytes32("0x20"));
      await expect(
        summary.storeEventBatch([
          { domainId: 1, eventHash: toBytes32("0x10") },
          { domainId: 2, eventHash: toBytes32("0x20") },
          { domainId: 5, eventHash: toBytes32("0x500") },
        ])
      )
        .to.emit(summary, "EventStored")
        .withArgs(1, toBytes32("0x10"))
        .to.emit(summary, "EventStored")
        .withArgs(2, toBytes32("0x20"))
        .to.emit(summary, "EventStored")
        .withArgs(5, toBytes32("0x500"));
    });
    it("fail - not owner", async () => {
      const { summary, user } = await loadFixture(fixture);
      await expect(
        summary.connect(user).storeEventBatch([{ domainId: 1, eventHash: toBytes32("0x10") }])
      ).to.be.revertedWith(nxErrors.executorForbidden);
      await expect(
        summary.connect(user).storeEventBatch([
          { domainId: 1, eventHash: toBytes32("0x10") },
          { domainId: 2, eventHash: toBytes32("0x20") },
        ])
      ).to.be.revertedWith(nxErrors.executorForbidden);
      await expect(
        summary.connect(user).storeEventBatch([
          { domainId: 1, eventHash: toBytes32("0x10") },
          { domainId: 2, eventHash: toBytes32("0x20") },
          { domainId: 5, eventHash: toBytes32("0x500") },
        ])
      ).to.be.revertedWith(nxErrors.executorForbidden);
    });
  });
});
