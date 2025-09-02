// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ISuccinctGateway {
    function verifyProof(
        bytes32 programId,
        bytes calldata publicInputs,
        bytes calldata proof
    ) external view returns (bool);
}

/**
 * @title SuccinctEigenDAVerifier
 * @notice On-chain verification of EigenDA blob decoding using Succinct ZK proofs
 * @dev This contract enables trustless verification that EigenDA blobs were correctly decoded
 */
contract SuccinctEigenDAVerifier {
    ISuccinctGateway public immutable succinctGateway;
    bytes32 public immutable eigenDADecoderProgramId;
    
    // Mapping from blob hash to verified data hash
    mapping(bytes32 => bytes32) public verifiedBlobs;
    
    // Events
    event BlobVerified(
        bytes32 indexed blobHash,
        bytes32 indexed dataHash,
        address indexed verifier
    );
    
    event BatchVerified(
        bytes32[] blobHashes,
        bytes32[] dataHashes,
        address indexed verifier
    );
    
    error InvalidProof();
    error EmptyData();
    error AlreadyVerified(bytes32 blobHash);
    
    constructor(address _succinctGateway, bytes32 _programId) {
        succinctGateway = ISuccinctGateway(_succinctGateway);
        eigenDADecoderProgramId = _programId;
    }
    
    /**
     * @notice Verify that decoded data matches the EigenDA blob
     * @param blobHash The EigenDA blob hash/certificate
     * @param decodedData The claimed decoded data
     * @param proof The Succinct ZK proof
     * @return verified Whether the proof is valid
     */
    function verifyAndStore(
        bytes32 blobHash,
        bytes calldata decodedData,
        bytes calldata proof
    ) external returns (bool verified) {
        if (decodedData.length == 0) revert EmptyData();
        
        // Check if already verified
        bytes32 dataHash = keccak256(decodedData);
        if (verifiedBlobs[blobHash] != bytes32(0)) {
            return verifiedBlobs[blobHash] == dataHash;
        }
        
        // Prepare public inputs for verification
        bytes memory publicInputs = abi.encode(blobHash, dataHash);
        
        // Verify the proof using Succinct Gateway
        verified = succinctGateway.verifyProof(
            eigenDADecoderProgramId,
            publicInputs,
            proof
        );
        
        if (!verified) revert InvalidProof();
        
        // Store the verified data hash
        verifiedBlobs[blobHash] = dataHash;
        
        emit BlobVerified(blobHash, dataHash, msg.sender);
        
        return true;
    }
    
    /**
     * @notice Verify a batch of blobs in one transaction
     * @param blobHashes Array of EigenDA blob hashes
     * @param decodedDataArray Array of decoded data for each blob
     * @param proof Single proof covering all blobs
     */
    function batchVerify(
        bytes32[] calldata blobHashes,
        bytes[] calldata decodedDataArray,
        bytes calldata proof
    ) external returns (bool) {
        require(blobHashes.length == decodedDataArray.length, "Length mismatch");
        
        bytes32[] memory dataHashes = new bytes32[](blobHashes.length);
        
        // Calculate all data hashes
        for (uint i = 0; i < blobHashes.length; i++) {
            if (decodedDataArray[i].length == 0) revert EmptyData();
            dataHashes[i] = keccak256(decodedDataArray[i]);
        }
        
        // Prepare public inputs for batch verification
        bytes memory publicInputs = abi.encode(blobHashes, dataHashes);
        
        // Verify the batch proof
        bool verified = succinctGateway.verifyProof(
            eigenDADecoderProgramId,
            publicInputs,
            proof
        );
        
        if (!verified) revert InvalidProof();
        
        // Store all verified blobs
        for (uint i = 0; i < blobHashes.length; i++) {
            verifiedBlobs[blobHashes[i]] = dataHashes[i];
        }
        
        emit BatchVerified(blobHashes, dataHashes, msg.sender);
        
        return true;
    }
    
    /**
     * @notice Check if a blob has been verified
     * @param blobHash The EigenDA blob hash to check
     * @return verified Whether the blob has been verified
     * @return dataHash The hash of the verified data (0x0 if not verified)
     */
    function isVerified(bytes32 blobHash) external view returns (bool verified, bytes32 dataHash) {
        dataHash = verifiedBlobs[blobHash];
        verified = dataHash != bytes32(0);
    }
    
    /**
     * @notice Verify data against a previously verified blob
     * @param blobHash The EigenDA blob hash
     * @param data The data to verify
     * @return matches Whether the data matches the verified blob
     */
    function verifyAgainstStored(
        bytes32 blobHash,
        bytes calldata data
    ) external view returns (bool matches) {
        bytes32 storedHash = verifiedBlobs[blobHash];
        if (storedHash == bytes32(0)) return false;
        
        return storedHash == keccak256(data);
    }
}

/**
 * @title KaiSignWithVerification
 * @notice Extension of KaiSign that uses Succinct verification for high-value operations
 */
contract KaiSignWithVerification {
    SuccinctEigenDAVerifier public immutable verifier;
    
    // Threshold for requiring verification (in USD)
    uint256 public verificationThreshold = 1000 * 1e18; // $1000
    
    // Track which operations used verification
    mapping(bytes32 => bool) public verifiedOperations;
    
    modifier requiresVerification(uint256 value, bytes32 blobHash) {
        if (value >= verificationThreshold) {
            (bool verified, ) = verifier.isVerified(blobHash);
            require(verified, "High-value operation requires verified blob");
            verifiedOperations[blobHash] = true;
        }
        _;
    }
    
    constructor(address _verifier) {
        verifier = SuccinctEigenDAVerifier(_verifier);
    }
    
    /**
     * @notice Submit a high-value transaction with verified ERC-7730 metadata
     * @param blobHash The EigenDA blob containing ERC-7730 spec
     * @param value The transaction value in USD (scaled by 1e18)
     * @param data Additional transaction data
     */
    function submitWithVerification(
        bytes32 blobHash,
        uint256 value,
        bytes calldata data
    ) external requiresVerification(value, blobHash) {
        // Process the transaction with verified metadata
        _processTransaction(blobHash, data);
    }
    
    /**
     * @notice Verify a blob on-demand before use
     * @param blobHash The blob to verify
     * @param decodedData The decoded data
     * @param proof The Succinct proof
     */
    function verifyBeforeUse(
        bytes32 blobHash,
        bytes calldata decodedData,
        bytes calldata proof
    ) external {
        require(
            verifier.verifyAndStore(blobHash, decodedData, proof),
            "Verification failed"
        );
    }
    
    function _processTransaction(bytes32 blobHash, bytes calldata data) internal {
        // Implementation specific to KaiSign
    }
}

/**
 * Usage Example:
 * 
 * 1. Deploy SuccinctEigenDAVerifier with Succinct Gateway address
 * 2. Generate proof off-chain using Succinct Network
 * 3. Call verifyAndStore() with proof
 * 4. Blob is now verified on-chain and can be trusted
 * 
 * For KaiSign integration:
 * - Low-value operations: Skip verification
 * - High-value operations: Require verified blobs
 * - Periodic audits: Batch verify historical blobs
 */