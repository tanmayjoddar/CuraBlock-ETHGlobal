// Smart Contract Interaction Module for UnhackableWallet
// Handles all interactions with deployed smart contracts

interface ProposalExecutedEventArgs extends Result {
  proposalId: bigint;
  passed: boolean;
}

interface VoteCastEventArgs extends Result {
  proposalId: bigint;
  voter: string;
  support: boolean;
  tokens: bigint;
  power: bigint;
}

// Imports
import { Contract, formatUnits, parseUnits, ethers } from "ethers";
import walletConnector from "./wallet";
import { patchProviderForMonad } from "./wallet";
import { shortenAddress, isValidAddress } from "./utils";
import EventEmitter from "events";
import type { Result } from "ethers";
import addresses from "./addresses.json";

/**
 * Safely get gas overrides for transactions.
 * Some MetaMask versions don't support eth_maxPriorityFeePerGas, so we
 * try EIP-1559 first and fall back to legacy gasPrice.
 */
async function safeGasOverrides(
  provider: ethers.BrowserProvider | null | undefined,
  gasLimit: bigint = 200000n,
): Promise<Record<string, unknown>> {
  if (!provider) return { gasLimit };
  try {
    const feeData = await provider.getFeeData();
    if (feeData.maxFeePerGas) {
      return {
        gasLimit,
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? 1_500_000_000n,
      };
    }
    if (feeData.gasPrice) {
      return { gasLimit, gasPrice: feeData.gasPrice };
    }
  } catch {
    // eth_maxPriorityFeePerGas not supported — fall back to legacy
    try {
      const block = await provider.getBlock("latest");
      const gasPrice = block?.baseFeePerGas
        ? block.baseFeePerGas * 2n
        : 2_000_000_000n;
      return { gasLimit, gasPrice };
    } catch {
      // absolute fallback
    }
  }
  return { gasLimit, gasPrice: 2_000_000_000n };
}

// ABI for the QuadraticVoting contract
const QUADRATIC_VOTING_ABI = [
  // View functions
  "function owner() view returns (address)",
  "function shieldToken() view returns (address)",
  "function getProposal(uint256 proposalId) view returns (address reporter, address suspiciousAddress, string description, string evidence, uint256 votesFor, uint256 votesAgainst, bool isActive)",
  "function getVote(uint256 proposalId, address voter) view returns (tuple(bool hasVoted, bool support, uint256 tokens, uint256 power))",
  "function isScammer(address) view returns (bool)",
  "function scamScore(address) view returns (uint256)",
  "function proposalCount() view returns (uint256)",

  // State-changing functions
  "function submitProposal(address _suspiciousAddress, string memory _description, string memory _evidence) returns (uint256)",
  "function castVote(uint256 _proposalId, bool _support, uint256 _tokens) returns (uint256)",
  "function executeProposal(uint256 _proposalId) returns (bool)",

  // Events
  "event ProposalCreated(uint256 indexed proposalId, address indexed reporter, address indexed suspiciousAddress, string description, string evidence)",
  "event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 tokens, uint256 power)",
  "event ProposalExecuted(uint256 indexed proposalId, bool passed)",
];

// ABI for the SHIELD token contract
const SHIELD_TOKEN_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function mint(address to, uint256 amount)",
  "function owner() view returns (address)",
];

// The ONLY supported network for CuraBlock contracts is Sepolia.
// All chain IDs resolve to the same Sepolia contract address so that
// even if MetaMask is briefly on another chain, init() will switch first.
const SEPOLIA_QV_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS_SEPOLIA ||
  (addresses as any).quadraticVoting ||
  "0x810DA31a1eFB767652b2f969972d2A612AfdEc5C";

const CONTRACT_ADDRESSES: { [chainId: string]: string } = {
  "1": "0x0000000000000000000000000000000000000000",
  "5": "0x0000000000000000000000000000000000000000",
  "11155111": SEPOLIA_QV_ADDRESS,
  // Legacy Monad chain IDs — redirect to Sepolia address so reads/writes
  // never accidentally hit the old Monad contract.
  "10143": SEPOLIA_QV_ADDRESS,
  "143": SEPOLIA_QV_ADDRESS,
};

/**
 * Smart contract interaction class for UnhackableWallet
 */
class ContractService extends EventEmitter {
  private contractInstance: Contract | null = null;

  private QUADRATIC_VOTING_ADDRESS =
    (addresses as any).quadraticVoting ||
    import.meta.env.VITE_CONTRACT_ADDRESS_SEPOLIA ||
    "0x0000000000000000000000000000000000000000"; // loaded from addresses.json
  private SHIELD_TOKEN_ADDRESS =
    (addresses as any).shieldToken ||
    import.meta.env.VITE_SHIELD_TOKEN_ADDRESS ||
    "0x0000000000000000000000000000000000000000";

