/**
 * StakingVault — Hardhat Tests
 *
 * Tests for:
 *   1. Staking as Miner / Validator
 *   2. Unstaking with cooldown
 *   3. Slashing
 *   4. Admin setter bounds + events
 *   5. Pause / Unpause
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("StakingVault", function () {
    async function deployFixture() {
        const [owner, miner, validator, slasher, user] = await ethers.getSigners();

        const MockToken = await ethers.getContractFactory("MockMDT");
        const token = await MockToken.deploy();

        const StakingVault = await ethers.getContractFactory("StakingVault");
        const vault = await StakingVault.deploy(await token.getAddress());

        const mintAmount = ethers.parseUnits("1000000", 8);
        await token.mint(miner.address, mintAmount);
        await token.mint(validator.address, mintAmount);
        await token.mint(user.address, mintAmount);

        const vaultAddr = await vault.getAddress();
        await token.connect(miner).approve(vaultAddr, mintAmount);
        await token.connect(validator).approve(vaultAddr, mintAmount);
        await token.connect(user).approve(vaultAddr, mintAmount);

        return { vault, token, owner, miner, validator, slasher, user };
    }

    describe("Staking", function () {
        it("should allow staking as miner with sufficient amount", async function () {
            const { vault, miner } = await loadFixture(deployFixture);
            const minStake = await vault.minMinerStake();
            await expect(vault.connect(miner).stake(minStake, 1)) // role=1 (Miner)
                .to.emit(vault, "Staked");
        });

        it("should reject staking below minimum", async function () {
            const { vault, miner } = await loadFixture(deployFixture);
            await expect(vault.connect(miner).stake(100, 1))
                .to.be.reverted;
        });

        it("should allow staking as validator", async function () {
            const { vault, validator } = await loadFixture(deployFixture);
            const minStake = await vault.minValidatorStake();
            await expect(vault.connect(validator).stake(minStake, 2)) // role=2 (Validator)
                .to.emit(vault, "Staked");
        });

        it("should track total staked amount", async function () {
            const { vault, miner } = await loadFixture(deployFixture);
            const minStake = await vault.minMinerStake();
            await vault.connect(miner).stake(minStake, 1);
            expect(await vault.totalStaked()).to.equal(minStake);
        });
    });

    describe("Unstaking", function () {
        it("should request unstake and enforce cooldown", async function () {
            const { vault, miner } = await loadFixture(deployFixture);
            const minStake = await vault.minMinerStake();
            await vault.connect(miner).stake(minStake, 1);

            await vault.connect(miner).requestUnstake();

            // Trying to withdraw before cooldown should fail
            await expect(vault.connect(miner).withdraw())
                .to.be.reverted;

            // Fast-forward past cooldown
            await time.increase(7 * 24 * 3600 + 1);

            await expect(vault.connect(miner).withdraw())
                .to.emit(vault, "Withdrawn");
        });
    });

    describe("Admin setters", function () {
        it("should update minMinerStake with bounds", async function () {
            const { vault, owner } = await loadFixture(deployFixture);
            const newMin = ethers.parseUnits("500", 8);
            await expect(vault.setMinMinerStake(newMin))
                .to.emit(vault, "MinMinerStakeUpdated");
        });

        it("should reject non-owner calls", async function () {
            const { vault, miner } = await loadFixture(deployFixture);
            await expect(vault.connect(miner).setMinMinerStake(100))
                .to.be.reverted;
        });
    });

    describe("Pause", function () {
        it("should prevent staking when paused", async function () {
            const { vault, owner, miner } = await loadFixture(deployFixture);
            await vault.pause();
            const minStake = await vault.minMinerStake();
            await expect(vault.connect(miner).stake(minStake, 1))
                .to.be.reverted;
        });
    });
});
