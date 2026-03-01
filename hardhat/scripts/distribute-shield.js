/**
 * Distribute SHIELD tokens from deployer to specified addresses.
 * Usage: npx hardhat run scripts/distribute-shield.js --network sepolia
 *
 * Sends 1000 SHIELD to each address listed below.
 * The deployer (owner of ShieldToken) holds the initial 1M supply.
 */
const { ethers } = require("hardhat");

// Addresses to receive SHIELD tokens — add yours here
const RECIPIENTS = [
  "0x691a2035A26673273176C7ef0e4652d90d217ac5", // user wallet
];

const AMOUNT_PER_USER = "1000"; // 1000 SHIELD each

// ShieldToken address on Sepolia (from addresses.json)
const SHIELD_TOKEN_ADDRESS = "0x4866507F82F870beD552884F700C54D8A6Dcb061";

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const shield = new ethers.Contract(SHIELD_TOKEN_ADDRESS, ERC20_ABI, deployer);

  const symbol = await shield.symbol();
  const decimals = await shield.decimals();
  const deployerBalance = await shield.balanceOf(deployer.address);
  console.log(
    `Deployer ${symbol} balance: ${ethers.formatUnits(
      deployerBalance,
      decimals,
    )}`,
  );

  const amountWei = ethers.parseUnits(AMOUNT_PER_USER, decimals);

  for (const recipient of RECIPIENTS) {
    const before = await shield.balanceOf(recipient);
    console.log(
      `\n${recipient} current balance: ${ethers.formatUnits(
        before,
        decimals,
      )} ${symbol}`,
    );

    console.log(`Sending ${AMOUNT_PER_USER} ${symbol}...`);
    const tx = await shield.transfer(recipient, amountWei);
    console.log(`  tx: ${tx.hash}`);
    await tx.wait();

    const after = await shield.balanceOf(recipient);
    console.log(
      `  New balance: ${ethers.formatUnits(after, decimals)} ${symbol}`,
    );
  }

  const deployerAfter = await shield.balanceOf(deployer.address);
  console.log(
    `\nDeployer remaining: ${ethers.formatUnits(
      deployerAfter,
      decimals,
    )} ${symbol}`,
  );
  console.log("Done!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
