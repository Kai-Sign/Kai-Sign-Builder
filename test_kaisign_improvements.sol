// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.13;

import {RealityETH_v3_0} from "../contracts/staticlib/RealityETH-3.0.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Enhanced KaiSign Contract
 * @dev Improved version incorporating patterns from TruthMarket and ConditionalTokens
 */
contract EnhancedKaiSign is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    // ============ CONSTANTS & IMMUTABLES ============
    string public constant VERSION = "2.0.0";
    uint256 private constant _HUNDRED_PERCENT = 1e18;
    uint256 private constant _BOND_CLAIM_FEE_PROPORTION = 40; // 2.5%
    
    // ============ CUSTOM ERRORS ============
    error AlreadyProposed();
    error NotProposed();
    error InsufficientBond();
    error ContractPaused();
    error TooManySpecs();
    error CreationFeeRequired();
    error InvalidStatus();
    error InvalidOutcome();
    error InvalidTransition();
    error Unauthorized();
    error InvalidAddress();
    error InvalidTimeoutPeriod();
    error EmergencyNotInitiated();
    error EmergencyTooEarly();
    error SpecNotFinalized();
    error BondsAlreadySettled();

    // ============ ENUMS ============
    enum Status {
        Submitted,     // 0 - Initial state
        Proposed,      // 1 - Question created on Reality.eth
        Challenged,    // 2 - Someone disputed the current answer
        Finalized,     // 3 - Final result determined
        Emergency,     // 4 - Emergency resolution in progress
        Cancelled      // 5 - Cancelled/invalid
    }

    enum SpecType {
        Standard,      // 0 - Regular ERC7730 spec
        Critical,      // 1 - High-impact spec requiring higher bonds
        Experimental   // 2 - Experimental spec with different rules
    }

    // ============ STRUCTS ============
    struct ERC7730Spec {
        uint64 createdTimestamp;
        uint64 proposedTimestamp;
        uint64 finalizedTimestamp;
        Status status;
        SpecType specType;
        address creator;
        string ipfs;
        bytes32 questionId;
        uint256 totalBonds;
        uint256 creationFee;
        bool bondsSettled;
    }

    struct StatusChange {
        Status status;
        uint256 timestamp;
        address actor;
        uint256 bondAmount;
    }

    struct SpecConfig {
        uint256 minBond;
        uint256 creationFee;
        uint32 timeout;
        uint32 challengePeriod;
        bool requiresStaking;
    }

    struct UserStats {
        uint256 specsCreated;
        uint256 successfulSpecs;
        uint256 totalBondsWon;
        uint256 totalBondsLost;
        bool isBlacklisted;
    }

    // ============ STATE VARIABLES ============
    address public realityETH;
    address public arbitrator;
    address public safeBoxAddress;
    uint256 public templateId;
    bool public paused;
    
    // Configuration by spec type
    mapping(SpecType => SpecConfig) public specConfigs;
    
    // Core spec data
    mapping(bytes32 => ERC7730Spec) public specs;
    mapping(bytes32 => address) public specCreators;
    mapping(bytes32 => StatusChange[]) public statusHistory;
    
    // User management
    mapping(address => UserStats) public userStats;
    mapping(address => uint256) public userSpecCount;
    mapping(address => mapping(SpecType => uint256)) public userSpecCountByType;
    
    // Emergency mechanisms
    mapping(bytes32 => uint256) public emergencyTimestamps;
    mapping(bytes32 => address) public emergencyInitiators;
    uint256 public constant EMERGENCY_TIMEOUT = 7 days;
    
    // Bond management (similar to TruthMarket pattern)
    mapping(bytes32 => mapping(address => uint256)) public userBonds;
    mapping(bytes32 => address[]) public bondHolders;
    
    // Fee collection
    IERC20 public feeToken;
    uint256 public collectedFees;
    
    // Rate limiting
    mapping(address => uint256) public lastActionTimestamp;
    uint256 public constant MIN_ACTION_INTERVAL = 1 minutes;

    // ============ EVENTS ============
    event LogCreateSpec(address indexed user, address indexed creator, bytes32 indexed specID, string ipfs, SpecType specType);
    event LogProposeSpec(address indexed user, address indexed creator, bytes32 indexed specID, bytes32 questionId, uint256 bond);
    event LogAssertSpecValid(address indexed user, bytes32 indexed specID, bytes32 questionId, uint256 bond);
    event LogAssertSpecInvalid(address indexed user, bytes32 indexed specID, bytes32 questionId, uint256 bond);
    event LogHandleResult(bytes32 indexed specID, address indexed creator, bool isAccepted, uint256 timestamp);
    event LogStatusChange(bytes32 indexed specID, Status from, Status to, address indexed actor, uint256 bondAmount);
    event LogEmergencyInitiated(bytes32 indexed specID, address indexed initiator, uint256 timestamp);
    event LogEmergencyResolved(bytes32 indexed specID, bool isValid, address indexed resolver);
    event LogBondsSettled(bytes32 indexed specID, address indexed winner, uint256 amount);
    event LogUserBlacklisted(address indexed user, address indexed admin);
    event LogUserUnblacklisted(address indexed user, address indexed admin);
    event LogConfigUpdated(SpecType specType, SpecConfig config);
    event LogPaused(address indexed admin);
    event LogUnpaused(address indexed admin);

    // ============ MODIFIERS ============
    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }
    
    modifier onlySpecCreator(bytes32 specID) {
        if (msg.sender != specCreators[specID]) revert Unauthorized();
        _;
    }
    
    modifier onlyValidAddress(address addr) {
        if (addr == address(0)) revert InvalidAddress();
        _;
    }
    
    modifier rateLimit() {
        if (block.timestamp < lastActionTimestamp[msg.sender] + MIN_ACTION_INTERVAL) {
            revert("Rate limited");
        }
        lastActionTimestamp[msg.sender] = block.timestamp;
        _;
    }
    
    modifier notBlacklisted(address user) {
        if (userStats[user].isBlacklisted) revert("User blacklisted");
        _;
    }

    // ============ CONSTRUCTOR & INITIALIZATION ============
    function initialize(
        address _realityETH,
        address _arbitrator,
        address _safeBoxAddress,
        address _feeToken
    ) external initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
        
        if (_realityETH == address(0) || _arbitrator == address(0) || _safeBoxAddress == address(0)) {
            revert InvalidAddress();
        }
        
        realityETH = _realityETH;
        arbitrator = _arbitrator;
        safeBoxAddress = _safeBoxAddress;
        feeToken = IERC20(_feeToken);
        
        templateId = RealityETH_v3_0(realityETH).createTemplate(
            '{"title": "Is the ERC7730 spec %s correct?", "type": "bool", "category": "technology", "lang": "en"}'
        );
        
        // Initialize default configurations
        _initializeConfigs();
    }
    
    function _initializeConfigs() private {
        // Standard specs
        specConfigs[SpecType.Standard] = SpecConfig({
            minBond: 0.01 ether,
            creationFee: 0.001 ether,
            timeout: 24 hours,
            challengePeriod: 2 hours,
            requiresStaking: false
        });
        
        // Critical specs - higher requirements
        specConfigs[SpecType.Critical] = SpecConfig({
            minBond: 0.1 ether,
            creationFee: 0.01 ether,
            timeout: 72 hours,
            challengePeriod: 12 hours,
            requiresStaking: true
        });
        
        // Experimental specs - lower barriers
        specConfigs[SpecType.Experimental] = SpecConfig({
            minBond: 0.005 ether,
            creationFee: 0.0005 ether,
            timeout: 12 hours,
            challengePeriod: 1 hours,
            requiresStaking: false
        });
    }

    // ============ MAIN FUNCTIONALITY ============
    
    /**
     * @dev Create a new ERC7730 spec with enhanced security and type classification
     */
    function createSpec(
        string calldata ipfs,
        SpecType specType,
        uint256 nonce
    ) external payable nonReentrant whenNotPaused rateLimit notBlacklisted(msg.sender) {
        SpecConfig memory config = specConfigs[specType];
        
        if (msg.value < config.creationFee) revert CreationFeeRequired();
        if (userSpecCountByType[msg.sender][specType] >= _getMaxSpecsForType(specType)) revert TooManySpecs();
        
        // Generate collision-resistant spec ID
        bytes32 specID = keccak256(abi.encodePacked(
            ipfs, 
            msg.sender, 
            nonce, 
            block.number, 
            block.timestamp,
            specType
        ));
        
        if (specs[specID].createdTimestamp != 0) revert AlreadyProposed();
        
        // Create spec with comprehensive data
        specs[specID] = ERC7730Spec({
            createdTimestamp: uint64(block.timestamp),
            proposedTimestamp: 0,
            finalizedTimestamp: 0,
            status: Status.Submitted,
            specType: specType,
            creator: msg.sender,
            ipfs: ipfs,
            questionId: bytes32(0),
            totalBonds: 0,
            creationFee: config.creationFee,
            bondsSettled: false
        });
        
        specCreators[specID] = msg.sender;
        userSpecCount[msg.sender]++;
        userSpecCountByType[msg.sender][specType]++;
        userStats[msg.sender].specsCreated++;
        
        // Record status change
        _recordStatusChange(specID, Status.Submitted, msg.sender, config.creationFee);
        
        // Collect creation fee
        if (address(feeToken) != address(0) && config.creationFee > 0) {
            collectedFees += config.creationFee;
        }
        
        emit LogCreateSpec(msg.sender, msg.sender, specID, ipfs, specType);
        
        // Auto-propose if additional funds provided
        uint256 remainingValue = msg.value - config.creationFee;
        if (remainingValue >= config.minBond) {
            _proposeSpecInternal(specID, remainingValue);
        }
    }
    
    /**
     * @dev Propose a spec to Reality.eth with proper bond validation
     */
    function proposeSpecByHash(bytes32 specID) external payable nonReentrant whenNotPaused rateLimit {
        ERC7730Spec memory spec = specs[specID];
        if (spec.createdTimestamp == 0) revert NotProposed();
        if (spec.questionId != bytes32(0)) revert AlreadyProposed();
        
        SpecConfig memory config = specConfigs[spec.specType];
        if (msg.value < config.minBond) revert InsufficientBond();
        
        _proposeSpecInternal(specID, msg.value);
    }
    
    function _proposeSpecInternal(bytes32 specID, uint256 bondAmount) internal {
        ERC7730Spec storage spec = specs[specID];
        SpecConfig memory config = specConfigs[spec.specType];
        
        // Create question on Reality.eth
        bytes32 questionId = RealityETH_v3_0(realityETH).askQuestionWithMinBond{value: bondAmount}(
            templateId,
            spec.ipfs,
            arbitrator,
            config.timeout,
            0,
            0,
            config.minBond
        );
        
        // Update spec state
        spec.questionId = questionId;
        spec.proposedTimestamp = uint64(block.timestamp);
        spec.status = Status.Proposed;
        spec.totalBonds += bondAmount;
        
        // Track bonds
        userBonds[specID][msg.sender] += bondAmount;
        if (userBonds[specID][msg.sender] == bondAmount) {
            bondHolders[specID].push(msg.sender);
        }
        
        _recordStatusChange(specID, Status.Proposed, msg.sender, bondAmount);
        
        emit LogProposeSpec(msg.sender, spec.creator, specID, questionId, bondAmount);
    }
    
    /**
     * @dev Assert spec validity with enhanced bond tracking
     */
    function assertSpecValidByHash(bytes32 specID) external payable nonReentrant whenNotPaused rateLimit {
        _assertSpec(specID, true, msg.value);
    }
    
    function assertSpecInvalidByHash(bytes32 specID) external payable nonReentrant whenNotPaused rateLimit {
        _assertSpec(specID, false, msg.value);
    }
    
    function _assertSpec(bytes32 specID, bool isValid, uint256 bondAmount) internal {
        ERC7730Spec storage spec = specs[specID];
        if (spec.questionId == bytes32(0)) revert NotProposed();
        if (bondAmount == 0) revert InsufficientBond();
        
        bytes32 questionId = spec.questionId;
        bytes32 answer = isValid ? bytes32(uint256(1)) : bytes32(uint256(0));
        
        // Submit answer to Reality.eth
        RealityETH_v3_0(realityETH).submitAnswerFor{value: bondAmount}(
            questionId,
            answer,
            0,
            msg.sender
        );
        
        // Update bonds tracking
        spec.totalBonds += bondAmount;
        userBonds[specID][msg.sender] += bondAmount;
        
        if (userBonds[specID][msg.sender] == bondAmount) {
            bondHolders[specID].push(msg.sender);
        }
        
        if (isValid) {
            emit LogAssertSpecValid(msg.sender, specID, questionId, bondAmount);
        } else {
            emit LogAssertSpecInvalid(msg.sender, specID, questionId, bondAmount);
        }
    }
    
    /**
     * @dev Handle question result with comprehensive finalization
     */
    function handleResultByHash(bytes32 specID) external nonReentrant whenNotPaused {
        ERC7730Spec storage spec = specs[specID];
        if (spec.questionId == bytes32(0)) revert NotProposed();
        if (spec.status == Status.Finalized) revert("Already finalized");
        
        // Get result from Reality.eth
        bytes32 result = RealityETH_v3_0(realityETH).resultFor(spec.questionId);
        bool isAccepted = uint256(result) == uint256(1);
        
        // Update spec state
        spec.status = Status.Finalized;
        spec.finalizedTimestamp = uint64(block.timestamp);
        
        // Update user stats
        if (isAccepted) {
            userStats[spec.creator].successfulSpecs++;
        }
        
        _recordStatusChange(specID, Status.Finalized, msg.sender, 0);
        
        emit LogHandleResult(specID, spec.creator, isAccepted, block.timestamp);
        
        // Auto-settle bonds if possible
        if (!spec.bondsSettled) {
            _settleBonds(specID);
        }
    }
    
    /**
     * @dev Settle bonds similar to TruthMarket pattern
     */
    function settleBonds(bytes32 specID) external nonReentrant whenNotPaused {
        _settleBonds(specID);
    }
    
    function _settleBonds(bytes32 specID) internal {
        ERC7730Spec storage spec = specs[specID];
        if (spec.status != Status.Finalized) revert SpecNotFinalized();
        if (spec.bondsSettled) revert BondsAlreadySettled();
        
        // Get the winning answer
        bytes32 result = RealityETH_v3_0(realityETH).resultFor(spec.questionId);
        bool specAccepted = uint256(result) == uint256(1);
        
        // Find the winning bond holder (simplified logic)
        address winner = address(0);
        uint256 totalPayout = 0;
        
        // In a real implementation, this would follow Reality.eth's bond distribution logic
        // For now, we'll distribute to the spec creator if accepted, or to the safe box if rejected
        if (specAccepted) {
            winner = spec.creator;
            totalPayout = (spec.totalBonds * 95) / 100; // 95% to winner, 5% as fee
            userStats[winner].totalBondsWon += totalPayout;
        } else {
            winner = safeBoxAddress;
            totalPayout = spec.totalBonds;
        }
        
        if (totalPayout > 0 && winner != address(0)) {
            collectedFees += spec.totalBonds - totalPayout;
            payable(winner).transfer(totalPayout);
        }
        
        spec.bondsSettled = true;
        emit LogBondsSettled(specID, winner, totalPayout);
    }
    
    // ============ EMERGENCY MECHANISMS ============
    
    function initiateEmergencyResolution(bytes32 specID) external onlyOwner {
        ERC7730Spec storage spec = specs[specID];
        if (spec.status == Status.Finalized) revert("Already finalized");
        
        emergencyTimestamps[specID] = block.timestamp;
        emergencyInitiators[specID] = msg.sender;
        spec.status = Status.Emergency;
        
        _recordStatusChange(specID, Status.Emergency, msg.sender, 0);
        
        emit LogEmergencyInitiated(specID, msg.sender, block.timestamp);
    }
    
    function executeEmergencyResolution(bytes32 specID, bool isValid) external onlyOwner {
        if (emergencyTimestamps[specID] == 0) revert EmergencyNotInitiated();
        if (block.timestamp < emergencyTimestamps[specID] + EMERGENCY_TIMEOUT) revert EmergencyTooEarly();
        
        ERC7730Spec storage spec = specs[specID];
        spec.status = isValid ? Status.Finalized : Status.Cancelled;
        spec.finalizedTimestamp = uint64(block.timestamp);
        
        _recordStatusChange(specID, spec.status, msg.sender, 0);
        
        emit LogEmergencyResolved(specID, isValid, msg.sender);
        emit LogHandleResult(specID, spec.creator, isValid, block.timestamp);
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    function updateSpecConfig(SpecType specType, SpecConfig calldata config) external onlyOwner {
        if (config.timeout > 30 days) revert InvalidTimeoutPeriod();
        specConfigs[specType] = config;
        emit LogConfigUpdated(specType, config);
    }
    
    function blacklistUser(address user) external onlyOwner onlyValidAddress(user) {
        userStats[user].isBlacklisted = true;
        emit LogUserBlacklisted(user, msg.sender);
    }
    
    function unblacklistUser(address user) external onlyOwner onlyValidAddress(user) {
        userStats[user].isBlacklisted = false;
        emit LogUserUnblacklisted(user, msg.sender);
    }
    
    function pause() external onlyOwner {
        paused = true;
        emit LogPaused(msg.sender);
    }
    
    function unpause() external onlyOwner {
        paused = false;
        emit LogUnpaused(msg.sender);
    }
    
    function withdrawFees() external onlyOwner {
        uint256 amount = collectedFees;
        collectedFees = 0;
        payable(safeBoxAddress).transfer(amount);
    }
    
    function emergencyWithdraw() external onlyOwner {
        payable(safeBoxAddress).transfer(address(this).balance);
    }
    
    // ============ VIEW FUNCTIONS ============
    
    function getSpecHistory(bytes32 specID) external view returns (StatusChange[] memory) {
        return statusHistory[specID];
    }
    
    function getUserStats(address user) external view returns (UserStats memory) {
        return userStats[user];
    }
    
    function getSpecConfig(SpecType specType) external view returns (SpecConfig memory) {
        return specConfigs[specType];
    }
    
    function getBondHolders(bytes32 specID) external view returns (address[] memory) {
        return bondHolders[specID];
    }
    
    function getUserBond(bytes32 specID, address user) external view returns (uint256) {
        return userBonds[specID][user];
    }
    
    function isQuestionFinalized(bytes32 specID) external view returns (bool) {
        if (specs[specID].questionId == bytes32(0)) return false;
        return RealityETH_v3_0(realityETH).isFinalized(specs[specID].questionId);
    }
    
    function canHandleResult(bytes32 specID) external view returns (bool) {
        ERC7730Spec memory spec = specs[specID];
        return spec.questionId != bytes32(0) && 
               spec.status != Status.Finalized && 
               this.isQuestionFinalized(specID);
    }
    
    // ============ INTERNAL HELPERS ============
    
    function _recordStatusChange(bytes32 specID, Status status, address actor, uint256 bondAmount) internal {
        statusHistory[specID].push(StatusChange({
            status: status,
            timestamp: block.timestamp,
            actor: actor,
            bondAmount: bondAmount
        }));
        
        emit LogStatusChange(specID, specs[specID].status, status, actor, bondAmount);
    }
    
    function _getMaxSpecsForType(SpecType specType) internal pure returns (uint256) {
        if (specType == SpecType.Critical) return 3;
        if (specType == SpecType.Experimental) return 50;
        return 10; // Standard
    }
    
    // ============ EMERGENCY FUNCTIONS ============
    
    receive() external payable {
        // Allow receiving ETH for bonds
    }
} 