"use strict";
// noinspection JSSuspiciousNameCombination
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashOfKey = exports.outputHash = exports.scalarFromCurvePoints = exports.hashToCurve = exports.newCandidateSecp256k1Point = exports.fieldHash = exports.projectiveECAdd = exports.projectiveIMul = exports.projectiveMul = exports.projectiveISub = exports.projectiveSub = exports.VRF_RANDOM_OUTPUT_HASH_PREFIX = exports.SCALAR_FROM_CURVE_POINTS_HASH_PREFIX = exports.HASH_TO_CURVE_HASH_PREFIX = void 0;
const bn_js_1 = __importDefault(require("bn.js"));
const solidity_1 = require("@ethersproject/solidity");
const utils_1 = require("../../utils");
const ec_1 = require("../../crypto/ec");
exports.HASH_TO_CURVE_HASH_PREFIX = 1n;
exports.SCALAR_FROM_CURVE_POINTS_HASH_PREFIX = 2n;
exports.VRF_RANDOM_OUTPUT_HASH_PREFIX = 3n;
const bn1 = new bn_js_1.default(1).toRed(ec_1.ec.curve.red);
// Returns x1/z1-x2/z2=(x1z2-x2z1)/(z1z2) in projective coordinates on P¹(𝔽ₙ)
function projectiveSub(x1, z1, x2, z2) {
    return [x1.redMul(z2).redISub(z1.redMul(x2)), z1.redMul(z2)];
}
exports.projectiveSub = projectiveSub;
function projectiveISub(x1, z1, x2, z2) {
    return [x1.redIMul(z2).redISub(z1.redMul(x2)), z1.redIMul(z2)];
}
exports.projectiveISub = projectiveISub;
// Returns x1/z1*x2/z2=(x1x2)/(z1z2), in projective coordinates on P¹(𝔽ₙ)
function projectiveMul(x1, z1, x2, z2) {
    return [x1.redMul(x2), z1.redMul(z2)];
}
exports.projectiveMul = projectiveMul;
function projectiveIMul(x1, z1, x2, z2) {
    return [x1.redIMul(x2), z1.redIMul(z2)];
}
exports.projectiveIMul = projectiveIMul;
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
function projectiveECAdd(px, py, qx, qy) {
    let sx, sy, sz;
    // See "Group law for E/K : y^2 = x^3 + ax + b", in section 3.1.2, p. 80,
    // "Guide to Elliptic Curve Cryptography" by Hankerson, Menezes and Vanstone
    // We take the equations there for (sx,sy), and homogenize them to
    // projective coordinates. That way, no inverses are required, here, and we
    // only need the one inverse in affineECAdd.
    // We only need the "point addition" equations from Hankerson et al. Can
    // skip the "point doubling" equations because p1 == p2 is cryptographically
    // impossible, and required not to be the case in linearCombination.
    // Add extra "projective coordinate" to the two points
    const z1 = bn1;
    const z2 = bn1;
    // (lx, lz) = (qy-py)/(qx-px), i.e., gradient of secant line.
    // Cannot wrap since px and py are in [0, FIELD_SIZE-1]
    const lx = qy.redSub(py);
    const lz = qx.redSub(px);
    let dx; // Accumulates denominator from sx calculation
    // sx=((qy-py)/(qx-px))^2-px-qx
    [sx, dx] = projectiveMul(lx, lz, lx, lz); // ((qy-py)/(qx-px))^2
    [sx, dx] = projectiveISub(sx, dx, px, z1); // ((qy-py)/(qx-px))^2-px
    [sx, dx] = projectiveISub(sx, dx, qx, z2); // ((qy-py)/(qx-px))^2-px-qx
    let dy; // Accumulates denominator from sy calculation
    // sy=((qy-py)/(qx-px))(px-sx)-py
    [sy, dy] = projectiveSub(px, z1, sx, dx); // px-sx
    [sy, dy] = projectiveIMul(sy, dy, lx, lz); // ((qy-py)/(qx-px))(px-sx)
    [sy, dy] = projectiveISub(sy, dy, py, z1); // ((qy-py)/(qx-px))(px-sx)-py
    if (!dx.eq(dy)) {
        // Cross-multiply to put everything over a common denominator
        sx = sx.redIMul(dy);
        sy = sy.redIMul(dx);
        sz = dx.redIMul(dy);
    }
    else {
        // Already over a common denominator, use that for z ordinate
        sz = dx;
    }
    return [sx, sy, sz];
}
exports.projectiveECAdd = projectiveECAdd;
function fieldHash(b) {
    let x = (0, utils_1.solidityKeccak256ToBN)(["bytes"], [b]);
    while (x.gte(ec_1.ec.n))
        x = (0, utils_1.solidityKeccak256ToBN)(["uint256"], [x]);
    return x;
}
exports.fieldHash = fieldHash;
function newCandidateSecp256k1Point(b) {
    const x = fieldHash(b);
    return (0, ec_1.pointFromXUnchecked)(x, 0);
}
exports.newCandidateSecp256k1Point = newCandidateSecp256k1Point;
function hashToCurve(pk, input) {
    let rv = newCandidateSecp256k1Point((0, solidity_1.pack)(["uint256", "uint256", "uint256", "uint256"], [exports.HASH_TO_CURVE_HASH_PREFIX, pk.getX().toArray("be", 32), pk.getY().toArray("be", 32), input.toArray("be", 32)]));
    while (!rv.validate())
        rv = newCandidateSecp256k1Point((0, solidity_1.pack)(["uint256"], [rv.getX().toArray("be", 32)]));
    return rv;
}
exports.hashToCurve = hashToCurve;
function scalarFromCurvePoints(hash, pk, gamma, uWitness, v) {
    return (0, utils_1.solidityKeccak256ToBN)(["uint256", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256", "address"], [
        exports.SCALAR_FROM_CURVE_POINTS_HASH_PREFIX,
        hash.getX().toArray("be", 32),
        hash.getY().toArray("be", 32),
        pk.getX().toArray("be", 32),
        pk.getY().toArray("be", 32),
        gamma.getX().toArray("be", 32),
        gamma.getY().toArray("be", 32),
        v.getX().toArray("be", 32),
        v.getY().toArray("be", 32),
        uWitness,
    ]);
}
exports.scalarFromCurvePoints = scalarFromCurvePoints;
function outputHash(p) {
    return (0, utils_1.solidityKeccak256)(["uint256", "uint256", "uint256"], [exports.VRF_RANDOM_OUTPUT_HASH_PREFIX, p.getX().toArray("be", 32), p.getY().toArray("be", 32)]);
}
exports.outputHash = outputHash;
function hashOfKey(pk) {
    return (0, utils_1.solidityKeccak256)(["uint256", "uint256"], [pk.getX().toArray("be", 32), pk.getY().toArray("be", 32)]);
}
exports.hashOfKey = hashOfKey;
