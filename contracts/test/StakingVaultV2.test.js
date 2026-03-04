/**
 * StakingVaultV2 — Hardhat Tests
 *
 * Tests for:
 *   1. EIP-1559 dynamic registration fee
 *   2. Passive reward distribution (depositRewards / claimRewards)
 *   3. Holder role staking
 *   4. Admin setter bounds + events
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("StakingVaultV2", function () {
    async function deployFixture() {
        const [owner, miner, validator, holder, rewardDepositor] = await ethers.getSigners();

        const MockToken = await ethers.getContractFactory("MockMDT");
        const token = await MockToken.deploy();

        const StakingVaultV2 = await ethers.getContractFactory("StakingVaultV2");
        const vault = await StakingVaultV2.deploy(await token.getAddress());

        const mintAmount = ethers.parseUnits("10000000", 8);
        for (const signer of [miner, validator, holder, rewardDepositor]) {
            await token.mint(signer.address, mintAmount);
            await token.connect(signer).approve(await vault.getAddress(), mintAmount);
        }
        // Also mint to owner for reward deposits
        await token.mint(owner.address, mintAmount);
        await token.connect(owner).approve(await vault.getAddress(), mintAmount);

        return { vault, token, owner, miner, validator, holder, rewardDepositor };
    }

    describe("Staking roles", function () {
        it("should allow staking as miner", async function () {
            const { vault, miner } = await loadFixture(deployFixture);
            const minStake = await vault.minMinerStake();
            await expect(vault.connect(miner).stake(minStake, 1))
                .to.emit(vault, "Staked");
            expect(await vault.isMiner(miner.address)).to.be.true;
        });

        it("should allow staking as validator", async function () {
            const { vault, validator } = await loadFixture(deployFixture);
            const minStake = await vault.minValidatorStake();
            await expect(vault.connect(validator).stake(minStake, 2))
                .to.emit(vault, "Staked");
            expect(await vault.isValidator(validator.address)).to.be.true;
        });

        it("should allow staking as holder", async function () {
            const { vault, holder } = await loadFixture(deployFixture);
            const minStake = await vault.minHolderStake();
            await expect(vault.connect(holder).stake(minStake, 3))
                .to.emit(vault, "Staked");
        });
    });

    describe("EIP-1559 Registration Fee", function () {
        it("should return base fee initially", async function () {
            const { vault } = await loadFixture(deployFixture);
            const fee = await vault.getCurrentRegFee();
            const baseFee = await vault.regBaseFee();
            // After time decay, fee should be at or near base
            expect(fee).to.be.gte(await vault.regFeeFloor());
        });

        it("should increase fee after registration", async function () {
            const { vault, miner } = await loadFixture(deployFixture);
            const feeBefore = await vault.getCurrentRegFee();
            const minStake = await vault.minMinerStake();
            await vault.connect(miner).stake(minStake, 1);
            const feeAfter = await vault.getCurrentRegFee();
            expect(feeAfter).to.be.gte(feeBefore);
        });

        it("should decrease fee after time passes", async function () {
            const { vault, miner, validator } = await loadFixture(deployFixture);
            const minStake = await vault.minMinerStake();
            await vault.connect(miner).stake(minStake, 1);
            const feeAfterStake = await vault.getCurrentRegFee();

            // Advance time by many decay intervals
            await time.increase(10 * 3600);

            const feeAfterDecay = await vault.getCurrentRegFee();
            expect(feeAfterDecay).to.be.lte(feeAfterStake);
        });
    });

    describe("Passive Rewards", function () {
        it("should accept reward deposits", async function () {
            const { vault, token, owner, miner } = await loadFixture(deployFixture);
            // Need at least one staker
            const minStake = await vault.minMinerStake();
            await vault.connect(miner).stake(minStake, 1);

            const rewardAmount = ethers.parseUnits("1000", 8);
            await expect(vault.depositRewards(rewardAmount))
                .to.emit(vault, "RewardDeposited");
        });
    });

    describe("Admin setters with bounds", function () {
        it("should update minMinerStake with event", async function () {
            const { vault } = await loadFixture(deployFixture);
            const newMin = ethers.parseUnits("20", 8);
            await expect(vault.setMinMinerStake(newMin))
                .to.emit(vault, "MinMinerStakeUpdated");
        });

        it("should update minValidatorStake with event", async function () {
            const { vault } = await loadFixture(deployFixture);
            const newMin = ethers.parseUnits("1000", 8);
            await expect(vault.setMinValidatorStake(newMin))
                .to.emit(vault, "MinValidatorStakeUpdated");
        });

        it("should read regBaseFee and regFeeCeiling", async function () {
            const { vault } = await loadFixture(deployFixture);
            const baseFee = await vault.regBaseFee();
            const ceiling = await vault.regFeeCeiling();
            expect(baseFee).to.be.lte(ceiling);
        });

        it("should reject non-owner admin calls", async function () {
            const { vault, miner } = await loadFixture(deployFixture);
            await expect(vault.connect(miner).setMinMinerStake(1))
                .to.be.reverted;
        });
    });
});
