"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.solidityKeccak256 = exports.solidityKeccak256ToBN = exports.hexToBN = exports.arrayifyHex64Unchecked = void 0;
const bn_js_1 = __importDefault(require("bn.js"));
const solidity_1 = require("@ethersproject/solidity");
Object.defineProperty(exports, "solidityKeccak256", { enumerable: true, get: function () { return solidity_1.keccak256; } });
function arrayifyHex64Unchecked(hex) {
    if (!hex.startsWith("0x"))
        throw new Error(`invalid hex string: ${hex}`);
    if (hex.length !== 66)
        throw new Error(`invalid hex64 length: ${hex}`);
    return [...Array(32).keys()].map((i) => Number.parseInt(hex.substring(i * 2 + 2, i * 2 + 4), 16));
}
exports.arrayifyHex64Unchecked = arrayifyHex64Unchecked;
function hexToBN(hex) {
    return new bn_js_1.default(arrayifyHex64Unchecked(hex));
}
exports.hexToBN = hexToBN;
function solidityKeccak256ToBN(types, values) {
    return hexToBN((0, solidity_1.keccak256)(types, values));
}
exports.solidityKeccak256ToBN = solidityKeccak256ToBN;
