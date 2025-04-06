// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { MaplestoryEquip } from "@projecta/msu-contracts/contracts/Items/MaplestoryEquip/MaplestoryEquip.sol";
import { MaplestoryCharacter } from "@projecta/msu-contracts/contracts/Character/MaplestoryCharacter.sol";
import { Collection } from "../Collection/Collection.sol";

contract MockCollectionV2 is Collection {
    constructor(
        address trustedForwarder_,
        MaplestoryEquip equipContract_,
        MaplestoryCharacter characterContract_
    ) Collection(trustedForwarder_, equipContract_, characterContract_) {}

    function fake() external view {
        assert(_msgData().length == msg.data.length);
        assert(_msgSender() == msg.sender);
    }

    function version() external pure returns (uint256) {
        return 2;
    }
}
