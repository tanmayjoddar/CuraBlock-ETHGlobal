import React, { useState, useCallback } from "react";
import { JsonRpcProvider, Contract, isAddress } from "ethers";

// ── Contract config ──
const RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";
const CONTRACT_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS_SEPOLIA ||
  "0x0000000000000000000000000000000000000000";

const ORACLE_ABI = [
  "function getThreatScore(address wallet) public view returns (uint256)",
  "function isConfirmedScam(address wallet) public view returns (bool)",
  "function getDAOConfidence(address wallet) external view returns (uint256 votesFor, uint256 votesAgainst, uint256 totalVoters, uint256 confidencePercent)",
];

// ── Types ──
interface OracleResult {
  threatScore: number;
  isConfirmed: boolean;
  votesFor: bigint;
  votesAgainst: bigint;
  totalVoters: bigint;
  confidencePercent: bigint;
}

interface RiskProfile {
  color: string;
  label: string;
  description: string;
  borderColor: string;
  bgGlow: string;
}

// ── Risk mapping ──
function getRiskProfile(score: number): RiskProfile {
  if (score >= 80)
    return {
      color: "#DC2626",
      label: "🔴 CRITICAL",
      description: "DAO confirmed scammer. Block all transactions.",
      borderColor: "border-red-600",
      bgGlow: "shadow-[0_0_60px_rgba(220,38,38,0.3)]",
    };
  if (score >= 60)
    return {
      color: "#D97706",
      label: "🟠 HIGH RISK",
      description: "High risk patterns. Strong warning.",
      borderColor: "border-amber-600",
      bgGlow: "shadow-[0_0_60px_rgba(217,119,6,0.3)]",
    };
  if (score >= 30)
    return {
      color: "#2563EB",
      label: "🟡 UNDER REVIEW",
      description: "Under community review. Caution.",
      borderColor: "border-blue-600",
      bgGlow: "shadow-[0_0_60px_rgba(37,99,235,0.3)]",
    };
  return {
    color: "#059669",
    label: "🟢 CLEAN",
    description: "No threats detected. Safe to transact.",
    borderColor: "border-emerald-600",
    bgGlow: "shadow-[0_0_60px_rgba(5,150,105,0.3)]",
  };
}

// ── Chain badges ──
const CHAINS = [
  { name: "Ethereum", active: false },
  { name: "Arbitrum", active: false },
  { name: "Base", active: false },
  { name: "Polygon", active: false },
  { name: "BNB Chain", active: false },
  { name: "Sepolia ✓", active: true },
];

