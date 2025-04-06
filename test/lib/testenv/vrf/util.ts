import { BigNumberish } from "ethers";
import { solidityKeccak256 } from "ethers/lib/utils";
import { RandomWordsFulfilledEvent } from "../../../../typechain-types/@chainlink/contracts/src/v0.8/dev/vrf/VRFCoordinatorV2_5";

export function calcSeed(baseSeed: BigNumberish, index: BigNumberish) {
  return BigInt(solidityKeccak256(["uint256", "uint256"], [baseSeed, index]));
}

export function calcRequestId(blockNumber: BigNumberish, index: BigNumberish) {
  return BigInt(solidityKeccak256(["uint64", "uint256"], [blockNumber, index]));
}

export function firstRandomWord(fulfillEvent: RandomWordsFulfilledEvent) {
  return calcSeed(fulfillEvent.args.outputSeed.toBigInt(), 0n);
}

export function calcRandomWords(seed: BigNumberish, numWords: number) {
  const t = ["uint256", "uint256"];
  const v = [seed, 0n];
  // noinspection CommaExpressionJS
  return [...Array(numWords).keys()].map(
    // eslint-disable-next-line no-sequences
    (i) => ((v[1] = i), BigInt(solidityKeccak256(t, v)))
  );
}
