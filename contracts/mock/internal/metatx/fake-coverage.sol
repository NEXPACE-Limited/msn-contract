// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { MSUContentsCommission } from "../../../MSUContentsCommission/MSUContentsCommission.sol";
import { EventStore } from "../../../EventStore/EventStore.sol";
import { RandomSeedGenerator } from "../../../Random/RandomSeedGenerator.sol";
import { VRFCoordinatorV2Interface } from "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import { IVRFManager } from "@projecta/nexpace-contracts/contracts/VRF/interfaces/IVRFManager.sol";

// import { LinkTokenInterface } from "@chainlink/contracts/src/v0.8/interfaces/LinkTokenInterface.sol";

interface IMockFake {
    function fake() external;
}

contract MockMSUContentsCommissionMetaTransactionFakeCoverage is
    MSUContentsCommission(address(0xdead), address(0xdead), address(0xdead)),
    IMockFake
{
    function fake() external view override {
        assert(_msgData().length == msg.data.length);
        assert(_msgSender() == msg.sender);
    }
}

contract MockEventStoreMetaTransactionFakeCoverage is EventStore(address(0)), IMockFake {
    function fake() external view override {
        assert(_msgData().length == msg.data.length);
        assert(_msgSender() == msg.sender);
    }
}

contract MockRandomSeedGeneratorMetaTransactionFakeCoverage is
    RandomSeedGenerator(address(0), (IVRFManager(address(1))), bytes32(0), uint64(1)),
    IMockFake
{
    function fake() external view override {
        assert(_msgData().length == msg.data.length);
        assert(_msgSender() == msg.sender);
    }
}
