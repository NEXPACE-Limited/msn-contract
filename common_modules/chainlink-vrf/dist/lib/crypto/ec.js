"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ec = exports.EC = exports.pointFromXUnchecked = void 0;
const bn_js_1 = __importDefault(require("bn.js"));
const elliptic_1 = require("elliptic");
Object.defineProperty(exports, "EC", { enumerable: true, get: function () { return elliptic_1.ec; } });
const ec = new elliptic_1.ec("secp256k1");
exports.ec = ec;
const a = new bn_js_1.default("0").toRed(ec.curve.red);
const b = new bn_js_1.default("7").toRed(ec.curve.red);
function pointFromXUnchecked(x, parity) {
    const xr = x.toRed(ec.curve.red);
    const sqry = xr.redSqr().redIMul(xr).redIAdd(xr.redMul(a)).redIAdd(b);
    const y = sqry.redPow(ec.curve.p.addn(1).iushrn(2));
    return ec.curve.point(x, y.testn(0) !== !!(parity & 1) ? y.redNeg() : y);
}
exports.pointFromXUnchecked = pointFromXUnchecked;
