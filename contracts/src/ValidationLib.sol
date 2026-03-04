// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ValidationLib
 * @dev Shared library for scoring, median calculation, and deviation helpers.
 *
 * Extracted from PaymentEscrow / SubnetRegistry / SubnetRegistryV2 to
 * eliminate ~120 lines of duplicated logic.
 *
 * Functions are `internal pure/view` so they get inlined by the compiler,
 * incurring zero extra DELEGATECALL gas overhead.
 *
 * For Hedera Hello Future Hackathon 2026
 */
library ValidationLib {
    // =========================================================================
    // MEDIAN CALCULATION
    // =========================================================================

    /**
     * @dev Sort an array of scores in-place using insertion sort.
     *      Optimal for small N (2-10 validators per task).
     * @param scores Array to sort (modified in-place)
     */
    function insertionSort(uint256[] memory scores) internal pure {
        uint256 n = scores.length;
        for (uint256 i = 1; i < n; i++) {
            uint256 key = scores[i];
            uint256 j = i;
            while (j > 0 && scores[j - 1] > key) {
                scores[j] = scores[j - 1];
                j--;
            }
            scores[j] = key;
        }
    }

    /**
     * @dev Calculate median of a pre-sorted array.
     * @param sortedScores Sorted score array
     * @return Median value
     */
    function median(
        uint256[] memory sortedScores
    ) internal pure returns (uint256) {
        uint256 n = sortedScores.length;
        require(n > 0, "Empty scores");

        if (n % 2 == 1) {
            return sortedScores[n / 2];
        } else {
            return (sortedScores[n / 2 - 1] + sortedScores[n / 2]) / 2;
        }
    }

    /**
     * @dev Sort and compute median in one call.
     * @param scores Unsorted score array (modified in-place)
     * @return Median value
     */
    function sortAndMedian(
        uint256[] memory scores
    ) internal pure returns (uint256) {
        insertionSort(scores);
        return median(scores);
    }

    // =========================================================================
    // DEVIATION CALCULATION
    // =========================================================================

    /**
     * @dev Calculate deviation between a score and the median, in basis points.
     *      Returns value 0-10000 where 10000 = 100% deviation.
     * @param score Individual validator score
     * @param medianScore Consensus median score
     * @return Deviation in basis points
     */
    function calculateDeviation(
        uint256 score,
        uint256 medianScore
    ) internal pure returns (uint256) {
        if (medianScore == 0) return 0;
        uint256 diff = score > medianScore
            ? score - medianScore
            : medianScore - score;
        return (diff * 10000) / medianScore;
    }

    // =========================================================================
    // VALIDATOR REWARD SPLIT
    // =========================================================================

    /**
     * @dev Calculate equal share per validator from a reward pool.
     *      Returns (sharePerValidator, remainder).
     *      Remainder stays in the contract (dust).
     * @param totalReward Total reward pool
     * @param validatorCount Number of validators to split among
     * @return share Per-validator amount
     * @return remainder Leftover dust
     */
    function equalSplit(
        uint256 totalReward,
        uint256 validatorCount
    ) internal pure returns (uint256 share, uint256 remainder) {
        require(validatorCount > 0, "No validators");
        share = totalReward / validatorCount;
        remainder = totalReward - (share * validatorCount);
    }
}