  private votingContract: ethers.Contract | null = null;
  private shieldToken: ethers.Contract | null = null;

  /** Public getter so UI components can display the contract address */
  getContractAddress(): string {
    return this.QUADRATIC_VOTING_ADDRESS;
  }

  private async getSignerContract() {
    if (!this.votingContract) {
      await this.init();
    }
    return {
      voting: this.votingContract,
      shield: this.shieldToken,
    };
  }

  // Forward contract events to EventEmitter.
  // NOTE: ethers.js contract.on() uses polling eth_getLogs under the hood
  // which can hammer RPC rate limits. Disabled to avoid 429 floods.
  // Events are refreshed via manual fetchData() in components instead.
  private setupEventForwarding() {
    // Intentionally disabled — rate-limit protection.
    // Components call fetchData() on user actions instead.
  }

  /**
   * Query events with automatic block-range chunking.
   * Keeps block-range chunking for RPC resilience.
   */
  private async queryFilterChunked(
    filter: any,
    maxBlocks = 500,
  ): Promise<ethers.EventLog[]> {
    if (!this.votingContract || !walletConnector.provider) return [];

    const CHUNK = 999; // Sepolia supports larger block ranges
    const DELAY_MS = 120; // throttle between chunks
    const MAX_RETRIES = 2;
    const latestBlock = await walletConnector.provider.getBlockNumber();
    const startBlock = Math.max(0, latestBlock - maxBlocks);
    const allEvents: ethers.EventLog[] = [];

    for (let from = startBlock; from <= latestBlock; from += CHUNK + 1) {
      const to = Math.min(from + CHUNK, latestBlock);
      let retries = 0;
      while (retries <= MAX_RETRIES) {
        try {
          const events = await this.votingContract.queryFilter(
            filter,
            from,
            to,
          );
          allEvents.push(...(events as ethers.EventLog[]));
          break; // success
        } catch (err: any) {
          const is429 =
            err?.message?.includes("429") ||
            err?.message?.includes("limited to 25");
          if (is429 && retries < MAX_RETRIES) {
            retries++;
            await new Promise((r) => setTimeout(r, DELAY_MS * retries * 2));
          } else {
            console.warn(`[DAO] queryFilter chunk ${from}-${to} failed:`, err);
            break; // skip chunk
          }
        }
      }
      // Throttle between chunks to stay under rate limit
      if (from + CHUNK + 1 <= latestBlock) {
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }
    }
    return allEvents;
  }

