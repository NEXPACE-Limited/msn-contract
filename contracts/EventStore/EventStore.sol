// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { Context } from "@openzeppelin/contracts/utils/Context.sol";
import { ERC2771Context } from "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import { NextOwnablePausable } from "@projecta/util-contracts/contracts/access/NextOwnablePausable.sol";

/// @title EventStore
/// @notice A contract that stores the changing hash values for each domain. The event keeps the changing hash value of
/// each domain on the blockchain. You can continue to check the final state of the event's off-chain data with the event log
/// and validate the changed values.
contract EventStore is ERC2771Context, NextOwnablePausable {
    struct Event {
        uint256 domainId;
        bytes32 eventHash; // eventHash = hash(prev_hash + hash(event))
    }

    /// @notice Emitted when event has updated
    /// @param domainId Domain id
    /// @param eventHash Data for checking the final state of the event
    event EventStored(uint256 indexed domainId, bytes32 eventHash);

    constructor(address trustedForwarder) ERC2771Context(trustedForwarder) {}

    /// @notice Store the event
    /// @param newEvent event data; see {EventStore-EventStored}
    function storeEvent(Event calldata newEvent) external whenExecutable {
        emit EventStored(newEvent.domainId, newEvent.eventHash);
    }

    /// @notice Store batch of the event
    /// @param newEvents Bunch of event; see {EventStore-EventStored}
    function storeEventBatch(Event[] calldata newEvents) external whenExecutable {
        uint256 len = newEvents.length;
        for (uint256 index; index < len; ) {
            Event memory newEvent = newEvents[index];
            emit EventStored(newEvent.domainId, newEvent.eventHash);
            unchecked {
                index++;
            }
        }
    }

    /* trivial overrides */

    function _msgSender() internal view virtual override(Context, ERC2771Context) returns (address sender) {
        return ERC2771Context._msgSender();
    }

    function _msgData() internal view virtual override(Context, ERC2771Context) returns (bytes calldata) {
        return ERC2771Context._msgData();
    }
}
