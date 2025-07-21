// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.13;

import {RealityETH_v3_0} from "../staticlib/RealityETH-3.0.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract KaiSign is ReentrancyGuard, AccessControl, Pausable {
    using SafeERC20 for IERC20;

    // =============================================================================
    //                                CUSTOM ERRORS
    // =============================================================================
    error AlreadyProposed();
    error NotProposed();
    error InsufficientBond();
    error InsufficientIncentive();
    error InvalidContract();
    error ContractNotFound();
    error InvalidIPFS();
    error CommitmentNotFound();
    error CommitmentExpired();
    error CommitmentAlreadyRevealed();
    error InvalidReveal();
    error NotFinalized();
    error AlreadySettled();
    error NoIncentiveToClaim();
    error IncentiveExpired();
    error Unauthorized();

    // =============================================================================
    //                                   ROLES
    // =============================================================================
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    // =============================================================================
    //                                CONSTANTS
    // =============================================================================
    uint256 public constant PLATFORM_FEE_PERCENT = 5; // 5%
    uint256 public constant COMMIT_REVEAL_TIMEOUT = 1 hours;
    uint256 public constant INCENTIVE_DURATION = 7 days;
    uint32 public constant DEFAULT_TIMEOUT = 48 hours; // 48 hours for Reality.eth questions

    // =============================================================================
    //                              STATE VARIABLES
    // =============================================================================
    address public immutable realityETH;
    address public immutable arbitrator;
    address public immutable treasury;
    uint256 public minBond;
    uint256 public templateId;
    
    // Commit-reveal mechanism
    mapping(bytes32 => CommitData) public commitments;
    
    // Contract address integration
    mapping(address => bytes32[]) public contractSpecs;
    mapping(address => uint256) public contractSpecCount;
    
    // Incentive system
    mapping(bytes32 => IncentiveData) public incentives;
    mapping(address => bytes32[]) public userIncentives;
    
    // Spec management
    mapping(bytes32 => ERC7730Spec) public specs;
    mapping(bytes32 => bool) public bondsSettled;
    mapping(bytes32 => mapping(address => uint256)) public userBonds;
    
    // =============================================================================
    //                                   ENUMS
    // =============================================================================
    enum Status {
        Committed,    // Commitment submitted, waiting for reveal
        Submitted,    // Revealed and submitted, waiting for proposal
        Proposed,     // Question created on Reality.eth
        Finalized,    // Final result determined
        Cancelled     // Cancelled/invalid
    }

    // =============================================================================
    //                                 STRUCTS
    // =============================================================================
    
    // Optimized struct packing for gas efficiency
    struct ERC7730Spec {
        uint64 createdTimestamp;    // 8 bytes
        uint64 proposedTimestamp;   // 8 bytes  
        Status status;              // 1 byte
        bool bondsSettled;          // 1 byte
        uint48 totalBonds;          // 6 bytes (up to 281 ETH)
        uint8 reserved;             // 8 bytes - reserved for future use
        // SLOT 1: 32 bytes total (perfectly packed!)
        
        address creator;            // 20 bytes  
        address targetContract;     // 20 bytes - contract this spec validates
        // SLOT 2: 40 bytes - needs 2 slots but efficiently packed
        
        string ipfs;               // Dynamic - separate slots when needed
        bytes32 questionId;        // 32 bytes - full slot
        bytes32 incentiveId;       // 32 bytes - linked incentive if any
        // SLOTS 3+: Only when spec has IPFS/questionId/incentiveId
    }

    struct CommitData {
        address committer;          // 20 bytes
        uint64 commitTimestamp;     // 8 bytes
        uint32 revealDeadline;      // 4 bytes
        // SLOT 1: 32 bytes total (perfectly packed!)
        
        address targetContract;     // 20 bytes
        bool isRevealed;            // 1 byte
        uint80 bondAmount;          // 11 bytes (up to 1.2M ETH)
        // SLOT 2: 32 bytes total (perfectly packed!)
        
        bytes32 incentiveId;        // 32 bytes - if incentivized
        // SLOT 3: Only when incentivized
    }

    struct IncentiveData {
        address creator;            // 20 bytes
        address token;              // 20 bytes (address(0) for ETH)
        // SLOT 1: 40 bytes - needs 2 slots
        
        uint128 amount;             // 16 bytes
        uint64 deadline;            // 8 bytes
        uint64 createdAt;           // 8 bytes
        // SLOT 2: 32 bytes total (perfectly packed!)
        
        address targetContract;     // 20 bytes
        bool isClaimed;             // 1 byte
        bool isActive;              // 1 byte
        uint80 reserved;            // 10 bytes - reserved for future use
        // SLOT 3: 32 bytes total (perfectly packed!)
        
        string description;         // Dynamic - separate slots when needed
        // SLOT 4+: Only when description exists
    }

    // =============================================================================
    //                                  EVENTS
    // =============================================================================
    event LogCommitSpec(
        address indexed committer,
        bytes32 indexed commitmentId,
        address indexed targetContract,
        uint256 bondAmount,
        uint32 revealDeadline
    );

    event LogRevealSpec(
        address indexed creator,
        bytes32 indexed specID,
        bytes32 indexed commitmentId,
        string ipfs,
        address targetContract
    );

    event LogCreateSpec(
        address indexed creator,
        bytes32 indexed specID,
        string ipfs,
        address indexed targetContract,
        uint256 timestamp,
        bytes32 incentiveId
    );

    event LogProposeSpec(
        address indexed user,
        bytes32 indexed specID,
        bytes32 questionId,
        uint256 bond
    );

    event LogAssertSpecValid(
        address indexed user,
        bytes32 indexed specID,
        bytes32 questionId,
        uint256 bond
    );

    event LogAssertSpecInvalid(
        address indexed user,
        bytes32 indexed specID,
        bytes32 questionId,
        uint256 bond
    );

    event LogHandleResult(
        bytes32 indexed specID,
        bool isAccepted
    );

    event LogBondsSettled(
        bytes32 indexed specID,
        address indexed winner,
        uint256 amount
    );

    event LogIncentiveCreated(
        bytes32 indexed incentiveId,
        address indexed creator,
        address indexed targetContract,
        address token,
        uint256 amount,
        uint64 deadline,
        string description
    );

    event LogIncentiveClaimed(
        bytes32 indexed incentiveId,
        address indexed claimer,
        bytes32 indexed specID,
        uint256 amount
    );

    event LogContractSpecAdded(
        address indexed targetContract,
        bytes32 indexed specID,
        address indexed creator
    );

    event LogEmergencyPause(address indexed admin);
    event LogEmergencyUnpause(address indexed admin);

    // =============================================================================
    //                                MODIFIERS
    // =============================================================================
    modifier onlyAdmin() {
        if (!hasRole(ADMIN_ROLE, msg.sender)) revert Unauthorized();
        _;
    }

    // =============================================================================
    //                               CONSTRUCTOR
    // =============================================================================
    constructor(
        address _realityETH,
        address _arbitrator,
        address _treasury,
        uint256 _minBond,
        address[] memory _initialAdmins
    ) {
        if (_realityETH == address(0)) revert InvalidContract();
        if (_arbitrator == address(0)) revert InvalidContract();
        if (_treasury == address(0)) revert InvalidContract();
        if (_initialAdmins.length == 0) revert Unauthorized();

        realityETH = _realityETH;
        arbitrator = _arbitrator;
        treasury = _treasury;
        minBond = _minBond;

        // Set up initial admins
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        for (uint256 i = 0; i < _initialAdmins.length; i++) {
            _grantRole(ADMIN_ROLE, _initialAdmins[i]);
        }

        // Create Reality.eth template
        templateId = RealityETH_v3_0(realityETH).createTemplate(
            '{"title": "Is the ERC7730 spec %s for contract %s correct?", "type": "bool"}'
        );
    }

    // =============================================================================
    //                              ADMIN FUNCTIONS
    // =============================================================================
    
    function setMinBond(uint256 _minBond) external onlyAdmin {
        minBond = _minBond;
    }

    function addAdmin(address newAdmin) external onlyAdmin {
        _grantRole(ADMIN_ROLE, newAdmin);
    }

    function removeAdmin(address admin) external onlyAdmin {
        _revokeRole(ADMIN_ROLE, admin);
    }

    // Emergency pause/unpause - any admin can trigger
    function emergencyPause() external onlyAdmin {
        _pause();
        emit LogEmergencyPause(msg.sender);
    }

    function emergencyUnpause() external onlyAdmin {
        _unpause();
        emit LogEmergencyUnpause(msg.sender);
    }

    // =============================================================================
    //                           INCENTIVE SYSTEM
    // =============================================================================
    
    function createIncentive(
        address targetContract,
        address token, // address(0) for ETH
        uint256 amount,
        uint64 duration,
        string calldata description
    ) external payable nonReentrant whenNotPaused returns (bytes32 incentiveId) {
        if (targetContract == address(0)) revert InvalidContract();
        if (duration == 0 || duration > 30 days) revert IncentiveExpired();
        
        // Validate contract exists
        uint256 contractSize;
        assembly {
            contractSize := extcodesize(targetContract)
        }
        if (contractSize == 0) revert ContractNotFound();

        incentiveId = keccak256(abi.encodePacked(
            msg.sender,
            targetContract,
            token,
            amount,
            block.timestamp,
            description
        ));

        if (token == address(0)) {
            // ETH incentive
            if (msg.value < amount) revert InsufficientIncentive();
            // Refund excess ETH
            if (msg.value > amount) {
                payable(msg.sender).transfer(msg.value - amount);
            }
        } else {
            // ERC20 incentive
            if (msg.value > 0) {
                // Refund any ETH sent by mistake
                payable(msg.sender).transfer(msg.value);
            }
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        }

        incentives[incentiveId] = IncentiveData({
            creator: msg.sender,
            token: token,
            amount: uint128(amount),
            deadline: uint64(block.timestamp + duration),
            createdAt: uint64(block.timestamp),
            targetContract: targetContract,
            isClaimed: false,
            isActive: true,
            reserved: 0,
            description: description
        });

        userIncentives[msg.sender].push(incentiveId);

        emit LogIncentiveCreated(
            incentiveId,
            msg.sender,
            targetContract,
            token,
            amount,
            uint64(block.timestamp + duration),
            description
        );
    }

    // =============================================================================
    //                           COMMIT-REVEAL PATTERN
    // =============================================================================
    
    function commitSpec(
        bytes32 commitment,
        address targetContract,
        bytes32 incentiveId
    ) external payable nonReentrant whenNotPaused {
        if (targetContract == address(0)) revert InvalidContract();
        
        // Validate contract exists
        uint256 contractSize;
        assembly {
            contractSize := extcodesize(targetContract)
        }
        if (contractSize == 0) revert ContractNotFound();

        if (msg.value < minBond) revert InsufficientBond();

        // Validate incentive if provided
        if (incentiveId != bytes32(0)) {
            IncentiveData memory incentive = incentives[incentiveId];
            if (!incentive.isActive || incentive.isClaimed) revert NoIncentiveToClaim();
            if (incentive.targetContract != targetContract) revert InvalidContract();
            if (block.timestamp > incentive.deadline) revert IncentiveExpired();
        }

        bytes32 commitmentId = keccak256(abi.encodePacked(
            commitment,
            msg.sender,
            targetContract,
            block.timestamp
        ));

        commitments[commitmentId] = CommitData({
            committer: msg.sender,
            commitTimestamp: uint64(block.timestamp),
            revealDeadline: uint32(block.timestamp + COMMIT_REVEAL_TIMEOUT),
            targetContract: targetContract,
            isRevealed: false,
            bondAmount: uint80(msg.value),
            incentiveId: incentiveId
        });

        // Collect platform fee
        uint256 platformFee = (msg.value * PLATFORM_FEE_PERCENT) / 100;
        if (platformFee > 0) {
            payable(treasury).transfer(platformFee);
        }

        emit LogCommitSpec(
            msg.sender,
            commitmentId,
            targetContract,
            msg.value,
            uint32(block.timestamp + COMMIT_REVEAL_TIMEOUT)
        );
    }

    function revealSpec(
        bytes32 commitmentId,
        string calldata ipfs,
        uint256 nonce
    ) external nonReentrant whenNotPaused returns (bytes32 specID) {
        CommitData storage commitment = commitments[commitmentId];
        
        if (commitment.committer == address(0)) revert CommitmentNotFound();
        if (commitment.committer != msg.sender) revert InvalidReveal();
        if (commitment.isRevealed) revert CommitmentAlreadyRevealed();
        if (block.timestamp > commitment.revealDeadline) revert CommitmentExpired();

        // Validate IPFS CID format
        if (bytes(ipfs).length == 0 || bytes(ipfs).length > 256) revert InvalidIPFS();

        // Verify commitment
        bytes32 expectedCommitment = keccak256(abi.encodePacked(ipfs, nonce));
        bytes32 actualCommitment = keccak256(abi.encodePacked(
            expectedCommitment,
            msg.sender,
            commitment.targetContract,
            commitment.commitTimestamp
        ));

        if (actualCommitment != commitmentId) revert InvalidReveal();

        // Create spec ID
        specID = keccak256(abi.encodePacked(
            ipfs,
            commitment.targetContract,
            msg.sender,
            commitment.commitTimestamp
        ));

        if (specs[specID].createdTimestamp != 0) revert AlreadyProposed();

        // Mark commitment as revealed
        commitment.isRevealed = true;

        // Create spec
        specs[specID] = ERC7730Spec({
            createdTimestamp: uint64(block.timestamp),
            proposedTimestamp: 0,
            status: Status.Submitted,
            bondsSettled: false,
            totalBonds: uint48(commitment.bondAmount),
            reserved: 0,
            creator: msg.sender,
            targetContract: commitment.targetContract,
            ipfs: ipfs,
            questionId: bytes32(0),
            incentiveId: commitment.incentiveId
        });

        // Index by contract
        contractSpecs[commitment.targetContract].push(specID);
        contractSpecCount[commitment.targetContract]++;

        emit LogRevealSpec(
            msg.sender,
            specID,
            commitmentId,
            ipfs,
            commitment.targetContract
        );

        emit LogCreateSpec(
            msg.sender,
            specID,
            ipfs,
            commitment.targetContract,
            block.timestamp,
            commitment.incentiveId
        );

        emit LogContractSpecAdded(
            commitment.targetContract,
            specID,
            msg.sender
        );

        // Auto-propose if enough bond was provided
        if (commitment.bondAmount >= minBond) {
            _proposeSpec(specID);
        }
    }

    // =============================================================================
    //                              SPEC MANAGEMENT
    // =============================================================================
    
    function proposeSpec(bytes32 specID) external payable nonReentrant whenNotPaused {
        _proposeSpec(specID);
    }

    function _proposeSpec(bytes32 specID) internal {
        ERC7730Spec storage spec = specs[specID];
        if (spec.createdTimestamp == 0) revert NotProposed();
        if (spec.status != Status.Submitted) revert AlreadyProposed();

        uint256 totalBond = spec.totalBonds + msg.value;
        
        if (totalBond < minBond) revert InsufficientBond();

        // Create Reality.eth question with 48 hour timeout
        string memory questionText = string(abi.encodePacked(spec.ipfs, " ", _addressToString(spec.targetContract)));
        
        spec.questionId = RealityETH_v3_0(realityETH).askQuestionWithMinBond{value: totalBond}(
            templateId,
            questionText,
            arbitrator,
            DEFAULT_TIMEOUT, // 48 hours - will extend by 24h on each challenge
            0,
            0,
            minBond
        );

        spec.status = Status.Proposed;
        spec.proposedTimestamp = uint64(block.timestamp);
        spec.totalBonds = uint48(totalBond);

        // Track user bonds for settlement
        userBonds[specID][msg.sender] += msg.value;

        emit LogProposeSpec(msg.sender, specID, spec.questionId, totalBond);

        // Auto-assert valid
        _assertSpecValid(specID, 0);
    }

    function assertSpecValid(bytes32 specID) external payable nonReentrant whenNotPaused {
        _assertSpecValid(specID, msg.value);
    }

    function _assertSpecValid(bytes32 specID, uint256 bondAmount) internal {
        ERC7730Spec storage spec = specs[specID];
        if (spec.createdTimestamp == 0) revert NotProposed();
        if (spec.status != Status.Proposed) revert NotProposed();

        bytes32 questionId = spec.questionId;
        if (bondAmount > 0) {
            RealityETH_v3_0(realityETH).submitAnswerFor{value: bondAmount}(
                questionId,
                bytes32(uint256(1)),
                0,
                msg.sender
            );
            userBonds[specID][msg.sender] += bondAmount;
        }

        emit LogAssertSpecValid(msg.sender, specID, questionId, bondAmount);
    }

    function assertSpecInvalid(bytes32 specID) external payable nonReentrant whenNotPaused {
        ERC7730Spec storage spec = specs[specID];
        if (spec.createdTimestamp == 0) revert NotProposed();
        if (spec.status != Status.Proposed) revert NotProposed();

        bytes32 questionId = spec.questionId;
        RealityETH_v3_0(realityETH).submitAnswerFor{value: msg.value}(
            questionId,
            bytes32(uint256(0)),
            0,
            msg.sender
        );

        userBonds[specID][msg.sender] += msg.value;
        emit LogAssertSpecInvalid(msg.sender, specID, questionId, msg.value);
    }

    function handleResult(bytes32 specID) external nonReentrant whenNotPaused {
        ERC7730Spec storage spec = specs[specID];
        if (spec.status != Status.Proposed) revert NotProposed();

        // Check if Reality.eth question is finalized
        if (!RealityETH_v3_0(realityETH).isFinalized(spec.questionId)) revert NotFinalized();

        bytes32 result = RealityETH_v3_0(realityETH).resultFor(spec.questionId);
        bool isAccepted = uint256(result) == 1;

        spec.status = Status.Finalized;
        emit LogHandleResult(specID, isAccepted);

        // Handle incentive claiming
        if (spec.incentiveId != bytes32(0) && isAccepted) {
            _claimIncentive(spec.incentiveId, specID, spec.creator);
        }
    }

    function _claimIncentive(bytes32 incentiveId, bytes32 specID, address claimer) internal {
        IncentiveData storage incentive = incentives[incentiveId];
        if (incentive.isClaimed || !incentive.isActive) revert NoIncentiveToClaim();
        if (block.timestamp > incentive.deadline) revert IncentiveExpired();

        incentive.isClaimed = true;
        incentive.isActive = false;

        uint256 platformFee = (incentive.amount * PLATFORM_FEE_PERCENT) / 100;
        uint256 claimerAmount = incentive.amount - platformFee;

        if (incentive.token == address(0)) {
            // ETH payout
            payable(claimer).transfer(claimerAmount);
            payable(treasury).transfer(platformFee);
        } else {
            // ERC20 payout
            IERC20(incentive.token).safeTransfer(claimer, claimerAmount);
            IERC20(incentive.token).safeTransfer(treasury, platformFee);
        }

        emit LogIncentiveClaimed(incentiveId, claimer, specID, claimerAmount);
    }

    // =============================================================================
    //                              BOND SETTLEMENT
    // =============================================================================
    
    function settleBonds(bytes32 specID) external nonReentrant whenNotPaused {
        ERC7730Spec storage spec = specs[specID];
        if (spec.status != Status.Finalized) revert NotFinalized();
        if (bondsSettled[specID]) revert AlreadySettled();

        bytes32 result = RealityETH_v3_0(realityETH).resultFor(spec.questionId);
        bool specAccepted = uint256(result) == 1;
        
        address winner = specAccepted ? spec.creator : address(this); // Placeholder
        uint256 totalBonds = spec.totalBonds;
        uint256 platformFee = (totalBonds * PLATFORM_FEE_PERCENT) / 100;
        uint256 payout = totalBonds - platformFee;

        if (payout > 0 && winner != address(this)) {
            payable(winner).transfer(payout);
            payable(treasury).transfer(platformFee);
        }

        bondsSettled[specID] = true;
        emit LogBondsSettled(specID, winner, payout);
    }

    // =============================================================================
    //                              QUERY FUNCTIONS
    // =============================================================================
    
    function getSpecsByContract(address targetContract) external view returns (bytes32[] memory) {
        return contractSpecs[targetContract];
    }

    function getSpecsByContractPaginated(
        address targetContract,
        uint256 offset,
        uint256 limit
    ) external view returns (bytes32[] memory specIds, uint256 total) {
        bytes32[] storage allSpecs = contractSpecs[targetContract];
        total = allSpecs.length;
        
        if (offset >= total) {
            return (new bytes32[](0), total);
        }
        
        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }
        
        specIds = new bytes32[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            specIds[i - offset] = allSpecs[i];
        }
    }

    function getContractSpecCount(address targetContract) external view returns (uint256) {
        return contractSpecCount[targetContract];
    }

    function getUserIncentives(address user) external view returns (bytes32[] memory) {
        return userIncentives[user];
    }

    // =============================================================================
    //                              UTILITY FUNCTIONS
    // =============================================================================
    
    function _addressToString(address addr) internal pure returns (string memory) {
        bytes memory data = abi.encodePacked(addr);
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(2 + data.length * 2);
        str[0] = "0";
        str[1] = "x";
        for (uint256 i = 0; i < data.length; i++) {
            str[2+i*2] = alphabet[uint8(data[i] >> 4)];
            str[3+i*2] = alphabet[uint8(data[i] & 0x0f)];
        }
        return string(str);
    }

    // =============================================================================
    //                              LEGACY COMPATIBILITY
    // =============================================================================
    
    // Keep some old function signatures for compatibility
    function createSpec(string calldata ipfs) external payable {
        revert("Use commitSpec instead");
    }

    function getStatus(string calldata ipfs) external view returns (Status) {
        bytes32 id = keccak256(bytes(ipfs));
        return specs[id].status;
    }

    function getCreatedTimestamp(string calldata ipfs) external view returns (uint64) {
        bytes32 id = keccak256(bytes(ipfs));
        return specs[id].createdTimestamp;
    }

    function isAccepted(string calldata ipfs) external view returns (bool) {
        bytes32 id = keccak256(bytes(ipfs));
        return specs[id].status == Status.Finalized;
    }
}
