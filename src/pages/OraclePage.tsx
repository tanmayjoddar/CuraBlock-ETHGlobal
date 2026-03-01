import React, { useState, useCallback, useEffect, useRef } from "react";
import { JsonRpcProvider, Contract, isAddress } from "ethers";
import addresses from "@/web3/addresses.json";

// ── Contract config ──
const RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";
const CONTRACT_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS_SEPOLIA ||
  (addresses as any).quadraticVoting ||
  "0x810DA31a1eFB767652b2f969972d2A612AfdEc5C";

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
  glowColor: string;
  gradientFrom: string;
  gradientTo: string;
}

// ── Risk mapping ──
// isConfirmed overrides score — a DAO-confirmed scammer is always CRITICAL
function getRiskProfile(score: number, isConfirmed?: boolean): RiskProfile {
  if (isConfirmed || score >= 80)
    return {
      color: "#FF3B3B",
      label: "🔴 CRITICAL — DAO CONFIRMED SCAM",
      description: "DAO confirmed scammer. Block all transactions.",
      borderColor: "rgba(255,59,59,0.6)",
      glowColor: "rgba(255,59,59,0.25)",
      gradientFrom: "rgba(255,59,59,0.08)",
      gradientTo: "transparent",
    };
  if (score >= 60)
    return {
      color: "#FF9500",
      label: "🟠 HIGH RISK",
      description: "High risk patterns. Strong warning.",
      borderColor: "rgba(255,149,0,0.6)",
      glowColor: "rgba(255,149,0,0.2)",
      gradientFrom: "rgba(255,149,0,0.08)",
      gradientTo: "transparent",
    };
  if (score >= 30)
    return {
      color: "#3B82F6",
      label: "🟡 UNDER REVIEW",
      description: "Under community review. Caution.",
      borderColor: "rgba(59,130,246,0.6)",
      glowColor: "rgba(59,130,246,0.2)",
      gradientFrom: "rgba(59,130,246,0.08)",
      gradientTo: "transparent",
    };
  return {
    color: "#00D48A",
    label: "🟢 CLEAN",
    description: "No threats detected. Safe to transact.",
    borderColor: "rgba(0,212,138,0.6)",
    glowColor: "rgba(0,212,138,0.2)",
    gradientFrom: "rgba(0,212,138,0.08)",
    gradientTo: "transparent",
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

// ── Animated Score Counter ──
const AnimatedScore: React.FC<{ target: number; color: string }> = ({
  target,
  color,
}) => {
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    let start = 0;
    const duration = 1200;
    const startTime = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const frame = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      setDisplayed(Math.round(ease(progress) * target));
      if (progress < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, [target]);
  return (
    <span
      style={{
        color,
        textShadow: `0 0 80px ${color}80, 0 0 160px ${color}30`,
        fontFamily: "'DM Mono', monospace",
        fontSize: "clamp(5rem, 18vw, 9rem)",
        fontWeight: 900,
        lineHeight: 1,
        letterSpacing: "-0.04em",
      }}
    >
      {displayed}
    </span>
  );
};

// ── Scanline overlay ──
const ScanLines: React.FC = () => (
  <div
    style={{
      position: "fixed",
      inset: 0,
      pointerEvents: "none",
      zIndex: 0,
      backgroundImage:
        "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px)",
    }}
  />
);

// ── Grid background ──
const GridBg: React.FC = () => (
  <div
    style={{
      position: "fixed",
      inset: 0,
      pointerEvents: "none",
      zIndex: 0,
      backgroundImage: `
        linear-gradient(rgba(124,58,237,0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(124,58,237,0.04) 1px, transparent 1px)
      `,
      backgroundSize: "48px 48px",
    }}
  />
);

// ── Radial glow bg ──
const RadialGlow: React.FC = () => (
  <div
    style={{
      position: "fixed",
      top: "-20%",
      left: "50%",
      transform: "translateX(-50%)",
      width: "80vw",
      height: "60vh",
      borderRadius: "50%",
      background:
        "radial-gradient(ellipse, rgba(109,40,217,0.12) 0%, transparent 70%)",
      pointerEvents: "none",
      zIndex: 0,
    }}
  />
);

// ── Stat Box ──
const StatBox: React.FC<{
  label: string;
  value: string;
  valueColor: string;
  index: number;
}> = ({ label, value, valueColor, index }) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 300 + index * 120);
    return () => clearTimeout(t);
  }, [index]);
  return (
    <div
      style={{
        padding: "20px 24px",
        background: "rgba(15,12,40,0.7)",
        backdropFilter: "blur(8px)",
        transition: "opacity 0.4s ease, transform 0.4s ease",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
        borderBottom: "1px solid rgba(124,58,237,0.1)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: "#6B7280",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          fontWeight: 600,
          marginBottom: 6,
          fontFamily: "'DM Mono', monospace",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "clamp(1.1rem, 3vw, 1.5rem)",
          fontWeight: 700,
          color: valueColor,
          fontFamily: "'DM Mono', monospace",
          textShadow: `0 0 20px ${valueColor}50`,
        }}
      >
        {value}
      </div>
    </div>
  );
};

