import BN from "bn.js";
import { BasePoint, EC } from "./types";
export interface Proof {
    gamma: BasePoint;
    c: BN;
    s: BN;
}
export interface RawProof {
    pk: BasePoint;
    h: BasePoint;
    gamma: BasePoint;
    c: BN;
    s: BN;
}
export interface RawVerification {
    h: BasePoint;
    u: BasePoint;
    v: BasePoint;
}
declare type Awaitable<T> = T | Promise<T>;
export default class ECVRF<Input = BN, Output = BN> {
    readonly ec: EC;
    readonly hashToCurve: (pk: BasePoint, x: Input) => Awaitable<BasePoint>;
    readonly outputHash: (p: BasePoint) => Awaitable<Output>;
    readonly scalarFromCurvePoints: (...pts: [BasePoint, BasePoint, BasePoint, BasePoint, BasePoint, BasePoint]) => Awaitable<BN>;
    constructor(ec: EC, hashToCurve: (pk: BasePoint, x: Input) => Awaitable<BasePoint>, // {0,1}* -> G - {identity}
    outputHash: (p: BasePoint) => Awaitable<Output>, // E -> {0,1}^2l
    scalarFromCurvePoints: (...pts: [BasePoint, BasePoint, BasePoint, BasePoint, BasePoint, BasePoint]) => Awaitable<BN>);
    prove(sk: BN, input: Input): Promise<Proof>;
    proveRaw(sk: BN, input: Input): Promise<RawProof>;
    compute({ gamma }: {
        gamma: BasePoint;
    }): Promise<Output>;
    verify(pk: BasePoint, input: Input, proof: Proof): Promise<boolean>;
    verifyRaw(pk: BasePoint, input: Input, { gamma, c, s }: Proof): Promise<RawVerification | null>;
}
export {};