const OraclePage: React.FC = () => {
  const [address, setAddress] = useState(
    "0x098B716B8Aaf21512996dC57EB0615e2383E2f96",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OracleResult | null>(null);
  const [showResult, setShowResult] = useState(false);

  const queryOracle = useCallback(async () => {
    const trimmed = address.trim();
    if (!isAddress(trimmed)) {
      setError(
        "Invalid Ethereum address. Must be 0x followed by 40 hex characters.",
      );
      return;
    }

    setError(null);
    setResult(null);
    setShowResult(false);
    setLoading(true);

    try {
      const provider = new JsonRpcProvider(RPC_URL);
      const contract = new Contract(CONTRACT_ADDRESS, ORACLE_ABI, provider);

      const [threatScore, isConfirmed, confidence] = await Promise.all([
        contract.getThreatScore(trimmed) as Promise<bigint>,
        contract.isConfirmedScam(trimmed) as Promise<boolean>,
        contract.getDAOConfidence(trimmed) as Promise<
          [bigint, bigint, bigint, bigint]
        >,
      ]);

      setResult({
        threatScore: Number(threatScore),
        isConfirmed,
        votesFor: confidence[0],
        votesAgainst: confidence[1],
        totalVoters: confidence[2],
        confidencePercent: confidence[3],
      });

      // Trigger animation
      requestAnimationFrame(() => setShowResult(true));
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to query contract";
      if (msg.includes("BAD_DATA") || msg.includes("could not decode")) {
        setError(
          "Contract returned unexpected data. The contract may not be deployed at this address.",
        );
      } else if (msg.includes("network") || msg.includes("timeout")) {
        setError("Network error. Sepolia RPC may be unavailable. Try again.");
      } else {
        setError(`Query failed: ${msg.slice(0, 200)}`);
      }
    } finally {
      setLoading(false);
    }
  }, [address]);

  const risk = result ? getRiskProfile(result.threatScore) : null;

  return (
    <div className="min-h-screen" style={{ background: "#0D1117" }}>
      <div className="max-w-3xl mx-auto px-4 py-12 sm:py-20">
        {/* ── SECTION 1: Header ── */}
        <header className="text-center mb-12">
          <h1
            className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-3"
            style={{ color: "#A78BFA" }}
          >
            ⚡ NeuroShield Threat Oracle
          </h1>
          <p className="text-gray-400 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
            No wallet needed · Any address · Any EVM chain can call this
          </p>

          {/* Chain badges */}
          <div className="flex flex-wrap justify-center gap-2 mt-6">
            {CHAINS.map((chain) => (
              <span
                key={chain.name}
                className={`px-3 py-1 rounded-full text-xs font-semibold tracking-wide ${
                  chain.active
                    ? "bg-emerald-900/60 text-emerald-300 border border-emerald-500/40"
                    : "bg-gray-800/60 text-gray-500 border border-gray-700/40"
                }`}
              >
                {chain.name}
              </span>
            ))}
          </div>
        </header>

        {/* ── SECTION 2: Input ── */}
        <div
          className="rounded-2xl p-6 sm:p-8 mb-8"
          style={{ background: "#1E1B4B" }}
        >
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Wallet Address
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x..."
            spellCheck={false}
            className="w-full px-4 py-3.5 rounded-xl text-sm font-mono bg-black/40 text-gray-100 border border-purple-800/40 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 outline-none transition-all placeholder:text-gray-600"
          />

          <button
            onClick={queryOracle}
            disabled={loading}
            className="w-full mt-4 py-3.5 rounded-xl font-bold text-white text-base transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: loading
                ? "#4C1D95"
                : "linear-gradient(135deg, #7C3AED, #6D28D9)",
              boxShadow: loading ? "none" : "0 4px 24px rgba(124,58,237,0.4)",
            }}
          >
            {loading ? "⏳ Querying Blockchain..." : "⚡ Query Threat Oracle"}
          </button>

          {error && (
            <p className="mt-3 text-sm text-red-400 bg-red-900/20 border border-red-800/30 rounded-lg px-4 py-2.5">
              {error}
            </p>
          )}
        </div>

        {/* ── SECTION 3: Results ── */}
        {result && risk && (
          <div
            className={`rounded-2xl border-2 overflow-hidden transition-all duration-500 ${risk.borderColor} ${risk.bgGlow}`}
            style={{
              background: "#1E1B4B",
              opacity: showResult ? 1 : 0,
              transform: showResult ? "translateY(0)" : "translateY(24px)",
            }}
          >
            {/* 3A — Big score */}
            <div className="text-center py-10 px-6">
              <div
                className="text-8xl sm:text-9xl font-black tabular-nums leading-none"
                style={{
                  color: risk.color,
                  textShadow: `0 0 40px ${risk.color}60`,
                }}
              >
                {result.threatScore}
              </div>
              <div
                className="text-2xl font-bold mt-4 tracking-wide"
                style={{ color: risk.color }}
              >
                {risk.label}
              </div>
              <p className="text-gray-400 mt-2 text-sm max-w-sm mx-auto">
                {risk.description}
              </p>
            </div>

            {/* 3B — Stats grid */}
            <div className="grid grid-cols-2 gap-px bg-purple-900/20">
              <StatBox
                label="DAO Confirmed"
                value={result.isConfirmed ? "YES" : "NO"}
                valueColor={result.isConfirmed ? "#DC2626" : "#059669"}
              />
              <StatBox
                label="Community Confidence"
                value={`${result.confidencePercent.toString()}%`}
                valueColor="#A78BFA"
              />
              <StatBox
                label="Votes Against Wallet"
                value={`${result.votesFor.toString()} power`}
                valueColor="#F59E0B"
              />
              <StatBox
                label="Total Voters"
                value={`${result.totalVoters.toString()} people`}
                valueColor="#60A5FA"
              />
            </div>

            {/* 3C — Solidity snippet */}
            <div className="border-t border-purple-900/30">
              <div
                className="px-6 py-3 text-xs font-bold tracking-widest uppercase"
                style={{
                  color: "#A78BFA",
                  background: "rgba(124,58,237,0.08)",
                }}
              >
                ⚡ Any DeFi Protocol Integrates In 3 Lines:
              </div>
              <pre
                className="px-6 py-5 text-sm leading-relaxed overflow-x-auto font-mono"
                style={{ color: "#60A5FA" }}
              >
                {`INeuroShield oracle = INeuroShield(CONTRACT_ADDRESS);
require(
  oracle.getThreatScore(msg.sender) < 70,
  "Blocked: High risk address"
);`}
              </pre>
            </div>

            {/* 3D — Explorer link */}
            <div className="px-6 py-4 border-t border-purple-900/30 text-center">
              <a
                href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium hover:underline transition-colors"
                style={{ color: "#A78BFA" }}
              >
                View contract on Etherscan (Sepolia) →
              </a>
            </div>
          </div>
        )}

        {/* ── SECTION 4: Bottom quote ── */}
        <div className="mt-16 text-center px-4">
          <blockquote className="text-gray-500 text-sm sm:text-base italic leading-relaxed max-w-lg mx-auto">
            "Chainlink tells you the price of ETH.
            <br />
            NeuroShield tells you if the sender is a scammer."
          </blockquote>
        </div>
      </div>
    </div>
  );
};

// ── Stat box sub-component ──
const StatBox: React.FC<{
  label: string;
  value: string;
  valueColor: string;
}> = ({ label, value, valueColor }) => (
  <div className="px-5 py-5" style={{ background: "rgba(30,27,75,0.6)" }}>
    <div className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">
      {label}
    </div>
    <div
      className="text-xl sm:text-2xl font-bold tabular-nums"
      style={{ color: valueColor }}
    >
      {value}
    </div>
  </div>
);

export default OraclePage;
