// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.13;

import {RealityETH_v3_0} from "../staticlib/RealityETH-3.0.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

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
    error ClawbackTooEarly();
    error IncentiveAlreadyActive();

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
    uint256 public constant INCENTIVE_CLAWBACK_PERIOD = 90 days; // 3 months
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
    
    // Contract address integration with chain support
    mapping(uint256 => mapping(address => bytes32[])) public contractSpecs;
    mapping(uint256 => mapping(address => uint256)) public contractSpecCount;
    
    // Incentive system
    mapping(bytes32 => IncentiveData) public incentives;
    mapping(address => bytes32[]) public userIncentives;
    mapping(uint256 => mapping(address => mapping(address => bytes32))) public currentIncentive;
    
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
        uint80 totalBonds;          // 10 bytes (up to ~1.2M ETH)
        uint32 reserved;            // 4 bytes - reserved for future use
        // SLOT 1: 32 bytes total (perfectly packed!)
        
        address creator;            // 20 bytes  
        address targetContract;     // 20 bytes - contract this spec validates
        // SLOT 2: 40 bytes - needs 2 slots but efficiently packed
        
        string ipfs;               // Dynamic - separate slots when needed
        bytes32 questionId;        // 32 bytes - full slot
        bytes32 incentiveId;       // 32 bytes - linked incentive if any
        uint256 chainId;           // 32 bytes - target chain ID
        // SLOTS 3+: Only when spec has IPFS/questionId/incentiveId/chainId
    }

    struct CommitData {
        address committer;          // 20 bytes
        uint64 commitTimestamp;     // 8 bytes
        uint32 reserved1;           // 4 bytes - reserved for future use
        // SLOT 1: 32 bytes total (perfectly packed!)
        
        address targetContract;     // 20 bytes
        bool isRevealed;            // 1 byte
        uint80 bondAmount;          // 10 bytes (up to 1.2M ETH)
        uint8 reserved;             // 1 byte - for alignment
        // SLOT 2: 32 bytes total (perfectly packed!)
        
        uint64 revealDeadline;      // 8 bytes (safe until year 2554)
        uint256 chainId;            // 32 bytes - target chain ID
        bytes32 incentiveId;        // 32 bytes - if incentivized
        // SLOTS 3-4: Chain ID and incentive data
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
        
        uint256 chainId;            // 32 bytes - target chain ID
        string description;         // Dynamic - separate slots when needed
        // SLOT 4: Chain ID, SLOT 5+: Description when exists
    }

    // =============================================================================
    //                                  EVENTS
    // =============================================================================
    event LogCommitSpec(
        address indexed committer,
        bytes32 indexed commitmentId,
        address indexed targetContract,
        uint256 chainId,
        uint256 bondAmount,
        uint64 revealDeadline
    );

    event LogRevealSpec(
        address indexed creator,
        bytes32 indexed specID,
        bytes32 indexed commitmentId,
        string ipfs,
        address targetContract,
        uint256 chainId
    );

    event LogCreateSpec(
        address indexed creator,
        bytes32 indexed specID,
        string ipfs,
        address indexed targetContract,
        uint256 chainId,
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
        uint256 chainId,
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

    event LogIncentiveClawback(
        bytes32 indexed incentiveId,
        address indexed creator,
        uint256 amount
    );

    event LogContractSpecAdded(
        address indexed targetContract,
        bytes32 indexed specID,
        address indexed creator,
        uint256 chainId
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
            '{"title": "Is the ERC7730 specification %s for contract %s on chain %s correct?", "type": "bool", "category": "misc"}'
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
        uint256 targetChainId,
        address token, // address(0) for ETH
        uint256 amount,
        uint64 duration,
        string calldata description
    ) external payable nonReentrant whenNotPaused returns (bytes32 incentiveId) {
        if (targetContract == address(0)) revert InvalidContract();
        if (targetChainId == 0) revert InvalidContract();
        if (amount > type(uint128).max) revert InsufficientIncentive(); // Prevent overflow
        if (duration == 0 || duration > 30 days) revert IncentiveExpired();
        
        incentiveId = keccak256(abi.encodePacked(
            msg.sender,
            targetContract,
            targetChainId,
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
            chainId: targetChainId,
            description: description
        });

        userIncentives[msg.sender].push(incentiveId);

        bytes32 active = currentIncentive[targetChainId][targetContract][token];
        if (active != bytes32(0)) {
            IncentiveData storage existing = incentives[active];
            if (existing.isActive && !existing.isClaimed && block.timestamp <= existing.deadline) {
                revert IncentiveAlreadyActive();
            }
        }
        currentIncentive[targetChainId][targetContract][token] = incentiveId;

        emit LogIncentiveCreated(
            incentiveId,
            msg.sender,
            targetContract,
            targetChainId,
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
        uint256 targetChainId
    ) external payable nonReentrant whenNotPaused {
        if (targetContract == address(0)) revert InvalidContract();
        if (targetChainId == 0) revert InvalidContract();
        // No overflow check needed - using uint256 throughout
        
        if (msg.value < minBond) revert InsufficientBond();
        
        // Check for uint80 overflow before storing bond amount
        uint256 platformFee = (msg.value * PLATFORM_FEE_PERCENT) / 100;
        uint256 netBondAmount = msg.value - platformFee;
        if (netBondAmount > type(uint80).max) revert InsufficientBond(); // Prevent overflow


        uint64 currentTime = uint64(block.timestamp);

        bytes32 commitmentId = keccak256(abi.encodePacked(
            commitment,
            msg.sender,
            targetContract,
            targetChainId,
            currentTime
        ));

        commitments[commitmentId] = CommitData({
            committer: msg.sender,
            commitTimestamp: currentTime,
            reserved1: 0,
            targetContract: targetContract,
            isRevealed: false,
            bondAmount: uint80(netBondAmount),
            reserved: 0,
            revealDeadline: currentTime + uint64(COMMIT_REVEAL_TIMEOUT),
            chainId: targetChainId,
            incentiveId: bytes32(0)
        });
        
        if (platformFee > 0) {
            (bool success, ) = treasury.call{value: platformFee, gas: 50000}("");
            require(success, "Treasury transfer failed");
        }

        emit LogCommitSpec(
            msg.sender,
            commitmentId,
            targetContract,
            targetChainId,
            msg.value,
            currentTime + uint64(COMMIT_REVEAL_TIMEOUT)
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
        {
            bytes memory ipfsBytes = bytes(ipfs);
            bytes memory delimBytes = bytes(unicode"␟");
            if (ipfsBytes.length >= delimBytes.length) {
                for (uint256 i = 0; i <= ipfsBytes.length - delimBytes.length; i++) {
                    bool matchDelim = true;
                    for (uint256 j = 0; j < delimBytes.length; j++) {
                        if (ipfsBytes[i + j] != delimBytes[j]) {
                            matchDelim = false;
                            break;
                        }
                    }
                    if (matchDelim) {
                        revert InvalidIPFS();
                    }
                }
            }
        }

        // Verify commitment: reconstruct the original commitmentId
        bytes32 expectedCommitment = keccak256(abi.encodePacked(ipfs, nonce));
        bytes32 reconstructedCommitmentId = keccak256(abi.encodePacked(
            expectedCommitment,
            commitment.committer,
            commitment.targetContract,
            commitment.chainId,
            commitment.commitTimestamp
        ));

        if (reconstructedCommitmentId != commitmentId) revert InvalidReveal();

        // Create spec ID
        specID = keccak256(abi.encodePacked(
            ipfs,
            commitment.targetContract,
            commitment.chainId,
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
            totalBonds: uint80(commitment.bondAmount),
            reserved: 0,
            creator: msg.sender,
            targetContract: commitment.targetContract,
            ipfs: ipfs,
            questionId: bytes32(0),
            incentiveId: bytes32(0),
            chainId: commitment.chainId
        });

        // Index by contract and chain
        contractSpecs[commitment.chainId][commitment.targetContract].push(specID);
        contractSpecCount[commitment.chainId][commitment.targetContract]++;

        emit LogRevealSpec(
            msg.sender,
            specID,
            commitmentId,
            ipfs,
            commitment.targetContract,
            commitment.chainId
        );

        emit LogCreateSpec(
            msg.sender,
            specID,
            ipfs,
            commitment.targetContract,
            commitment.chainId,
            block.timestamp,
            bytes32(0)
        );

        emit LogContractSpecAdded(
            commitment.targetContract,
            specID,
            msg.sender,
            commitment.chainId
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
        if (totalBond > type(uint80).max) revert InsufficientBond(); // Prevent overflow

        // 1. CHECKS - All validation done above
        
        // 2. EFFECTS - Update state before external calls
        spec.status = Status.Proposed;
        spec.proposedTimestamp = uint64(block.timestamp);
        spec.totalBonds = uint80(totalBond);
        
        // Track user bonds for settlement
        userBonds[specID][msg.sender] += msg.value;

        // 3. INTERACTIONS - External calls last
         // Create Reality.eth question with 48 hour timeout
        string memory delim = unicode"␟";
        string memory questionParams = string(abi.encodePacked(
            spec.ipfs,
            delim,
            _addressToString(spec.targetContract),
            delim,
            _uint256ToString(spec.chainId)
        ));

        spec.questionId = RealityETH_v3_0(realityETH).askQuestionWithMinBond{value: totalBond}(
            templateId,
            questionParams,
            arbitrator,
            DEFAULT_TIMEOUT, // 48 hours - will extend by 24h on each challenge
            0,
            0,
            minBond
        );

        emit LogProposeSpec(msg.sender, specID, spec.questionId, totalBond);

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
        bool specAccepted = uint256(result) == 1;

        spec.status = Status.Finalized;
        emit LogHandleResult(specID, specAccepted);

        if (specAccepted) {
            bytes32 ethIncId = currentIncentive[spec.chainId][spec.targetContract][address(0)];
            if (ethIncId != bytes32(0)) {
                IncentiveData storage inc = incentives[ethIncId];
                if (inc.isActive && !inc.isClaimed && block.timestamp <= inc.deadline) {
                    // claim and clear the current incentive mapping
                    currentIncentive[spec.chainId][spec.targetContract][address(0)] = bytes32(0);
                    _claimIncentive(ethIncId, specID, spec.creator);
                }
            }
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
            (bool success, ) = treasury.call{value: platformFee, gas: 50000}("");
            require(success, "Treasury transfer failed");
        } else {
            // ERC20 payout
            IERC20(incentive.token).safeTransfer(claimer, claimerAmount);
            IERC20(incentive.token).safeTransfer(treasury, platformFee);
        }

        emit LogIncentiveClaimed(incentiveId, claimer, specID, claimerAmount);
    }

    // Allow incentive creators to reclaim funds after 3 months if unclaimed
    function clawbackIncentive(bytes32 incentiveId) external nonReentrant whenNotPaused {
        IncentiveData storage incentive = incentives[incentiveId];
        
        if (incentive.creator != msg.sender) revert Unauthorized();
        if (incentive.isClaimed || !incentive.isActive) revert NoIncentiveToClaim();
        if (block.timestamp < incentive.createdAt + INCENTIVE_CLAWBACK_PERIOD) revert ClawbackTooEarly();
        
        // Mark as inactive and claimed to prevent double-spending
        incentive.isClaimed = true;
        incentive.isActive = false;
        
        uint256 clawbackAmount = incentive.amount;
        
        if (incentive.token == address(0)) {
            // ETH clawback - no platform fee on clawback
            payable(msg.sender).transfer(clawbackAmount);
        } else {
            // ERC20 clawback - no platform fee on clawback
            IERC20(incentive.token).safeTransfer(msg.sender, clawbackAmount);
        }

        currentIncentive[incentive.chainId][incentive.targetContract][incentive.token] = bytes32(0);
        
        emit LogIncentiveClawback(incentiveId, msg.sender, clawbackAmount);
    }

    /**
     * @notice Claim an active ERC20 token incentive for a finalized and accepted spec.
     * @dev ETH incentives are claimed automatically in handleResult, so only non-zero
     *      token addresses should be passed here. Reverts if the spec is not finalized,
     *      the caller is not the spec creator, or there is no active incentive for
     *      this token.
     * @param specID The spec identifier for which to claim the incentive
     * @param token The ERC20 token address of the incentive to claim
     */
    function claimActiveTokenIncentive(bytes32 specID, address token) external nonReentrant whenNotPaused {
        if (token == address(0)) revert InvalidContract(); // ETH incentives claimed via handleResult
        ERC7730Spec storage spec = specs[specID];
        if (spec.status != Status.Finalized) revert NotFinalized();
        // Only the creator of the accepted spec can claim the incentive
        if (msg.sender != spec.creator) revert Unauthorized();
        bytes32 incId = currentIncentive[spec.chainId][spec.targetContract][token];
        if (incId == bytes32(0)) revert NoIncentiveToClaim();
        IncentiveData storage inc = incentives[incId];
        if (!inc.isActive || inc.isClaimed || block.timestamp > inc.deadline) revert NoIncentiveToClaim();
        // Clear mapping to allow future incentives for this token
        currentIncentive[spec.chainId][spec.targetContract][token] = bytes32(0);
        _claimIncentive(incId, specID, spec.creator);
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

        bondsSettled[specID] = true;
        
        if (payout > 0 && winner != address(this)) {
            payable(winner).transfer(payout);
            (bool success, ) = treasury.call{value: platformFee, gas: 50000}("");
            require(success, "Treasury transfer failed");
        }

        emit LogBondsSettled(specID, winner, payout);
    }

    // =============================================================================
    //                              QUERY FUNCTIONS
    // =============================================================================
    
    function getSpecsByContract(address targetContract, uint256 chainId) external view returns (bytes32[] memory) {
        return contractSpecs[chainId][targetContract];
    }

    function getSpecsByContractPaginated(
        address targetContract,
        uint256 chainId,
        uint256 offset,
        uint256 limit
    ) external view returns (bytes32[] memory specIds, uint256 total) {
        bytes32[] storage allSpecs = contractSpecs[chainId][targetContract];
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

    function getContractSpecCount(address targetContract, uint256 chainId) external view returns (uint256) {
        return contractSpecCount[chainId][targetContract];
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

    function _uint256ToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    // =============================================================================
    //                              LEGACY COMPATIBILITY
    // =============================================================================
    
    function createSpec(string calldata /* ipfs */) external payable {
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
        Status specStatus = specs[id].status;
        return uint8(specStatus) == uint8(Status.Finalized) && specStatus == Status.Finalized;
    }
}