import BN from "bn.js";
import { keccak256 as solidityKeccak256 } from "@ethersproject/solidity";
export declare function arrayifyHex64Unchecked(hex: string): number[];
export declare function hexToBN(hex: string): BN;
export declare function solidityKeccak256ToBN(types: ReadonlyArray<string>, values: ReadonlyArray<any>): BN;
export { solidityKeccak256 };
