/**
 * Set the voting period on the QuadraticVoting contract.
 * Usage: npx hardhat run scripts/set-voting-period.js --network sepolia
 */
const { ethers } = require("hardhat");

const QUADRATIC_VOTING_ADDRESS = "0x810DA31a1eFB767652b2f969972d2A612AfdEc5C";
const NEW_PERIOD_SECONDS = 60; // 1 minute

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const voting = await ethers.getContractAt("QuadraticVoting", QUADRATIC_VOTING_ADDRESS);

  const current = await voting.votingPeriod();
  console.log("Current voting period:", Number(current), "seconds");

  if (Number(current) === NEW_PERIOD_SECONDS) {
    console.log("Already set to", NEW_PERIOD_SECONDS, "seconds. Done.");
    return;
  }

  console.log("Setting voting period to", NEW_PERIOD_SECONDS, "seconds...");
  const tx = await voting.setVotingPeriod(NEW_PERIOD_SECONDS);
  await tx.wait();
  console.log("Done! Voting period is now", NEW_PERIOD_SECONDS, "seconds.");
}

main().catch(console.error);
