const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Address:", deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  const code = await ethers.provider.getCode(
    "0x810DA31a1eFB767652b2f969972d2A612AfdEc5C",
  );
  console.log("QuadraticVoting bytecode length:", code.length);
  console.log("Status:", code === "0x" ? "NOT DEPLOYED" : "DEPLOYED");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