// ── Loading Pulse Spinner ──
const OracleLoader: React.FC = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
    <div
      style={{
        width: 18,
        height: 18,
        borderRadius: "50%",
        border: "2px solid rgba(167,139,250,0.2)",
        borderTopColor: "#A78BFA",
        animation: "spin 0.7s linear infinite",
      }}
    />
    <span
      style={{
        color: "#A78BFA",
        fontSize: 14,
        fontFamily: "'DM Mono', monospace",
      }}
    >
      Querying Blockchain...
    </span>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const OraclePage: React.FC = () => {
  const [address, setAddress] = useState(
    "0x098B716B8Aaf21512996dC57EB0615e2383E2f96",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OracleResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

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
      requestAnimationFrame(() => {
        setShowResult(true);
        setTimeout(
          () =>
            resultRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            }),
          100,
        );
      });
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

  const risk = result
    ? getRiskProfile(result.threatScore, result.isConfirmed)
    : null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#080612",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <ScanLines />
      <GridBg />
      <RadialGlow />

      {/* Google Fonts */}
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@700;800;900&display=swap"
        rel="stylesheet"
      />

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(32px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseRing {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.04); }
        }
        @keyframes chainBadge {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .query-btn {
          position: relative;
          overflow: hidden;
          cursor: pointer;
          border: none;
          outline: none;
        }
        .query-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.08), transparent);
          opacity: 0;
          transition: opacity 0.2s;
        }
        .query-btn:hover:not(:disabled)::before { opacity: 1; }
        .query-btn:active:not(:disabled) { transform: scale(0.98); }
      `}</style>

      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "clamp(48px, 8vw, 96px) 24px 80px",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* ── Header ── */}
        <header
          style={{
            textAlign: "center",
            marginBottom: 56,
            animation: "fadeSlideUp 0.7s ease both",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 16,
            }}
          >
            <span
              style={{
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#6D28D9",
                fontFamily: "'DM Mono', monospace",
                fontWeight: 500,
                background: "rgba(109,40,217,0.12)",
                border: "1px solid rgba(109,40,217,0.3)",
                padding: "4px 12px",
                borderRadius: 100,
              }}
            >
              On-chain · Decentralized · DAO-governed
            </span>
          </div>
          <h1
            style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: "clamp(2.2rem, 7vw, 3.8rem)",
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              margin: 0,
              background:
                "linear-gradient(135deg, #C4B5FD 0%, #A78BFA 50%, #7C3AED 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            ⚡ NeuroShield
            <br />
            Threat Oracle
          </h1>
          <p
            style={{
              color: "#6B7280",
              fontSize: 15,
              marginTop: 16,
              fontFamily: "'DM Mono', monospace",
              letterSpacing: "0.02em",
            }}
          >
            No wallet needed · Any address · Any EVM chain can call this
          </p>

          {/* Chain badges */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: 8,
              marginTop: 24,
            }}
          >
            {CHAINS.map((chain, i) => (
              <span
                key={chain.name}
                style={{
                  padding: "5px 14px",
                  borderRadius: 100,
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: "'DM Mono', monospace",
                  letterSpacing: "0.06em",
                  background: chain.active
                    ? "rgba(0,212,138,0.08)"
                    : "rgba(255,255,255,0.03)",
                  color: chain.active ? "#00D48A" : "#4B5563",
                  border: `1px solid ${chain.active ? "rgba(0,212,138,0.3)" : "rgba(255,255,255,0.06)"}`,
                  animation: `chainBadge 0.4s ease ${0.1 + i * 0.06}s both`,
                  boxShadow: chain.active
                    ? "0 0 16px rgba(0,212,138,0.1)"
                    : "none",
                }}
              >
                {chain.name}
              </span>
            ))}
          </div>
        </header>

        {/* ── Input Card ── */}
        <div
          style={{
            borderRadius: 20,
            padding: "32px 32px 28px",
            marginBottom: 28,
            background: "rgba(20,14,50,0.8)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(124,58,237,0.2)",
            boxShadow:
              "0 0 60px rgba(109,40,217,0.1), inset 0 1px 0 rgba(255,255,255,0.04)",
            animation: "fadeSlideUp 0.7s ease 0.15s both",
          }}
        >
          <label
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#6B7280",
              fontFamily: "'DM Mono', monospace",
              marginBottom: 10,
            }}
          >
            Wallet Address
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && queryOracle()}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            placeholder="0x..."
            spellCheck={false}
            style={{
              width: "100%",
              padding: "14px 18px",
              borderRadius: 12,
              fontSize: 13,
              fontFamily: "'DM Mono', monospace",
              background: "rgba(0,0,0,0.4)",
              color: "#E5E7EB",
              border: `1px solid ${inputFocused ? "rgba(124,58,237,0.6)" : "rgba(124,58,237,0.15)"}`,
              outline: "none",
              boxSizing: "border-box",
              transition: "border-color 0.2s, box-shadow 0.2s",
              boxShadow: inputFocused
                ? "0 0 0 3px rgba(124,58,237,0.12)"
                : "none",
              letterSpacing: "0.02em",
            }}
          />

          <button
            onClick={queryOracle}
            disabled={loading}
            className="query-btn"
            style={{
              width: "100%",
              marginTop: 14,
              padding: "15px 0",
              borderRadius: 12,
              fontFamily: "'Syne', sans-serif",
              fontWeight: 800,
              fontSize: 15,
              letterSpacing: "0.04em",
              color: "#fff",
              background: loading
                ? "rgba(109,40,217,0.4)"
                : "linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)",
              boxShadow: loading
                ? "none"
                : "0 0 32px rgba(124,58,237,0.4), 0 4px 16px rgba(0,0,0,0.4)",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            {loading ? <OracleLoader /> : "⚡ Query Threat Oracle"}
          </button>

          {error && (
            <div
              style={{
                marginTop: 12,
                padding: "12px 16px",
                borderRadius: 10,
                background: "rgba(255,59,59,0.07)",
                border: "1px solid rgba(255,59,59,0.25)",
                color: "#FF6B6B",
                fontSize: 13,
                fontFamily: "'DM Mono', monospace",
                animation: "fadeSlideUp 0.3s ease",
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* ── Results ── */}
        {result && risk && (
          <div
            ref={resultRef}
            style={{
              borderRadius: 20,
              overflow: "hidden",
              border: `1px solid ${risk.borderColor}`,
              boxShadow: `0 0 80px ${risk.glowColor}, 0 0 160px ${risk.glowColor.replace("0.25", "0.1")}`,
              background: "rgba(14,10,38,0.95)",
              backdropFilter: "blur(24px)",
              opacity: showResult ? 1 : 0,
              transform: showResult ? "translateY(0)" : "translateY(28px)",
              transition: "opacity 0.5s ease, transform 0.5s ease",
            }}
          >
            {/* Top gradient wash */}
            <div
              style={{
                background: `linear-gradient(180deg, ${risk.gradientFrom} 0%, ${risk.gradientTo} 100%)`,
                padding: "48px 32px 36px",
                textAlign: "center",
              }}
            >
              {/* Pulse ring behind score */}
              <div style={{ position: "relative", display: "inline-block" }}>
                <div
                  style={{
                    position: "absolute",
                    inset: -20,
                    borderRadius: "50%",
                    border: `1px solid ${risk.borderColor}`,
                    animation: "pulseRing 2.5s ease-in-out infinite",
                    pointerEvents: "none",
                  }}
                />
                <AnimatedScore target={result.threatScore} color={risk.color} />
              </div>

              <div
                style={{
                  fontFamily: "'Syne', sans-serif",
                  fontSize: "clamp(1.1rem, 3.5vw, 1.5rem)",
                  fontWeight: 800,
                  color: risk.color,
                  marginTop: 20,
                  letterSpacing: "0.06em",
                  textShadow: `0 0 24px ${risk.color}60`,
                }}
              >
                {risk.label}
              </div>
              <p
                style={{
                  color: "#6B7280",
                  marginTop: 8,
                  fontSize: 13,
                  fontFamily: "'DM Mono', monospace",
                  letterSpacing: "0.02em",
                }}
              >
                {risk.description}
              </p>
            </div>

            {/* Stats */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1px",
                background: "rgba(124,58,237,0.1)",
              }}
            >
              <StatBox
                label="DAO Confirmed"
                value={result.isConfirmed ? "YES" : "NO"}
                valueColor={result.isConfirmed ? "#FF3B3B" : "#00D48A"}
                index={0}
              />
              <StatBox
                label="Community Confidence"
                value={`${result.confidencePercent.toString()}%`}
                valueColor="#A78BFA"
                index={1}
              />
              <StatBox
                label="Votes Against Wallet"
                value={`${result.votesFor.toString()} power`}
                valueColor="#FF9500"
                index={2}
              />
              <StatBox
                label="Total Voters"
                value={`${result.totalVoters.toString()} people`}
                valueColor="#60A5FA"
                index={3}
              />
            </div>

            {/* Code snippet */}
            <div style={{ borderTop: "1px solid rgba(124,58,237,0.12)" }}>
              <div
                style={{
                  padding: "10px 24px",
                  fontSize: 10,
                  fontFamily: "'DM Mono', monospace",
                  fontWeight: 600,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "#7C3AED",
                  background: "rgba(124,58,237,0.06)",
                  borderBottom: "1px solid rgba(124,58,237,0.08)",
                }}
              >
                ⚡ Any DeFi Protocol Integrates In 3 Lines:
              </div>
              <pre
                style={{
                  padding: "20px 24px",
                  margin: 0,
                  fontSize: 13,
                  lineHeight: 1.7,
                  color: "#60A5FA",
                  fontFamily: "'DM Mono', monospace",
                  overflowX: "auto",
                  background: "rgba(0,0,0,0.3)",
                }}
              >
                {`INeuroShield oracle = INeuroShield(CONTRACT_ADDRESS);
