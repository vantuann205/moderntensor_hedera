// Hardhat deploy script for ALL remaining contracts
// SubnetRegistry, StakingVault, MDTGovernor on Hedera Testnet

const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deployer:", deployer.address);

    // MDT Token: HTS 0.0.7852345 → EVM address
    const mdtTokenNum = 7852345;
    const mdtTokenAddress = "0x" + mdtTokenNum.toString(16).padStart(40, "0");
    console.log("MDT Token:", mdtTokenAddress);

    // Treasury = deployer address (operator)
    const treasuryAddress = deployer.address;
    console.log("Treasury:", treasuryAddress);
    console.log("");

    // ── 1. SubnetRegistry ──
    console.log("1/3 Deploying SubnetRegistry...");
    try {
        const SubnetRegistry = await hre.ethers.getContractFactory("SubnetRegistry");
        const registry = await SubnetRegistry.deploy(mdtTokenAddress, treasuryAddress);
        await registry.waitForDeployment();
        const regAddr = await registry.getAddress();
        console.log("  ✓ SubnetRegistry:", regAddr);
        await lookupContract(regAddr, "HEDERA_SUBNET_REGISTRY_CONTRACT_ID");
    } catch (e) {
        console.log("  ✗ SubnetRegistry failed:", e.message?.slice(0, 200));
    }

    // ── 2. StakingVault ──
    console.log("\n2/3 Deploying StakingVault...");
    try {
        const StakingVault = await hre.ethers.getContractFactory("StakingVault");
        const vault = await StakingVault.deploy(mdtTokenAddress);
        await vault.waitForDeployment();
        const vaultAddr = await vault.getAddress();
        console.log("  ✓ StakingVault:", vaultAddr);
        await lookupContract(vaultAddr, "HEDERA_STAKING_VAULT_CONTRACT_ID");
    } catch (e) {
        console.log("  ✗ StakingVault failed:", e.message?.slice(0, 200));
    }

    // ── 3. MDTGovernor ──
    console.log("\n3/3 Deploying MDTGovernor...");
    try {
        const MDTGovernor = await hre.ethers.getContractFactory("MDTGovernor");
        const gov = await MDTGovernor.deploy(mdtTokenAddress);
        await gov.waitForDeployment();
        const govAddr = await gov.getAddress();
        console.log("  ✓ MDTGovernor:", govAddr);
        await lookupContract(govAddr, "HEDERA_MDT_GOVERNOR_CONTRACT_ID");
    } catch (e) {
        console.log("  ✗ MDTGovernor failed:", e.message?.slice(0, 200));
    }

    console.log("\n✅ Done! Add the contract IDs above to your .env file.");
}

async function lookupContract(evmAddress, envName) {
    // Wait a moment for mirror node to sync
    await new Promise(r => setTimeout(r, 3000));
    try {
        const resp = await fetch(
            `https://testnet.mirrornode.hedera.com/api/v1/contracts/${evmAddress}`
        );
        const data = await resp.json();
        if (data.contract_id) {
            console.log(`  Hedera ID: ${data.contract_id}`);
            console.log(`  → ${envName}='${data.contract_id}'`);
        } else {
            console.log(`  (Mirror node not synced yet, check manually)`);
        }
    } catch (e) {
        console.log(`  (Mirror node lookup failed, check manually)`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
