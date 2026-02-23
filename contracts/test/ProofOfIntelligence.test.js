const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Proof-of-Intelligence Differentiator Tests", function () {
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

        const amount = ethers.parseUnits("1000000", 8);
        await token.mint(requester.address, amount);
        await token.connect(requester).approve(escrow.target || escrow.address, amount);
        await token.mint(escrow.target || escrow.address, amount);
    });

    // =========================================================================
    // ADAPTIVE MIN VALIDATIONS
    // =========================================================================
    describe("Adaptive minValidations", function () {
        it("should return base minValidations for low-value tasks", async function () {
            const reward = ethers.parseUnits("100", 8); // 100 MDT (below threshold)
            const adaptive = await escrow.getAdaptiveMinValidations(reward);
            expect(adaptive).to.equal(2); // base = 2
        });

        it("should return base + 1 for high-value tasks (>=1000 MDT)", async function () {
            const reward = ethers.parseUnits("1000", 8); // 1000 MDT
            const adaptive = await escrow.getAdaptiveMinValidations(reward);
            expect(adaptive).to.equal(3); // base (2) + 1
        });

        it("should return base + 2 for ultra-high-value tasks (>=10000 MDT)", async function () {
            const reward = ethers.parseUnits("10000", 8); // 10000 MDT
            const adaptive = await escrow.getAdaptiveMinValidations(reward);
            expect(adaptive).to.equal(4); // base (2) + 2
        });

        it("should scale with different base minValidations", async function () {
            await escrow.setMinValidations(3);
            const reward = ethers.parseUnits("10000", 8);
            const adaptive = await escrow.getAdaptiveMinValidations(reward);
            expect(adaptive).to.equal(5); // base (3) + 2
        });

        it("should expose HIGH_VALUE_THRESHOLD constant", async function () {
            const threshold = await escrow.HIGH_VALUE_THRESHOLD();
            expect(threshold).to.equal(ethers.parseUnits("1000", 8));
        });

        it("should expose ULTRA_VALUE_THRESHOLD constant", async function () {
            const threshold = await escrow.ULTRA_VALUE_THRESHOLD();
            expect(threshold).to.equal(ethers.parseUnits("10000", 8));
        });
    });

    // =========================================================================
    // REPUTATION SYSTEM EDGE CASES (PoI)
    // =========================================================================
    describe("Proof-of-Intelligence: Reputation Multiplier Effect", function () {
        it("should demonstrate compounding reputation effect over 3 tasks", async function () {
            // Task 1: Both accurate
            await escrow.connect(requester).createTask("t1", ethers.parseUnits("100", 8), 86400);
            await escrow.connect(miner).submitResult(1, "r1");
            await escrow.connect(validator1).validateSubmission(1, 0, 9000);
            await escrow.connect(validator2).validateSubmission(1, 0, 9000);
            await escrow.connect(requester).finalizeTask(1);

            let rep1 = await escrow.validatorReputation(validator1.address);
            expect(rep1.reputationScore).to.equal(10000); // 100%
            expect(rep1.totalValidations).to.equal(1);

            // Task 2: V1 still accurate, V2 wildly off
            await escrow.setMinValidations(3);
            await escrow.connect(requester).createTask("t2", ethers.parseUnits("100", 8), 86400);
            await escrow.connect(miner).submitResult(2, "r2");
            await escrow.connect(validator1).validateSubmission(2, 0, 9000);
            await escrow.connect(validator2).validateSubmission(2, 0, 1000); // way off
            await escrow.connect(validator3).validateSubmission(2, 0, 8800);
            await escrow.connect(requester).finalizeTask(2);

            rep1 = await escrow.validatorReputation(validator1.address);
            let rep2 = await escrow.validatorReputation(validator2.address);

            // V1: 2/2 accurate = 100%, V2: 1/2 accurate = 50%
            expect(rep1.reputationScore).to.equal(10000);
            expect(rep2.reputationScore).to.equal(5000);

            // Task 3: Check that rewards compound differently
            await escrow.connect(validator1).withdrawEarnings();
            await escrow.connect(validator2).withdrawEarnings().catch(() => { }); // may have 0

            await escrow.connect(requester).createTask("t3", ethers.parseUnits("100", 8), 86400);
            await escrow.connect(miner).submitResult(3, "r3");
            await escrow.connect(validator1).validateSubmission(3, 0, 9000);
            await escrow.connect(validator2).validateSubmission(3, 0, 9000);
            await escrow.connect(validator3).validateSubmission(3, 0, 9000);
            await escrow.connect(requester).finalizeTask(3);

            const p1 = await escrow.pendingWithdrawals(validator1.address);
            const p2 = await escrow.pendingWithdrawals(validator2.address);

            // V1 (100% rep) should get MORE than V2 (50% rep) for same accurate score
            // Because share = 100 * rep/10000
            // V1: 100 * 10000/10000 = 100, V2: 100 * 6666/10000 = 66 (2/3 accurate)
            expect(p1).to.be.gt(p2, "Higher reputation = higher rewards (compounding PoI)");
        });
    });
});
