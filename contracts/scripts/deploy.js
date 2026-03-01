// Hardhat deploy script for PaymentEscrow on Hedera Testnet
// Uses JSON-RPC relay (Hashio) for standard EVM deployment

const hre = require("hardhat");

async function main() {
    // MDT Token address — HTS token 0.0.7852345 in EVM format
    // Hedera HTS tokens have EVM address = 0x + token shard.realm.num encoded
    const mdtTokenNum = 7852345;
    const mdtTokenAddress = "0x" + mdtTokenNum.toString(16).padStart(40, "0");

    console.log("Deploying PaymentEscrow...");
    console.log("  MDT Token:", mdtTokenAddress);
    console.log("  Network:", hre.network.name);

    const PaymentEscrow = await hre.ethers.getContractFactory("PaymentEscrow");
    const escrow = await PaymentEscrow.deploy(mdtTokenAddress);
    await escrow.waitForDeployment();

    const address = await escrow.getAddress();
    console.log("  PaymentEscrow deployed to:", address);
    console.log("");
    console.log("  === SAVE THIS ===");
    console.log(`  Contract EVM address: ${address}`);

    // Convert EVM address to Hedera contract ID via mirror node
    try {
        const resp = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/contracts/${address}`);
        const data = await resp.json();
        console.log(`  Contract Hedera ID: ${data.contract_id}`);
        console.log(`  Add to .env: HEDERA_PAYMENT_ESCROW_CONTRACT_ID='${data.contract_id}'`);
    } catch (e) {
        console.log("  (Mirror node lookup will be available in a few seconds)");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
