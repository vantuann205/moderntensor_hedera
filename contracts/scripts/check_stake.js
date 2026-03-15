const { ethers } = require("hardhat");

async function main() {
  const VAULT = "0x99968cF6Aa38337a4dD3cBf40D13011293Cf718f";
  const USER  = "0xbaf78ade892453743d2b8ebb143fd6b236b855a9";

  const vault = await ethers.getContractAt("StakingVaultV2", VAULT);
  const info = await vault.getStakeInfo(USER);

  const roles = { 0: 'None', 1: 'Miner', 2: 'Validator', 3: 'Holder' };
  console.log("amount   :", Number(info.amount) / 1e8, "MDT");
  console.log("role     :", roles[Number(info.role)] || info.role.toString());
  console.log("isActive :", info.isActive);
  console.log("stakedAt :", new Date(Number(info.stakedAt) * 1000).toISOString());
  console.log("isValidator:", await vault.isValidator(USER));
  console.log("isMiner    :", await vault.isMiner(USER));
}

main().catch(console.error);