  private async init() {
    try {
      // Try to recover wallet connection if provider/signer are missing
      if (!walletConnector.provider || !walletConnector.signer) {
        if (typeof window !== "undefined" && window.ethereum) {
          const accounts = await window.ethereum.request({
            method: "eth_accounts",
          });
          if (accounts && accounts.length > 0) {
            const { BrowserProvider } = await import("ethers");
            walletConnector.provider = patchProviderForMonad(
              new BrowserProvider(window.ethereum),
            );
            walletConnector.signer = await walletConnector.provider.getSigner();
            walletConnector.address = accounts[0];
            const network = await walletConnector.provider.getNetwork();
            walletConnector.chainId = Number(network.chainId);
            console.log(
              "init: Wallet auto-reconnected:",
              walletConnector.address,
            );
          } else {
            throw new Error("Wallet not connected");
          }
        } else {
          throw new Error("Wallet not connected");
        }
      }

      // ── Force switch to Sepolia (11155111) before any contract init ──
      let network = await walletConnector.provider.getNetwork();
      let chainId = network.chainId.toString();
      console.log("Current network:", { chainId, name: network.name });

      if (
        chainId !== "11155111" &&
        typeof window !== "undefined" &&
        window.ethereum
      ) {
        console.warn(
          `[Contract] Wrong chain ${chainId}, switching to Sepolia...`,
        );
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0xaa36a7" }], // 11155111
          });
        } catch (switchErr: any) {
          if (switchErr.code === 4902) {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: "0xaa36a7",
                  chainName: "Sepolia Testnet",
                  nativeCurrency: {
                    name: "Sepolia ETH",
                    symbol: "ETH",
                    decimals: 18,
                  },
                  rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
                  blockExplorerUrls: ["https://sepolia.etherscan.io"],
                },
              ],
            });
          } else {
            throw new Error(
              "Please switch to Sepolia Testnet to use CuraBlock",
            );
          }
        }
        // Re-create provider/signer after chain switch
        const { BrowserProvider } = await import("ethers");
        walletConnector.provider = patchProviderForMonad(
          new BrowserProvider(window.ethereum),
        );
        walletConnector.signer = await walletConnector.provider.getSigner();
        network = await walletConnector.provider.getNetwork();
        chainId = network.chainId.toString();
        walletConnector.chainId = Number(chainId);
        console.log("[Contract] Switched to Sepolia, chainId:", chainId);
      }

      // Always use the Sepolia contract address
      const contractAddress = SEPOLIA_QV_ADDRESS;
      console.log("Contract address:", contractAddress);

      // Set the contract addresses
      this.QUADRATIC_VOTING_ADDRESS = contractAddress;

      // Initialize the voting contract
      this.votingContract = new ethers.Contract(
        this.QUADRATIC_VOTING_ADDRESS,
        QUADRATIC_VOTING_ABI,
        walletConnector.signer,
      );

      // Verify contract is accessible
      try {
        const owner = await this.votingContract.owner();
        console.log("Contract verified, owner:", owner);
      } catch (error: any) {
        // If owner() returns 0x → contract not deployed at this address
        if (
          error?.code === "BAD_DATA" ||
          error?.message?.includes("could not decode")
        ) {
          console.warn(
            "Contract not deployed or ABI mismatch at",
            contractAddress,
            "— read-only mode. Reports/votes will fail.",
          );
        } else {
          console.warn("Could not verify contract owner (non-fatal):", error);
        }
        // Don't throw — contract may still work for read/write operations
      }

      // Initialize SHIELD token contract from on-chain address
      try {
        const shieldTokenAddress = await this.votingContract.shieldToken();
        if (shieldTokenAddress && shieldTokenAddress !== ethers.ZeroAddress) {
          this.SHIELD_TOKEN_ADDRESS = shieldTokenAddress;
          this.shieldToken = new ethers.Contract(
            shieldTokenAddress,
            SHIELD_TOKEN_ABI,
            walletConnector.signer,
          );
          console.log("SHIELD token initialized at:", shieldTokenAddress);
        } else {
          console.warn(
            "SHIELD token address is zero — token features disabled",
          );
        }
      } catch (error: any) {
        if (
          error?.code === "BAD_DATA" ||
          error?.message?.includes("could not decode")
        ) {
          console.warn(
            "[Contract] shieldToken() returned 0x — contract not deployed. SHIELD token disabled.",
          );
        } else {
          console.warn("Could not initialize SHIELD token (non-fatal):", error);
        }
      }

      // Set up event forwarding
      this.setupEventForwarding();

      console.log("Contract initialization complete:", {
        votingAddress: this.QUADRATIC_VOTING_ADDRESS,
        shieldTokenAddress: this.SHIELD_TOKEN_ADDRESS,
        chainId,
        initialized: true,
      });
    } catch (error) {
      console.error("Initialization error:", error);
      throw error;
    }
  }

  /**
   * Initialize the contract instance
   * @returns {Promise<Contract>} The contract instance
   */ async initContract(): Promise<Contract> {
    console.log("Initializing contract...");

    if (
      !walletConnector.provider ||
      !walletConnector.signer ||
      !walletConnector.chainId
    ) {
      throw new Error(
        "Wallet not connected. Please connect your wallet first.",
      );
    }

    const chainId = walletConnector.chainId.toString();
    console.log("Current chain ID:", chainId);

    // Get contract address for the current network
    const contractAddress = CONTRACT_ADDRESSES[chainId];
    console.log("Contract address from mapping:", contractAddress);

    // Validate contract address
    if (
      !contractAddress ||
      contractAddress === "0x0000000000000000000000000000000000000000"
    ) {
      throw new Error(
        `Contract not deployed on network ${walletConnector.networkName || chainId}. Please switch to Monad network.`,
      );
    }

    try {
      console.log("Creating contract instance with address:", contractAddress);
      this.contractInstance = new Contract(
        contractAddress,
        QUADRATIC_VOTING_ABI, // Use the QuadraticVoting ABI instead of UnhackableWallet
        walletConnector.signer,
      );

      // Verify the contract exists on the network by calling a view function
      await this.contractInstance.proposalCount();

      return this.contractInstance;
    } catch (error: any) {
      console.error("Failed to initialize contract:", error);
      if (error.message.includes("call revert exception")) {
        throw new Error(
          `Contract at ${contractAddress} doesn't match the expected ABI. Please check deployment.`,
        );
      }
      throw new Error(`Failed to connect to the contract: ${error.message}`);
    }
  }

  /**
   * Get the contract instance, initializing if necessary
   * @returns {Promise<Contract>} The contract instance
   */
  async getContract(): Promise<Contract> {
    if (!this.contractInstance) {
      return this.initContract();
    }
    return this.contractInstance;
  }

  /**
   * Verify that the contract on the connected network matches our ABI
   * @returns {Promise<boolean>} True if contract is valid
   */
  async verifyContract(): Promise<boolean> {
    try {
      const contract = await this.getContract();

      // Try to call a view function to verify the contract
      await contract.proposalCount();

      // If we got here, the contract is valid
      return true;
    } catch (error) {
      console.error("Contract verification failed:", error);
      return false;
    }
  }

  /**
   * Vote on a scam report (DAO functionality)
   * @param {string} proposalId - The ID of the report to vote on
   * @param {boolean} inSupport - Whether the user believes the report is valid
   * @returns {Promise<any>} Transaction result
   */
  async voteOnScamReport(
    proposalId: string,
    inSupport: boolean,
    tokens: string = "1000000000000000000", // Default: 1 SHIELD token (in wei)
  ): Promise<any> {
    try {
      // Check wallet connection
      if (!walletConnector.address) {
        throw new Error("Wallet not connected");
      }

      // Use the quadratic voting castVote which requires token staking
      console.log(
        `Casting quadratic vote on proposal ${proposalId}, support: ${inSupport}, tokens: ${tokens}`,
      );

      // Ensure SHIELD token approval first
      const needsApproval = await this.needsShieldApproval(tokens);
      if (needsApproval) {
        console.log("Approving SHIELD tokens for voting contract...");
        const approveTx = await this.approveShield(tokens);
        await approveTx.wait(1);
        console.log("SHIELD tokens approved");
      }

      const tx = await this.castQuadraticVote(proposalId, inSupport, tokens);
      return tx;
    } catch (error: any) {
      console.error("Vote error:", error);
      throw new Error(`Failed to vote on report: ${error.message}`);
    }
  }

  /**
   * Check if an address is marked as a scam
   * @param {string} address - The address to check
   * @returns {Promise<boolean>} True if address is confirmed scammer
   */
  async checkScamAddress(address: string): Promise<boolean> {
    try {
      if (!address || !isValidAddress(address)) {
        return false;
      }

      const contract = await this.getContract();
      const isConfirmedScammer = await contract.isScammer(address);

      return isConfirmedScammer;
    } catch (error: any) {
      console.error("Error checking scam address:", error);
      // Return false on error to avoid blocking legitimate transactions
      return false;
    }
  }

  /**
   * Check if user has enough balance for transaction including gas buffer
   * @param {string} amountEth - Amount in ETH to send
   * @returns {Promise<boolean>} True if sufficient balance
   */
  async hasEnoughBalance(amountEth: string): Promise<boolean> {
    try {
      if (!walletConnector.address) {
        return false;
      }

      const balance = await walletConnector.getBalance();
      const balanceNum = parseFloat(balance);
      const amountNum = parseFloat(amountEth);

      // Add 10% buffer for gas fees
      const requiredAmount = amountNum * 1.1;

      return balanceNum >= requiredAmount;
    } catch (error: any) {
      console.error("Error checking balance:", error);
      return false;
    }
  }

  /**
   * Get all legacy scam reports
   * @returns {Promise<any[]>} List of scam reports
   */
  async getLegacyScamReports(): Promise<any[]> {
    // Legacy method — redirects to QuadraticVoting-based reports
    // The old UnhackableWallet getReportCount/getReport functions are not in QuadraticVoting
    try {
      return await this.getScamReports();
    } catch (error: any) {
      console.error("Get reports error:", error);
      return [];
    }
  }

  /**
   * Get scam reports filed by the connected address
   * @returns {Promise<any[]>} List of user's scam reports
   */
  async getUserReports(): Promise<any[]> {
    try {
      if (!walletConnector.address) return [];

      const reports = await this.getScamReports();
      return reports.filter(
        (report) =>
          report.reporter.toLowerCase() ===
          walletConnector.address?.toLowerCase(),
      );
    } catch (error) {
      console.error("Get user reports error:", error);
      return [];
    }
  }

  /**
   * Transfer funds using the secure transfer function of the wallet
   * @param {string} to - Recipient address
   * @param {string} amount - Amount in ETH
   * @returns {Promise<any>} Transaction result
   */
  async secureSendETH(to: string, amount: string): Promise<any> {
    try {
      // Check wallet connection
      if (!walletConnector.address) {
        throw new Error("Wallet not connected");
      }

      // Check if user has enough balance
      const hasBalance = await this.hasEnoughBalance(amount);
      if (!hasBalance) {
        throw new Error(
          "Insufficient balance for this transaction (including gas fees)",
        );
      }

      const contract = await this.getContract();

      // Convert ETH amount to Wei
      const amountWei = parseUnits(amount, 18);
      console.log(`Sending ${amount} ETH to ${shortenAddress(to)}`);

      // Use direct signer transfer (QuadraticVoting contract doesn't have secureTransfer)
      // First check if recipient is a known scammer
      let isSafe = true;
      try {
        isSafe = !(await this.isScamAddress(to));
      } catch (_) {
        /* continue even if check fails */
      }

      if (!isSafe) {
        console.warn(
          `⚠️ WARNING: Recipient ${shortenAddress(to)} is a DAO-confirmed scammer!`,
        );
      }

      const overrides = await safeGasOverrides(walletConnector.provider, 21000n);
      const tx = await walletConnector.signer!.sendTransaction({
        to,
        value: amountWei,
        ...overrides,
      });

      return tx;
    } catch (error: any) {
      console.error("Secure send error:", error);
      // Check if user rejected the transaction
      if (error.code === 4001 || error.message?.includes("user rejected")) {
        throw new Error("Transaction cancelled by user");
      }
      throw new Error(`Failed to send transaction: ${error.message}`);
    }
  }

  // Shield Token Functions
  public async getShieldBalance(address: string): Promise<string> {
    if (!this.votingContract) await this.init();
    if (!this.shieldToken) {
      console.warn("SHIELD token not initialized — returning 0");
      return "0";
    }
    try {
      const balance = await this.shieldToken.balanceOf(address);
      return formatUnits(balance, 18);
    } catch (error) {
      console.warn("Failed to get SHIELD balance:", error);
      return "0";
    }
  }

  public async needsShieldApproval(amount: string): Promise<boolean> {
    if (!this.votingContract) await this.init();
    if (!this.shieldToken || !walletConnector.address) return true;

    const allowance = await this.shieldToken?.allowance(
      walletConnector.address,
      this.QUADRATIC_VOTING_ADDRESS,
    );

    return ethers.getBigInt(allowance || 0) < ethers.getBigInt(amount);
  }

  public async approveShield(
    amount: string,
  ): Promise<ethers.ContractTransactionResponse> {
    const { shield } = await this.getSignerContract();
    if (!shield) {
      throw new Error("SHIELD token not available on this network");
    }
    const overrides = await safeGasOverrides(walletConnector.provider, 100000n);
    return shield.approve(this.QUADRATIC_VOTING_ADDRESS, amount, overrides);
  }

  /**
   * Claim SHIELD tokens for voting.
   * - If connected wallet IS the deployer/owner → calls mint() to create new tokens
   * - Otherwise → the deployer must transfer tokens (use distribute-shield.js script)
   *
   * @param amount Human-readable amount (e.g. "100")
   * @returns Transaction response
   */
  public async claimShieldTokens(
    amount: string = "100",
  ): Promise<ethers.ContractTransactionResponse> {
    const { shield } = await this.getSignerContract();
    if (!shield) {
      throw new Error("SHIELD token not available on this network");
    }
    const amountWei = ethers.parseEther(amount);

    // Check if connected wallet is the SHIELD token owner
    try {
      const owner = await shield.owner();
      if (owner.toLowerCase() === walletConnector.address?.toLowerCase()) {
        // Owner can mint directly
        console.log(
          `[SHIELD] Owner detected — minting ${amount} SHIELD to self`,
        );
        const overrides = await safeGasOverrides(
          walletConnector.provider,
          100000n,
        );
        return shield.mint(walletConnector.address, amountWei, overrides);
      }
    } catch (e) {
      console.warn("[SHIELD] Could not check owner:", e);
    }

    // Not the owner — cannot self-serve. Throw with instructions.
    throw new Error(
      "SHIELD tokens must be distributed by the contract owner. " +
        "Run: npx hardhat run scripts/distribute-shield.js --network sepolia",
    );
  }

  /**
   * Check if the connected wallet is the deployer/owner of the SHIELD token.
   */
  public async isShieldOwner(): Promise<boolean> {
    if (!this.shieldToken) await this.init();
    if (!this.shieldToken || !walletConnector.address) return false;
    try {
      const owner = await this.shieldToken.owner();
      return owner.toLowerCase() === walletConnector.address.toLowerCase();
    } catch {
      return false;
    }
  }

  // Quadratic Voting Functions
  public async getScamReports(): Promise<any[]> {
    if (!this.votingContract) await this.init();

    try {
      // Use proposalCount + getProposal to fetch all proposals
      let count;
      try {
        count = await this.votingContract?.proposalCount();
      } catch (err: any) {
        // BAD_DATA = contract not deployed or ABI mismatch → return empty
        if (
          err?.code === "BAD_DATA" ||
          err?.message?.includes("could not decode")
        ) {
          console.warn(
            "[DAO] proposalCount() returned 0x — contract likely not deployed. Returning empty reports.",
          );
          return [];
        }
        throw err;
      }
      const totalProposals = Number(count || 0);

      if (totalProposals === 0) return [];

      const reports = [];
      for (let i = 1; i <= totalProposals; i++) {
        try {
          const proposal = await this.votingContract?.getProposal(i);
          reports.push({
            id: i,
            reporter: proposal.reporter || proposal[0],
            suspiciousAddress: proposal.suspiciousAddress || proposal[1],
            description: proposal.description || proposal[2],
            evidence: proposal.evidence || proposal[3],
            timestamp: new Date(),
            votesFor: (proposal.votesFor || proposal[4]).toString(),
            votesAgainst: (proposal.votesAgainst || proposal[5]).toString(),
            status:
              (proposal.isActive ?? proposal[6])
                ? "active"
                : BigInt(proposal.votesFor || proposal[4]) >
                    BigInt(proposal.votesAgainst || proposal[5])
                  ? "approved"
                  : "rejected",
          });
        } catch (err) {
          console.warn(`Failed to fetch proposal ${i}:`, err);
        }
      }

      return reports;
    } catch (error) {
      console.error("Error fetching scam reports:", error);

      // Fallback: try event-based approach with chunked block ranges
      try {
        const filter = this.votingContract?.filters.ProposalCreated();
        const events = await this.queryFilterChunked(filter);

        return (events || []).map((event, index) => {
          const args = (event as ethers.EventLog).args;
          return {
            id: Number(args?.[0] || index + 1),
            reporter: args?.[1] || "unknown",
            suspiciousAddress: args?.[2] || "unknown",
            description: args?.[3] || "Scam report",
            evidence: args?.[4] || "",
            timestamp: new Date(),
            votesFor: "0",
            votesAgainst: "0",
            status: "active",
          };
        });
      } catch (fallbackErr) {
        console.error("Event fallback also failed:", fallbackErr);
        return [];
      }
    }
  }

  public async castQuadraticVote(
    proposalId: string,
    support: boolean,
    tokens: string,
  ): Promise<ethers.ContractTransactionResponse> {
    const { voting } = await this.getSignerContract();
    const overrides = await safeGasOverrides(walletConnector.provider, 500000n);
    return voting.castVote(proposalId, support, tokens, overrides);
  }
  public async reportScam(
    suspiciousAddress: string,
    description: string,
    evidence: string,
  ): Promise<ethers.ContractTransactionResponse> {
    try {
      console.log("Starting report submission...");

      // Ensure wallet connector has provider/signer — re-connect if needed
      if (!walletConnector.provider || !walletConnector.signer) {
        console.log(
          "Wallet connector missing provider/signer, reconnecting...",
        );
        if (typeof window !== "undefined" && window.ethereum) {
          const { BrowserProvider } = await import("ethers");
          const accounts = await window.ethereum.request({
            method: "eth_accounts",
          });
          if (accounts && accounts.length > 0) {
            walletConnector.provider = patchProviderForMonad(
              new BrowserProvider(window.ethereum),
            );
            walletConnector.signer = await walletConnector.provider.getSigner();
            walletConnector.address = accounts[0];
            const network = await walletConnector.provider.getNetwork();
            walletConnector.chainId = Number(network.chainId);
            console.log(
              "Wallet reconnected:",
              walletConnector.address,
              "chain:",
              walletConnector.chainId,
            );
          } else {
            throw new Error("Please connect your wallet first");
          }
        } else {
          throw new Error("No wallet provider found. Please install MetaMask.");
        }
      }

      // Make sure contract is initialized
      if (!this.votingContract) {
        console.log("Initializing contract...");
        await this.init();
      }

      if (!walletConnector.address) {
        throw new Error("Please connect your wallet first");
      }

      if (!walletConnector.signer) {
        throw new Error("No signer available. Please check wallet connection.");
      }

      // Get network info and verify chain
      const network = await walletConnector.provider?.getNetwork();
      const chainId = Number(network?.chainId || 0);

      if (chainId !== 11155111) {
        throw new Error("Please switch to Sepolia network (chain ID 11155111)");
      }

      console.log("Network info:", {
        chainId,
        name: network?.name,
        contractAddress: this.QUADRATIC_VOTING_ADDRESS,
      });

      if (!isValidAddress(suspiciousAddress)) {
        throw new Error("Please enter a valid address to report");
      }

      // Normalize address to proper EIP-55 checksum
      suspiciousAddress = ethers.getAddress(suspiciousAddress);

      // Verify we have the contract address
      if (
        !this.QUADRATIC_VOTING_ADDRESS ||
        this.QUADRATIC_VOTING_ADDRESS === "0x..."
      ) {
        throw new Error("Contract address not properly initialized");
      }

      // Check if we have enough gas
      const balance = await walletConnector.provider?.getBalance(
        walletConnector.address,
      );
      if (balance && balance <= 0n) {
        throw new Error("Insufficient funds for gas");
      }

      console.log("Submitting scam report:", {
        reporter: walletConnector.address,
        suspiciousAddress,
        description: description.slice(0, 50) + "...",
        evidenceLength: evidence?.length || 0,
        chainId,
        contractAddress: this.QUADRATIC_VOTING_ADDRESS,
      });

      // Prepare transaction with gas estimate
      let gasEstimate: bigint;
      try {
        gasEstimate = await this.votingContract.submitProposal.estimateGas(
          suspiciousAddress,
          description,
          evidence,
        );
        console.log("Gas estimate:", gasEstimate.toString());
      } catch {
        gasEstimate = 400000n; // safe fallback
      }

      const overrides = await safeGasOverrides(
        walletConnector.provider,
        (gasEstimate * 120n) / 100n,
      );

      const tx = await this.votingContract.submitProposal(
        suspiciousAddress,
        description,
        evidence,
        overrides,
      );

      console.log("Transaction submitted:", tx.hash);

      // Wait for transaction confirmation
      console.log("Waiting for transaction confirmation...");
      const receipt = await tx.wait(1);

      console.log("Transaction confirmed:", {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      });

      return tx;
    } catch (error: any) {
      console.error("Error submitting scam report:", {
        error,
        message: error.message,
        code: error.code,
        data: error.data,
      });

      if (error.code === 4001 || error.message?.includes("user rejected")) {
        throw new Error("Transaction rejected by user");
      } else if (error.message.includes("insufficient funds")) {
        throw new Error("Insufficient funds for gas");
      } else if (error.message.includes("contract not properly initialized")) {
        throw new Error(
          "Smart contract not properly loaded. Please refresh the page and try again.",
        );
      } else {
        throw new Error(`Failed to submit report: ${error.message}`);
      }
    }
  }

  public async isScamAddress(address: string): Promise<boolean> {
    if (!this.votingContract) await this.init();
    try {
      const result = await this.votingContract?.isScammer(address);
      console.log(
        `[DAO] eth_call isScammer(${address}) → ${result}  |  contract: ${this.votingContract?.target}`,
      );
      return result;
    } catch (error: any) {
      if (
        error?.code === "BAD_DATA" ||
        error?.message?.includes("could not decode")
      ) {
        console.warn(
          "[DAO] isScammer() returned 0x — contract not deployed. Returning false.",
        );
        return false;
      }
      console.warn("isScammer check failed (non-fatal):", error);
      return false;
    }
  }

  public async getScamScore(address: string): Promise<number> {
    if (!this.votingContract) await this.init();

    try {
      // ── REAL on-chain read: public mapping scamScore(address) → uint256 ──
      // This is a direct eth_call to the QuadraticVoting contract.
      // The contract increments scamScore by +25 each time executeProposal() confirms a scam.
      const onChainScore = await this.votingContract?.scamScore(address);
      const score = Number(onChainScore ?? 0);
      console.log(
        `[DAO] eth_call scamScore(${address}) → ${score}  |  contract: ${this.votingContract?.target}`,
      );
      return Math.min(100, score);
    } catch (err: any) {
      // BAD_DATA = contract not deployed at this address
      if (
        err?.code === "BAD_DATA" ||
        err?.message?.includes("could not decode")
      ) {
        console.warn(
          "[DAO] scamScore() returned 0x — contract not deployed. Returning 0.",
        );
        return 0;
      }
      console.error("Error calculating scam score:", err);
      return 0;
    }
  }

  public async getUserVotingStats(address: string) {
    if (!this.votingContract) await this.init();

    try {
      // Use direct contract reads instead of event scanning to avoid
      // hammering eth_getLogs and hitting Monad's 25 req/sec rate limit.
      let count;
      try {
        count = await this.votingContract?.proposalCount();
      } catch {
        return { totalVotes: 0, accuracy: 0 };
      }
      const totalProposals = Number(count || 0);
      if (totalProposals === 0) return { totalVotes: 0, accuracy: 0 };

      let totalVotes = 0;
      let correctVotes = 0;

      for (let i = 1; i <= totalProposals; i++) {
        try {
          const vote = await this.votingContract?.getVote(i, address);
          const hasVoted = vote?.hasVoted ?? vote?.[0];
          if (!hasVoted) continue;

          totalVotes++;

          // Check if proposal was executed and whether vote aligned
          try {
            const proposal = await this.votingContract?.getProposal(i);
            const isActive = proposal?.isActive ?? proposal?.[6];
            if (!isActive) {
              // Proposal ended — check if voter was on the winning side
              const votesFor = BigInt(proposal?.votesFor ?? proposal?.[4]);
              const votesAgainst = BigInt(
                proposal?.votesAgainst ?? proposal?.[5],
              );
              const passed = votesFor > votesAgainst;
              const voterSupport = vote?.support ?? vote?.[1];
              if (voterSupport === passed) correctVotes++;
            }
          } catch {
            // Can't decode proposal — skip accuracy calc for this one
          }
        } catch {
          // getVote failed — skip
        }
      }

      return {
        totalVotes,
        accuracy:
          totalVotes > 0 ? Math.round((correctVotes / totalVotes) * 100) : 0,
      };
    } catch (err) {
      console.error("Error getting user voting stats:", err);
      return { totalVotes: 0, accuracy: 0 };
    }
  }
}

