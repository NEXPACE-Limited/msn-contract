export declare type Scalar = number[];
export declare type Point = [Scalar, Scalar];
export interface Proof {
    pk: Point;
    gamma: Point;
    c: Scalar;
    s: Scalar;
    seed: bigint;
    uWitness: string;
    cGammaWitness: Point;
    sHashWitness: Point;
    zInv: Scalar;
}
