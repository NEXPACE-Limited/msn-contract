// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

// temporary contract to be used until VRF is available
contract MockRandom {
    uint256 private _seed;

    function getRandom() public returns (uint256) {
        _seed++;
        return uint256(keccak256(abi.encodePacked(block.prevrandao, block.timestamp, _seed)));
    }
}
