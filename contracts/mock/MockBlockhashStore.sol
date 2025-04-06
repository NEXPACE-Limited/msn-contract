// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { BlockhashStoreInterface } from "@chainlink/contracts/src/v0.8/interfaces/BlockhashStoreInterface.sol";

contract MockBlockhashStore is BlockhashStoreInterface {
    function getBlockhash(uint256 n) external view returns (bytes32 hash) {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            hash := blockhash(n)
        }
    }
}
