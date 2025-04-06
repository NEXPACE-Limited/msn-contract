"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.outputHashFromProof = exports.verifyDirect = exports.verify = exports.convertProof = exports.computeSeed = exports.proveDirect = exports.prove = exports.calcZInv = exports.ecvrf = exports.scalarFromCurvePoints = exports.hashOfKey = exports.outputHash = exports.hashToCurve = void 0;
const bn_js_1 = __importDefault(require("bn.js"));
const utils_1 = require("../../utils");
const ec_1 = require("../../crypto/ec");
const ecvrf_1 = __importDefault(require("../../crypto/ecvrf"));
const eth_1 = require("./eth");
const contract_functions_1 = require("./contract-functions");
Object.defineProperty(exports, "hashOfKey", { enumerable: true, get: function () { return contract_functions_1.hashOfKey; } });
Object.defineProperty(exports, "hashToCurve", { enumerable: true, get: function () { return contract_functions_1.hashToCurve; } });
Object.defineProperty(exports, "outputHash", { enumerable: true, get: function () { return contract_functions_1.outputHash; } });
function scalarFromCurvePoints(g, h, gx, hx, gk, hk) {
    return (0, contract_functions_1.scalarFromCurvePoints)(h, gx, hx, (0, eth_1.pointToAddress)(gk), hk);
}
exports.scalarFromCurvePoints = scalarFromCurvePoints;
exports.ecvrf = new ecvrf_1.default(ec_1.ec, contract_functions_1.hashToCurve, contract_functions_1.outputHash, scalarFromCurvePoints);
function calcZRed(p, q) {
    return (0, contract_functions_1.projectiveECAdd)(p.getX().toRed(ec_1.ec.curve.red), p.getY().toRed(ec_1.ec.curve.red), q.getX().toRed(ec_1.ec.curve.red), q.getY().toRed(ec_1.ec.curve.red))[2];
}
function calcZInv(p, q) {
    return calcZRed(p, q).redInvm().fromRed();
}
exports.calcZInv = calcZInv;
function se(p) {
    return [p.getX().toArray("be", 32), p.getY().toArray("be", 32)];
}
async function prove(sk, preSeed, blockhash) {
    const seed = computeSeed(preSeed, blockhash);
    const rawProof = await exports.ecvrf.proveRaw(sk, seed);
    const rawVerification = (await exports.ecvrf.verifyRaw(rawProof.pk, seed, rawProof));
    return convertProof(rawProof, rawVerification, preSeed);
}
exports.prove = prove;
async function proveDirect(sk, seed) {
    const rawProof = await exports.ecvrf.proveRaw(sk, seed);
    const rawVerification = (await exports.ecvrf.verifyRaw(rawProof.pk, seed, rawProof));
    return convertProof(rawProof, rawVerification, BigInt("0x" + seed.toString("hex")));
}
exports.proveDirect = proveDirect;
function computeSeed(preSeed, blockhash) {
    return (0, utils_1.solidityKeccak256ToBN)(["uint256", "bytes32"], [preSeed, blockhash]);
}
exports.computeSeed = computeSeed;
function convertProof(rawProof, rawVerification, seed) {
    const { pk, h, gamma, c, s } = rawProof;
    const { u } = rawVerification;
    const cGamma = gamma.mul(c);
    const sHash = h.mul(s);
    return {
        pk: se(pk),
        gamma: se(gamma),
        c: c.toArray("be", 32),
        s: s.toArray("be", 32),
        seed,
        uWitness: (0, eth_1.pointToAddress)(u),
        cGammaWitness: se(cGamma),
        sHashWitness: se(sHash),
        zInv: calcZInv(cGamma, sHash).toArray("be", 32),
    };
}
exports.convertProof = convertProof;
function de(p) {
    return ec_1.ec.curve.point(p[0], p[1]);
}
async function verify(pk, preSeed, blockhash, proof) {
    if (typeof preSeed === "bigint" && proof.seed !== preSeed)
        return false;
    const seed = computeSeed(proof.seed, blockhash);
    return verifyInternal(pk, seed, proof);
}
exports.verify = verify;
async function verifyDirect(pk, seed, proof) {
    {
        const seedDerived = new bn_js_1.default(proof.seed.toString(16), "hex");
        if (bn_js_1.default.isBN(seed) && !seedDerived.eq(seed))
            return false;
        seed = seedDerived;
    }
    return verifyInternal(pk, seed, proof);
}
exports.verifyDirect = verifyDirect;
async function verifyInternal(pk, seed, proof) {
    {
        const pkDerived = de(proof.pk);
        if (pk && !pkDerived.eq(pk))
            return false;
        pk = pkDerived;
    }
    const gamma = de(proof.gamma);
    const c = new bn_js_1.default(proof.c, "be");
    const s = new bn_js_1.default(proof.s, "be");
    const verifyResult = await exports.ecvrf.verifyRaw(pk, seed, { gamma, c, s });
    if (!verifyResult)
        return false;
    const { h, u } = verifyResult;
    if ((0, eth_1.pointToAddress)(u) !== proof.uWitness)
        return false;
    const cGamma = gamma.mul(c);
    const sHash = h.mul(s);
    return (cGamma.eq(de(proof.cGammaWitness)) &&
        sHash.eq(de(proof.sHashWitness)) &&
        calcZRed(cGamma, sHash).redIMul(new bn_js_1.default(proof.zInv, "be").toRed(ec_1.ec.curve.red)).eqn(1));
}
async function outputHashFromProof(proof) {
    return (0, contract_functions_1.outputHash)(de(proof.gamma));
}
exports.outputHashFromProof = outputHashFromProof;
