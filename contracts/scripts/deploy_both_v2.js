// Deploy updated StakingVaultV2 + SubnetRegistryV2 (both with getStakeAmount integration)
const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deployer:", deployer.address);

    const mdtTokenNum = 8198586;  // HTS 0.0.8198586 (real MDT on testnet)
    const mdtTokenAddress = "0x" + mdtTokenNum.toString(16).padStart(40, "0");
    const treasury = deployer.address;

    // 1. Deploy StakingVaultV2 (updated with getStakeAmount)
    console.log("\n1. Deploying StakingVaultV2...");
    const StakingVaultV2 = await hre.ethers.getContractFactory("StakingVaultV2");
    const vault = await StakingVaultV2.deploy(mdtTokenAddress);
    await vault.waitForDeployment();
    const vaultAddr = await vault.getAddress();
    console.log("   ✓ StakingVaultV2:", vaultAddr);

    await new Promise(r => setTimeout(r, 5000));
    let vaultId = "";
    try {
        const resp = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/contracts/${vaultAddr}`);
        const data = await resp.json();
        vaultId = data.contract_id || "";
        console.log(`   Hedera ID: ${vaultId}`);
    } catch (e) { }

    // 2. Deploy SubnetRegistryV2 with new vault
    console.log("\n2. Deploying SubnetRegistryV2...");
    const SubnetRegistryV2 = await hre.ethers.getContractFactory("SubnetRegistryV2");
    const registry = await SubnetRegistryV2.deploy(mdtTokenAddress, treasury, vaultAddr);
    await registry.waitForDeployment();
    const regAddr = await registry.getAddress();
    console.log("   ✓ SubnetRegistryV2:", regAddr);

    await new Promise(r => setTimeout(r, 5000));
    let regId = "";
    try {
        const resp = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/contracts/${regAddr}`);
        const data = await resp.json();
        regId = data.contract_id || "";
        console.log(`   Hedera ID: ${regId}`);
    } catch (e) { }

    // Verify
    console.log("\n3. Verification:");
    const pFee = await registry.PROTOCOL_FEE_RATE();
    console.log(`   Protocol Fee: ${pFee / 100n}%`);
    const vFee = await registry.VALIDATOR_REWARD_RATE();
    console.log(`   Validator Fee: ${vFee / 100n}%`);
    const sFee = await registry.STAKING_POOL_RATE();
    console.log(`   Staking Pool: ${sFee / 100n}%`);

    console.log("\n=== ENV UPDATES ===");
    console.log(`CONTRACT_ID_STAKING_VAULT_V2='${vaultId}'`);
    console.log(`CONTRACT_ID_SUBNET_REGISTRY_V2='${regId}'`);
    console.log("✅ Done!");
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
