// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { Context } from "@openzeppelin/contracts/utils/Context.sol";
import { ERC2771Context } from "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import { NextOwnablePausable } from "@projecta/util-contracts/contracts/access/NextOwnablePausable.sol";
import { MaplestoryEquip } from "@projecta/msu-contracts/contracts/Items/MaplestoryEquip/MaplestoryEquip.sol";
import { MaplestoryCharacter } from "@projecta/msu-contracts/contracts/Character/MaplestoryCharacter.sol";

/// @title Collection
/// @notice Items acquired in the game can be placed in a collection to give them additional stats in MapleStoryN(game).
/// Items can be collected from a wallet or character to a collection, and vice versa. A collection is mapped to
/// a wallet address, so a wallet can have a single collection, and a collection extends to all characters in the wallet.
/// Collected items can also be extracted to any character in the wallet.
contract Collection is ERC2771Context, NextOwnablePausable {
    using SafeERC20 for IERC20;

    struct SlotInfo {
        uint256 nftTokenId;
        uint64 itemId;
        bool valid;
    }

    struct TokenInfo {
        uint256 nftTokenId;
        string slotKey;
    }

    /// @notice CA of MaplestoryEquip
    MaplestoryEquip public immutable equipContract;
    /// @notice CA of MaplestoryCharacter
    MaplestoryCharacter public immutable characterContract;

    mapping(address => mapping(string => SlotInfo)) private _slotInfo;

    /// @notice Emitted when item added into collection from user wallet
    /// @param userWallet EOA of user
    /// @param itemId Item id
    /// @param tokenId Token id
    /// @param slotKey The unique ID of the slot where the item is registered in the collection
    event ItemAdded(address indexed userWallet, uint64 indexed itemId, uint256 indexed tokenId, string slotKey);
    /// @notice Emitted when item added into collection from character
    /// @param tokenOwner The owner of token, same as user wallet
    /// @param charId Character id
    /// @param itemId Item id
    /// @param tokenId Token id
    /// @param slotKey The unique ID of the slot where the item is registered in the collection
    event ItemAddedByChar(
        address indexed tokenOwner,
        uint256 charId,
        uint64 indexed itemId,
        uint256 indexed tokenId,
        string slotKey
    );
    /// @notice Emitted when item returned to user wallet
    /// @param userWallet EOA of user
    /// @param itemId Item id
    /// @param tokenId Token id
    /// @param slotKey The unique ID of the slot where the item is registered in the collection
    event ItemReturned(address indexed userWallet, uint64 indexed itemId, uint256 indexed tokenId, string slotKey);
    /// @notice Emitted when item returned to character
    /// @param tokenOwner The owner of token, same as user wallet
    /// @param charId Character id
    /// @param itemId Item id
    /// @param tokenId Token id
    /// @param slotKey The unique ID of the slot where the item is registered in the collection
    event ItemReturnedByChar(
        address indexed tokenOwner,
        uint256 charId,
        uint64 indexed itemId,
        uint256 indexed tokenId,
        string slotKey
    );
    /// @notice Emitted when clear item slot to empty
    /// @param account EOA of user
    /// @param slotKey The unique ID of the slot where the item is registered in the collection
    event SlotCleared(address indexed account, string slotKey);

    modifier validAddress(address addr) {
        require(addr != address(0), "Collection/validAddress: couldn't be zero address");
        _;
    }

    /// @dev Need CAs for deploy this contract
    /// @param equipContract_ CA of the MaplestoryEquip
    /// @param characterContract_ CA of the MaplestoryCharacter
    constructor(
        address trustedForwarder_,
        MaplestoryEquip equipContract_,
        MaplestoryCharacter characterContract_
    )
        ERC2771Context(trustedForwarder_)
        validAddress(address(equipContract_))
        validAddress(address(characterContract_))
    {
        equipContract = equipContract_;
        characterContract = characterContract_;
        equipContract.setApprovalForAll(address(characterContract), true);
    }

    /// @notice Function for adding a item from user to collection
    /// @param userWallet The address of the user who owns the item to be added to the collection
    /// @param tokenInfo Information of the token that to be enrolled in the collection
    function addItem(
        address userWallet,
        TokenInfo calldata tokenInfo
    ) external validAddress(userWallet) whenExecutable {
        _addItem(userWallet, tokenInfo.nftTokenId, tokenInfo.slotKey);
    }

    /// @notice Function for adding items from user to collection
    /// @param userWallet The address of the user who owns the item to be added to the collection
    /// @param tokenInfoList Information of the tokens that to be enrolled in the collection
    function addBatchItem(
        address userWallet,
        TokenInfo[] calldata tokenInfoList
    ) external validAddress(userWallet) whenExecutable {
        uint256 tLen = tokenInfoList.length;

        for (uint256 i; i < tLen; ) {
            _addItem(userWallet, tokenInfoList[i].nftTokenId, tokenInfoList[i].slotKey);
            unchecked {
                i++;
            }
        }
    }

    /// @notice Function for returning a item from collection to user
    /// @param userWallet The address of the user who receives the added item in the collection
    /// @param tokenInfo Information of the token that to be enrolled in the collection
    function returnItem(
        address userWallet,
        TokenInfo calldata tokenInfo
    ) external validAddress(userWallet) whenExecutable {
        _returnItem(userWallet, tokenInfo.nftTokenId, tokenInfo.slotKey);
    }

    /// @notice Function for returning items from collection to user
    /// @param userWallet The address of the user who receives the added item in the collection
    /// @param tokenInfoList Information of the tokens that to be enrolled in the collection
    function returnBatchItem(
        address userWallet,
        TokenInfo[] calldata tokenInfoList
    ) external validAddress(userWallet) whenExecutable {
        uint256 tLen = tokenInfoList.length;

        for (uint256 i; i < tLen; ) {
            _returnItem(userWallet, tokenInfoList[i].nftTokenId, tokenInfoList[i].slotKey);
            unchecked {
                i++;
            }
        }
    }

    /// @notice Function for adding a item from character to collection
    /// @param charId The character id for sending the item
    /// @param userWallet The address of the user who owns the item to be added to the collection
    /// @param tokenInfo Information of the token that to be enrolled in the collection
    function addItemByChar(
        uint256 charId,
        address userWallet,
        TokenInfo calldata tokenInfo
    ) external validAddress(userWallet) whenExecutable {
        _addItemByChar(charId, userWallet, tokenInfo.nftTokenId, tokenInfo.slotKey);
    }

    /// @notice Function for adding a item from character to collection
    /// @param charId The character id for sending the item
    /// @param userWallet The address of the user who owns the item to be added to the collection
    /// @param tokenInfoList Information of the tokens that to be enrolled in the collection
    function addBatchItemByChar(
        uint256 charId,
        address userWallet,
        TokenInfo[] calldata tokenInfoList
    ) external validAddress(userWallet) whenExecutable {
        uint256 tLen = tokenInfoList.length;

        for (uint256 i; i < tLen; ) {
            _addItemByChar(charId, userWallet, tokenInfoList[i].nftTokenId, tokenInfoList[i].slotKey);
            unchecked {
                i++;
            }
        }
    }

    /// @notice Function for returning a item from collection to character
    /// @param charId The character id for receiving the item
    /// @param userWallet The address of the user who receives the added item in the collection
    /// @param tokenInfo Information of the token that to be enrolled in the collection
    function returnItemByChar(
        uint256 charId,
        address userWallet,
        TokenInfo calldata tokenInfo
    ) external validAddress(userWallet) whenExecutable {
        _returnItemByChar(charId, userWallet, tokenInfo.nftTokenId, tokenInfo.slotKey);
    }

    /// @notice Function for returning items from collection to character
    /// @param charId The character id for receiving the item
    /// @param userWallet The address of the user who receives the added item in the collection
    /// @param tokenInfoList Information of the tokens that to be enrolled in the collection
    function returnBatchItemByChar(
        uint256 charId,
        address userWallet,
        TokenInfo[] calldata tokenInfoList
    ) external validAddress(userWallet) whenExecutable {
        uint256 tLen = tokenInfoList.length;

        for (uint256 i; i < tLen; ) {
            _returnItemByChar(charId, userWallet, tokenInfoList[i].nftTokenId, tokenInfoList[i].slotKey);
            unchecked {
                i++;
            }
        }
    }

    /// @notice Clear slot information; This function is a contingency and is not normally used
    /// @param account EOA of user
    /// @param slotKey The unique ID of the slot where the item is registered in the collection
    function clearSlot(address account, string calldata slotKey) external onlyOwner {
        require(_slotInfo[account][slotKey].valid, "Collection/slotEmpty: slot is empty");
        _slotInfo[account][slotKey].valid = false;
        emit SlotCleared(account, slotKey);
    }

    /// @notice Withdraw ERC-20 base tokens; This function is a contingency and is not normally used
    /// @param token CA of be withdrawing token
    /// @param tos Address of receiving the token
    /// @param amounts Amounts for withdraw
    function withdrawERC20(IERC20 token, address[] calldata tos, uint256[] calldata amounts) external onlyOwner {
        require(tos.length == amounts.length, "Collection/mismatch: tos and amounts length mismatch");
        uint256 len = tos.length;
        for (uint256 i; i < len; ) {
            token.safeTransfer(tos[i], amounts[i]);
            unchecked {
                i++;
            }
        }
    }

    /// @notice Withdraw ERC-721 base tokens; This function is a contingency and is not normally used
    /// @param token CA of be withdrawing token
    /// @param tos Addresses of receiving the token
    /// @param tokenIds Token ids for withdraw
    function withdrawERC721(IERC721 token, address[] calldata tos, uint256[] calldata tokenIds) external onlyOwner {
        require(tos.length == tokenIds.length, "Collection/mismatch: tos and tokenIds length mismatch");
        uint256 len = tos.length;
        for (uint256 i; i < len; ) {
            token.safeTransferFrom(address(this), tos[i], tokenIds[i]);
            unchecked {
                i++;
            }
        }
    }

    /// @notice Retrieve slot information by `account` and `slotKey`
    /// @param account EOA of user
    /// @param slotKey The unique ID of the slot where the item is registered in the collection
    /// @return SlotInfo The slot information; see {Collection-SlotInfo}
    function slotInfo(address account, string calldata slotKey) external view returns (SlotInfo memory) {
        return _slotInfo[account][slotKey];
    }

    function _addItem(address userWallet, uint256 nftTokenId, string memory slotKey) internal {
        uint64 itemId = _tokenItemId(nftTokenId);
        require(!_slotInfo[userWallet][slotKey].valid, "Collection/slotOccupied: slot is occupied");

        _slotInfo[userWallet][slotKey] = SlotInfo(nftTokenId, itemId, true);

        equipContract.transferFrom(userWallet, address(this), nftTokenId);
        emit ItemAdded(userWallet, itemId, nftTokenId, slotKey);
    }

    function _returnItem(address userWallet, uint256 nftTokenId, string memory slotKey) internal {
        uint64 itemId = _tokenItemId(nftTokenId);
        require(_slotInfo[userWallet][slotKey].valid, "Collection/slotEmpty: slot is empty");
        require(
            _slotInfo[userWallet][slotKey].nftTokenId == nftTokenId,
            "Collection/slotConflict: requested token is not the stored one"
        );

        _slotInfo[userWallet][slotKey].valid = false;

        equipContract.transferFrom(address(this), userWallet, nftTokenId);
        emit ItemReturned(userWallet, itemId, nftTokenId, slotKey);
    }

    function _addItemByChar(uint256 charId, address userWallet, uint256 nftTokenId, string memory slotKey) internal {
        uint64 itemId = _tokenItemId(nftTokenId);
        require(!_slotInfo[userWallet][slotKey].valid, "Collection/slotOccupied: slot is occupied");
        require(characterContract.ownerOf(charId) == userWallet, "Collection/invalidID: wrong charId");

        _slotInfo[userWallet][slotKey] = SlotInfo(nftTokenId, itemId, true);

        characterContract.withdrawItemTo(charId, userWallet, address(this), equipContract, nftTokenId);
        emit ItemAddedByChar(userWallet, charId, itemId, nftTokenId, slotKey);
    }

    function _returnItemByChar(uint256 charId, address userWallet, uint256 nftTokenId, string memory slotKey) internal {
        uint64 itemId = _tokenItemId(nftTokenId);
        require(_slotInfo[userWallet][slotKey].valid, "Collection/slotEmpty: slot is empty");
        require(
            _slotInfo[userWallet][slotKey].nftTokenId == nftTokenId,
            "Collection/slotConflict: requested token is not the stored one"
        );

        _slotInfo[userWallet][slotKey].valid = false;

        characterContract.depositItemFromSender(userWallet, charId, equipContract, nftTokenId);
        emit ItemReturnedByChar(userWallet, charId, itemId, nftTokenId, slotKey);
    }

    function _tokenItemId(uint256 nftTokenId) internal view returns (uint64) {
        return equipContract.tokenItemId(nftTokenId);
    }

    /* trivial overrides */
    function _msgSender() internal view virtual override(Context, ERC2771Context) returns (address sender) {
        return ERC2771Context._msgSender();
    }

    function _msgData() internal view virtual override(Context, ERC2771Context) returns (bytes calldata) {
        return ERC2771Context._msgData();
    }
}
