/**
 * SoulboundToken.tsx — The SBT Profile Card
 * Redesigned to match the Soulbound Token Dashboard HTML reference.
 *
 * Visual system:
 * - bg-background-dark (#020617), glass-card, glow-purple
 * - Inter + JetBrains Mono
 * - Primary #7C3AED / accent #A78BFA / success #10B981
 * - Concentric SVG rings for trust score
 * - Gradient mint button fixed to bottom
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  getSBTProfile,
  computeLiveTrustScore,
  mintSBT,
  updateSBT,
  levelToString,
  levelToColor,
  onSBTMinted,
  onMetadataUpdated,
  type SBTProfile,
  type TrustBreakdown,
} from "@/web3/civic/sbt";
import walletConnector from "@/web3/wallet";

/* ─────────────────────────────────────────────
   CSS — Soulbound Token Dashboard design system
───────────────────────────────────────────── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

  :root {
    --bg:         #020617;
    --primary:    #7C3AED;
    --accent:     #A78BFA;
    --success:    #10B981;
    --border:     rgba(255,255,255,0.05);
    --slate-300:  #cbd5e1;
    --slate-400:  #94a3b8;
    --slate-500:  #64748b;
    --slate-800:  #1e293b;
    --slate-900:  rgba(15,23,42,0.4);
  }

  .sbt-root {
    background: var(--bg);
    color: #f1f5f9;
    font-family: 'Inter', sans-serif;
    -webkit-font-smoothing: antialiased;
    min-height: 100%;
    padding-bottom: 120px;
  }

  /* ── Glass card ── */
  .glass-card {
    background: rgba(30,41,59,0.5);
    backdrop-filter: blur(12px);
    border: 1px solid var(--border);
  }

  /* ── Glow ── */
  .glow-purple {
    box-shadow: 0 0 25px -5px rgba(124,58,237,0.5);
  }

  /* ── Pulse shield icon ── */
  @keyframes sbtPulse {
    0%,100% { opacity:1; filter:drop-shadow(0 0 8px rgba(167,139,250,0.6)); }
    50%      { opacity:.8; filter:drop-shadow(0 0 20px rgba(167,139,250,0.9)); }
  }
  .pulse-slow { animation: sbtPulse 3s cubic-bezier(.4,0,.6,1) infinite; }

  /* ── Header hero ── */
  .sbt-header {
    display: flex; flex-direction: column; align-items: center; text-align: center;
    padding: 24px 20px 0; gap: 16px;
    animation: sbtFadeUp 0.5s ease both;
  }
  .sbt-avatar-wrap { position: relative; }
  .sbt-avatar {
    width: 80px; height: 80px; border-radius: 50%;
    background: rgba(124,58,237,0.2);
    border: 1px solid rgba(124,58,237,0.3);
    display: flex; align-items: center; justify-content: center;
  }
  .sbt-avatar-shield {
    font-size: 48px; color: var(--primary);
  }
  .sbt-onchain-badge {
    position: absolute; top: -4px; right: -4px;
    background: var(--primary); color: #fff;
    font-family: 'Inter', sans-serif; font-size: 10px; font-weight: 700;
    padding: 2px 8px; border-radius: 999px;
    text-transform: uppercase; letter-spacing: 0.06em;
  }
  .sbt-title {
    font-size: 28px; font-weight: 700; letter-spacing: -0.02em;
    background: linear-gradient(to right, #fff, #94a3b8);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
    line-height: 1.15;
  }
  .sbt-subtitle {
    color: var(--slate-400); font-size: 13px;
    max-width: 320px; line-height: 1.6; margin-top: 2px;
  }

  /* ── Concentric score ring ── */
  .sbt-score-section {
    display: flex; flex-direction: column; align-items: center;
    padding: 24px 20px 0;
    animation: sbtFadeUp 0.5s ease 0.1s both; opacity: 0;
  }
  .sbt-ring-wrap {
    position: relative; width: 256px; height: 256px;
    display: flex; align-items: center; justify-content: center;
  }
  .concentric-svg { transform: rotate(-90deg); }
  .sbt-score-center {
    position: absolute; display: flex; flex-direction: column; align-items: center;
    z-index: 10;
  }
  .sbt-score-num {
    font-size: 52px; font-weight: 900; color: #fff; line-height: 1;
  }
  .sbt-score-label {
    font-size: 11px; font-weight: 500; text-transform: uppercase;
    letter-spacing: 0.12em; color: var(--slate-500); margin-top: 4px;
  }

  /* ── Score breakdown list ── */
  .sbt-breakdown-list {
    width: 100%; margin-top: 28px;
    display: flex; flex-direction: column; gap: 10px;
  }
  .sbt-breakdown-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 16px; border-radius: 12px;
  }
  .sbt-breakdown-row.dim { opacity: 0.6; }
  .sbt-breakdown-left {
    display: flex; align-items: center; gap: 10px;
    font-size: 14px; font-weight: 500;
  }
  .sbt-dot {
    width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
  }
  .sbt-breakdown-val {
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px; font-weight: 500;
  }
  .sbt-breakdown-val.filled { color: var(--primary); }
  .sbt-breakdown-val.empty  { color: var(--slate-400); }

  /* ── Progress bar variant ── */
  .sbt-bar-label-row {
    display: flex; justify-content: space-between;
    font-size: 13px; margin-bottom: 5px;
  }
  .sbt-bar-label-row span:first-child { color: var(--slate-300); }
  .sbt-bar-label-row span:last-child  { font-family: 'JetBrains Mono', monospace; color: #fff; }
  .sbt-bar-track {
    width: 100%; height: 10px; border-radius: 999px;
    background: #374151; overflow: hidden; margin-bottom: 12px;
  }
  .sbt-bar-fill {
    height: 100%; border-radius: 999px;
    transition: width 0.7s ease-out;
  }
  .sbt-breakdown-total {
    display: flex; justify-content: space-between;
    padding-top: 12px; margin-top: 4px;
    border-top: 1px solid var(--slate-800);
    font-size: 14px;
  }
  .sbt-breakdown-total span:first-child { color: var(--slate-300); font-weight: 500; }
  .sbt-breakdown-total span:last-child  {
    font-family: 'JetBrains Mono', monospace; font-weight: 700; color: #fff;
  }

  /* ── What is SBT card ── */
  .sbt-info-card {
    margin: 24px 20px 0; border-radius: 20px; padding: 24px;
    position: relative; overflow: hidden;
    animation: sbtFadeUp 0.5s ease 0.2s both; opacity: 0;
  }
  .sbt-info-glow {
    position: absolute; top: -40px; right: -40px;
    width: 128px; height: 128px;
    background: rgba(124,58,237,0.1); border-radius: 50%; filter: blur(40px);
    pointer-events: none; transition: background 0.3s;
  }
  .sbt-info-card:hover .sbt-info-glow { background: rgba(124,58,237,0.2); }
  .sbt-info-title {
    font-size: 17px; font-weight: 700; margin-bottom: 16px;
    display: flex; align-items: center; gap: 8px;
  }
  .sbt-info-title .icon { color: var(--accent); font-size: 20px; }
  .sbt-info-list { display: flex; flex-direction: column; gap: 14px; }
  .sbt-info-item {
    display: flex; align-items: flex-start; gap: 10px; font-size: 13px;
  }
  .sbt-info-item .check { color: var(--success); font-size: 18px; flex-shrink: 0; }
  .sbt-info-item span { color: var(--slate-300); line-height: 1.55; }
  .sbt-info-item strong { color: #fff; font-weight: 500; }

  /* ── Code block ── */
  .sbt-code-section {
    margin: 24px 20px 0;
    animation: sbtFadeUp 0.5s ease 0.25s both; opacity: 0;
  }
  .sbt-code-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 4px; margin-bottom: 10px;
  }
  .sbt-code-head-label {
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.18em; color: var(--slate-500);
  }
  .sbt-code-version {
    font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #4b5563;
  }
  .sbt-code-block {
    background: rgba(0,0,0,0.8); border: 1px solid var(--slate-800);
    border-radius: 12px; padding: 20px;
    font-family: 'JetBrains Mono', monospace; font-size: 13px; line-height: 1.7;
  }
  .sbt-code-dots { display: flex; gap: 6px; margin-bottom: 16px; }
  .sbt-code-dot { width: 10px; height: 10px; border-radius: 50%; }
  .sbt-code-line { display: flex; gap: 8px; }
  .sbt-code-divider { height: 1px; background: var(--slate-800); width: 64px; margin: 12px 0; }
  .sbt-code-total { color: #fff; font-weight: 700; }

  /* ── Technical details ── */
  .sbt-tech-section {
    margin: 24px 20px 0;
    animation: sbtFadeUp 0.5s ease 0.3s both; opacity: 0;
  }
  .sbt-tech-title {
    font-size: 17px; font-weight: 700; margin-bottom: 12px;
  }
  .sbt-tech-grid { display: flex; flex-direction: column; gap: 10px; }
  .sbt-tech-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 14px 16px; border-radius: 12px;
    background: rgba(15,23,42,0.4); border: 1px solid var(--slate-800);
  }
  .sbt-tech-key {
    font-size: 12px; font-weight: 500; color: var(--slate-500);
  }
  .sbt-tech-val {
    font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--slate-300);
  }
  .sbt-tech-val.red   { color: rgba(248,113,113,0.8); }
  .sbt-tech-val.green { color: var(--success); }

  /* ── Raw URI toggle ── */
  .sbt-raw-toggle {
    background: none; border: none; cursor: pointer;
    font-size: 13px; color: #a855f7;
    display: flex; align-items: center; gap: 4px;
    padding: 0; transition: color 0.18s;
  }
  .sbt-raw-toggle:hover { color: #c084fc; }
  .sbt-raw-box {
    margin-top: 10px; background: #1f2937;
    border-radius: 10px; padding: 12px; overflow-x: auto;
  }
  .sbt-raw-hint { font-size: 11px; color: var(--slate-500); margin-bottom: 6px; }
  .sbt-raw-code {
    font-family: 'JetBrains Mono', monospace; font-size: 11px;
    color: #4ade80; word-break: break-all; line-height: 1.6;
  }

  /* ── Quote block ── */
  .sbt-quote {
    background: rgba(30,41,59,0.5); border: 1px solid var(--slate-800);
    border-radius: 10px; padding: 16px; margin-bottom: 20px;
  }
  .sbt-quote p {
    font-size: 13px; color: var(--slate-300); font-style: italic; line-height: 1.7;
  }

  /* ── Alerts ── */
  .sbt-alert {
    margin-bottom: 14px; padding: 12px 14px;
    border-radius: 10px; font-size: 13px;
  }
  .sbt-alert-err   { background: rgba(127,29,29,0.3); border: 1px solid #b91c1c; color: #fca5a5; }
  .sbt-alert-success { background: rgba(6,78,59,0.3); border: 1px solid #065f46; color: #6ee7b7; }

  /* ── Connect prompt ── */
  .sbt-connect {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 12px; padding: 48px 24px; text-align: center;
    background: rgba(30,41,59,0.5); backdrop-filter: blur(12px);
    border: 1px solid var(--border); border-radius: 20px;
    margin: 20px;
  }
  .sbt-connect p { font-size: 14px; color: var(--slate-400); }

  /* ── Loading skeleton ── */
  .sbt-skel-row {
    height: 16px; border-radius: 6px;
    background: rgba(255,255,255,0.06);
    animation: sbtShimmer 1.6s ease infinite;
  }
  @keyframes sbtShimmer {
    0%,100%{opacity:0.4} 50%{opacity:0.8}
  }

  /* ── Bottom CTA bar ── */
  .sbt-cta-bar {
    padding: 24px 20px 20px;
    background: linear-gradient(to top, var(--bg) 75%, transparent);
  }
  .sbt-btn-mint {
    width: 100%; padding: 16px;
    background: linear-gradient(to right, var(--primary), var(--accent));
    color: #fff; font-family: 'Inter', sans-serif;
    font-size: 15px; font-weight: 700;
    border: none; border-radius: 16px; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    box-shadow: 0 4px 20px rgba(124,58,237,0.25);
    transition: filter 0.2s, transform 0.15s;
  }
  .sbt-btn-mint:hover  { filter: brightness(1.08); }
  .sbt-btn-mint:active { transform: scale(0.98); }
  .sbt-btn-mint:disabled {
    background: #374151; color: #6b7280; cursor: not-allowed;
    box-shadow: none; filter: none;
  }
  .sbt-btn-update {
    width: 100%; padding: 12px 16px;
    background: var(--primary); color: #fff;
    font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 500;
    border: none; border-radius: 12px; cursor: pointer;
    transition: background 0.18s;
  }
  .sbt-btn-update:hover    { background: #6d28d9; }
  .sbt-btn-update:disabled { background: #374151; color: #6b7280; cursor: not-allowed; }
  .sbt-cta-note {
    text-align: center; font-size: 10px; color: var(--slate-500);
    font-family: 'Inter', sans-serif; font-weight: 500;
    text-transform: uppercase; letter-spacing: 0.08em; margin-top: 10px;
  }

  /* ── Spin ── */
  @keyframes spin { to { transform: rotate(360deg); } }
  .spin { display: inline-block; animation: spin 0.8s linear infinite; }

  /* ── Animations ── */
  @keyframes sbtFadeUp {
    from { opacity:0; transform:translateY(14px); }
    to   { opacity:1; transform:translateY(0); }
  }
  .sbt-section-pad { padding: 0 20px; margin-top: 24px; }
`;

/* ─────────── Sub-components ─────────── */

const TrustScoreBar: React.FC<{
  label: string;
  value: number;
  max: number;
  color: string;
}> = ({ label, value, max, color }) => (
  <div>
    <div className="sbt-bar-label-row">
      <span>{label}</span>
      <span>
        +{value}/{max}
      </span>
    </div>
    <div className="sbt-bar-track">
      <div
        className="sbt-bar-fill"
        style={{ width: `${(value / max) * 100}%`, backgroundColor: color }}
      />
    </div>
  </div>
);

const VerificationBadge: React.FC<{ level: number }> = ({ level }) => {
  const name = levelToString(level);
  const color = levelToColor(level);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 12px",
        borderRadius: 999,
        border: `1px solid ${color}`,
        color,
        fontFamily: "'Inter', sans-serif",
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: color,
          display: "inline-block",
        }}
      />
      {name}
    </span>
  );
};

/* Concentric SVG ring */
const ConcentricRings: React.FC<{
  walletPct: number;
  votingPct: number;
  daoPct: number;
  score: number;
}> = ({ walletPct, votingPct, daoPct, score }) => {
  const r1 = 45,
    r2 = 37,
    r3 = 29;
  const circ = (r: number) => 2 * Math.PI * r;
  const offset = (r: number, pct: number) => circ(r) * (1 - pct);

  return (
    <div className="sbt-ring-wrap">
      <svg
        className="concentric-svg"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
        }}
        viewBox="0 0 100 100"
      >
        {/* track rings */}
        <circle
          cx="50"
          cy="50"
          r={r1}
          fill="transparent"
          stroke="#1e293b"
          strokeWidth="4"
        />
        <circle
          cx="50"
          cy="50"
          r={r2}
          fill="transparent"
          stroke="#1e293b"
          strokeWidth="4"
        />
        <circle
          cx="50"
          cy="50"
          r={r3}
          fill="transparent"
          stroke="#1e293b"
          strokeWidth="4"
        />
        {/* filled rings */}
        <circle
          cx="50"
          cy="50"
          r={r1}
          fill="transparent"
          stroke="#7C3AED"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circ(r1)}
          strokeDashoffset={offset(r1, walletPct)}
          style={{ transition: "stroke-dashoffset 0.9s ease" }}
        />
        <circle
          cx="50"
          cy="50"
          r={r2}
          fill="transparent"
          stroke="rgba(167,139,250,0.6)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circ(r2)}
          strokeDashoffset={offset(r2, votingPct)}
          style={{ transition: "stroke-dashoffset 0.9s ease 0.15s" }}
        />
        <circle
          cx="50"
          cy="50"
          r={r3}
          fill="transparent"
          stroke="rgba(99,102,241,0.4)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circ(r3)}
          strokeDashoffset={offset(r3, daoPct)}
          style={{ transition: "stroke-dashoffset 0.9s ease 0.3s" }}
        />
      </svg>
      <div className="sbt-score-center">
        <span className="sbt-score-num">{score}</span>
        <span className="sbt-score-label">Trust Score</span>
      </div>
    </div>
  );
};

/* ─────────────────── Main Component ─────────────────── */
const SoulboundToken: React.FC = () => {
  const [profile, setProfile] = useState<SBTProfile | null>(null);
  const [liveBreakdown, setLiveBreakdown] = useState<TrustBreakdown | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [minting, setMinting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showRawURI, setShowRawURI] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  const loadSBTData = useCallback(async (address: string) => {
    setLoading(true);
    setError(null);
    try {
      const [sbtProfile, breakdown] = await Promise.all([
        getSBTProfile(address),
        computeLiveTrustScore(address),
      ]);
      setProfile(sbtProfile);
      setLiveBreakdown(breakdown);
    } catch (err) {
      setError("Failed to load SBT data. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const addr = walletConnector.address;
    if (addr) {
      setWalletAddress(addr);
      loadSBTData(addr);
    } else setLoading(false);
  }, [loadSBTData]);

  useEffect(() => {
    const cleanupMint = onSBTMinted((to, _tokenId) => {
      if (walletAddress && to.toLowerCase() === walletAddress.toLowerCase())
        loadSBTData(walletAddress);
    });
    const cleanupUpdate = onMetadataUpdated(() => {
      if (walletAddress) loadSBTData(walletAddress);
    });
    return () => {
      cleanupMint();
      cleanupUpdate();
    };
  }, [walletAddress, loadSBTData]);

  const handleMint = async () => {
    if (!walletAddress) return;
    setMinting(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await mintSBT();
      if (result.success) {
        setSuccess(`SBT minted! TX: ${result.txHash?.slice(0, 10)}...`);
        await loadSBTData(walletAddress);
      } else setError(result.error || "Minting failed");
    } catch (err: any) {
      setError(err?.message || "Minting failed");
    } finally {
      setMinting(false);
    }
  };

  const handleUpdate = async () => {
    if (!walletAddress) return;
    setUpdating(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await updateSBT();
      if (result.success) {
        setSuccess(`SBT updated! TX: ${result.txHash?.slice(0, 10)}...`);
        await loadSBTData(walletAddress);
      } else setError(result.error || "Update failed");
    } catch (err: any) {
      setError(err?.message || "Update failed");
    } finally {
      setUpdating(false);
    }
  };

  const breakdown = profile?.hasSBT ? profile.trustBreakdown : liveBreakdown;

  /* ── Loading ── */
  if (loading)
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div
          className="sbt-root"
          style={{
            padding: "32px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div className="sbt-skel-row" style={{ width: "55%", height: 24 }} />
          <div className="sbt-skel-row" style={{ width: "80%" }} />
          <div className="sbt-skel-row" style={{ width: "65%" }} />
          <div
            style={{
              width: 192,
              height: 192,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.04)",
              margin: "20px auto",
              animation: "sbtShimmer 1.6s ease infinite",
            }}
          />
        </div>
      </>
    );

  /* ── No wallet ── */
  if (!walletAddress)
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="sbt-root">
          <div className="sbt-connect">
            <span style={{ fontSize: 40 }}>🔗</span>
            <p>Connect your wallet to view your Soulbound Token</p>
          </div>
        </div>
      </>
    );

  /* ── Ring percentages ── */
  const walletPct = breakdown ? breakdown.walletHistory / 40 : 0;
  const votingPct = breakdown ? breakdown.votingAccuracy / 30 : 0;
  const daoPct = breakdown ? breakdown.daoParticipation / 30 : 0;
  const displayScore = breakdown?.total ?? profile?.metadata?.trustScore ?? 0;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="sbt-root">
        {/* ── Hero header ── */}
        <div className="sbt-header">
          <div className="sbt-avatar-wrap">
            <div className="sbt-avatar glow-purple">
              <span className="material-icons-round sbt-avatar-shield pulse-slow">
                shield
              </span>
            </div>
            <span className="sbt-onchain-badge">On-Chain</span>
          </div>
          <div>
            <h1 className="sbt-title">Soulbound Token</h1>
            <p className="sbt-subtitle">
              Your permanent on-chain reputation. Non-transferable, immutable,
              and verifiable.
            </p>
          </div>
          {profile?.hasSBT && profile.metadata && (
            <VerificationBadge level={profile.metadata.verificationLevel} />
          )}
        </div>

        {/* ── Trust score rings ── */}
        <div className="sbt-score-section">
          <ConcentricRings
            walletPct={walletPct}
            votingPct={votingPct}
            daoPct={daoPct}
            score={displayScore}
          />

          {/* Breakdown rows (glass cards) */}
          <div className="sbt-breakdown-list">
            {error && <div className="sbt-alert sbt-alert-err">{error}</div>}
            {success && (
              <div className="sbt-alert sbt-alert-success">{success}</div>
            )}

            <div
              className={`sbt-breakdown-row glass-card${breakdown && breakdown.walletHistory > 0 ? "" : " dim"}`}
              style={{ borderRadius: 12 }}
            >
              <div className="sbt-breakdown-left">
                <div className="sbt-dot" style={{ background: "#7C3AED" }} />
                <span>Wallet History</span>
              </div>
              <span
                className={`sbt-breakdown-val${breakdown && breakdown.walletHistory > 0 ? " filled" : " empty"}`}
              >
                +{breakdown?.walletHistory ?? 0}/40
              </span>
            </div>

            <div
              className={`sbt-breakdown-row glass-card${breakdown && breakdown.votingAccuracy > 0 ? "" : " dim"}`}
              style={{ borderRadius: 12 }}
            >
              <div className="sbt-breakdown-left">
                <div className="sbt-dot" style={{ background: "#A78BFA" }} />
                <span>DAO Voting Accuracy</span>
              </div>
              <span
                className={`sbt-breakdown-val${breakdown && breakdown.votingAccuracy > 0 ? " filled" : " empty"}`}
              >
                +{breakdown?.votingAccuracy ?? 0}/30
              </span>
            </div>

            <div
              className={`sbt-breakdown-row glass-card${breakdown && breakdown.daoParticipation > 0 ? "" : " dim"}`}
              style={{ borderRadius: 12 }}
            >
              <div className="sbt-breakdown-left">
                <div className="sbt-dot" style={{ background: "#6366f1" }} />
                <span>DAO Participation</span>
              </div>
              <span
                className={`sbt-breakdown-val${breakdown && breakdown.daoParticipation > 0 ? " filled" : " empty"}`}
              >
                +{breakdown?.daoParticipation ?? 0}/30
              </span>
            </div>
          </div>
        </div>

        {/* ── What is SBT card ── */}
        <div className="sbt-info-card glass-card">
          <div className="sbt-info-glow" />
          <div className="sbt-info-title">
            <span className="material-icons-round icon">help_outline</span>
            What is a Soulbound Token?
          </div>
          <div className="sbt-info-list">
            <div className="sbt-info-item">
              <span className="material-icons-round check">check_circle</span>
              <span>
                <strong>Non-transferable</strong> — permanently bound to your
                wallet.
              </span>
            </div>
            <div className="sbt-info-item">
              <span className="material-icons-round check">check_circle</span>
              <span>
                <strong>Fully on-chain</strong> — Base64 JSON, no server
                dependencies.
              </span>
            </div>
            <div className="sbt-info-item">
              <span className="material-icons-round check">check_circle</span>
              <span>
                <strong>Trust score</strong> — computed from wallet history +
                DAO activity.
              </span>
            </div>
            <div className="sbt-info-item">
              <span className="material-icons-round check">check_circle</span>
              <span>
                <strong>Updatable</strong> — your score evolves as you
                participate.
              </span>
            </div>
          </div>
        </div>

        {/* ── Computation logic code block ── */}
        <div className="sbt-code-section">
          <div className="sbt-code-head">
            <span className="sbt-code-head-label">Computation Logic</span>
            <span className="sbt-code-version">v1.0.4-stable</span>
          </div>
          <div className="sbt-code-block glow-purple">
            <div className="sbt-code-dots">
              <div
                className="sbt-code-dot"
                style={{ background: "rgba(239,68,68,0.5)" }}
              />
              <div
                className="sbt-code-dot"
                style={{ background: "rgba(234,179,8,0.5)" }}
              />
              <div
                className="sbt-code-dot"
                style={{ background: "rgba(34,197,94,0.5)" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div className="sbt-code-line">
                <span style={{ color: "#a855f7" }}>+40</span>
                <span style={{ color: "#94a3b8" }}>
                  Are you a verified human?
                </span>
              </div>
              <div className="sbt-code-line">
                <span style={{ color: "#60a5fa" }}>+20</span>
                <span style={{ color: "#94a3b8" }}>Do you have history?</span>
              </div>
              <div className="sbt-code-line">
                <span style={{ color: "#4ade80" }}>+20</span>
                <span style={{ color: "#94a3b8" }}>Do you vote correctly?</span>
              </div>
              <div className="sbt-code-line">
                <span style={{ color: "#fb923c" }}>+20</span>
                <span style={{ color: "#94a3b8" }}>Do you participate?</span>
              </div>
              <div className="sbt-code-divider" />
              <div className="sbt-code-total">
                <span style={{ color: "#94a3b8" }}>TOTAL: </span>100 SBT Score
              </div>
            </div>
          </div>
        </div>

        {/* ── SBT exists: extra details ── */}
        {profile?.hasSBT && profile.metadata && (
          <>
            {/* Technical details */}
            <div className="sbt-tech-section">
              <h3 className="sbt-tech-title">Technical Details</h3>
              <div className="sbt-tech-grid">
                <div className="sbt-tech-row">
                  <span className="sbt-tech-key">Standard</span>
                  <span className="sbt-tech-val">ERC-721 (SBT)</span>
                </div>
                <div className="sbt-tech-row">
                  <span className="sbt-tech-key">Transfer Behavior</span>
                  <span className="sbt-tech-val red">revert("SBT_LOCKED")</span>
                </div>
                <div className="sbt-tech-row">
                  <span className="sbt-tech-key">Metadata</span>
                  <span className="sbt-tech-val green">
                    On-chain Base64 JSON
                  </span>
                </div>
                <div className="sbt-tech-row">
                  <span className="sbt-tech-key">Network</span>
                  <span className="sbt-tech-val">Monad Testnet</span>
                </div>
                {profile.tokenId !== undefined && (
                  <div className="sbt-tech-row">
                    <span className="sbt-tech-key">Token ID</span>
                    <span className="sbt-tech-val">#{profile.tokenId}</span>
                  </div>
                )}
                <div className="sbt-tech-row">
                  <span className="sbt-tech-key">Voting Accuracy</span>
                  <span className="sbt-tech-val">
                    {profile.metadata.votingAccuracy}%
                  </span>
                </div>
                <div className="sbt-tech-row">
                  <span className="sbt-tech-key">DAO Votes Cast</span>
                  <span className="sbt-tech-val">
                    {profile.metadata.doiParticipation}
                  </span>
                </div>
                <div className="sbt-tech-row">
                  <span className="sbt-tech-key">Issued At</span>
                  <span className="sbt-tech-val">
                    {new Date(
                      profile.metadata.issuedAt * 1000,
                    ).toLocaleDateString()}
                  </span>
                </div>
                <div className="sbt-tech-row">
                  <span className="sbt-tech-key">Contract</span>
                  <span className="sbt-tech-val green">
                    {import.meta.env.VITE_CIVIC_SBT_ADDRESS?.slice(0, 10)}...
                  </span>
                </div>
              </div>
            </div>

            {/* Raw token URI */}
            <div className="sbt-section-pad">
              <button
                className="sbt-raw-toggle"
                onClick={() => setShowRawURI(!showRawURI)}
              >
                {showRawURI ? "▾" : "▸"} View Raw On-Chain Token URI
                <span style={{ marginLeft: 4, fontSize: 11, color: "#4b5563" }}>
                  (eth_call → tokenURI)
                </span>
              </button>
              {showRawURI && profile.tokenURI && (
                <div className="sbt-raw-box">
                  <p className="sbt-raw-hint">
                    Read directly from contract via tokenURI(
                    {profile.tokenId ?? "?"}) — fully on-chain Base64 JSON, no
                    IPFS, no server
                  </p>
                  <code className="sbt-raw-code">{profile.tokenURI}</code>
                </div>
              )}
            </div>

            {/* Quote */}
            <div className="sbt-section-pad">
              <div className="sbt-quote">
                <p>
                  "In Web2, your reputation lives on a server someone else owns.
                  They can delete it. They can sell it. In NeuroShield, your
                  reputation is permanently encoded on-chain, bound to your
                  wallet forever, impossible to transfer, impossible to fake,
                  impossible to take down."
                </p>
              </div>
            </div>

            {/* Update button */}
            <div className="sbt-section-pad">
              <button
                className="sbt-btn-update"
                onClick={handleUpdate}
                disabled={updating}
              >
                {updating ? (
                  <>
                    <span className="spin">⟳</span> Refreshing On-Chain Score...
                  </>
                ) : (
                  "Refresh Trust Score On-Chain"
                )}
              </button>
            </div>
          </>
        )}

        {/* ── Bottom CTA ── */}
        <div className="sbt-cta-bar" style={{ marginTop: 32 }}>
          <button
            className="sbt-btn-mint"
            onClick={profile?.hasSBT ? handleUpdate : handleMint}
            disabled={minting || updating}
          >
            <span className="material-icons-round" style={{ fontSize: 20 }}>
              auto_fix_high
            </span>
            {minting || updating ? (
              <>
                <span className="spin">⟳</span>{" "}
                {profile?.hasSBT ? "Updating..." : "Minting SBT On-Chain..."}
              </>
            ) : profile?.hasSBT ? (
              "Refresh Trust Score On-Chain"
            ) : (
              "Mint Your Soulbound Token"
            )}
          </button>
          <p className="sbt-cta-note">
            Requires MON for gas — score computed entirely on-chain
          </p>
        </div>
      </div>
    </>
  );
};

export default SoulboundToken;
