const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Phase 2 & 3: Reputation + Commit-Reveal Tests", function () {
    let escrow, token;
    let owner, requester, miner, validator1, validator2, validator3;

    beforeEach(async function () {
        [owner, requester, miner, validator1, validator2, validator3] = await ethers.getSigners();

        const MockToken = await ethers.getContractFactory("MockMDT");
        token = await MockToken.deploy();

        const Escrow = await ethers.getContractFactory("PaymentEscrow");
        escrow = await Escrow.deploy(token.target || token.address);

        await escrow.addValidator(validator1.address);
        await escrow.addValidator(validator2.address);
        await escrow.addValidator(validator3.address);
        await escrow.setMinValidations(2);

        const amount = ethers.parseUnits("100000", 8);
        await token.mint(requester.address, amount);
        await token.connect(requester).approve(escrow.target || escrow.address, amount);
        await token.mint(escrow.target || escrow.address, amount);
    });

    // =========================================================================
    // PHASE 2: REPUTATION SCORE TESTS
    // =========================================================================
    describe("Phase 2: Reputation Score", function () {
        it("should initialize validator with default 50% reputation", async function () {
            const rep = await escrow.validatorReputation(validator1.address);
            expect(rep.reputationScore).to.equal(5000); // 50%
            expect(rep.totalValidations).to.equal(0);
        });

        it("should update reputation after accurate scoring", async function () {
            await escrow.connect(requester).createTask("hash1", ethers.parseUnits("100", 8), 86400);
            await escrow.connect(miner).submitResult(1, "result");

            // Both give similar scores → both accurate
            await escrow.connect(validator1).validateSubmission(1, 0, 9000);
            await escrow.connect(validator2).validateSubmission(1, 0, 9200);

            await escrow.connect(requester).finalizeTask(1);

            const rep1 = await escrow.validatorReputation(validator1.address);
            expect(rep1.totalValidations).to.equal(1);
            expect(rep1.accurateValidations).to.equal(1);
            expect(rep1.reputationScore).to.equal(10000); // 100% accuracy
        });

        it("should decrease reputation after inaccurate scoring", async function () {
            await escrow.setMinValidations(3);
            await escrow.connect(requester).createTask("hash2", ethers.parseUnits("100", 8), 86400);
            await escrow.connect(miner).submitResult(1, "result");

            // V1: 9000, V2: 8500, V3: 1000 (wildly off)
            await escrow.connect(validator1).validateSubmission(1, 0, 9000);
            await escrow.connect(validator2).validateSubmission(1, 0, 8500);
            await escrow.connect(validator3).validateSubmission(1, 0, 1000);

            await escrow.connect(requester).finalizeTask(1);

            // V3 was inaccurate → 0/1 = 0 reputation
            const rep3 = await escrow.validatorReputation(validator3.address);
            expect(rep3.totalValidations).to.equal(1);
            expect(rep3.accurateValidations).to.equal(0);
            expect(rep3.reputationScore).to.equal(0);
        });

        it("should emit ReputationUpdated event", async function () {
            await escrow.connect(requester).createTask("hash3", ethers.parseUnits("100", 8), 86400);
            await escrow.connect(miner).submitResult(1, "result");

            await escrow.connect(validator1).validateSubmission(1, 0, 9000);
            await escrow.connect(validator2).validateSubmission(1, 0, 9000);

            await expect(escrow.connect(requester).finalizeTask(1))
                .to.emit(escrow, "ReputationUpdated");
        });

        it("should give higher rewards to validators with better reputation over time", async function () {
            // TASK 1: V1 is accurate, V2 is accurate
            await escrow.connect(requester).createTask("hash4a", ethers.parseUnits("100", 8), 86400);
            await escrow.connect(miner).submitResult(1, "result");
            await escrow.connect(validator1).validateSubmission(1, 0, 9000);
            await escrow.connect(validator2).validateSubmission(1, 0, 9000);
            await escrow.connect(requester).finalizeTask(1);

            // Both withdraw to reset
            await escrow.connect(validator1).withdrawEarnings();
            await escrow.connect(validator2).withdrawEarnings();

            // TASK 2: V1 is accurate, V2 is wildly off
            await escrow.setMinValidations(3);
            await escrow.connect(requester).createTask("hash4b", ethers.parseUnits("100", 8), 86400);
            await escrow.connect(miner).submitResult(2, "result");
            await escrow.connect(validator1).validateSubmission(2, 0, 9000);
            await escrow.connect(validator2).validateSubmission(2, 0, 1000); // Way off
            await escrow.connect(validator3).validateSubmission(2, 0, 8500);
            await escrow.connect(requester).finalizeTask(2);

            // V1 reputation = 2/2 = 100%, V2 reputation = 1/2 = 50%
            const rep1 = await escrow.validatorReputation(validator1.address);
            const rep2 = await escrow.validatorReputation(validator2.address);
            expect(rep1.reputationScore).to.equal(10000); // 100%
            expect(rep2.reputationScore).to.equal(5000);  // 50%
        });
    });

    // =========================================================================
    // PHASE 3: COMMIT-REVEAL TESTS
    // =========================================================================
    describe("Phase 3: Commit-Reveal Scheme", function () {
        let taskId;

        beforeEach(async function () {
            // Reduce commit/reveal durations for testing
            await escrow.setCommitRevealConfig(300, 300); // 5 min each

            await escrow.connect(requester).createTask("hash_cr", ethers.parseUnits("100", 8), 86400);
            await escrow.connect(miner).submitResult(1, "result");
            taskId = 1;
        });

        it("should allow validator to commit a score hash", async function () {
            const salt = ethers.encodeBytes32String("secret_salt_1");
            const commitHash = await escrow.getCommitHash(9000, salt);

            await expect(escrow.connect(validator1).commitScore(taskId, 0, commitHash))
                .to.emit(escrow, "ScoreCommitted")
                .withArgs(taskId, 0, validator1.address);

            expect(await escrow.commitCount(taskId, 0)).to.equal(1);
        });

        it("should REJECT commit with empty hash", async function () {
            await expect(
                escrow.connect(validator1).commitScore(taskId, 0, ethers.ZeroHash)
            ).to.be.revertedWith("Empty commit hash");
        });

        it("should REJECT duplicate commits", async function () {
            const salt = ethers.encodeBytes32String("salt");
            const commitHash = await escrow.getCommitHash(9000, salt);

            await escrow.connect(validator1).commitScore(taskId, 0, commitHash);
            await expect(
                escrow.connect(validator1).commitScore(taskId, 0, commitHash)
            ).to.be.revertedWith("Already committed");
        });

        it("should REJECT reveal before commit phase ends", async function () {
            const salt = ethers.encodeBytes32String("salt");
            const commitHash = await escrow.getCommitHash(9000, salt);

            await escrow.connect(validator1).commitScore(taskId, 0, commitHash);

            await expect(
                escrow.connect(validator1).revealScore(taskId, 0, 9000, salt)
            ).to.be.revertedWith("Commit phase not ended yet");
        });

        it("should allow reveal after commit phase ends", async function () {
            const salt = ethers.encodeBytes32String("salt_v1");
            const commitHash = await escrow.getCommitHash(9000, salt);

            await escrow.connect(validator1).commitScore(taskId, 0, commitHash);

            // Fast forward past commit phase
            await time.increase(301);

            await expect(
                escrow.connect(validator1).revealScore(taskId, 0, 9000, salt)
            ).to.emit(escrow, "ScoreRevealed")
                .withArgs(taskId, 0, validator1.address, 9000);
        });

        it("should REJECT reveal with wrong score (hash mismatch)", async function () {
            const salt = ethers.encodeBytes32String("salt");
            const commitHash = await escrow.getCommitHash(9000, salt);

            await escrow.connect(validator1).commitScore(taskId, 0, commitHash);
            await time.increase(301);

            // Try to reveal with different score
            await expect(
                escrow.connect(validator1).revealScore(taskId, 0, 5000, salt)
            ).to.be.revertedWith("Hash mismatch");
        });

        it("should REJECT reveal with wrong salt (hash mismatch)", async function () {
            const salt = ethers.encodeBytes32String("original_salt");
            const commitHash = await escrow.getCommitHash(9000, salt);

            await escrow.connect(validator1).commitScore(taskId, 0, commitHash);
            await time.increase(301);

            const wrongSalt = ethers.encodeBytes32String("wrong_salt");
            await expect(
                escrow.connect(validator1).revealScore(taskId, 0, 9000, wrongSalt)
            ).to.be.revertedWith("Hash mismatch");
        });

        it("should reach consensus via commit-reveal path", async function () {
            const salt1 = ethers.encodeBytes32String("salt_1");
            const salt2 = ethers.encodeBytes32String("salt_2");
            const hash1 = await escrow.getCommitHash(9000, salt1);
            const hash2 = await escrow.getCommitHash(8500, salt2);

            // Phase A: Both validators commit
            await escrow.connect(validator1).commitScore(taskId, 0, hash1);
            await escrow.connect(validator2).commitScore(taskId, 0, hash2);
            expect(await escrow.commitCount(taskId, 0)).to.equal(2);

            // Fast-forward past commit phase
            await time.increase(301);

            // Phase B: Both validators reveal
            await escrow.connect(validator1).revealScore(taskId, 0, 9000, salt1);
            await escrow.connect(validator2).revealScore(taskId, 0, 8500, salt2);

            // Consensus should be reached: median of [8500, 9000] = 8750
            const task = await escrow.getTask(taskId);
            expect(task.winningScore).to.equal(8750);
            expect(task.winningMiner).to.equal(miner.address);
        });

        it("should REJECT reveal after reveal phase ends", async function () {
            const salt = ethers.encodeBytes32String("salt");
            const commitHash = await escrow.getCommitHash(9000, salt);

            await escrow.connect(validator1).commitScore(taskId, 0, commitHash);

            // Fast forward past both commit + reveal phases (5min + 5min + 1s)
            await time.increase(601);

            await expect(
                escrow.connect(validator1).revealScore(taskId, 0, 9000, salt)
            ).to.be.revertedWith("Reveal phase ended");
        });

        it("should REJECT commit after commit phase ends", async function () {
            const salt1 = ethers.encodeBytes32String("salt1");
            const hash1 = await escrow.getCommitHash(9000, salt1);

            // V1 commits (starts commit phase)
            await escrow.connect(validator1).commitScore(taskId, 0, hash1);

            // Fast forward past commit phase
            await time.increase(301);

            // V2 tries to commit — too late
            const salt2 = ethers.encodeBytes32String("salt2");
            const hash2 = await escrow.getCommitHash(8500, salt2);

            await expect(
                escrow.connect(validator2).commitScore(taskId, 0, hash2)
            ).to.be.revertedWith("Commit phase ended");
        });

        it("should correctly configure commit-reveal durations", async function () {
            await escrow.setCommitRevealConfig(3600, 1800); // 1hr, 30min
            expect(await escrow.commitPhaseDuration()).to.equal(3600);
            expect(await escrow.revealPhaseDuration()).to.equal(1800);
        });

        it("should REJECT durations shorter than 5 minutes", async function () {
            await expect(
                escrow.setCommitRevealConfig(60, 300)
            ).to.be.revertedWith("Commit phase too short");

            await expect(
                escrow.setCommitRevealConfig(300, 60)
            ).to.be.revertedWith("Reveal phase too short");
        });

        it("should prevent validator from using both direct and commit paths", async function () {
            // V1 uses direct validateSubmission
            await escrow.connect(validator1).validateSubmission(taskId, 0, 9000);

            // V1 tries to also commit → should fail
            const salt = ethers.encodeBytes32String("salt");
            const hash = await escrow.getCommitHash(9000, salt);

            await expect(
                escrow.connect(validator1).commitScore(taskId, 0, hash)
            ).to.be.revertedWith("Already scored directly");
        });
    });
});
