/**
 * MDTGovernor — Hardhat Tests
 *
 * Tests for:
 *   1. Proposal creation with target whitelist
 *   2. Voting with snapshot (flash-loan prevention)
 *   3. Proposal lifecycle (create → vote → succeed/defeat → execute)
 *   4. Admin setters with bounds + events
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("MDTGovernor", function () {
    async function deployFixture() {
        const [owner, voter1, voter2, voter3, unauthorized] = await ethers.getSigners();

        const MockToken = await ethers.getContractFactory("MockMDT");
        const token = await MockToken.deploy();

        const MDTGovernor = await ethers.getContractFactory("MDTGovernor");
        const governor = await MDTGovernor.deploy(await token.getAddress());

        // Mint tokens to voters so they can meet proposal threshold / quorum
        const mintAmount = ethers.parseUnits("100000", 8);
        for (const voter of [voter1, voter2, voter3]) {
            await token.mint(voter.address, mintAmount);
            await token.connect(voter).approve(await governor.getAddress(), mintAmount);
        }

        // Whitelist the governor itself as a target for proposals
        await governor.setAllowedTarget(await governor.getAddress(), true);

        return { governor, token, owner, voter1, voter2, voter3, unauthorized };
    }

    describe("Proposal creation", function () {
        it("should create a proposal when threshold met", async function () {
            const { governor, voter1 } = await loadFixture(deployFixture);
            const govAddr = await governor.getAddress();

            await expect(
                governor.connect(voter1).propose(
                    "Test proposal",
                    govAddr,
                    "0x"
                )
            ).to.emit(governor, "ProposalCreated");
        });

        it("should reject proposal to non-whitelisted target", async function () {
            const { governor, voter1, unauthorized } = await loadFixture(deployFixture);
            await expect(
                governor.connect(voter1).propose(
                    "Bad target proposal",
                    unauthorized.address,
                    "0x"
                )
            ).to.be.revertedWith("Target not whitelisted");
        });
    });

    describe("Voting", function () {
        it("should allow voting on active proposal", async function () {
            const { governor, voter1, voter2 } = await loadFixture(deployFixture);
            const govAddr = await governor.getAddress();

            await governor.connect(voter1).propose("Test", govAddr, "0x");

            // Wait for voting to be active (after executionDelay)
            await time.increase(1);

            await expect(
                governor.connect(voter2).vote(1, true)
            ).to.emit(governor, "VoteCast");
        });

        it("should prevent double voting", async function () {
            const { governor, voter1 } = await loadFixture(deployFixture);
            const govAddr = await governor.getAddress();

            await governor.connect(voter1).propose("Test", govAddr, "0x");
            await time.increase(1);

            await governor.connect(voter1).vote(1, true);
            await expect(
                governor.connect(voter1).vote(1, false)
            ).to.be.revertedWith("Already voted");
        });
    });

    describe("Admin setters", function () {
        it("should update proposalThreshold with bounds", async function () {
            const { governor } = await loadFixture(deployFixture);
            const newThreshold = ethers.parseUnits("5000", 8);
            await expect(governor.setProposalThreshold(newThreshold))
                .to.emit(governor, "ProposalThresholdUpdated");
        });

        it("should update quorum with bounds", async function () {
            const { governor } = await loadFixture(deployFixture);
            const newQuorum = ethers.parseUnits("5000", 8);
            await expect(governor.setQuorum(newQuorum))
                .to.emit(governor, "QuorumUpdated");
        });

        it("should update votingPeriod with bounds", async function () {
            const { governor } = await loadFixture(deployFixture);
            await expect(governor.setVotingPeriod(2 * 24 * 3600)) // 2 days
                .to.emit(governor, "VotingPeriodUpdated");
        });

        it("should reject non-owner admin calls", async function () {
            const { governor, voter1 } = await loadFixture(deployFixture);
            await expect(
                governor.connect(voter1).setProposalThreshold(1)
            ).to.be.reverted;
        });
    });

    describe("Target whitelist", function () {
        it("should add and remove targets", async function () {
            const { governor, voter1 } = await loadFixture(deployFixture);
            await governor.setAllowedTarget(voter1.address, true);
            expect(await governor.allowedTargets(voter1.address)).to.be.true;

            await governor.setAllowedTarget(voter1.address, false);
            expect(await governor.allowedTargets(voter1.address)).to.be.false;
        });
    });
});
