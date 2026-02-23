// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockMDT
 * @dev Minimal ERC20 mock for testing PaymentEscrow.
 *      Has a public mint() function so tests can create tokens easily.
 */
contract MockMDT is ERC20 {
    constructor() ERC20("Mock MDT", "MDT") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 8;
    }
}
