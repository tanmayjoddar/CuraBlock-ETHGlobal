const { ethers } = require("hardhat");

async function main() {
  const qv = await ethers.getContractAt("QuadraticVoting", "0x810DA31a1eFB767652b2f969972d2A612AfdEc5C");
  const count = Number(await qv.proposalCount());
  const period = Number(await qv.votingPeriod());
  console.log("Total proposals:", count, "| Voting period:", period, "seconds");

  const now = Math.floor(Date.now() / 1000);
  for (let i = 1; i <= count; i++) {
    const f = await qv.proposals(i);
    const end = Number(f.endTime);
    console.log(`P${i}: active=${f.isActive} executed=${f.executed} remaining=${end - now}s addr=${f.suspiciousAddress.slice(0, 10)}`);
  }

  const user = "0x691a2035A26673273176C7ef0e4652d90d217ac5";
  const sh = await ethers.getContractAt("ShieldToken", await qv.shieldToken());
  console.log("User SHIELD:", ethers.formatEther(await sh.balanceOf(user)));
  console.log("User allowance:", ethers.formatEther(await sh.allowance(user, "0x810DA31a1eFB767652b2f969972d2A612AfdEc5C")));

  for (let i = 1; i <= count; i++) {
    const v = await qv.getVote(i, user);
    if (v.hasVoted) console.log(`User voted on P${i}: support=${v.support} tokens=${ethers.formatEther(v.tokens)}`);
  }
}

main().then(() => process.exit(0)).catch(console.error);
