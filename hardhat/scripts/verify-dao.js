const { ethers } = require("hardhat");

async function main() {
  const qv = await ethers.getContractAt(
    "QuadraticVoting",
    "0x810DA31a1eFB767652b2f969972d2A612AfdEc5C"
  );
  const ronin = "0x098B716B8Aaf21512996dC57EB0615e2383E2f96";

  const count = await qv.proposalCount();
  console.log("proposalCount:", count.toString());

  // Check each proposal
  for (let i = 1; i <= Number(count); i++) {
    const p = await qv.getProposal(i);
    console.log(`\nProposal #${i}:`);
    console.log("  reporter:", p.reporter || p[0]);
    console.log("  suspiciousAddress:", p.suspiciousAddress || p[1]);
    console.log("  votesFor:", (p.votesFor || p[4]).toString());
    console.log("  votesAgainst:", (p.votesAgainst || p[5]).toString());
    console.log("  isActive:", p.isActive ?? p[6]);
  }

  // Check Ronin address scam status
  console.log("\n--- Ronin Exploiter Status ---");
  const isScam = await qv.isConfirmedScam(ronin);
  console.log("isConfirmedScam:", isScam);

  const score = await qv.getThreatScore(ronin);
  console.log("threatScore:", score.toString());

  const conf = await qv.getDAOConfidence(ronin);
  console.log("votesFor:", conf[0].toString());
  console.log("votesAgainst:", conf[1].toString());
  console.log("totalVoters:", conf[2].toString());
  console.log("confidencePct:", conf[3].toString());
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
