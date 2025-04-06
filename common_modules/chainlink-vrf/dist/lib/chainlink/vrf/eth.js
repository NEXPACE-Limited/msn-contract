"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pointToAddress = void 0;
const address_1 = require("@ethersproject/address");
const utils_1 = require("../../utils");
function pointToAddress(p) {
    return (0, address_1.getAddress)((0, utils_1.solidityKeccak256)(["uint256", "uint256"], [p.getX().toArray("be", 32), p.getY().toArray("be", 32)]).substring(26));
}
exports.pointToAddress = pointToAddress;
