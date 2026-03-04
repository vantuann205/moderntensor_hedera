const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Attack Vector Tests — Post-Security-Patch", function () {
    let escrow, token;
    let owner, requester, miner1, miner2, validator1, validator2, anyone;

    beforeEach(async function () {
        [owner, requester, miner1, miner2, validator1, validator2, anyone] = await ethers.getSigners();

        const MockToken = await ethers.getContractFactory("MockMDT");
        token = await MockToken.deploy();

        const Escrow = await ethers.getContractFactory("PaymentEscrow");
        escrow = await Escrow.deploy(token.target || token.address);

        // Disable dispute grace period for test simplicity
        await escrow.setDisputeGracePeriod(0);

        // Setup validators
        await escrow.addValidator(validator1.address);
        await escrow.addValidator(validator2.address);

        // Mint and approve tokens for requester
        const amount = ethers.parseUnits("10000", 8);
        await token.mint(requester.address, amount);
        await token.connect(requester).approve(escrow.target || escrow.address, amount);
    });

    // =========================================================================
    // FIX 1: State Desync — acceptTask should no longer lock funds
    // =========================================================================
    describe("FIX 1: State Desync (acceptTask flow)", function () {
        it("should allow finalization EVEN IF a miner called acceptTask first", async function () {
            await escrow.connect(requester).createTask("hash1", 100000000, 86400);

            // Miner accepts -> status was InProgress
            await escrow.connect(miner1).acceptTask(1);

            // Miner submits -> status NOW becomes PendingReview (FIXED!)
            await escrow.connect(miner1).submitResult(1, "resHash");

            // Validators score
            await escrow.connect(validator1).validateSubmission(1, 0, 9000);
            await escrow.connect(validator2).validateSubmission(1, 0, 9500);

            // Verify task is now PendingReview
            const taskBefore = await escrow.getTask(1);
            expect(taskBefore.status).to.equal(2); // 2 = PendingReview

            // Finalization should now SUCCEED
            await expect(escrow.connect(requester).finalizeTask(1)).to.not.be.reverted;

            // Task should be Completed
            const taskAfter = await escrow.getTask(1);
            expect(taskAfter.status).to.equal(3); // 3 = Completed
        });
    });

    // =========================================================================
    // FIX 2: Trustless Finalization — Anyone can finalize
    // =========================================================================
    describe("FIX 2: Trustless Finalization", function () {
        beforeEach(async function () {
            await escrow.connect(requester).createTask("hash2", 100000000, 86400);
            await escrow.connect(miner1).submitResult(1, "resHash");
            await escrow.connect(validator1).validateSubmission(1, 0, 8500);
            await escrow.connect(validator2).validateSubmission(1, 0, 9000);
        });

        it("should allow requester to finalize", async function () {
            await expect(escrow.connect(requester).finalizeTask(1)).to.not.be.reverted;
        });

        it("should allow owner to finalize", async function () {
            await expect(escrow.connect(owner).finalizeTask(1)).to.not.be.reverted;
        });

        it("should allow the winning miner to finalize (trustless!)", async function () {
            await expect(escrow.connect(miner1).finalizeTask(1)).to.not.be.reverted;
        });

        it("should allow ANY random address to finalize (trustless!)", async function () {
            await expect(escrow.connect(anyone).finalizeTask(1)).to.not.be.reverted;
        });

        it("should NOT allow double finalization", async function () {
            await escrow.connect(anyone).finalizeTask(1);
            await expect(escrow.connect(anyone).finalizeTask(1))
                .to.be.revertedWith("Task not ready for finalization");
        });
    });

    // =========================================================================
    // FIX 3: Pull-over-Push (withdrawEarnings)
    // =========================================================================
    describe("FIX 3: Pull-over-Push Pattern (withdrawEarnings)", function () {
        beforeEach(async function () {
            // Fund the escrow with tokens for payouts
            const escrowFund = ethers.parseUnits("5000", 8);
            await token.mint(escrow.target || escrow.address, escrowFund);

            // Create and complete a task
            await escrow.connect(requester).createTask("hash3", 100000000, 86400);
            await escrow.connect(miner1).submitResult(1, "resHash");
            await escrow.connect(validator1).validateSubmission(1, 0, 9000);
            await escrow.connect(validator2).validateSubmission(1, 0, 9500);
            await escrow.connect(anyone).finalizeTask(1);
        });

        it("should credit pending withdrawals to winning miner", async function () {
            const pending = await escrow.pendingWithdrawals(miner1.address);
            expect(pending).to.be.gt(0);
        });

        it("should credit pending withdrawals to validators", async function () {
            const pending1 = await escrow.pendingWithdrawals(validator1.address);
            const pending2 = await escrow.pendingWithdrawals(validator2.address);
            expect(pending1).to.be.gt(0);
            expect(pending2).to.be.gt(0);
        });

        it("should allow miner to withdraw earnings", async function () {
            const pendingBefore = await escrow.pendingWithdrawals(miner1.address);
            const balBefore = await token.balanceOf(miner1.address);

            await escrow.connect(miner1).withdrawEarnings();

            const pendingAfter = await escrow.pendingWithdrawals(miner1.address);
            const balAfter = await token.balanceOf(miner1.address);

            expect(pendingAfter).to.equal(0);
            expect(balAfter - balBefore).to.equal(pendingBefore);
        });

        it("should allow validator to withdraw earnings", async function () {
            const pendingBefore = await escrow.pendingWithdrawals(validator1.address);

            await escrow.connect(validator1).withdrawEarnings();

            const pendingAfter = await escrow.pendingWithdrawals(validator1.address);
            expect(pendingAfter).to.equal(0);
        });

        it("should REJECT withdrawal if no pending earnings", async function () {
            await expect(escrow.connect(anyone).withdrawEarnings())
                .to.be.revertedWith("No pending earnings");
        });

        it("should REJECT double withdrawal", async function () {
            await escrow.connect(miner1).withdrawEarnings();
            await expect(escrow.connect(miner1).withdrawEarnings())
                .to.be.revertedWith("No pending earnings");
        });

        it("should emit EarningsWithdrawn event", async function () {
            const pending = await escrow.pendingWithdrawals(miner1.address);
            await expect(escrow.connect(miner1).withdrawEarnings())
                .to.emit(escrow, "EarningsWithdrawn")
                .withArgs(miner1.address, pending);
        });
    });

    // =========================================================================
    // REGRESSION: Original test suite core flows still work
    // =========================================================================
    describe("Regression: Core Functionality", function () {
        it("should create task with correct fee breakdown", async function () {
            await escrow.connect(requester).createTask("hash_reg", 100000000, 86400);
            const task = await escrow.getTask(1);
            expect(task.rewardAmount).to.equal(100000000);
            // 5% platform fee
            expect(task.platformFee).to.equal(5000000);
            // 15% validator reward
            expect(task.validatorReward).to.equal(15000000);
        });

        it("should track miner earnings after finalization", async function () {
            const escrowFund = ethers.parseUnits("5000", 8);
            await token.mint(escrow.target || escrow.address, escrowFund);

            await escrow.connect(requester).createTask("hash_earn", 100000000, 86400);
            await escrow.connect(miner1).submitResult(1, "resHash");
            await escrow.connect(validator1).validateSubmission(1, 0, 9000);
            await escrow.connect(validator2).validateSubmission(1, 0, 9500);
            await escrow.connect(requester).finalizeTask(1);

            const earnings = await escrow.minerEarnings(miner1.address);
            expect(earnings).to.equal(100000000);
        });

        it("should allow task cancellation when status is Created", async function () {
            await escrow.connect(requester).createTask("hash_cancel", 100000000, 86400);

            const balBefore = await token.balanceOf(requester.address);
            await escrow.connect(requester).cancelTask(1);
            const balAfter = await token.balanceOf(requester.address);

            // Full refund: reward + platformFee + validatorReward
            expect(balAfter - balBefore).to.equal(120000000);
        });
    });
});