require(
  oracle.getThreatScore(msg.sender) < 70,
  "Blocked: High risk address"
);`}
              </pre>
            </div>

            {/* Etherscan link */}
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid rgba(124,58,237,0.1)",
                textAlign: "center",
              }}
            >
              <a
                href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "#A78BFA",
                  fontSize: 13,
                  fontFamily: "'DM Mono', monospace",
                  textDecoration: "none",
                  letterSpacing: "0.02em",
                  transition: "color 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#C4B5FD")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#A78BFA")}
              >
                View contract on Etherscan (Sepolia) →
              </a>
            </div>
          </div>
        )}

        {/* ── Bottom quote ── */}
        <div
          style={{
            marginTop: 64,
            textAlign: "center",
            animation: "fadeSlideUp 0.7s ease 0.4s both",
          }}
        >
          <div
            style={{
              display: "inline-block",
              padding: "1px",
              borderRadius: 16,
              background:
                "linear-gradient(135deg, rgba(124,58,237,0.2), rgba(124,58,237,0.05))",
            }}
          >
            <blockquote
              style={{
                margin: 0,
                padding: "20px 28px",
                borderRadius: 15,
                background: "rgba(8,6,18,0.9)",
                color: "#4B5563",
                fontSize: "clamp(12px, 2.5vw, 14px)",
                fontFamily: "'DM Mono', monospace",
                fontStyle: "italic",
                lineHeight: 1.8,
                letterSpacing: "0.02em",
              }}
            >
              "Chainlink tells you the price of ETH.
              <br />
              NeuroShield tells you if the sender is a scammer."
            </blockquote>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OraclePage;
