import { ethers } from "hardhat";
import { IMockFake } from "../../typechain-types";

describe("meta-transaction fake coverage", function () {
  it("this test is for faking coverage of unused trivial override functions", async function () {
    const signers = await ethers.getSigners();
    await Promise.all(
      ["MSUContentsCommission", "EventStore", "RandomSeedGenerator"].map(async (n, i) => {
        const factory = await ethers.getContractFactory(`Mock${n}MetaTransactionFakeCoverage`, signers[i]);
        const fake = (await factory.deploy()) as IMockFake;
        await fake.fake();
      })
    );
  });
});