// Create a singleton instance
const contractService = new ContractService();

// Standalone functions for Step 6

/**
 * Get a contract instance
 * @returns {Promise<Contract>} Contract instance
 */
export const getContract = async (): Promise<Contract> => {
  return contractService.getContract();
};

/**
 * Send ETH securely
 * @param to Recipient address
 * @param amountEth Amount in ETH
 * @returns Transaction hash
 */
export const sendTransaction = async (
  to: string,
  amountEth: string,
): Promise<string> => {
  try {
    const tx = await contractService.secureSendETH(to, amountEth);
    const receipt = await tx.wait();
    return receipt.hash;
  } catch (error: any) {
    console.error("Send transaction error:", error);
    throw new Error(`Transaction failed: ${error.message}`);
  }
};

/**
 * Report scammer
 * @param scammer Address to report
 * @param reason Reason for the report
 * @param evidence Evidence URL or documentation (optional)
 * @returns Transaction hash
 */
export const reportScam = async (
  scammer: string,
  reason: string,
  evidence: string = "",
): Promise<string> => {
  try {
    console.log("Starting scam report submission...", {
      scammer,
      reason,
      evidence,
    });

    // Validate inputs
    if (!isValidAddress(scammer)) {
      throw new Error("Invalid address format");
    }
    // Normalize to proper EIP-55 checksum so any valid hex address works
    scammer = ethers.getAddress(scammer);
    if (!reason.trim()) {
      throw new Error("Reason is required");
    }

    const tx = await contractService.reportScam(scammer, reason, evidence);
    console.log("Transaction sent:", tx.hash);

    // Wait for one confirmation
    const receipt = await tx.wait(1);
    console.log("Transaction confirmed:", receipt.hash);

    return receipt.hash;
  } catch (error: any) {
    console.error("Report scam error:", error);
    // Check if user rejected the transaction
    if (error.code === 4001 || error.message?.includes("user rejected")) {
      throw new Error("Report cancelled by user");
    }
    throw new Error(
      error.message || "Report submission failed. Please try again.",
    );
  }
};

