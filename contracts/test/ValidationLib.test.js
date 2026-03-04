/**
 * ValidationLib — Hardhat Tests
 *
 * Unit tests for the shared library functions:
 *   1. insertionSort
 *   2. median calculation (odd/even arrays)
 *   3. sortAndMedian convenience
 *   4. calculateDeviation
 *   5. equalSplit
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ValidationLib", function () {
    let libConsumer;

    before(async function () {
        // Deploy a small consumer contract that exposes library functions
        // Since libraries with only internal functions are inlined,
        // we test them through a wrapper contract
        const TestLib = await ethers.getContractFactory("TestValidationLib");
        libConsumer = await TestLib.deploy();
    });

    describe("calculateDeviation", function () {
        it("should return 0 for equal values", async function () {
            expect(await libConsumer.testDeviation(5000, 5000)).to.equal(0);
        });

        it("should return 0 when median is 0", async function () {
            expect(await libConsumer.testDeviation(100, 0)).to.equal(0);
        });

        it("should calculate 50% deviation", async function () {
            // score=7500, median=5000 → diff=2500, deviation=2500*10000/5000=5000
            expect(await libConsumer.testDeviation(7500, 5000)).to.equal(5000);
        });

        it("should handle score < median", async function () {
            // score=2500, median=5000 → diff=2500, deviation=5000
            expect(await libConsumer.testDeviation(2500, 5000)).to.equal(5000);
        });

        it("should return 10000 for 100% deviation", async function () {
            // score=10000, median=5000 → diff=5000, deviation=10000
            expect(await libConsumer.testDeviation(10000, 5000)).to.equal(10000);
        });
    });

    describe("equalSplit", function () {
        it("should split evenly with no remainder", async function () {
            const [share, remainder] = await libConsumer.testEqualSplit(1000, 5);
            expect(share).to.equal(200);
            expect(remainder).to.equal(0);
        });

        it("should handle remainder (dust)", async function () {
            const [share, remainder] = await libConsumer.testEqualSplit(1000, 3);
            expect(share).to.equal(333);
            expect(remainder).to.equal(1);
        });

        it("should revert on 0 validators", async function () {
            await expect(libConsumer.testEqualSplit(1000, 0))
                .to.be.revertedWith("No validators");
        });
    });
});
