// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ValidationLib.sol";

/**
 * @title TestValidationLib
 * @dev Wrapper contract to expose ValidationLib internal functions for testing.
 *      Only used in Hardhat tests — not deployed to mainnet.
 */
contract TestValidationLib {
    function testDeviation(
        uint256 score,
        uint256 medianScore
    ) external pure returns (uint256) {
        return ValidationLib.calculateDeviation(score, medianScore);
    }

    function testEqualSplit(
        uint256 totalReward,
        uint256 validatorCount
    ) external pure returns (uint256 share, uint256 remainder) {
        return ValidationLib.equalSplit(totalReward, validatorCount);
    }

    function testSortAndMedian(
        uint256[] memory scores
    ) external pure returns (uint256) {
        return ValidationLib.sortAndMedian(scores);
    }

    function testInsertionSort(
        uint256[] memory scores
    ) external pure returns (uint256[] memory) {
        ValidationLib.insertionSort(scores);
        return scores;
    }
}
