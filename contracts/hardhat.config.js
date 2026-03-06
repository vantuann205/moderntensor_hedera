// SPDX-License-Identifier: MIT
// Hardhat Configuration for ModernTensor Smart Contracts
// Used to compile and verify SubnetRegistry.sol and PaymentEscrow.sol

require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: {
        version: "0.8.24",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
            viaIR: true,
        },
    },
    paths: {
        sources: "./src",       // Contracts are in contracts/src/ directory
        tests: "./test",
        cache: "./cache",
        artifacts: "./artifacts",
    },
    networks: {
        // Hedera Testnet (via JSON-RPC relay)
        hederaTestnet: {
            url: process.env.HEDERA_JSON_RPC_URL || "https://testnet.hashio.io/api",
            accounts: process.env.HEDERA_EVM_PRIVATE_KEY
                ? [process.env.HEDERA_EVM_PRIVATE_KEY]
                : [],
            chainId: 296,
        },
        // Hedera Mainnet
        hederaMainnet: {
            url: process.env.HEDERA_MAINNET_RPC_URL || "https://mainnet.hashio.io/api",
            accounts: process.env.HEDERA_EVM_PRIVATE_KEY
                ? [process.env.HEDERA_EVM_PRIVATE_KEY]
                : [],
            chainId: 295,
        },
    },
};
