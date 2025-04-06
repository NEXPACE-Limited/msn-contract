// SPDX-License-Identifier: MIT
// solhint-disable var-name-mixedcase
pragma solidity 0.8.19;

import { VRFCoordinatorV2Interface } from "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";

contract MockVRFCoordinatorOnlyUsingRequestRandomWords is VRFCoordinatorV2Interface {
    function getRequestConfig() external view virtual override returns (uint16, uint32, bytes32[] memory) {}

    /// @dev Only use this funciton
    function requestRandomWords(
        bytes32,
        uint64,
        uint16,
        uint32,
        uint32
    ) external virtual override returns (uint256 requestId) {
        return 0;
    }

    function createSubscription() external virtual override returns (uint64) {}

    function getSubscription(
        uint64
    ) external view virtual override returns (uint96, uint64, address, address[] memory) {}

    function requestSubscriptionOwnerTransfer(uint64, address) external virtual override {}

    function acceptSubscriptionOwnerTransfer(uint64) external virtual override {}

    function addConsumer(uint64, address) external virtual override {}

    function removeConsumer(uint64, address) external virtual override {}

    function cancelSubscription(uint64, address) external virtual override {}

    function pendingRequestExists(uint64) external view virtual override returns (bool) {}
}
