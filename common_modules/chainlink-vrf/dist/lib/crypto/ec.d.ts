import BN from "bn.js";
import { curve, ec as EC } from "elliptic";
import { BasePoint } from "./types";
declare type SECP256K1 = Omit<EC, "curve"> & {
    n: BN;
    curve: curve.short;
};
declare const ec: SECP256K1;
export declare function pointFromXUnchecked(x: BN, parity: number): BasePoint;
export { BasePoint, EC, ec };
