import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";

dotenv.config();

// Helper to format private key correctly - adds 0x prefix if needed
function formatPrivateKey(key: string | undefined): string {
  if (!key)
    return "0x0000000000000000000000000000000000000000000000000000000000000000";
  return key.startsWith("0x") ? key : `0x${key}`;
}

// Get private key from .env file or use a default one for testing (never use this in production!)
const PRIVATE_KEY = formatPrivateKey(process.env.PRIVATE_KEY);
// API keys for blockchain explorers
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY || "";
const MONADSCAN_API_KEY = process.env.MONADSCAN_API_KEY || "";

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  defaultNetwork: "sepolia",
  networks: {
    sepolia: {
      url: "https://ethereum-sepolia-rpc.publicnode.com",
      accounts: [PRIVATE_KEY],
      chainId: 11155111,
      timeout: 120000, // 2 minute timeout
    },
    monad_testnet: {
      url: "https://testnet-rpc.monad.xyz", // Legacy Monad testnet RPC
      accounts: [PRIVATE_KEY],
      chainId: 10143,
      timeout: 120000,
    },
  },
  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "sepolia",
        chainId: 11155111,
        urls: {
          apiURL: "https://api-sepolia.etherscan.io/api",
          browserURL: "https://sepolia.etherscan.io",
        },
      },
    ],
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
