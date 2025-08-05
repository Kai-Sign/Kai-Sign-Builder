// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import {KaiSign} from "../src/Kaisign_V1.sol";
import {RealityETH_v3_0} from "../staticlib/RealityETH-3.0.sol";

contract KaiSignV1DebugTest is Test {
    KaiSign public kaisign;
    RealityETH_v3_0 public realityETH;
    address public arbitrator;
    address public treasury;
    uint256 public minBond = 10000000000000000; // 0.01 ETH
    
    // Test accounts
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");
    address public admin = makeAddr("admin");
    
    function setUp() public {
        // Setup accounts with ETH
        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);
        vm.deal(admin, 10 ether);
        
        // Deploy Reality.eth first
        realityETH = new RealityETH_v3_0();
        
        // Create arbitrator and treasury
        arbitrator = makeAddr("arbitrator");
        treasury = makeAddr("treasury");
        
        // Deploy KaiSign V1 contract
        address[] memory initialAdmins = new address[](1);
        initialAdmins[0] = admin;
        
        kaisign = new KaiSign(
            address(realityETH),
            arbitrator,
            treasury,
            minBond,
            initialAdmins
        );
        
        console.log("=== SETUP COMPLETE ===");
        console.log("KaiSign address:", address(kaisign));
        console.log("Reality.eth address:", address(realityETH));
        console.log("Min bond:", minBond);
        console.log("Treasury:", treasury);
    }
    
    function test_debugCommitRevealFlow() public {
        string memory ipfsHash = "QmXECco2A4M7E4yR58J4JZb3wL2P1KUx2JrkLPQkintE7n";
        address targetContract = address(kaisign); // Use self as target
        uint256 bondAmount = 20000000000000000; // 0.02 ETH
        uint256 nonce = 213432;
        bytes32 incentiveId = bytes32(0);
        
        console.log("\n=== STEP 1: PREPARE COMMITMENT ===");
        
        // Create commitment hash (must match Solidity exactly)
        bytes32 commitment = keccak256(abi.encodePacked(ipfsHash, nonce));
        console.log("IPFS Hash:", ipfsHash);
        console.log("Nonce:", nonce);
        console.log("Commitment:", vm.toString(commitment));
        
        console.log("\n=== STEP 2: COMMIT SPEC ===");
        console.log("Bond amount:", bondAmount);
        console.log("Target contract:", targetContract);
        console.log("User1 balance before:", user1.balance);
        
        vm.startPrank(user1);
        
        // Call commitSpec
        try kaisign.commitSpec{value: bondAmount}(commitment, targetContract, incentiveId) {
            console.log("✅ commitSpec succeeded");
        } catch Error(string memory reason) {
            console.log("❌ commitSpec failed:", reason);
            revert("commitSpec failed");
        } catch (bytes memory lowLevelData) {
            console.log("❌ commitSpec failed with low-level error");
            console.logBytes(lowLevelData);
            revert("commitSpec failed with low-level error");
        }
        
        console.log("User1 balance after commit:", user1.balance);
        
        // Generate commitment ID the same way the contract does
        bytes32 commitmentId = keccak256(abi.encodePacked(
            commitment,
            user1,
            targetContract,
            block.timestamp
        ));
        console.log("Generated commitment ID:", vm.toString(commitmentId));
        
        console.log("\n=== STEP 3: CHECK COMMITMENT DATA ===");
        // Read commitment data to verify it was stored correctly
        (
            address committer,
            uint64 commitTimestamp,
            uint32 revealDeadline,
            address storedTargetContract,
            bool isRevealed,
            uint80 storedBondAmount,
            bytes32 storedIncentiveId
        ) = kaisign.commitments(commitmentId);
        
        console.log("Stored committer:", committer);
        console.log("Stored bond amount:", uint256(storedBondAmount));
        console.log("Stored target contract:", storedTargetContract);
        console.log("Is revealed:", isRevealed);
        
        console.log("\n=== STEP 4: REVEAL SPEC ===");
        console.log("Attempting to reveal with:");
        console.log("- Commitment ID:", vm.toString(commitmentId));
        console.log("- IPFS Hash:", ipfsHash);
        console.log("- Nonce:", nonce);
        
        // Now try to reveal - this is where the error should occur
        try kaisign.revealSpec(commitmentId, ipfsHash, nonce) returns (bytes32 specID) {
            console.log("✅ revealSpec succeeded");
            console.log("Spec ID:", vm.toString(specID));
        } catch Error(string memory reason) {
            console.log("❌ revealSpec failed:", reason);
            
            // Try to decode the error
            if (keccak256(bytes(reason)) == keccak256(bytes("InsufficientBond()"))) {
                console.log("🔍 This is the InsufficientBond error we're debugging!");
                
                // Let's check what's happening in _proposeSpec
                console.log("\n=== DEBUGGING _proposeSpec ===");
                console.log("Stored bond amount:", uint256(storedBondAmount));
                console.log("msg.value in revealSpec:", 0);
                console.log("Total bond would be:", uint256(storedBondAmount) + 0);
                console.log("Contract minBond:", kaisign.minBond());
                
                // Check Reality.eth requirements
                console.log("\n=== CHECKING REALITY.ETH ===");
                uint256 templateId = kaisign.templateId();
                console.log("Template ID:", templateId);
                
                // Try to estimate gas for askQuestionWithMinBond directly
                string memory questionText = string(abi.encodePacked(ipfsHash, " ", vm.toString(targetContract)));
                console.log("Question text:", questionText);
                
                console.log("Attempting Reality.eth call with bond:", uint256(storedBondAmount));
                try realityETH.askQuestionWithMinBond{value: uint256(storedBondAmount)}(
                    templateId,
                    questionText,
                    arbitrator,
                    48 hours,
                    0,
                    0,
                    minBond
                ) returns (bytes32 questionId) {
                    console.log("✅ Reality.eth call would succeed, questionId:", vm.toString(questionId));
                } catch Error(string memory realityReason) {
                    console.log("❌ Reality.eth call failed:", realityReason);
                } catch (bytes memory realityLowLevel) {
                    console.log("❌ Reality.eth call failed with low-level error");
                    console.logBytes(realityLowLevel);
                }
            }
            
            revert(reason);
        } catch (bytes memory lowLevelData) {
            console.log("❌ revealSpec failed with low-level error");
            console.logBytes(lowLevelData);
            
            // Check if it's our expected error selector
            if (lowLevelData.length >= 4) {
                bytes4 errorSelector = bytes4(lowLevelData);
                console.log("Error selector:", vm.toString(errorSelector));
                
                // InsufficientBond() selector is 0xe92c469f
                if (errorSelector == 0xe92c469f) {
                    console.log("🔍 Confirmed: This is InsufficientBond() error");
                    
                    // Additional debugging
                    console.log("\n=== ADDITIONAL DEBUGGING ===");
                    console.log("Bond checks:");
                    console.log("- Stored bond:", uint256(storedBondAmount));
                    console.log("- Contract minBond:", kaisign.minBond());
                    console.log("- Bond >= minBond?", uint256(storedBondAmount) >= kaisign.minBond());
                }
            }
        }
        
        vm.stopPrank();
    }
    
    // Test just the commitment part
    function test_debugCommitOnly() public {
        string memory ipfsHash = "QmTest";
        address targetContract = address(kaisign);
        uint256 bondAmount = 20000000000000000; // 0.02 ETH
        uint256 nonce = 12345;
        bytes32 incentiveId = bytes32(0);
        
        bytes32 commitment = keccak256(abi.encodePacked(ipfsHash, nonce));
        
        vm.startPrank(user1);
        vm.deal(user1, 1 ether);
        
        console.log("Testing commitSpec only...");
        console.log("Bond amount:", bondAmount);
        console.log("Min bond:", kaisign.minBond());
        console.log("Bond >= minBond?", bondAmount >= kaisign.minBond());
        
        kaisign.commitSpec{value: bondAmount}(commitment, targetContract, incentiveId);
        console.log("✅ Commit successful");
        
        vm.stopPrank();
    }
    
    // Test Reality.eth directly
    function test_debugRealityEthDirect() public {
        uint256 bondAmount = 20000000000000000; // 0.02 ETH
        
        vm.startPrank(user1);
        vm.deal(user1, 1 ether);
        
        console.log("Testing Reality.eth directly...");
        
        // Create template first
        uint256 templateId = realityETH.createTemplate(
            '{"title": "Test question", "type": "bool"}'
        );
        
        console.log("Template ID:", templateId);
        console.log("Bond amount:", bondAmount);
        
        try realityETH.askQuestionWithMinBond{value: bondAmount}(
            templateId,
            "Test question",
            arbitrator,
            48 hours,
            0,
            0,
            minBond
        ) returns (bytes32 questionId) {
            console.log("✅ Reality.eth direct call succeeded");
            console.log("Question ID:", vm.toString(questionId));
        } catch Error(string memory reason) {
            console.log("❌ Reality.eth direct call failed:", reason);
        }
        
        vm.stopPrank();
    }
}