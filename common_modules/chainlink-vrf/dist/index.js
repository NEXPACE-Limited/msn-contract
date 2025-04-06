"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chainlinkContract = exports.chainlink = exports.ecvrf = exports.ECVRF = exports.ec = void 0;
var ec_1 = require("./lib/crypto/ec");
Object.defineProperty(exports, "ec", { enumerable: true, get: function () { return ec_1.ec; } });
var ecvrf_1 = require("./lib/crypto/ecvrf");
Object.defineProperty(exports, "ECVRF", { enumerable: true, get: function () { return __importDefault(ecvrf_1).default; } });
var vrf_1 = require("./lib/chainlink/vrf");
Object.defineProperty(exports, "ecvrf", { enumerable: true, get: function () { return vrf_1.ecvrf; } });
exports.chainlink = __importStar(require("./lib/ns/chainlink"));
exports.chainlinkContract = __importStar(require("./lib/chainlink/vrf/contract-functions"));
