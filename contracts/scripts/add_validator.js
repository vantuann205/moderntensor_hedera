const { ethers } = require("hardhat");

async function main() {
  const SUBNET_REGISTRY  = "0xbdbd7a138c7f815b1A7f432C1d06b2B95E46Ba1F";
  const STAKING_VAULT    = "0x99968cF6Aa38337a4dD3cBf40D13011293Cf718f";
  const VALIDATOR_EVM    = "0x8d67cb696ff8e91c64a240b152e965dd996984ea"; // 0.0.8230841
  const SUBNET_ID        = 0;

  const vault = await ethers.getContractAt("StakingVaultV2", STAKING_VAULT);
  const registry = await ethers.getContractAt("SubnetRegistryV2", SUBNET_REGISTRY);

  // Diagnose first
  const isVal = await vault.isValidator(VALIDATOR_EVM);
  const stakeInfo = await vault.getStakeInfo(VALIDATOR_EVM);
  console.log("isValidator:", isVal);
  console.log("stakeInfo:", {
    amount: stakeInfo.amount.toString(),
    amountMDT: Number(stakeInfo.amount) / 1e8,
    role: stakeInfo.role.toString(),
    isActive: stakeInfo.isActive,
  });

  if (!isVal) {
    console.log("❌ Validator not staked yet — cannot addValidator");
    return;
  }

  console.log("Calling addValidator(subnetId=" + SUBNET_ID + ", validator=" + VALIDATOR_EVM + ")...");
  const tx = await registry.addValidator(SUBNET_ID, VALIDATOR_EVM, { gasLimit: 300000 });
  console.log("TX hash:", tx.hash);
  await tx.wait();
  console.log("✓ Validator activated on subnet", SUBNET_ID);
}

main().catch(console.error);
