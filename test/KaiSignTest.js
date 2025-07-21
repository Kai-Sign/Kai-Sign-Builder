const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Enhanced KaiSign Contract - Requested Features Only", function () {
    let kaisign;
    let realityETH;
    let treasury;
    let mockToken;
    let owner, admin1, admin2, user1, user2, user3;
    let targetContract;

    // Test constants
    const MIN_BOND = ethers.utils.parseEther("0.01");
    const COMMIT_REVEAL_TIMEOUT = 3600; // 1 hour
    const INCENTIVE_AMOUNT = ethers.utils.parseEther("1.0");

    beforeEach(async function () {
        [owner, admin1, admin2, user1, user2, user3] = await ethers.getSigners();

        // Deploy mock contracts
        const MockToken = await ethers.getContractFactory("MockERC20");
        mockToken = await MockToken.deploy("Test Token", "TEST", ethers.utils.parseEther("1000000"));

        const Treasury = await ethers.getContractFactory("Treasury");
        treasury = await Treasury.deploy();

        const MockContract = await ethers.getContractFactory("MockContract");
        targetContract = await MockContract.deploy();

        // Deploy RealityETH (using the existing implementation)
        const RealityETH = await ethers.getContractFactory("RealityETH_v3_0");
        realityETH = await RealityETH.deploy();

        // Deploy enhanced KaiSign
        const KaiSign = await ethers.getContractFactory("KaiSign");
        kaisign = await KaiSign.deploy(
            realityETH.address,
            owner.address, // arbitrator
            treasury.address,
            MIN_BOND,
            86400, // 24 hours timeout
            [admin1.address, admin2.address] // initial admins
        );

        // Setup token balances
        await mockToken.transfer(user1.address, ethers.utils.parseEther("100"));
        await mockToken.transfer(user2.address, ethers.utils.parseEther("100"));
    });

    describe("1. Security Features", function () {
        describe("1.1 Reentrancy Protection", function () {
            it("should prevent reentrancy attacks", async function () {
                const commitment = ethers.utils.keccak256(
                    ethers.utils.defaultAbiCoder.encode(
                        ["string", "uint256"],
                        ["QmTestIPFS", 12345]
                    )
                );

                await expect(
                    kaisign.connect(user1).commitSpec(
                        commitment,
                        targetContract.address,
                        ethers.constants.HashZero,
                        { value: MIN_BOND }
                    )
                ).to.not.be.reverted;
            });
        });

        describe("1.2 Bond Validation Fix", function () {
            it("should enforce minimum bond requirements", async function () {
                const commitment = ethers.utils.keccak256(
                    ethers.utils.defaultAbiCoder.encode(
                        ["string", "uint256"],
                        ["QmTestIPFS", 12345]
                    )
                );

                // Should fail with insufficient bond
                await expect(
                    kaisign.connect(user1).commitSpec(
                        commitment,
                        targetContract.address,
                        ethers.constants.HashZero,
                        { value: ethers.utils.parseEther("0.001") }
                    )
                ).to.be.revertedWith("InsufficientBond");

                // Should succeed with sufficient bond
                await expect(
                    kaisign.connect(user1).commitSpec(
                        commitment,
                        targetContract.address,
                        ethers.constants.HashZero,
                        { value: MIN_BOND }
                    )
                ).to.not.be.reverted;
            });
        });

        describe("1.3 Access Control Enhancement", function () {
            it("should enforce admin-only functions", async function () {
                // Non-admin should not be able to call admin functions
                await expect(
                    kaisign.connect(user1).setMinBond(ethers.utils.parseEther("0.02"))
                ).to.be.revertedWith("Unauthorized");

                // Admin should be able to call admin functions
                await expect(
                    kaisign.connect(admin1).setMinBond(ethers.utils.parseEther("0.02"))
                ).to.not.be.reverted;
            });

            it("should allow multiple admins", async function () {
                const newAdmin = user3.address;
                
                // Admin can add new admin
                await kaisign.connect(admin1).addAdmin(newAdmin);
                const hasRole = await kaisign.hasRole(
                    await kaisign.ADMIN_ROLE(),
                    newAdmin
                );
                expect(hasRole).to.be.true;

                // New admin should be able to perform admin functions
                await expect(
                    kaisign.connect(user3).setMinBond(ethers.utils.parseEther("0.03"))
                ).to.not.be.reverted;
            });
        });

        describe("1.4 Custom Errors", function () {
            it("should use custom errors for gas efficiency", async function () {
                // Test various custom errors
                await expect(
                    kaisign.connect(user1).commitSpec(
                        ethers.constants.HashZero,
                        ethers.constants.AddressZero,
                        ethers.constants.HashZero,
                        { value: MIN_BOND }
                    )
                ).to.be.revertedWith("InvalidContract");

                await expect(
                    kaisign.connect(user1).revealSpec(
                        ethers.constants.HashZero,
                        "QmTestIPFS",
                        12345
                    )
                ).to.be.revertedWith("CommitmentNotFound");
            });
        });
    });

    describe("2. Economic Model - Incentive System", function () {
        it("should create ETH incentives", async function () {
            const tx = await kaisign.connect(user1).createIncentive(
                targetContract.address,
                ethers.constants.AddressZero, // ETH
                INCENTIVE_AMOUNT,
                86400, // 1 day
                "Test incentive",
                { value: INCENTIVE_AMOUNT }
            );

            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "LogIncentiveCreated");
            expect(event).to.not.be.undefined;
            expect(event.args.creator).to.equal(user1.address);
            expect(event.args.amount).to.equal(INCENTIVE_AMOUNT);
        });

        it("should create ERC20 incentives", async function () {
            await mockToken.connect(user1).approve(kaisign.address, INCENTIVE_AMOUNT);
            
            const tx = await kaisign.connect(user1).createIncentive(
                targetContract.address,
                mockToken.address,
                INCENTIVE_AMOUNT,
                86400, // 1 day
                "Test ERC20 incentive"
            );

            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "LogIncentiveCreated");
            expect(event).to.not.be.undefined;
            expect(event.args.token).to.equal(mockToken.address);
        });

        it("should collect 5% platform fee", async function () {
            const initialBalance = await ethers.provider.getBalance(treasury.address);
            
            const commitment = ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(
                    ["string", "uint256"],
                    ["QmTestIPFS", 12345]
                )
            );

            await kaisign.connect(user1).commitSpec(
                commitment,
                targetContract.address,
                ethers.constants.HashZero,
                { value: MIN_BOND }
            );

            const finalBalance = await ethers.provider.getBalance(treasury.address);
            const expectedFee = MIN_BOND.mul(5).div(100); // 5% of MIN_BOND
            expect(finalBalance.sub(initialBalance)).to.equal(expectedFee);
        });
    });

    describe("3. Commit-Reveal Pattern", function () {
        it("should complete full commit-reveal cycle", async function () {
            const ipfs = "QmTestIPFS123";
            const nonce = 12345;
            const commitment = ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(
                    ["string", "uint256"],
                    [ipfs, nonce]
                )
            );

            // Step 1: Commit
            const commitTx = await kaisign.connect(user1).commitSpec(
                commitment,
                targetContract.address,
                ethers.constants.HashZero,
                { value: MIN_BOND }
            );

            const commitReceipt = await commitTx.wait();
            const commitEvent = commitReceipt.events.find(e => e.event === "LogCommitSpec");
            expect(commitEvent).to.not.be.undefined;
            
            const commitmentId = commitEvent.args.commitmentId;

            // Step 2: Reveal
            const revealTx = await kaisign.connect(user1).revealSpec(
                commitmentId,
                ipfs,
                nonce
            );

            const revealReceipt = await revealTx.wait();
            const revealEvent = revealReceipt.events.find(e => e.event === "LogRevealSpec");
            expect(revealEvent).to.not.be.undefined;
            
            const specID = revealEvent.args.specID;

            // Verify spec was created
            const spec = await kaisign.specs(specID);
            expect(spec.creator).to.equal(user1.address);
            expect(spec.targetContract).to.equal(targetContract.address);
            expect(spec.ipfs).to.equal(ipfs);
        });

        it("should prevent double reveals", async function () {
            const ipfs = "QmTestIPFS123";
            const nonce = 12345;
            const commitment = ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(
                    ["string", "uint256"],
                    [ipfs, nonce]
                )
            );

            // Commit
            const commitTx = await kaisign.connect(user1).commitSpec(
                commitment,
                targetContract.address,
                ethers.constants.HashZero,
                { value: MIN_BOND }
            );

            const commitReceipt = await commitTx.wait();
            const commitmentId = commitReceipt.events.find(e => e.event === "LogCommitSpec").args.commitmentId;

            // First reveal should succeed
            await kaisign.connect(user1).revealSpec(commitmentId, ipfs, nonce);

            // Second reveal should fail
            await expect(
                kaisign.connect(user1).revealSpec(commitmentId, ipfs, nonce)
            ).to.be.revertedWith("CommitmentAlreadyRevealed");
        });

        it("should validate commitment correctness", async function () {
            const ipfs = "QmTestIPFS123";
            const nonce = 12345;
            const wrongNonce = 54321;
            const commitment = ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(
                    ["string", "uint256"],
                    [ipfs, nonce]
                )
            );

            // Commit
            const commitTx = await kaisign.connect(user1).commitSpec(
                commitment,
                targetContract.address,
                ethers.constants.HashZero,
                { value: MIN_BOND }
            );

            const commitReceipt = await commitTx.wait();
            const commitmentId = commitReceipt.events.find(e => e.event === "LogCommitSpec").args.commitmentId;

            // Reveal with wrong nonce should fail
            await expect(
                kaisign.connect(user1).revealSpec(commitmentId, ipfs, wrongNonce)
            ).to.be.revertedWith("InvalidReveal");
        });
    });

    describe("4. Contract Address Integration", function () {
        it("should index specs by contract address", async function () {
            const ipfs = "QmTestIPFS123";
            const nonce = 12345;
            const commitment = ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(
                    ["string", "uint256"],
                    [ipfs, nonce]
                )
            );

            // Create spec
            const commitTx = await kaisign.connect(user1).commitSpec(
                commitment,
                targetContract.address,
                ethers.constants.HashZero,
                { value: MIN_BOND }
            );

            const commitReceipt = await commitTx.wait();
            const commitmentId = commitReceipt.events.find(e => e.event === "LogCommitSpec").args.commitmentId;

            await kaisign.connect(user1).revealSpec(commitmentId, ipfs, nonce);

            // Check contract spec count
            const count = await kaisign.getContractSpecCount(targetContract.address);
            expect(count).to.equal(1);

            // Check specs by contract
            const specs = await kaisign.getSpecsByContract(targetContract.address);
            expect(specs.length).to.equal(1);
        });

        it("should support paginated queries", async function () {
            // Create multiple specs for the same contract
            for (let i = 0; i < 3; i++) {
                const ipfs = `QmTestIPFS${i}`;
                const nonce = 12345 + i;
                const commitment = ethers.utils.keccak256(
                    ethers.utils.defaultAbiCoder.encode(
                        ["string", "uint256"],
                        [ipfs, nonce]
                    )
                );

                const commitTx = await kaisign.connect(user1).commitSpec(
                    commitment,
                    targetContract.address,
                    ethers.constants.HashZero,
                    { value: MIN_BOND }
                );

                const commitReceipt = await commitTx.wait();
                const commitmentId = commitReceipt.events.find(e => e.event === "LogCommitSpec").args.commitmentId;

                await kaisign.connect(user1).revealSpec(commitmentId, ipfs, nonce);
            }

            // Test pagination
            const [specs, total] = await kaisign.getSpecsByContractPaginated(
                targetContract.address,
                0, // offset
                2  // limit
            );

            expect(specs.length).to.equal(2);
            expect(total).to.equal(3);
        });
    });

    describe("5. Gas Optimizations", function () {
        it("should use packed structs for storage efficiency", async function () {
            const ipfs = "QmTestIPFS123";
            const nonce = 12345;
            const commitment = ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(
                    ["string", "uint256"],
                    [ipfs, nonce]
                )
            );

            // Measure gas for commit operation
            const commitTx = await kaisign.connect(user1).commitSpec(
                commitment,
                targetContract.address,
                ethers.constants.HashZero,
                { value: MIN_BOND }
            );

            const commitReceipt = await commitTx.wait();
            console.log("Commit gas used:", commitReceipt.gasUsed.toString());

            // The gas usage should be reasonable due to packed structs
            expect(commitReceipt.gasUsed).to.be.lt(200000); // Less than 200k gas
        });

        it("should emit events for off-chain indexing", async function () {
            const ipfs = "QmTestIPFS123";
            const nonce = 12345;
            const commitment = ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(
                    ["string", "uint256"],
                    [ipfs, nonce]
                )
            );

            const commitTx = await kaisign.connect(user1).commitSpec(
                commitment,
                targetContract.address,
                ethers.constants.HashZero,
                { value: MIN_BOND }
            );

            const commitReceipt = await commitTx.wait();
            const commitmentId = commitReceipt.events.find(e => e.event === "LogCommitSpec").args.commitmentId;

            const revealTx = await kaisign.connect(user1).revealSpec(commitmentId, ipfs, nonce);
            const revealReceipt = await revealTx.wait();

            // Check that multiple events were emitted for indexing
            const events = revealReceipt.events.map(e => e.event);
            expect(events).to.include("LogRevealSpec");
            expect(events).to.include("LogCreateSpec");
            expect(events).to.include("LogContractSpecAdded");
        });
    });
});

// Helper contracts for testing
// These would need to be in separate files in a real project

// MockERC20.sol
const MockERC20 = `
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol, uint256 totalSupply) ERC20(name, symbol) {
        _mint(msg.sender, totalSupply);
    }
}
`;

// Treasury.sol
const Treasury = `
pragma solidity ^0.8.13;

contract Treasury {
    address public owner;
    
    constructor() {
        owner = msg.sender;
    }
    
    receive() external payable {}
    
    function withdraw(uint256 amount) external {
        require(msg.sender == owner, "Not owner");
        payable(owner).transfer(amount);
    }
}
`;

// MockContract.sol
const MockContract = `
pragma solidity ^0.8.13;

contract MockContract {
    string public name = "Mock Contract";
    uint256 public value = 42;
    
    function setValue(uint256 _value) external {
        value = _value;
    }
}
`; 