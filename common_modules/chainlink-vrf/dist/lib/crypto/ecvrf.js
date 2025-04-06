"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ECVRF {
    // eslint-disable-next-line no-useless-constructor
    constructor(ec, hashToCurve, // {0,1}* -> G - {identity}
    outputHash, // E -> {0,1}^2l
    scalarFromCurvePoints // {0,1}* -> {0,1}^l
    ) {
        this.ec = ec;
        this.hashToCurve = hashToCurve;
        this.outputHash = outputHash;
        this.scalarFromCurvePoints = scalarFromCurvePoints;
    }
    async prove(sk, input) {
        const proof = await this.proveRaw(sk, input);
        return {
            gamma: proof.gamma,
            c: proof.c,
            s: proof.s,
        };
    }
    async proveRaw(sk, input) {
        const { ec } = this;
        const pk = ec.keyFromPrivate(sk.toBuffer()).getPublic();
        const h = await this.hashToCurve(pk, input);
        const k = ec.genKeyPair().getPrivate();
        const gamma = h.mul(sk);
        const c = await this.scalarFromCurvePoints(ec.g, h, pk, gamma, ec.g.mul(k), h.mul(k));
        const s = k.sub(c.mul(sk).umod(ec.n)).umod(ec.n);
        return { pk, h, gamma, c, s };
    }
    async compute({ gamma }) {
        return this.outputHash(gamma);
    }
    async verify(pk, input, proof) {
        return !!(await this.verifyRaw(pk, input, proof));
    }
    async verifyRaw(pk, input, { gamma, c, s }) {
        const { ec } = this;
        const g = ec.g;
        if (!gamma.validate())
            return null;
        const h = await this.hashToCurve(pk, input);
        const u = pk.mul(c).add(g.mul(s));
        const v = gamma.mul(c).add(h.mul(s));
        if (u.isInfinity() || v.isInfinity())
            return null;
        if (!c.eq(await this.scalarFromCurvePoints(g, h, pk, gamma, u, v)))
            return null;
        return { h, u, v };
    }
}
exports.default = ECVRF;
