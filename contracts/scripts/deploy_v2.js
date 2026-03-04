// Deploy StakingVaultV2 with dynamic reg fees + passive staking rewards
const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deployer:", deployer.address);

    // MDT Token: HTS 0.0.7852345 → EVM address
    const mdtTokenNum = 7852345;
    const mdtTokenAddress = "0x" + mdtTokenNum.toString(16).padStart(40, "0");
    console.log("MDT Token:", mdtTokenAddress);
    console.log("");

    // Deploy StakingVaultV2
    console.log("Deploying StakingVaultV2...");
    try {
        const StakingVaultV2 = await hre.ethers.getContractFactory("StakingVaultV2");
        const vault = await StakingVaultV2.deploy(mdtTokenAddress);
        await vault.waitForDeployment();
        const addr = await vault.getAddress();
        console.log("  ✓ StakingVaultV2:", addr);

        // Wait for mirror node sync
        await new Promise(r => setTimeout(r, 4000));
        try {
            const resp = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/contracts/${addr}`);
            const data = await resp.json();
            if (data.contract_id) {
                console.log(`  Hedera ID: ${data.contract_id}`);
                console.log(`  → CONTRACT_ID_STAKING_VAULT_V2='${data.contract_id}'`);
            }
        } catch (e) {
            console.log("  (Mirror node lookup pending)");
        }

        // Read initial state
        console.log("\n  Initial State:");
        const regFee = await vault.getCurrentRegFee();
        console.log(`    Registration Fee: ${hre.ethers.formatUnits(regFee, 8)} MDT`);
        const minMiner = await vault.minMinerStake();
        console.log(`    Min Miner Stake: ${hre.ethers.formatUnits(minMiner, 8)} MDT`);
        const minValidator = await vault.minValidatorStake();
        console.log(`    Min Validator Stake: ${hre.ethers.formatUnits(minValidator, 8)} MDT`);
        const minHolder = await vault.minHolderStake();
        console.log(`    Min Holder Stake: ${hre.ethers.formatUnits(minHolder, 8)} MDT`);

    } catch (e) {
        console.log("  ✗ Deploy failed:", e.message?.slice(0, 300));
    }

    console.log("\n✅ Done!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
