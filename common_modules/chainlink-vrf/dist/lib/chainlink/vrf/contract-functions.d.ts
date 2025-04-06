import BN from "bn.js";
import { BasePoint } from "../../crypto/ec";
declare type BytesLike = ArrayLike<number> | string;
export declare const HASH_TO_CURVE_HASH_PREFIX = 1n;
export declare const SCALAR_FROM_CURVE_POINTS_HASH_PREFIX = 2n;
export declare const VRF_RANDOM_OUTPUT_HASH_PREFIX = 3n;
declare type RedBN = ReturnType<BN["toRed"]>;
export declare function projectiveSub(x1: RedBN, z1: RedBN, x2: RedBN, z2: RedBN): [RedBN, RedBN];
export declare function projectiveISub(x1: RedBN, z1: RedBN, x2: RedBN, z2: RedBN): [RedBN, RedBN];
export declare function projectiveMul(x1: RedBN, z1: RedBN, x2: RedBN, z2: RedBN): [RedBN, RedBN];
export declare function projectiveIMul(x1: RedBN, z1: RedBN, x2: RedBN, z2: RedBN): [RedBN, RedBN];
/** **************************************************************************
 @notice Computes elliptic-curve sum, in projective co-ordinates
 @dev Using projective coordinates avoids costly divisions
 @dev To use this with p and q in affine coordinates, call
 @dev projectiveECAdd(px, py, qx, qy). This will return
 @dev the addition of (px, py, 1) and (qx, qy, 1), in the
 @dev secp256k1 group.
 @dev This can be used to calculate the z which is the inverse to zInv
 @dev in isValidVRFOutput. But consider using a faster
 @dev re-implementation such as ProjectiveECAdd in the golang vrf package.
 @dev This function assumes [px,py,1],[qx,qy,1] are valid projective
 coordinates of secp256k1 points. That is safe in this contract,
 because this method is only used by linearCombination, which checks
 points are on the curve via ecrecover.
 **************************************************************************
 @param px The first affine coordinate of the first summand
 @param py The second affine coordinate of the first summand
 @param qx The first affine coordinate of the second summand
 @param qy The second affine coordinate of the second summand
 (px,py) and (qx,qy) must be distinct, valid secp256k1 points.
 **************************************************************************
 Return values are projective coordinates of [px,py,1]+[qx,qy,1] as points
 on secp256k1, in P²(𝔽ₙ)
 @return sx
 @return sy
 @return sz
 */
export declare function projectiveECAdd(px: RedBN, py: RedBN, qx: RedBN, qy: RedBN): [RedBN, RedBN, RedBN];
export declare function fieldHash(b: BytesLike): BN;
export declare function newCandidateSecp256k1Point(b: BytesLike): import("elliptic").curve.base.BasePoint;
export declare function hashToCurve(pk: BasePoint, input: BN): import("elliptic").curve.base.BasePoint;
export declare function scalarFromCurvePoints(hash: BasePoint, pk: BasePoint, gamma: BasePoint, uWitness: string, v: BasePoint): BN;
export declare function outputHash(p: BasePoint): string;
export declare function hashOfKey(pk: BasePoint): string;
export {};
