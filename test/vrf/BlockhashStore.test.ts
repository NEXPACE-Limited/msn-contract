import { expect } from "chai";
import { ethers } from "hardhat";
import type { providers } from "ethers";
import EvmProvider from "../lib/evm-provider";
import type { MockBlockhashStore } from "../../typechain-types";

describe("BlockhashStore", () => {
  const provider = ethers.provider;
  let store: MockBlockhashStore;

  before(async () => {
    const BlockhashStore = await ethers.getContractFactory("MockBlockhashStore");
    store = await BlockhashStore.deploy();
    await store.deployed();
  });

  async function testBlock(block: providers.Block) {
    expect(await store.getBlockhash(block.number, { blockTag: "pending" }), "block hash").to.eq(block.hash);
  }

  async function testBlockNumber(number: bigint | number) {
    await testBlock(await provider.getBlock(Number(number)));
  }

  describe("getBlockhash", () => {
    before(async () => {
      const evmProvider = new EvmProvider(provider);
      await evmProvider.mine();
      await evmProvider.mine();
      await evmProvider.mine();
    });

    it("should report block hash for a recent block", async () => testBlockNumber(provider.blockNumber - 2));
    it("should report block hash for the latest", async () => testBlock(await provider.getBlock("latest")));
  });
});
