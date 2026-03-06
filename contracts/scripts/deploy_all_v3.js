// Deploy ALL 4 security-fixed contracts to Hedera Testnet
// Order: StakingVault → SubnetRegistry → setStakingVault → PaymentEscrow → MDTGovernor
//
// For ModernTensor — Hello Future Apex Hackathon 2026

const hre = require("hardhat");

const MDT_TOKEN_NUM = 7852345; // HTS 0.0.7852345

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("=== ModernTensor Contract Deployment (Security-Fixed V3) ===");
    console.log("Deployer:", deployer.address);
    console.log("Network:", hre.network.name);
    console.log("");

    const mdtTokenAddress = "0x" + MDT_TOKEN_NUM.toString(16).padStart(40, "0");
    const treasury = deployer.address;
    console.log("MDT Token:", mdtTokenAddress);
    console.log("Treasury:", treasury);
    console.log("");

    const results = {};

    // ── 1. StakingVault (must be first — SubnetRegistry depends on it) ──
    console.log("1/4 Deploying StakingVault...");
    const StakingVault = await hre.ethers.getContractFactory("StakingVault");
    const vault = await StakingVault.deploy(mdtTokenAddress);
    await vault.waitForDeployment();
    const vaultAddr = await vault.getAddress();
    console.log("  ✓ StakingVault:", vaultAddr);
    results.vault = { addr: vaultAddr, contract: vault };
    const vaultId = await lookupContract(vaultAddr);
    results.vault.id = vaultId;

    // ── 2. SubnetRegistry ──
    console.log("\n2/4 Deploying SubnetRegistry...");
    const SubnetRegistry = await hre.ethers.getContractFactory("SubnetRegistry");
    const registry = await SubnetRegistry.deploy(mdtTokenAddress, treasury);
    await registry.waitForDeployment();
    const regAddr = await registry.getAddress();
    console.log("  ✓ SubnetRegistry:", regAddr);
    results.registry = { addr: regAddr, contract: registry };
    const regId = await lookupContract(regAddr);
    results.registry.id = regId;

    // ── 2b. Link SubnetRegistry → StakingVault ──
    console.log("\n  Linking SubnetRegistry → StakingVault...");
    const linkTx = await registry.setStakingVault(vaultAddr);
    const linkReceipt = await linkTx.wait();
    console.log("  ✓ setStakingVault TX:", linkReceipt.hash);
    results.linkTx = linkReceipt.hash;

    // ── 3. PaymentEscrow ──
    console.log("\n3/4 Deploying PaymentEscrow...");
    const PaymentEscrow = await hre.ethers.getContractFactory("PaymentEscrow");
    const escrow = await PaymentEscrow.deploy(mdtTokenAddress);
    await escrow.waitForDeployment();
    const escrowAddr = await escrow.getAddress();
    console.log("  ✓ PaymentEscrow:", escrowAddr);
    results.escrow = { addr: escrowAddr };
    const escrowId = await lookupContract(escrowAddr);
    results.escrow.id = escrowId;

    // ── 4. MDTGovernor ──
    console.log("\n4/4 Deploying MDTGovernor...");
    const MDTGovernor = await hre.ethers.getContractFactory("MDTGovernor");
    const gov = await MDTGovernor.deploy(mdtTokenAddress);
    await gov.waitForDeployment();
    const govAddr = await gov.getAddress();
    console.log("  ✓ MDTGovernor:", govAddr);
    results.governor = { addr: govAddr };
    const govId = await lookupContract(govAddr);
    results.governor.id = govId;

    // ── Summary ──
    console.log("\n" + "=".repeat(60));
    console.log("DEPLOYMENT COMPLETE — Add to .env:");
    console.log("=".repeat(60));
    console.log(`HEDERA_STAKING_VAULT_CONTRACT_ID='${results.vault.id}'`);
    console.log(`HEDERA_SUBNET_REGISTRY_CONTRACT_ID='${results.registry.id}'`);
    console.log(`HEDERA_PAYMENT_ESCROW_CONTRACT_ID='${results.escrow.id}'`);
    console.log(`HEDERA_MDT_GOVERNOR_CONTRACT_ID='${results.governor.id}'`);
    console.log("");
    console.log("EVM Addresses:");
    console.log(`  StakingVault:    ${results.vault.addr}`);
    console.log(`  SubnetRegistry:  ${results.registry.addr}`);
    console.log(`  PaymentEscrow:   ${results.escrow.addr}`);
    console.log(`  MDTGovernor:     ${results.governor.addr}`);
    console.log("");
    console.log(`setStakingVault TX: ${results.linkTx}`);
    console.log("=".repeat(60));
}

async function lookupContract(evmAddress) {
    await new Promise(r => setTimeout(r, 5000));
    try {
        const resp = await fetch(
            `https://testnet.mirrornode.hedera.com/api/v1/contracts/${evmAddress}`
        );
        const data = await resp.json();
        if (data.contract_id) {
            console.log(`  Hedera ID: ${data.contract_id}`);
            return data.contract_id;
        }
    } catch (e) { }
    console.log("  (Mirror node not synced yet)");
    return "PENDING";
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("DEPLOY FAILED:", error);
        process.exit(1);
    });
