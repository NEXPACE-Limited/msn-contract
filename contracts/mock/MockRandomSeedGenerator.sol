// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { Context } from "@openzeppelin/contracts/utils/Context.sol";
import { ERC2771Context } from "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import { VRF } from "@chainlink/contracts/src/v0.8/vrf/VRF.sol";
import { NextOwnablePausable } from "@projecta/util-contracts/contracts/access/NextOwnablePausable.sol";

/// @title RandomSeedGenerator
/// @notice A smart contract that uses the Chainlink VRF to generate the random numbers needed to enhance an item.
contract MockRandomSeedGenerator is ERC2771Context, NextOwnablePausable, VRF {
    struct RandomSeedGeneratorState {
        uint8 phase;
        uint64 maxDepth;
        uint64 nextReveal;
    }

    bytes32 private _keyHash;

    uint256 private _lastRequestId;

    uint256[] private _inputSeedAt;

    mapping(uint256 => uint256) private _secretSeedOf;

    RandomSeedGeneratorState private _state;

    /// @notice Emitted when requested generating a random value to VRF
    /// @param sequence Sequence of random value
    /// @param requestId Request id of VRF request
    event RandomSeedRequested(uint64 indexed sequence, uint256 requestId);
    /// @notice Emitted when fulfilled the random value from VRF
    /// @param sequence Sequence of random value
    /// @param inputSeed Random value that generated from VRF
    event RandomSeedGenerated(uint64 indexed sequence, uint256 inputSeed);
    /// @notice Emitted when revealed the random value
    /// @param sequence Sequence of random value
    /// @param secretSeed Value computed via VRF Proof
    event RandomSeedRevealed(uint64 indexed sequence, uint256 secretSeed);

    /// @dev Need CAs and values for deploy this contract
    /// @param keyHash_ Value of key hash
    /// @param maxDepth_ Count of maximum depth
    constructor(address trustedForwarder, bytes32 keyHash_, uint64 maxDepth_) ERC2771Context(trustedForwarder) {
        _keyHash = keyHash_;
        _state.maxDepth = maxDepth_;
    }

    /// @notice Request generating a random value to VRF
    function next() external whenExecutable {
        _next();
    }

    /// @notice Reveal the random value using inforamtion of proof
    /// @param proof Information of proofing random value
    function reveal(Proof memory proof) external {
        uint64 nextReveal = _state.nextReveal;
        uint256 secretSeed = verifyAndComputeSeed(nextReveal, proof);
        uint256 inputSeed = _inputSeedAt[nextReveal];

        _secretSeedOf[inputSeed] = secretSeed;
        _state.nextReveal = nextReveal + 1;

        emit RandomSeedRevealed(nextReveal, secretSeed);
    }

    /// @notice Set `KeyHash`
    /// @param newKeyHash Value of new key hash
    function setKeyHash(bytes32 newKeyHash) external onlyOwner {
        _keyHash = newKeyHash;
    }

    /// @notice Retrieve current state
    /// @return nextRequest Value of next sequence
    /// @return nextReveal Value of the next reveal sequence
    /// @return maxDepth Current value of `maxDepth`
    function sequences() external view returns (uint64 nextRequest, uint64 nextReveal, uint64 maxDepth) {
        RandomSeedGeneratorState memory s = _state;
        nextRequest = uint64(_inputSeedAt.length);
        nextReveal = s.nextReveal;
        maxDepth = s.maxDepth;
    }

    /// @notice Retrieve `KeyHash`
    function keyHash() external view returns (bytes32) {
        return _keyHash;
    }

    /// @notice Retrieve `secretSeed` by `sequence`
    /// @param sequence Sequence of random value
    /// @return secretSeed Value computed via VRF Proof
    function secretSeedAt(uint64 sequence) external view returns (uint256 secretSeed) {
        secretSeed = secretSeedOf(inputSeedAt(sequence));
    }

    /// @notice Retrieve values of `_lastDeadline` and `_lastRequestId`
    function pendingRequest() external view returns (uint256) {
        return _lastRequestId;
    }

    /// @notice Retrieve `inputSeed` by `sequence`
    /// @param sequence Sequence of random value
    /// @return inputSeed Random value that generated from VRF
    function inputSeedAt(uint64 sequence) public view returns (uint256 inputSeed) {
        require(sequence < _inputSeedAt.length, "RandomSeedGenerator/inputSeedNotReady: input seed not yet generated");
        inputSeed = _inputSeedAt[sequence];
    }

    /// @notice Retrieve `secretSeed` by `inputSeed`
    /// @param inputSeed Random value that generated from VRF
    /// @return secretSeed Value computed via VRF Proof
    function secretSeedOf(uint256 inputSeed) public view returns (uint256 secretSeed) {
        secretSeed = _secretSeedOf[inputSeed];
        require(secretSeed != 0, "RandomSeedGenerator/secretSeedNotReady: secret seed not yet revealed");
    }

    /// @notice Calculate key hash
    /// @param publicKey Public keys for calculating key hash
    /// @return Value of key hash
    function hashOfKey(uint256[2] memory publicKey) public pure returns (bytes32) {
        return keccak256(abi.encode(publicKey));
    }

    /// @notice Verify and coumpute the `secretSeed` using `proof`
    /// @param sequence Sequence of random value
    /// @param proof Information of proofing random value
    /// @return secretSeed Value computed via VRF Proof
    function verifyAndComputeSeed(uint256 sequence, Proof memory proof) public view returns (uint256 secretSeed) {
        require(hashOfKey(proof.pk) == _keyHash, "RandomSeedGenerator/wrongProvingKey: wrong proving key");

        require(sequence < _inputSeedAt.length, "RandomSeedGenerator/noInputSeed: no input seed");
        uint256 inputSeed = _inputSeedAt[sequence];

        secretSeed = randomValueFromVRFProof(proof, inputSeed);
        assert(secretSeed != 0);
    }

    function fulfillVRF(uint256 requestId, uint256[] memory randomWords) public {
        RandomSeedGeneratorState memory s = _state;

        assert(s.phase == 1);
        assert(randomWords.length == 1);
        require(requestId == _lastRequestId, "RandomSeedGenerator/invalidRequestId: invalid request");

        uint64 sequence = uint64(_inputSeedAt.length);
        uint256 inputSeed = randomWords[0];
        assert(inputSeed != 0);

        _inputSeedAt.push(inputSeed);

        _state.phase = 0;

        emit RandomSeedGenerated(sequence, inputSeed);
    }

    function _next() private {
        RandomSeedGeneratorState memory s = _state;

        require(s.phase == 0, "RandomSeedGenerator/randomNumberNotFulfilled: previous request not fulfilled");

        uint64 sequence = uint64(_inputSeedAt.length);
        assert(sequence < type(uint64).max);
        require(sequence - s.nextReveal < s.maxDepth, "RandomSeedGenerator/pendingRequests: too many unrevealed seeds");

        uint256 requestId = _requestVRF(1);

        _state.phase = 1;
        _lastRequestId = requestId;

        emit RandomSeedRequested(sequence, requestId);
        uint256[] memory randomWords = new uint256[](1);
        randomWords[0] = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender)));
        fulfillVRF(requestId, randomWords);
    }

    /* trivial overrides */

    function _msgSender() internal view virtual override(Context, ERC2771Context) returns (address sender) {
        return ERC2771Context._msgSender();
    }

    function _msgData() internal view virtual override(Context, ERC2771Context) returns (bytes calldata) {
        return ERC2771Context._msgData();
    }

    uint256 private nonce;

    function _requestVRF(uint32 numWords) internal returns (uint256) {
        nonce += 1;
        return uint256(keccak256(abi.encodePacked(block.timestamp, nonce, numWords)));
    }
}
