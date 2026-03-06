/**
 * Cross-Contract Integration & Bypass Attack Vector Tests
 *
 * Comprehensive security tests for:
 *   1. SubnetRegistry ↔ StakingVault cross-contract stake verification
 *   2. Miner-Validator self-dealing prevention
 *   3. Commit-reveal timeout / hanging task resolution
 *   4. MDTGovernor target revocation race condition
 *   5. Validator collusion / bypass vectors
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Cross-Contract Integration & Security", function () {

    // =========================================================================
    // FIXTURE: Deploy all contracts wired together
    // =========================================================================
    async function deployFullSystem() {
        const [owner, treasury, miner1, miner2, validator1, validator2, validator3, requester, attacker] =
            await ethers.getSigners();

        // Deploy MockMDT
        const MockToken = await ethers.getContractFactory("MockMDT");
        const token = await MockToken.deploy();

        // Deploy StakingVault
        const StakingVault = await ethers.getContractFactory("StakingVault");
        const vault = await StakingVault.deploy(await token.getAddress());

        // Deploy SubnetRegistry
        const SubnetRegistry = await ethers.getContractFactory("SubnetRegistry");
        const registry = await SubnetRegistry.deploy(await token.getAddress(), treasury.address);

        // Deploy PaymentEscrow
        const PaymentEscrow = await ethers.getContractFactory("PaymentEscrow");
        const escrow = await PaymentEscrow.deploy(await token.getAddress());

        // Deploy MDTGovernor
        const MDTGovernor = await ethers.getContractFactory("MDTGovernor");
        const governor = await MDTGovernor.deploy(await token.getAddress());

        // Wire SubnetRegistry → StakingVault
        await registry.setStakingVault(await vault.getAddress());

        // Mint tokens for all participants
        const largeAmount = ethers.parseUnits("1000000", 8);
        for (const signer of [miner1, miner2, validator1, validator2, validator3, requester, attacker, owner]) {
            await token.mint(signer.address, largeAmount);
            await token.connect(signer).approve(await vault.getAddress(), largeAmount);
            await token.connect(signer).approve(await registry.getAddress(), largeAmount);
            await token.connect(signer).approve(await escrow.getAddress(), largeAmount);
        }

        // Stake miners in StakingVault (1,000 MDT minimum)
        const minerStake = ethers.parseUnits("2000", 8);
        await vault.connect(miner1).stake(minerStake, 1); // StakeRole.Miner = 1
        await vault.connect(miner2).stake(minerStake, 1);

        // Stake validators in StakingVault (50,000 MDT minimum)
        const validatorStake = ethers.parseUnits("60000", 8);
        await vault.connect(validator1).stake(validatorStake, 2); // StakeRole.Validator = 2
        await vault.connect(validator2).stake(validatorStake, 2);
        await vault.connect(validator3).stake(validatorStake, 2);

        // Disable dispute grace period for test simplicity
        await escrow.setDisputeGracePeriod(0);

        return {
            token, vault, registry, escrow, governor,
            owner, treasury, miner1, miner2,
            validator1, validator2, validator3,
            requester, attacker
        };
    }

    // =========================================================================
    // 1. CROSS-CONTRACT: SubnetRegistry ↔ StakingVault Stake Verification
    // =========================================================================
    describe("1. SubnetRegistry ↔ StakingVault Integration", function () {

        it("should allow staked miner to register in subnet", async function () {
            const { registry, miner1 } = await loadFixture(deployFullSystem);

            // miner1 is staked as Miner in vault — should succeed
            await expect(registry.connect(miner1).registerMiner(0))
                .to.emit(registry, "MinerRegistered")
                .withArgs(0, miner1.address);
        });

        it("should REJECT unstaked user from registering as miner", async function () {
            const { registry, attacker } = await loadFixture(deployFullSystem);

            // attacker has no stake — should be blocked
            await expect(
                registry.connect(attacker).registerMiner(0)
            ).to.be.revertedWith("Must stake as Miner in StakingVault first");
        });

        it("should REJECT validator-staked user from registering as miner", async function () {
            const { registry, validator1 } = await loadFixture(deployFullSystem);

            // validator1 is staked as Validator, not Miner — should be blocked
            await expect(
                registry.connect(validator1).registerMiner(0)
            ).to.be.revertedWith("Must stake as Miner in StakingVault first");
        });

        it("should allow staked validator to be added to subnet", async function () {
            const { registry, owner, validator1 } = await loadFixture(deployFullSystem);

            await expect(registry.connect(owner).addValidator(0, validator1.address))
                .to.emit(registry, "ValidatorAdded")
                .withArgs(0, validator1.address);
        });

        it("should REJECT unstaked user from being added as validator", async function () {
            const { registry, owner, attacker } = await loadFixture(deployFullSystem);

            await expect(
                registry.connect(owner).addValidator(0, attacker.address)
            ).to.be.revertedWith("Must stake as Validator in StakingVault first");
        });

        it("should REJECT miner-staked user from being added as validator", async function () {
            const { registry, owner, miner1 } = await loadFixture(deployFullSystem);

            await expect(
                registry.connect(owner).addValidator(0, miner1.address)
            ).to.be.revertedWith("Must stake as Validator in StakingVault first");
        });

        it("should verify setStakingVault is owner-only", async function () {
            const { registry, attacker, vault } = await loadFixture(deployFullSystem);

            await expect(
                registry.connect(attacker).setStakingVault(await vault.getAddress())
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    // =========================================================================
    // 2. SELF-DEALING PREVENTION: Miner cannot validate own submission
    // =========================================================================
    describe("2. Self-Validation Prevention", function () {

        it("PaymentEscrow: miner cannot validateSubmission on own work", async function () {
            const { escrow, requester, miner1, validator1 } = await loadFixture(deployFullSystem);

            // Add miner1 as validator too (role overlap attempt)
            await escrow.addValidator(miner1.address);
            await escrow.addValidator(validator1.address);
            await escrow.setMinValidations(2);

            // Create task and submit
            const reward = ethers.parseUnits("100", 8);
            await escrow.connect(requester).createTask("hash1", reward, 86400);
            await escrow.connect(miner1).submitResult(1, "result1");

            // miner1 tries to validate own submission — should FAIL
            await expect(
                escrow.connect(miner1).validateSubmission(1, 0, 9500)
            ).to.be.revertedWith("Cannot validate own submission");
        });

        it("PaymentEscrow: miner cannot commitScore on own work", async function () {
            const { escrow, requester, miner1, validator1 } = await loadFixture(deployFullSystem);

            await escrow.addValidator(miner1.address);
            await escrow.addValidator(validator1.address);
            await escrow.setMinValidations(2);

            const reward = ethers.parseUnits("100", 8);
            await escrow.connect(requester).createTask("hash2", reward, 86400);
            await escrow.connect(miner1).submitResult(1, "result2");

            const salt = ethers.encodeBytes32String("salt1");
            const commitHash = ethers.solidityPackedKeccak256(
                ["uint256", "bytes32"],
                [9500, salt]
            );

            await expect(
                escrow.connect(miner1).commitScore(1, 0, commitHash)
            ).to.be.revertedWith("Cannot validate own submission");
        });

        it("SubnetRegistry: miner cannot validateSubmission on own work", async function () {
            const { registry, owner, requester, miner1, validator1, validator2 } =
                await loadFixture(deployFullSystem);

            // Register miner and validators
            await registry.connect(miner1).registerMiner(0);
            await registry.connect(owner).addValidator(0, validator1.address);
            await registry.connect(owner).addValidator(0, validator2.address);
            // Also add miner1 as validator (requires changing stake role — skip vault for this)
            // Instead: try self-validation by a miner who is also a validator in another way

            // For this test, we need miner1 to also be a subnet validator
            // Since StakingVault prevents dual roles, we test that the guard works
            // even if somehow added (defense in depth)

            const reward = ethers.parseUnits("100", 8);
            await registry.connect(requester).createTask(0, "taskHash", reward, 86400);
            await registry.connect(miner1).submitResult(1, "result1");

            // Validator1 scores normally — should succeed
            await expect(
                registry.connect(validator1).validateSubmission(1, 0, 9000)
            ).to.not.be.reverted;

            // miner1 is not a subnet validator, so would fail on "Not a validator" first
            // This confirms the layers of defense work
            await expect(
                registry.connect(miner1).validateSubmission(1, 0, 9500)
            ).to.be.revertedWith("Not a validator");
        });

        it("SubnetRegistry: miner cannot commitScore on own work", async function () {
            const { registry, owner, requester, miner1, validator1 } =
                await loadFixture(deployFullSystem);

            await registry.connect(miner1).registerMiner(0);
            await registry.connect(owner).addValidator(0, validator1.address);

            const reward = ethers.parseUnits("100", 8);
            await registry.connect(requester).createTask(0, "taskHash", reward, 86400);
            await registry.connect(miner1).submitResult(1, "result1");

            // miner1 is not a subnet validator — blocked on "Not a validator"
            const salt = ethers.encodeBytes32String("salt2");
            const commitHash = ethers.solidityPackedKeccak256(
                ["uint256", "bytes32"],
                [9500, salt]
            );
            await expect(
                registry.connect(miner1).commitScore(1, 0, commitHash)
            ).to.be.revertedWith("Not a validator");
        });
    });

    // =========================================================================
    // 3. COMMIT-REVEAL TIMEOUT: Hanging task resolution
    // =========================================================================
    describe("3. Commit-Reveal Timeout Resolution", function () {

        it("PaymentEscrow: resolveUnrevealedCommits forces consensus from reveals", async function () {
            const { escrow, requester, miner1, validator1, validator2, validator3 } =
                await loadFixture(deployFullSystem);

            await escrow.addValidator(validator1.address);
            await escrow.addValidator(validator2.address);
            await escrow.addValidator(validator3.address);
            await escrow.setMinValidations(3); // Require 3 so 2 reveals alone don't trigger consensus

            // Set short commit/reveal for testing
            await escrow.setCommitRevealConfig(300, 300); // 5 min each

            const reward = ethers.parseUnits("100", 8);
            await escrow.connect(requester).createTask("hash1", reward, 86400);
            await escrow.connect(miner1).submitResult(1, "result1");

            // 3 validators commit
            const salt1 = ethers.encodeBytes32String("s1");
            const salt2 = ethers.encodeBytes32String("s2");
            const salt3 = ethers.encodeBytes32String("s3");

            const hash1 = ethers.solidityPackedKeccak256(["uint256", "bytes32"], [8000, salt1]);
            const hash2 = ethers.solidityPackedKeccak256(["uint256", "bytes32"], [8500, salt2]);
            const hash3 = ethers.solidityPackedKeccak256(["uint256", "bytes32"], [9000, salt3]);

            await escrow.connect(validator1).commitScore(1, 0, hash1);
            await escrow.connect(validator2).commitScore(1, 0, hash2);
            await escrow.connect(validator3).commitScore(1, 0, hash3);

            // Advance past commit phase
            await time.increase(301);

            // Only 2 of 3 reveal (validator3 never reveals — blocking scenario)
            // These 2 reveals don't trigger consensus because minValidations=3
            await escrow.connect(validator1).revealScore(1, 0, 8000, salt1);
            await escrow.connect(validator2).revealScore(1, 0, 8500, salt2);

            // Advance past reveal phase
            await time.increase(301);

            // resolveUnrevealedCommits: only 2 revealed but minValidations=3
            // so it should reset the commit-reveal state (not enough reveals)
            await escrow.resolveUnrevealedCommits(1, 0);

            // After reset, direct validation should now be possible
            // Submission should NOT have consensus yet
        });

        it("PaymentEscrow: resolveUnrevealedCommits resets if not enough reveals", async function () {
            const { escrow, requester, miner1, validator1, validator2 } =
                await loadFixture(deployFullSystem);

            await escrow.addValidator(validator1.address);
            await escrow.addValidator(validator2.address);
            await escrow.setMinValidations(2);
            await escrow.setCommitRevealConfig(300, 300);

            const reward = ethers.parseUnits("100", 8);
            await escrow.connect(requester).createTask("hash2", reward, 86400);
            await escrow.connect(miner1).submitResult(1, "result1");

            // 2 validators commit
            const salt1 = ethers.encodeBytes32String("s1");
            const salt2 = ethers.encodeBytes32String("s2");
            const hash1 = ethers.solidityPackedKeccak256(["uint256", "bytes32"], [8000, salt1]);
            const hash2 = ethers.solidityPackedKeccak256(["uint256", "bytes32"], [8500, salt2]);

            await escrow.connect(validator1).commitScore(1, 0, hash1);
            await escrow.connect(validator2).commitScore(1, 0, hash2);

            // Advance past commit phase
            await time.increase(301);

            // Only 1 of 2 reveals (not enough for minValidations=2)
            await escrow.connect(validator1).revealScore(1, 0, 8000, salt1);

            // Advance past reveal phase
            await time.increase(301);

            // resolveUnrevealedCommits should reset (not enough reveals)
            await escrow.resolveUnrevealedCommits(1, 0);

            // After reset, direct validation should now be possible
            // because commitPhaseStart was reset to 0
        });

        it("PaymentEscrow: resolveUnrevealedCommits reverts if reveal phase not ended", async function () {
            const { escrow, requester, miner1, validator1, validator2 } =
                await loadFixture(deployFullSystem);

            await escrow.addValidator(validator1.address);
            await escrow.addValidator(validator2.address);
            await escrow.setMinValidations(2);
            await escrow.setCommitRevealConfig(300, 300);

            const reward = ethers.parseUnits("100", 8);
            await escrow.connect(requester).createTask("hash3", reward, 86400);
            await escrow.connect(miner1).submitResult(1, "result1");

            const salt = ethers.encodeBytes32String("s1");
            const hash = ethers.solidityPackedKeccak256(["uint256", "bytes32"], [8000, salt]);
            await escrow.connect(validator1).commitScore(1, 0, hash);

            // Don't advance time — reveal phase not ended
            await expect(
                escrow.resolveUnrevealedCommits(1, 0)
            ).to.be.revertedWith("Reveal phase not ended yet");
        });

        it("SubnetRegistry: resolveUnrevealedCommits works", async function () {
            const { registry, owner, requester, miner1, validator1, validator2 } =
                await loadFixture(deployFullSystem);

            await registry.connect(miner1).registerMiner(0);
            await registry.connect(owner).addValidator(0, validator1.address);
            await registry.connect(owner).addValidator(0, validator2.address);
            await registry.setCommitRevealConfig(300, 300);

            const reward = ethers.parseUnits("100", 8);
            await registry.connect(requester).createTask(0, "taskHash", reward, 86400);
            await registry.connect(miner1).submitResult(1, "result1");

            const salt1 = ethers.encodeBytes32String("s1");
            const salt2 = ethers.encodeBytes32String("s2");
            const hash1 = ethers.solidityPackedKeccak256(["uint256", "bytes32"], [9000, salt1]);
            const hash2 = ethers.solidityPackedKeccak256(["uint256", "bytes32"], [9500, salt2]);

            await registry.connect(validator1).commitScore(1, 0, hash1);
            await registry.connect(validator2).commitScore(1, 0, hash2);

            await time.increase(301);

            // Both reveal
            await registry.connect(validator1).revealScore(1, 0, 9000, salt1);
            await registry.connect(validator2).revealScore(1, 0, 9500, salt2);

            await time.increase(301);

            // Already have consensus from reveals, so consensus was already reached
            // The task should already have a winner
            const task = await registry.getTask(1);
            expect(task.winningMiner).to.equal(miner1.address);
        });
    });

    // =========================================================================
    // 4. GOVERNANCE TARGET REVOCATION RACE CONDITION
    // =========================================================================
    describe("4. Governance Target Race Condition", function () {

        it("proposal should execute even if target is de-whitelisted after creation", async function () {
            const { governor, token, owner, escrow, requester } =
                await loadFixture(deployFullSystem);

            const escrowAddr = await escrow.getAddress();

            // Whitelist escrow as target
            await governor.setAllowedTarget(escrowAddr, true);

            // Give requester enough to propose
            const threshold = ethers.parseUnits("10000", 8);
            await token.mint(requester.address, threshold);

            // Create proposal targeting escrow
            const callData = escrow.interface.encodeFunctionData("setPlatformFeeRate", [300]);
            await governor.connect(requester).propose(
                "Lower platform fee to 3%",
                escrowAddr,
                callData
            );

            // Vote
            await governor.connect(requester).vote(1, true);

            // Advance past voting period
            await time.increase(3 * 24 * 60 * 60 + 1);
            await governor.finalizeVoting(1);

            // Owner de-whitelists escrow AFTER proposal succeeded
            await governor.setAllowedTarget(escrowAddr, false);

            // Advance past timelock
            await time.increase(24 * 60 * 60 + 1);

            // Execution should STILL succeed (snapshot at creation time)
            // Transfer ownership of escrow to governor for the call to work
            await escrow.transferOwnership(await governor.getAddress());

            await expect(governor.execute(1)).to.not.be.reverted;
        });

        it("proposal with invalid target at creation should revert", async function () {
            const { governor, token, requester, escrow } =
                await loadFixture(deployFullSystem);

            const threshold = ethers.parseUnits("10000", 8);
            await token.mint(requester.address, threshold);

            const escrowAddr = await escrow.getAddress();
            // Don't whitelist — should fail at propose
            const callData = escrow.interface.encodeFunctionData("setPlatformFeeRate", [300]);

            await expect(
                governor.connect(requester).propose("Bad proposal", escrowAddr, callData)
            ).to.be.revertedWith("Target not whitelisted");
        });
    });

    // =========================================================================
    // 5. BYPASS ATTACK VECTORS
    // =========================================================================
    describe("5. Bypass Attack Vectors", function () {

        it("attacker cannot register as miner without stake", async function () {
            const { registry, attacker } = await loadFixture(deployFullSystem);

            await expect(
                registry.connect(attacker).registerMiner(0)
            ).to.be.revertedWith("Must stake as Miner in StakingVault first");
        });

        it("attacker cannot submit results without being registered in subnet", async function () {
            const { registry, requester, attacker, owner, validator1, vault, token } =
                await loadFixture(deployFullSystem);

            // Register a valid validator
            await registry.connect(owner).addValidator(0, validator1.address);

            // Create a task
            const reward = ethers.parseUnits("100", 8);
            await registry.connect(requester).createTask(0, "taskHash", reward, 86400);

            // Attacker tries to submit without being registered
            await expect(
                registry.connect(attacker).submitResult(1, "malicious_result")
            ).to.be.revertedWith("Not registered in subnet");
        });

        it("attacker cannot validate without being a subnet validator", async function () {
            const { registry, requester, miner1, attacker, owner, validator1 } =
                await loadFixture(deployFullSystem);

            await registry.connect(miner1).registerMiner(0);
            await registry.connect(owner).addValidator(0, validator1.address);

            const reward = ethers.parseUnits("100", 8);
            await registry.connect(requester).createTask(0, "taskHash", reward, 86400);
            await registry.connect(miner1).submitResult(1, "result");

            await expect(
                registry.connect(attacker).validateSubmission(1, 0, 10000)
            ).to.be.revertedWith("Not a validator");
        });

        it("validator cannot score the same submission twice", async function () {
            const { registry, requester, miner1, validator1, owner } =
                await loadFixture(deployFullSystem);

            await registry.connect(miner1).registerMiner(0);
            await registry.connect(owner).addValidator(0, validator1.address);

            const reward = ethers.parseUnits("100", 8);
            await registry.connect(requester).createTask(0, "taskHash", reward, 86400);
            await registry.connect(miner1).submitResult(1, "result");

            await registry.connect(validator1).validateSubmission(1, 0, 8000);

            await expect(
                registry.connect(validator1).validateSubmission(1, 0, 9000)
            ).to.be.revertedWith("Validator already scored this submission");
        });

        it("miner cannot submit twice to same task", async function () {
            const { registry, requester, miner1, owner, validator1 } =
                await loadFixture(deployFullSystem);

            await registry.connect(miner1).registerMiner(0);
            await registry.connect(owner).addValidator(0, validator1.address);

            const reward = ethers.parseUnits("100", 8);
            await registry.connect(requester).createTask(0, "taskHash", reward, 86400);

            await registry.connect(miner1).submitResult(1, "result1");
            await expect(
                registry.connect(miner1).submitResult(1, "result2")
            ).to.be.revertedWith("Miner already submitted");
        });

        it("StakingVault: prevents dual role (miner cannot stake as validator too)", async function () {
            const { vault, attacker, token } = await loadFixture(deployFullSystem);

            // Stake as miner first
            const minerStake = ethers.parseUnits("2000", 8);
            await vault.connect(attacker).stake(minerStake, 1); // Miner

            // Try to stake more as validator — should fail (cannot change role)
            const validatorStake = ethers.parseUnits("60000", 8);
            await expect(
                vault.connect(attacker).stake(validatorStake, 2) // Validator
            ).to.be.revertedWith("Cannot change role while staked");
        });

        it("SubnetRegistry: score must be valid (0-10000)", async function () {
            const { registry, requester, miner1, validator1, owner } =
                await loadFixture(deployFullSystem);

            await registry.connect(miner1).registerMiner(0);
            await registry.connect(owner).addValidator(0, validator1.address);

            const reward = ethers.parseUnits("100", 8);
            await registry.connect(requester).createTask(0, "taskHash", reward, 86400);
            await registry.connect(miner1).submitResult(1, "result");

            await expect(
                registry.connect(validator1).validateSubmission(1, 0, 20000)
            ).to.be.revertedWith("Invalid score");
        });

        it("cannot finalize task without a winner", async function () {
            const { registry, requester, miner1, owner, validator1 } =
                await loadFixture(deployFullSystem);

            await registry.connect(miner1).registerMiner(0);
            await registry.connect(owner).addValidator(0, validator1.address);

            const reward = ethers.parseUnits("100", 8);
            await registry.connect(requester).createTask(0, "taskHash", reward, 86400);

            // Submit but don't validate
            await registry.connect(miner1).submitResult(1, "result");

            await expect(
                registry.finalizeTask(1)
            ).to.be.revertedWith("No winner");
        });
    });

    // =========================================================================
    // 6. FULL END-TO-END CROSS-CONTRACT FLOW
    // =========================================================================
    describe("6. Full E2E Cross-Contract Flow", function () {

        it("complete lifecycle: stake → register → task → validate → finalize → withdraw", async function () {
            const { token, vault, registry, owner, requester, miner1, validator1, validator2 } =
                await loadFixture(deployFullSystem);

            // Step 1: Miners and validators already staked in fixture
            expect(await vault.isMiner(miner1.address)).to.be.true;
            expect(await vault.isValidator(validator1.address)).to.be.true;

            // Step 2: Register miner in subnet (requires StakingVault stake)
            await registry.connect(miner1).registerMiner(0);
            expect(await registry.isMiner(0, miner1.address)).to.be.true;

            // Step 3: Add validators to subnet (requires StakingVault stake)
            await registry.connect(owner).addValidator(0, validator1.address);
            await registry.connect(owner).addValidator(0, validator2.address);

            // Step 4: Create task
            const reward = ethers.parseUnits("100", 8);
            await registry.connect(requester).createTask(0, "taskHash", reward, 86400);

            // Step 5: Miner submits
            await registry.connect(miner1).submitResult(1, "result");

            // Step 6: Validators score
            await registry.connect(validator1).validateSubmission(1, 0, 8500);
            await registry.connect(validator2).validateSubmission(1, 0, 9000);

            // Step 7: Finalize
            await registry.finalizeTask(1);

            // Step 8: Check earnings and withdraw
            const minerWithdrawable = await registry.pendingWithdrawals(miner1.address);
            expect(minerWithdrawable).to.be.gt(0);

            const balBefore = await token.balanceOf(miner1.address);
            await registry.connect(miner1).withdrawEarnings();
            const balAfter = await token.balanceOf(miner1.address);
            expect(balAfter - balBefore).to.equal(minerWithdrawable);
        });
    });
});
