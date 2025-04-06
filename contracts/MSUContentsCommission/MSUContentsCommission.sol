// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Context } from "@openzeppelin/contracts/utils/Context.sol";
import { ERC2771Context } from "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { NextOwnablePausable } from "@projecta/util-contracts/contracts/access/NextOwnablePausable.sol";
import { CommissionForCreator } from "@projecta/nexpace-contracts/contracts/Commission/CommissionForCreator.sol";

/// @title MSUContentsCommission
/// @notice MSUContentsCommission contract is a contract used to purchase off-chain goods such as
/// MSN's Enhancement Contents by sending NextMeso (ERC20) to the Commission Wallet.
contract MSUContentsCommission is ERC2771Context, NextOwnablePausable, CommissionForCreator {
    using SafeERC20 for IERC20;

    /// @notice CA of NextMesos
    IERC20 public immutable neso;

    /// @notice Emitted when sending NextMeso (ERC20) to the commission wallet
    /// @param user EOA of user
    /// @param value Amount of token
    /// @param reason The reason of this transaction occurred
    event Deposit(address indexed user, uint256 value, string indexed reason);

    modifier validAddress(address addr) {
        require(addr != address(0), "MSUContentsCommission/validAddress: couldn't be zero address");
        _;
    }

    /// @dev Need CAs for deploy this contract
    /// @param trustedForwarder CA of the EmittingForwarder
    /// @param nesoAddress CA of the NextMeso
    /// @param commission_ Address to receive the commission
    constructor(
        address trustedForwarder,
        address nesoAddress,
        address commission_
    )
        validAddress(trustedForwarder)
        validAddress(nesoAddress)
        validAddress(commission_)
        ERC2771Context(trustedForwarder)
        CommissionForCreator(commission_, IERC20(nesoAddress))
    {
        neso = IERC20(nesoAddress);
    }

    /// @notice Deposit NextMeso (ERC20) to the commission wallet
    /// @param user EOA of user
    /// @param commission Commission for contents
    /// @param reason The reason of this transaction occurred
    function depositByOwner(
        address user,
        CommissionForCreator.CommissionParams memory commission,
        string memory reason
    ) external validAddress(user) whenExecutable {
        commission.reason = reason;
        _sendCommission(commission);

        emit Deposit(user, commission.commissionAmount, reason);
    }

    /* trivial overrides */

    function _msgSender() internal view virtual override(Context, ERC2771Context) returns (address sender) {
        return ERC2771Context._msgSender();
    }

    function _msgData() internal view virtual override(Context, ERC2771Context) returns (bytes calldata) {
        return ERC2771Context._msgData();
    }
}
