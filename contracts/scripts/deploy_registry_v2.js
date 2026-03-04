// Deploy SubnetRegistryV2 integrated with StakingVaultV2
const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deployer:", deployer.address);
    console.log("");

    // Existing deployed addresses
    const mdtTokenNum = 7852345;
    const mdtTokenAddress = "0x" + mdtTokenNum.toString(16).padStart(40, "0");

    // StakingVaultV2 EVM address from previous deployment
    const stakingVaultV2Address = "0xDA54C0191123f489978c8a14af74FB4D3F1258A1";

    const treasury = deployer.address; // Owner = treasury for testnet

    console.log("MDT Token:", mdtTokenAddress);
    console.log("StakingVaultV2:", stakingVaultV2Address);
    console.log("Treasury:", treasury);
    console.log("");

    // Deploy SubnetRegistryV2
    console.log("Deploying SubnetRegistryV2...");
    try {
        const SubnetRegistryV2 = await hre.ethers.getContractFactory("SubnetRegistryV2");
        const registry = await SubnetRegistryV2.deploy(mdtTokenAddress, treasury, stakingVaultV2Address);
        await registry.waitForDeployment();
        const addr = await registry.getAddress();
        console.log("  ✓ SubnetRegistryV2:", addr);

        // Wait for mirror node
        await new Promise(r => setTimeout(r, 5000));
        try {
            const resp = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/contracts/${addr}`);
            const data = await resp.json();
            if (data.contract_id) {
                console.log(`  Hedera ID: ${data.contract_id}`);
                console.log(`  → CONTRACT_ID_SUBNET_REGISTRY_V2='${data.contract_id}'`);
            }
        } catch (e) {
            console.log("  (Mirror node lookup pending, try manually later)");
        }

        // Verify integration
        console.log("\n  Verification:");
        const pFee = await registry.PROTOCOL_FEE_RATE();
        console.log(`    Protocol Fee: ${pFee / 100n}%`);
        const vFee = await registry.VALIDATOR_REWARD_RATE();
        console.log(`    Validator Fee: ${vFee / 100n}%`);
        const sFee = await registry.STAKING_POOL_RATE();
        console.log(`    Staking Pool: ${sFee / 100n}%`);
        console.log(`    Miner gets: ~85% (remainder)`);

    } catch (e) {
        console.log("  ✗ Deploy failed:", e.message?.slice(0, 500));
    }

    console.log("\n✅ Done!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
