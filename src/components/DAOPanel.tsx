import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  Clock,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ExternalLink,
  Shield,
  Gavel,
} from "lucide-react";
import QuadraticVoteInput from "../QuadraticVoteInput";
import { useToast } from "@/hooks/use-toast";
import { type ToastActionElement } from "@/components/ui/toast";
import contractService from "@/web3/contract";
import walletConnector from "@/web3/wallet";
import { shortenAddress } from "@/web3/utils";

/* ─────────────────────────────────────────────
   CSS — Black Theme / Shield DAO design system
   Matches: #000 bg, JetBrains Mono, neon-green/red
───────────────────────────────────────────── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@300;400;500;600;700&display=swap');

  :root {
    --black:      #000000;
    --deep:       #050505;
    --border:     #1a1a1a;
    --card-bg:    #050505;
    --neon-green: #00ff66;
    --neon-red:   #ff0033;
    --zinc-400:   rgba(255,255,255,0.6);
    --zinc-500:   rgba(255,255,255,0.4);
    --zinc-600:   rgba(255,255,255,0.25);
    --zinc-800:   rgba(255,255,255,0.08);
  }

  /* ── Root wrapper ── */
  .dao-root {
    display: flex;
    flex-direction: column;
    gap: 16px;
    background: var(--black);
    color: #fff;
    font-family: 'Inter', sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  /* ── Stat strip ── */
  .dao-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .dao-stat-cell {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    animation: daoFadeUp 0.4s ease both;
  }
  .dao-stat-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--zinc-500);
    margin-bottom: 4px;
  }
  .dao-stat-val {
    font-family: 'JetBrains Mono', monospace;
    font-size: 18px;
    font-weight: 700;
    color: #fff;
    line-height: 1;
  }
  .dao-stat-val.green { color: var(--neon-green); }
  .dao-stat-unit {
    font-family: 'JetBrains Mono', monospace;
    font-size: 8px;
    color: var(--zinc-600);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-top: 2px;
  }

  /* ── Section heading ── */
  .dao-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 2px;
    animation: daoFadeUp 0.4s ease 0.1s both;
  }
  .dao-heading-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: var(--zinc-500);
  }
  .dao-heading-live {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: var(--neon-green);
  }

  /* ── Alert bar ── */
  .dao-alert {
    padding: 12px 16px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: 'Inter', sans-serif;
    font-size: 12px;
    animation: daoFadeUp 0.4s ease 0.1s both;
  }
  .dao-alert-err  {
    background: rgba(255,0,51,0.06);
    border: 1px solid rgba(255,0,51,0.2);
    color: var(--neon-red);
  }
  .dao-alert-info {
    background: rgba(0,255,102,0.04);
    border: 1px solid rgba(0,255,102,0.15);
    color: var(--neon-green);
  }

  /* ── Empty state ── */
  .dao-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 52px 24px;
    text-align: center;
    border-radius: 16px;
    border: 1px solid var(--border);
    background: var(--card-bg);
    animation: daoFadeUp 0.4s ease 0.15s both;
  }
  .dao-empty-icon {
    width: 52px; height: 52px;
    border-radius: 14px;
    display: flex; align-items: center; justify-content: center;
    background: rgba(255,170,0,0.08);
    border: 1px solid rgba(255,170,0,0.2);
  }
  .dao-empty h3 {
    font-family: 'JetBrains Mono', monospace;
    font-size: 16px; font-weight: 700;
    color: #fff; text-transform: uppercase; letter-spacing: 0.06em;
  }
  .dao-empty p {
    font-family: 'Inter', sans-serif; font-size: 13px;
    color: var(--zinc-500); max-width: 340px; line-height: 1.6;
  }
  .dao-btn-primary {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 12px 28px; border-radius: 8px;
    background: var(--neon-green); color: #000;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.12em;
    border: none; cursor: pointer;
    transition: filter 0.18s;
  }
  .dao-btn-primary:hover { filter: brightness(0.88); }

  /* ── Proposal card ── */
  .dao-proposal {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 16px;
    overflow: hidden;
    opacity: 0;
    animation: daoSlideIn 0.45s ease forwards;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .dao-proposal:hover {
    border-color: rgba(0,255,102,0.2);
    box-shadow: 0 0 24px rgba(0,255,102,0.04);
  }
  .dao-proposal.risk-high { border-color: rgba(255,0,51,0.18); }
  .dao-proposal.risk-high:hover { border-color: rgba(255,0,51,0.35); }

  .dao-proposal-header { padding: 22px 24px 0; }

  .dao-proposal-top {
    display: flex; justify-content: space-between; align-items: flex-start;
    gap: 12px; margin-bottom: 10px;
  }
  .dao-proposal-id-block {}
  .dao-proposal-mono {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px; color: var(--zinc-600);
    margin-bottom: 4px;
  }
  .dao-proposal-mono.red { color: var(--neon-red); }
  .dao-proposal-title {
    font-family: 'Inter', sans-serif;
    font-size: 16px; font-weight: 700;
    color: #fff; text-transform: uppercase;
    letter-spacing: -0.01em; line-height: 1.2;
  }

  /* status badges */
  .dao-badge {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 3px 10px; border-radius: 4px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase;
    white-space: nowrap;
  }
  .dao-badge-active   { color: var(--neon-green); border: 1px solid rgba(0,255,102,0.3); background: rgba(0,255,102,0.05); }
  .dao-badge-approved { color: #4ade80; border: 1px solid rgba(74,222,128,0.3); background: rgba(74,222,128,0.05); }
  .dao-badge-rejected { color: var(--neon-red); border: 1px solid rgba(255,0,51,0.3); background: rgba(255,0,51,0.05); }
  .dao-badge-highrisk { color: var(--neon-red); border: 1px solid rgba(255,0,51,0.3); background: rgba(255,0,51,0.05); }

  /* category + time chips */
  .dao-tags { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 10px; margin-bottom: 0; }
  .dao-tag {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 2px 8px; border-radius: 4px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px; font-weight: 500;
    letter-spacing: 0.06em; text-transform: uppercase;
    background: var(--zinc-800);
    border: 1px solid var(--border);
    color: var(--zinc-500);
  }
  .dao-tag-nft     { color: #c084fc; background: rgba(192,132,252,0.06); border-color: rgba(192,132,252,0.18); }
  .dao-tag-defi    { color: #60a5fa; background: rgba(96,165,250,0.06);  border-color: rgba(96,165,250,0.18); }
  .dao-tag-phish   { color: #fb923c; background: rgba(251,146,60,0.06);  border-color: rgba(251,146,60,0.18); }
  .dao-tag-malware { color: var(--neon-red); background: rgba(255,0,51,0.06); border-color: rgba(255,0,51,0.18); }
  .dao-tag-honey   { color: #fbbf24; background: rgba(251,191,36,0.06);  border-color: rgba(251,191,36,0.18); }
  .dao-tag-airdrop { color: #4ade80; background: rgba(74,222,128,0.06);  border-color: rgba(74,222,128,0.18); }
  .dao-tag-hack    { color: #f472b6; background: rgba(244,114,182,0.06); border-color: rgba(244,114,182,0.18); }

  /* Description */
  .dao-desc {
    padding: 14px 24px;
    font-size: 12px; color: var(--zinc-400);
    line-height: 1.65;
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    margin-top: 14px;
  }

  /* Evidence link */
  .dao-evidence {
    display: inline-flex; align-items: center; gap: 5px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px; color: var(--neon-green);
    text-decoration: none;
    padding: 10px 24px;
    transition: opacity 0.18s;
    border-bottom: 1px solid var(--border);
  }
  .dao-evidence:hover { opacity: 0.65; }

  /* Vote power row */
  .dao-vote-power {
    display: flex; align-items: center; gap: 20px;
    padding: 14px 24px;
    font-family: 'JetBrains Mono', monospace; font-size: 10px;
  }
  .dao-vote-for    { display: flex; align-items: center; gap: 6px; color: var(--neon-green); }
  .dao-vote-against { display: flex; align-items: center; gap: 6px; color: var(--neon-red); }

  /* Vote bar */
  .dao-bar-wrap { padding: 0 24px 4px; }
  .dao-bar-track {
    height: 3px; border-radius: 99px;
    background: rgba(255,255,255,0.06); overflow: hidden; position: relative;
  }
  .dao-bar-for {
    position: absolute; left: 0; top: 0; height: 100%; border-radius: 99px;
    background: var(--neon-green);
    transition: width 0.8s cubic-bezier(.22,.68,0,1.2);
  }
  .dao-bar-against {
    position: absolute; right: 0; top: 0; height: 100%; border-radius: 99px;
    background: var(--neon-red);
    transition: width 0.8s cubic-bezier(.22,.68,0,1.2);
  }

  /* Participants row */
  .dao-participants {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 24px 14px;
    font-family: 'JetBrains Mono', monospace; font-size: 9px; color: var(--zinc-600);
  }
  .dao-avatars { display: flex; }
  .dao-avatar {
    width: 22px; height: 22px; border-radius: 50%;
    border: 1px solid var(--black);
    background: var(--border);
    display: flex; align-items: center; justify-content: center;
    font-size: 7px; font-weight: 700;
    margin-left: -6px;
  }
  .dao-avatar:first-child { margin-left: 0; }

  /* Vote input area */
  .dao-vote-section {
    padding: 0 24px 20px;
    border-top: 1px solid var(--border);
  }

  /* ── Skeleton ── */
  .dao-skel {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 24px;
    display: flex; flex-direction: column; gap: 12px;
  }
  .dao-skel-bar {
    height: 12px; border-radius: 4px;
    background: rgba(255,255,255,0.04);
    animation: daoShimmer 1.6s ease infinite;
  }
  @keyframes daoShimmer {
    0%,100%{opacity:0.4} 50%{opacity:0.8}
  }

  /* ── Animations ── */
  @keyframes daoFadeUp {
    from { opacity:0; transform:translateY(12px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes daoSlideIn {
    from { opacity:0; transform:translateY(18px) scale(0.985); }
    to   { opacity:1; transform:translateY(0) scale(1); }
  }

  .dao-d0{animation-delay:.05s} .dao-d1{animation-delay:.15s}
  .dao-d2{animation-delay:.25s} .dao-d3{animation-delay:.35s}
  .dao-d4{animation-delay:.45s} .dao-d5{animation-delay:.55s}

  @media(max-width:540px){
    .dao-stats { grid-template-columns:1fr; gap:6px; }
  }
`;

/* ─────────── Types ─────────── */
interface ScamReport {
  id: number;
  reporter: string;
  suspiciousAddress: string;
  description: string;
  evidence: string;
  timestamp: Date;
  votesFor: string;
  votesAgainst: string;
  status: "active" | "approved" | "rejected";
  category?: string;
}

type ToastProps = {
  title: string;
  description: string;
  variant?: "default" | "destructive";
  action?: ToastActionElement;
};

/* ─────────── Helpers ─────────── */
const getCategoryFromDescription = (desc: string): string => {
  const d = desc.toLowerCase();
  if (d.includes("nft")) return "NFT Scam";
  if (d.includes("defi") || d.includes("liquidity")) return "DeFi Attack";
  if (d.includes("phish")) return "Phishing";
  if (d.includes("malware")) return "Malware";
  if (d.includes("honeypot")) return "Honeypot";
  if (d.includes("airdrop")) return "Airdrop Scam";
  if (d.includes("hack")) return "Protocol Hack";
  return "Other";
};

const categoryTagClass: Record<string, string> = {
  "NFT Scam": "dao-tag dao-tag-nft",
  "DeFi Attack": "dao-tag dao-tag-defi",
  Phishing: "dao-tag dao-tag-phish",
  Malware: "dao-tag dao-tag-malware",
  Honeypot: "dao-tag dao-tag-honey",
  "Airdrop Scam": "dao-tag dao-tag-airdrop",
  "Protocol Hack": "dao-tag dao-tag-hack",
  Other: "dao-tag",
};

const StatusBadge = ({ status }: { status: string }) => {
  const cls =
    status === "approved"
      ? "dao-badge dao-badge-approved"
      : status === "rejected"
        ? "dao-badge dao-badge-rejected"
        : "dao-badge dao-badge-active";
  const label =
    status === "approved"
      ? "APPROVED"
      : status === "rejected"
        ? "REJECTED"
        : "ACTIVE";
  return <span className={cls}>{label}</span>;
};

/* ─────────── Empty ─────────── */
const EmptyState = ({
  onNavigateToReports,
}: {
  onNavigateToReports?: () => void;
}) => (
  <div className="dao-empty">
    <div className="dao-empty-icon">
      <AlertTriangle style={{ width: 22, height: 22, color: "#fbbf24" }} />
    </div>
    <h3>No Active Proposals</h3>
    <p>
      Help secure the community by being the first to report suspicious
      activity. Your report will be voted on by SHIELD token holders using
      quadratic voting.
    </p>
    <button className="dao-btn-primary" onClick={() => onNavigateToReports?.()}>
      <Gavel style={{ width: 13, height: 13 }} />
      Submit First Report
    </button>
  </div>
);

/* ─────────── Skeleton ─────────── */
const LoadingSkeleton = () => (
  <div className="dao-root">
    <div className="dao-stats">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="dao-stat-cell"
          style={{ animation: "none", opacity: 1 }}
        >
          <div className="dao-skel-bar" style={{ width: "55%", height: 20 }} />
          <div
            className="dao-skel-bar"
            style={{ width: "35%", marginTop: 6 }}
          />
        </div>
      ))}
    </div>
    {[1, 2].map((i) => (
      <div key={i} className="dao-skel">
        <div className="dao-skel-bar" style={{ width: "42%", height: 18 }} />
        <div className="dao-skel-bar" style={{ width: "75%" }} />
        <div className="dao-skel-bar" style={{ width: "60%" }} />
        <div
          className="dao-skel-bar"
          style={{ width: "100%", height: 4, marginTop: 8 }}
        />
      </div>
    ))}
  </div>
);

/* ─────────────────── Main Component ─────────────────── */
interface DAOPanelProps {
  onNavigateToReports?: () => void;
}

const DAOPanel = ({ onNavigateToReports }: DAOPanelProps) => {
  const { toast } = useToast();
  const [userVotes, setUserVotes] = useState<{
    [key: number]: "approve" | "reject" | null;
  }>({});
  const [proposals, setProposals] = useState<ScamReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userShield, setUserShield] = useState<string>("0");
  const [totalVotes, setTotalVotes] = useState(0);
  const [votingAccuracy, setVotingAccuracy] = useState(0);
  const [isVoting, setIsVoting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!walletConnector.provider) {
      setLoading(false);
      return;
    }
    try {
      const shieldBalance = await contractService.getShieldBalance(
        walletConnector.address,
      );
      setUserShield(shieldBalance);
      const stats = await contractService.getUserVotingStats(
        walletConnector.address,
      );
      setTotalVotes(stats.totalVotes);
      setVotingAccuracy(stats.accuracy);
      const reports = await contractService.getScamReports();
      setProposals(
        reports.map((r) => ({
          ...r,
          category: getCategoryFromDescription(r.description),
        })),
      );
    } catch (err: any) {
      setError(err.message || "Failed to load DAO data");
    } finally {
      setLoading(false);
    }
  }, [walletConnector.address]);

  useEffect(() => {
    fetchData();
    const eth = (window as any).ethereum;
    const onAccount = () => {
      setLoading(true);
      fetchData();
    };
    const onProposal = () => {
      toast({
        title: "New Proposal",
        description: "A new proposal has been created.",
      } as ToastProps);
      fetchData();
    };
    eth?.on("accountsChanged", onAccount);
    contractService.on("ProposalCreated", onProposal);
    contractService.on("VoteCast", fetchData);
    return () => {
      eth?.removeListener("accountsChanged", onAccount);
      contractService.off("ProposalCreated", onProposal);
      contractService.off("VoteCast", fetchData);
    };
  }, [fetchData, toast]);

  const handleVote = async (
    proposalId: number,
    tokens: string,
    isApprove: boolean,
  ) => {
    if (!walletConnector.address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to vote.",
        variant: "destructive",
      });
      return;
    }
    try {
      setIsVoting(true);
      setError(null);
      setUserVotes((p) => ({
        ...p,
        [proposalId]: isApprove ? "approve" : "reject",
      }));
      const needsApproval = await contractService.needsShieldApproval(tokens);
      if (needsApproval) {
        const tx = await contractService.approveShield(tokens);
        await tx.wait();
      }
      const tx = await contractService.castQuadraticVote(
        proposalId.toString(),
        isApprove,
        tokens,
      );
      await tx.wait();
      toast({
        title: "Vote Submitted",
        description: `Voting power: ${Math.sqrt(Number(tokens)).toFixed(2)}`,
      } as ToastProps);
      const reports = await contractService.getScamReports();
      setProposals(
        reports.map((r) => ({
          ...r,
          category: getCategoryFromDescription(r.description),
        })),
      );
    } catch (err: any) {
      setError(err.message || "Failed to submit vote");
      setUserVotes((p) => ({ ...p, [proposalId]: null }));
      toast({
        title: "Vote Failed",
        description: err.message || "Failed to submit vote",
        variant: "destructive",
      } as ToastProps);
    } finally {
      setIsVoting(false);
    }
  };

  if (loading)
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <LoadingSkeleton />
      </>
    );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="dao-root">
        {/* ── Stat strip ── */}
        <div className="dao-stats">
          <div className="dao-stat-cell" style={{ animationDelay: "0.05s" }}>
            <div className="dao-stat-label">Balance</div>
            <div className="dao-stat-val">
              {parseFloat(userShield || "0").toLocaleString()}
            </div>
            <div className="dao-stat-unit">SHIELD</div>
          </div>
          <div className="dao-stat-cell" style={{ animationDelay: "0.12s" }}>
            <div className="dao-stat-label">Votes</div>
            <div className="dao-stat-val">{totalVotes}</div>
            <div className="dao-stat-unit">ISSUED</div>
          </div>
          <div className="dao-stat-cell" style={{ animationDelay: "0.19s" }}>
            <div className="dao-stat-label">Accuracy</div>
            <div className="dao-stat-val green">{votingAccuracy}%</div>
            <div className="dao-stat-unit">RATING</div>
          </div>
        </div>

        {/* ── Alerts ── */}
        {error && (
          <div className="dao-alert dao-alert-err">
            <AlertCircle style={{ width: 15, height: 15, flexShrink: 0 }} />
            {error}
          </div>
        )}
        {!walletConnector.address && (
          <div className="dao-alert dao-alert-info">
            <Users style={{ width: 15, height: 15, flexShrink: 0 }} />
            Connect your wallet to view and vote on DAO proposals.
          </div>
        )}

        {/* ── Empty state ── */}
        {proposals.length === 0 && walletConnector.address && (
          <EmptyState onNavigateToReports={onNavigateToReports} />
        )}

        {/* ── Proposals ── */}
        {proposals.length > 0 && (
          <>
            <div className="dao-heading">
              <span className="dao-heading-label">
                Active Threats ({proposals.length})
              </span>
              <span className="dao-heading-live">LIVE_FEED</span>
            </div>

            {proposals.map((p, idx) => {
              const totalPower = Number(p.votesFor) + Number(p.votesAgainst);
              const forPct =
                totalPower > 0 ? (Number(p.votesFor) / totalPower) * 100 : 0;
              const agPct =
                totalPower > 0
                  ? (Number(p.votesAgainst) / totalPower) * 100
                  : 0;
              const isHighRisk =
                p.status === "rejected" ||
                Number(p.votesAgainst) > Number(p.votesFor);
              const addrIsRed = isHighRisk;

              return (
                <div
                  key={p.id}
                  className={`dao-proposal dao-d${Math.min(idx, 5)}${isHighRisk ? " risk-high" : ""}`}
                >
                  {/* Header */}
                  <div className="dao-proposal-header">
                    <div className="dao-proposal-top">
                      <div className="dao-proposal-id-block">
                        <div
                          className={`dao-proposal-mono${addrIsRed ? " red" : ""}`}
                        >
                          ID: {p.suspiciousAddress}
                        </div>
                        <div className="dao-proposal-title">
                          {p.description.length > 60
                            ? p.description.slice(0, 55) + "…"
                            : p.description}
                        </div>
                      </div>
                      <StatusBadge status={p.status} />
                    </div>

                    {/* Tags */}
                    <div className="dao-tags">
                      <span className={categoryTagClass[p.category || "Other"]}>
                        {p.category || "Other"}
                      </span>
                      <span className="dao-tag">
                        <Clock style={{ width: 9, height: 9 }} />
                        {new Date(p.timestamp).toLocaleDateString()}
                      </span>
                      <span className="dao-tag">
                        {shortenAddress(p.reporter)}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="dao-desc">{p.description}</div>

                  {/* Evidence */}
                  {p.evidence && (
                    <a
                      href={p.evidence}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="dao-evidence"
                    >
                      <ExternalLink style={{ width: 11, height: 11 }} />
                      View Evidence
                    </a>
                  )}

                  {/* Vote power row */}
                  <div className="dao-vote-power">
                    <div className="dao-vote-for">
                      <CheckCircle style={{ width: 13, height: 13 }} />
                      {Number(p.votesFor).toLocaleString()} POWER
                    </div>
                    <div className="dao-vote-against">
                      <XCircle style={{ width: 13, height: 13 }} />
                      {Number(p.votesAgainst).toLocaleString()} POWER
                    </div>
                  </div>

                  {/* Bar */}
                  <div className="dao-bar-wrap">
                    <div className="dao-bar-track">
                      <div
                        className="dao-bar-for"
                        style={{ width: `${forPct}%` }}
                      />
                      <div
                        className="dao-bar-against"
                        style={{ width: `${agPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Participants row */}
                  <div className="dao-participants">
                    <div className="dao-avatars">
                      {["01", "02", "03"].map((n, i) => (
                        <div key={i} className="dao-avatar">
                          {n}
                        </div>
                      ))}
                    </div>
                    <span>
                      {totalPower > 0
                        ? `${Math.round(totalPower / 1000)}K Nodes Participating`
                        : "No votes yet"}
                    </span>
                  </div>

                  {/* Quadratic vote input */}
                  {p.status === "active" && (
                    <div className="dao-vote-section">
                      <QuadraticVoteInput
                        proposalId={p.id}
                        maxTokens={userShield}
                        onVote={handleVote}
                        isVoting={isVoting && userVotes[p.id] !== null}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </>
  );
};

export default DAOPanel;