/**
 * Vote on a proposal
 * @param proposalId ID of the proposal
 * @param inSupport Whether to vote in support
 * @returns Transaction hash
 */
export const voteOnProposal = async (
  proposalId: string,
  inSupport: boolean,
  tokens: string = "1000000000000000000",
): Promise<string> => {
  try {
    const tx = await contractService.voteOnScamReport(
      proposalId,
      inSupport,
      tokens,
    );
    const receipt = await tx.wait();
    return receipt.hash;
  } catch (error: any) {
    console.error("Vote error:", error);
    throw new Error(`Vote submission failed: ${error.message}`);
  }
};

export default contractService;

// Utility function to handle ENS resolution based on network support
async function resolveAddressOrENS(
  provider: ethers.Provider,
  addressOrENS: string,
): Promise<string> {
  // Check if it's already a valid address
  if (isValidAddress(addressOrENS)) {
    return addressOrENS;
  }

  try {
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId); // Convert bigint to number for comparison

    // Immediately return for non-ENS networks to avoid unnecessary ENS calls
    if (chainId === 10143) {
      throw new Error("Only valid addresses are supported on Monad network");
    }

    // Only attempt ENS resolution on supported networks
    const supportedENSNetworks = [1, 5, 11155111]; // Mainnet, Goerli, Sepolia
    if (!supportedENSNetworks.includes(chainId)) {
      throw new Error("ENS resolution not supported on this network");
    }

    const address = await provider.resolveName(addressOrENS);
    if (!address) {
      throw new Error("ENS resolution failed");
    }
    return address;
  } catch (error) {
    // Always return the original input if it's a valid address
    if (isValidAddress(addressOrENS)) {
      return addressOrENS;
    }
    throw new Error("Please enter a valid address");
  }
}

export const getQuadraticVotingContract = async (
  provider: ethers.Provider,
  address: string,
) => {
  // Create contract instance
  const contract = new Contract(address, QUADRATIC_VOTING_ABI, provider);

  // Wrap the contract to handle addresses correctly for the network
  return {
    ...contract,
    submitProposal: async (
      suspiciousAddress: string,
      description: string,
      evidence: string,
    ) => {
      // For Monad network, only accept valid addresses directly
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);

      if (chainId === 10143) {
        if (!isValidAddress(suspiciousAddress)) {
          throw new Error("Please enter a valid address");
        }
        return contract.submitProposal(
          suspiciousAddress,
          description,
          evidence,
        );
      }

      // For other networks, attempt address resolution
      const resolvedAddress = await resolveAddressOrENS(
        provider,
        suspiciousAddress,
      );
      return contract.submitProposal(resolvedAddress, description, evidence);
    },
  };
};
