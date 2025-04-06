import { ethers } from "ethers";

export default class EvmProvider {
  // eslint-disable-next-line no-useless-constructor
  constructor(private backend: ethers.providers.JsonRpcProvider) {}

  async setAutomine(value: boolean): Promise<void> {
    // noinspection ES6MissingAwait
    return this.backend.send("evm_setAutomine", [value]);
  }

  async mine(): Promise<"0x0"> {
    // noinspection ES6MissingAwait
    return this.backend.send("evm_mine", [...arguments]);
  }
}
