import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Shield,
  AlertTriangle,
  Zap,
  Users,
  FileText,
  Settings,
  PieChart,
  Key,
  Fingerprint,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import WalletConnect from "@/components/WalletConnect";
import TransactionHistory from "@/components/TransactionHistory";
import DAOPanel from "@/components/dao/DAOPanel";
import TransactionInterceptor from "@/components/TransactionInterceptor";
import SecurityScore from "@/components/SecurityScore";
import AILearningFeedback from "@/components/AILearningFeedback";
import WalletAnalytics from "@/components/WalletAnalytics";
import GuardianManager from "@/components/GuardianManager";
import { useCivicStore } from "@/stores/civicStore";
import SimpleCivicAuth from "@/components/civic/SimpleCivicAuth";
import SoulboundToken from "@/components/SoulboundToken";
import NeuroShieldLogo from "@/components/NeuroShieldLogo";
import { reportScam } from "@/web3/contract";

/* ─────────────────────────────────────
   GLOBAL CSS — Full Window Layout
───────────────────────────────────── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=Inter:wght@300;400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:      #07090f;
    --card:    #0a0c16;
    --cyan:    #00e5d4;
    --purple:  #6b3fff;
    --blue:    #1a3aff;
    --text:    #ffffff;
    --muted:   rgba(255,255,255,0.42);
  }

  html, body, #root {
    width: 100%;
    height: 100%;
    overflow-x: hidden;
  }

  body { background: var(--bg); font-family: 'Inter', sans-serif; }

  /* ── Full page wrapper — fills entire viewport ── */
  .af-page {
    width: 100vw;
    min-height: 100vh;
    background: var(--bg);
    position: relative;
    overflow-x: hidden;
    display: flex;
    flex-direction: column;
  }

  /* ── Ambient background geometry ── */
  .af-bg {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    overflow: hidden;
  }
  .af-bg::before {
    content: '';
    position: absolute;
    top: -15%;
    left: -10%;
    width: 55%;
    height: 80%;
    background: linear-gradient(135deg, rgba(20,40,160,0.14) 0%, transparent 60%);
    transform: skew(-12deg, -8deg);
  }
  .af-bg::after {
    content: '';
    position: absolute;
    bottom: -10%;
    right: -8%;
    width: 50%;
    height: 70%;
    background: linear-gradient(315deg, rgba(15,30,130,0.12) 0%, transparent 65%);
    transform: skew(12deg, 6deg);
  }

  .af-bg-grid {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    background: repeating-linear-gradient(
      -48deg,
      transparent,
      transparent 90px,
      rgba(30,60,200,0.045) 90px,
      rgba(30,60,200,0.045) 91px
    );
  }

  /* ═══════════════════════════════════
     THE HERO CARD — stretches full width
  ═══════════════════════════════════ */
  .af-hero-card {
    position: relative;
    z-index: 10;
    width: 100%;
    border-radius: 0;
    border: none;
    border-bottom: 1px solid rgba(0,229,212,0.15);
    background: var(--card);
    box-shadow:
      0 0 0 1px rgba(0,229,212,0.04),
      0 20px 60px rgba(0,0,0,0.6);
    overflow: hidden;
    opacity: 0;
    transform: translateY(24px);
    transition: opacity 0.75s cubic-bezier(.22,.68,0,1.2), transform 0.75s cubic-bezier(.22,.68,0,1.2);
  }
  .af-hero-card.show {
    opacity: 1;
    transform: translateY(0);
  }

  /* ── Card header (nav row) ── */
  .af-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 40px;
    border-bottom: 1px solid rgba(255,255,255,0.055);
  }

  .af-logo {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    user-select: none;
  }
  .af-logo-text {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 20px;
    font-weight: 900;
    color: #fff;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    line-height: 1;
  }
  .af-logo-text em { color: var(--cyan); font-style: normal; }

  .af-nav-list {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .af-nav-btn {
    font-family: 'Inter', sans-serif;
    font-size: 13px;
    font-weight: 400;
    color: var(--muted);
    padding: 7px 16px;
    border-radius: 7px;
    border: none;
    background: transparent;
    cursor: pointer;
    transition: color 0.18s, background 0.18s;
    display: flex;
    align-items: center;
    gap: 5px;
    white-space: nowrap;
  }
  .af-nav-btn:hover  { color: #fff; background: rgba(255,255,255,0.06); }
  .af-nav-btn.active { color: #fff; background: rgba(255,255,255,0.09); }

  /* ── Card body = 2-col split, full width ── */
  .af-card-body {
    display: grid;
    grid-template-columns: 40% 60%;
    min-height: 560px;
  }

  /* ── LEFT SIDE ── */
  .af-left {
    padding: 56px 56px 44px;
    display: flex;
    flex-direction: column;
  }

  .af-h1 {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: clamp(72px, 7vw, 112px);
    font-weight: 900;
    line-height: 0.88;
    letter-spacing: -0.01em;
    text-transform: uppercase;
    color: #fff;
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 20px 0;
    animation: fadeUp 0.9s ease 0.25s both;
  }
  .af-h1 .hl { color: var(--cyan); }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .af-sub {
    font-family: 'Inter', sans-serif;
    font-size: 14px;
    font-weight: 300;
    color: var(--muted);
    line-height: 1.7;
    max-width: 400px;
    margin-bottom: 28px;
    animation: fadeUp 0.9s ease 0.4s both;
  }

  .af-cta-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 36px;
    flex-wrap: wrap;
    animation: fadeUp 0.9s ease 0.55s both;
  }

  .af-btn-primary {
    padding: 13px 38px;
    border-radius: 999px;
    background: #ffffff;
    color: #080c1e;
    font-family: 'Inter', sans-serif;
    font-size: 14px;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 4px 20px rgba(255,255,255,0.14);
  }
  .af-btn-primary:hover { background: #dce8ff; transform: translateY(-1px); box-shadow: 0 8px 28px rgba(255,255,255,0.2); }

  .af-btn-ghost {
    padding: 12px 28px;
    border-radius: 999px;
    background: transparent;
    color: rgba(255,255,255,0.65);
    font-family: 'Inter', sans-serif;
    font-size: 13px;
    font-weight: 400;
    border: 1px solid rgba(255,255,255,0.14);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 7px;
    transition: all 0.2s;
  }
  .af-btn-ghost:hover { color: #fff; border-color: rgba(0,229,212,0.5); }
  .af-btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }

  .af-protocols {
    display: flex;
    align-items: center;
    gap: 22px;
    margin-top: auto;
    opacity: 0.32;
    animation: fadeUp 0.9s ease 0.7s both;
  }
  .af-proto-item {
    font-family: 'Inter', sans-serif;
    font-size: 12px;
    color: #fff;
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .af-proto-icon {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: rgba(255,255,255,0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
  }

  /* ── RIGHT SIDE — fills remaining width ── */
  .af-right {
    position: relative;
    background: linear-gradient(140deg, #0d1252 0%, #160840 35%, #0a1865 65%, #0d1252 100%);
    border-left: 1px solid rgba(255,255,255,0.055);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .af-right-glow {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(ellipse 70% 55% at 50% 30%, rgba(70,90,255,0.28) 0%, transparent 65%),
      radial-gradient(ellipse 50% 40% at 75% 65%, rgba(100,55,255,0.2) 0%, transparent 55%);
  }

  .af-right-shards {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
  }
  .af-right-shards::before {
    content: '';
    position: absolute;
    top: 0; right: 0;
    width: 65%;
    height: 100%;
    background: linear-gradient(148deg, transparent 38%, rgba(90,110,255,0.13) 52%, transparent 70%);
    transform: skewX(-5deg);
  }
  .af-right-shards::after {
    content: '';
    position: absolute;
    top: 20%;
    left: -10%;
    width: 50%;
    height: 60%;
    background: linear-gradient(200deg, transparent 40%, rgba(60,80,220,0.09) 60%, transparent 80%);
  }

  .af-visual {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 2;
    min-height: 420px;
  }

  .af-diamond-wrap {
    position: relative;
    width: 220px;
    height: 220px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .af-pulse-ring {
    position: absolute;
    width: 320px;
    height: 320px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(80,100,255,0.22) 0%, rgba(100,60,255,0.1) 40%, transparent 70%);
    animation: ringPulse 3.5s ease-in-out infinite;
  }
  @keyframes ringPulse {
    0%,100% { transform: scale(1); opacity: 0.6; }
    50%      { transform: scale(1.15); opacity: 1; }
  }

  .af-inner-glow {
    position: absolute;
    width: 180px;
    height: 180px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(100,120,255,0.35) 0%, transparent 70%);
    filter: blur(8px);
  }

  .af-diamond-3d {
    position: relative;
    z-index: 2;
    width: 190px;
    height: 210px;
    animation: spin3d 9s linear infinite, float3d 4.5s ease-in-out infinite;
    filter: drop-shadow(0 0 20px rgba(120,100,255,0.9)) drop-shadow(0 0 50px rgba(80,60,255,0.5));
  }

  @keyframes spin3d {
    0%   { transform: perspective(700px) rotateY(0deg)   rotateX(8deg); }
    25%  { transform: perspective(700px) rotateY(90deg)  rotateX(4deg); }
    50%  { transform: perspective(700px) rotateY(180deg) rotateX(8deg); }
    75%  { transform: perspective(700px) rotateY(270deg) rotateX(12deg); }
    100% { transform: perspective(700px) rotateY(360deg) rotateX(8deg); }
  }
  @keyframes float3d {
    0%,100% { margin-top: 0px; }
    50%      { margin-top: -22px; }
  }

  /* ── Stat bar across full bottom of hero ── */
  .af-stat-bar {
    position: relative;
    z-index: 3;
    display: grid;
    grid-template-columns: 1fr 1fr;
    border-top: 1px solid rgba(255,255,255,0.06);
  }

  .af-stat-cell {
    padding: 20px 32px;
    display: flex;
    align-items: center;
    gap: 16px;
    background: rgba(8,12,36,0.55);
  }
  .af-stat-cell + .af-stat-cell {
    border-left: 1px solid rgba(255,255,255,0.06);
  }

  .af-stat-icon-box {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(80,100,255,0.28) 0%, rgba(100,60,255,0.28) 100%);
    border: 1px solid rgba(255,255,255,0.09);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    flex-shrink: 0;
  }

  .af-stat-val {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 30px;
    font-weight: 700;
    color: var(--cyan);
    line-height: 1;
  }
  .af-stat-desc {
    font-family: 'Inter', sans-serif;
    font-size: 11px;
    font-weight: 300;
    color: rgba(255,255,255,0.4);
    line-height: 1.45;
    margin-top: 3px;
  }

  /* ── DASHBOARD — full width, no max-width ── */
  .af-dash {
    position: relative;
    z-index: 10;
    width: 100%;
    padding: 32px 40px 48px;
    flex: 1;
  }

  /* ── Responsive ── */
  @media (max-width: 1024px) {
    .af-card-body { grid-template-columns: 50% 50%; }
  }
  @media (max-width: 820px) {
    .af-card-body { grid-template-columns: 1fr; }
    .af-right { min-height: 280px; }
    .af-card-header { padding: 18px 22px; flex-wrap: wrap; gap: 10px; }
    .af-nav-list { display: none; }
    .af-left { padding: 32px 24px 28px; }
    .af-h1 { font-size: 60px; }
    .af-visual { min-height: 280px; }
    .af-dash { padding: 24px 20px 40px; }
  }
`;

/* ────────────────────────────────────
   SVG 3D Diamond (Ethereum-inspired)
──────────────────────────────────── */
const Diamond3D = () => (
  <svg
    viewBox="0 0 170 190"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ width: "100%", height: "100%" }}
  >
    <defs>
      <linearGradient id="dg1" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#b88fff" />
        <stop offset="100%" stopColor="#5b2dd4" />
      </linearGradient>
      <linearGradient id="dg2" x1="1" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#d0b0ff" />
        <stop offset="100%" stopColor="#7a45e0" />
      </linearGradient>
      <linearGradient id="dg3" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#4466ff" />
        <stop offset="100%" stopColor="#1a2daa" />
      </linearGradient>
      <linearGradient id="dg4" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0%" stopColor="#8855ff" />
        <stop offset="100%" stopColor="#4422cc" />
      </linearGradient>
      <linearGradient id="dg5" x1="0.5" y1="0" x2="0.5" y2="1">
        <stop offset="0%" stopColor="#6b3fff" />
        <stop offset="100%" stopColor="#2d15aa" />
      </linearGradient>
      <filter id="dfglow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="4" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    <polygon
      points="85,0 55,55 85,42 115,55"
      fill="url(#dg2)"
      filter="url(#dfglow)"
    />
    <polygon points="85,42 55,55 22,100 85,90" fill="url(#dg1)" />
    <polygon points="85,42 115,55 148,100 85,90" fill="url(#dg2)" />
    <polygon points="22,100 85,90 148,100 85,112" fill="url(#dg3)" />
    <polygon points="22,100 85,112 52,145" fill="url(#dg4)" />
    <polygon points="148,100 85,112 118,145" fill="url(#dg1)" />
    <polygon
      points="52,145 85,112 118,145 85,190"
      fill="url(#dg5)"
      filter="url(#dfglow)"
    />
    <polyline
      points="85,0 55,55 22,100 52,145 85,190 118,145 148,100 115,55 85,0"
      fill="none"
      stroke="rgba(210,180,255,0.25)"
      strokeWidth="0.7"
    />
    <line
      x1="85"
      y1="0"
      x2="85"
      y2="190"
      stroke="rgba(200,160,255,0.15)"
      strokeWidth="0.5"
    />
    <line
      x1="22"
      y1="100"
      x2="148"
      y2="100"
      stroke="rgba(200,160,255,0.15)"
      strokeWidth="0.5"
    />
  </svg>
);

/* ──────────────── Component ──────────────── */
const Index = () => {
  const navigate = useNavigate();
  const [cardShow, setCardShow] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [currentAddress, setCurrentAddress] = useState("");
  const [threatLevel, setThreatLevel] = useState("safe");
  const [showInterceptor, setShowInterceptor] = useState(false);
  const [transactionDetails, setTransactionDetails] = useState({
    fromAddress: "",
    toAddress: "",
    value: 0,
    gasPrice: 0,
  });
  const [suspiciousAddress, setSuspiciousAddress] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [aiScansToday, setAiScansToday] = useState(0);
  const [blockedThreats, setBlockedThreats] = useState(0);
  const [reportAddress, setReportAddress] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [reportEvidence, setReportEvidence] = useState("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [securityScore, setSecurityScore] = useState(0);
  const [shieldLevel, setShieldLevel] = useState("Rookie");
  const [showAIFeedback, setShowAIFeedback] = useState(false);
  const [lastAction, setLastAction] = useState("scan");
  const [isProcessing, setIsProcessing] = useState(false);
  const [civicClientId] = useState(
    import.meta.env.VITE_CIVIC_CLIENT_ID || "demo_client_id",
  );
  const { toast } = useToast();

  useEffect(() => {
    setTimeout(() => setCardShow(true), 60);
  }, []);

  useEffect(() => {
    const load = () => {
      try {
        const raw = localStorage.getItem("transaction-logs");
        const logs = raw ? JSON.parse(raw) : [];
        setAiScansToday(logs.length);
        const blocked = logs.filter((l) => l.blocked);
        setBlockedThreats(blocked.length);
        const b =
          Math.min(30, logs.length * 2) +
          Math.min(40, blocked.length * 5) +
          Math.min(30, logs.length);
        setSecurityScore(Math.min(100, b));
        if (b >= 90) setShieldLevel("Guardian Elite");
        else if (b >= 75) setShieldLevel("Shield Master");
        else if (b >= 60) setShieldLevel("Defender");
        else if (b >= 40) setShieldLevel("Guardian");
        else setShieldLevel("Rookie");
        if (blocked.length > 0) setSuspiciousAddress(blocked[0].to || "");
      } catch {}
    };
    load();
    window.addEventListener("transaction-logged", load);
    return () => window.removeEventListener("transaction-logged", load);
  }, []);

  useEffect(() => {
    if (threatLevel === "danger" && !showInterceptor && !isProcessing) {
      const t = setTimeout(() => {
        setThreatLevel("safe");
        toast({
          title: "System Secured",
          description: "Threat level returned to safe.",
        });
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [threatLevel, showInterceptor, isProcessing, toast]);

  const simulateScamTransaction = () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setTransactionDetails({
      fromAddress:
        currentAddress || "0x742d35Cc6634C0532925a3b8D4C9db96c4b4d8b",
      toAddress: "0xa12066091c6F636505Bd64F2160EA1884142B38c",
      value: 0.00000000000001,
      gasPrice: 20,
    });
    setAiScansToday((p) => p + 1);
    setThreatLevel("danger");
    setLastAction("scan");
    setShowAIFeedback(true);
    toast({
      title: "⚠️ Analyzing Transaction",
      description: "ML model is analyzing the transaction...",
    });
    setTimeout(() => {
      setShowInterceptor(true);
      setIsProcessing(false);
    }, 800);
  };

  const handleBlockTransaction = () => {
    setBlockedThreats((p) => p + 1);
    setSecurityScore((p) => Math.min(100, p + 3));
    setLastAction("block");
    setShowAIFeedback(true);
    setShowInterceptor(false);
    setIsProcessing(false);
    toast({
      title: "🛡️ Transaction Blocked",
      description:
        "Malicious transaction successfully blocked. Your funds are safe!",
    });
    setTimeout(() => setThreatLevel("safe"), 2000);
  };

  const handleCloseInterceptor = () => {
    setShowInterceptor(false);
    setIsProcessing(false);
    toast({
      title: "⚠️ Transaction Signed",
      description: "You chose to proceed with the risky transaction.",
      variant: "destructive",
    });
    setTimeout(() => setThreatLevel("warning"), 1000);
  };

  const handleThreatReport = async () => {
    if (!reportAddress.trim()) {
      toast({
        title: "Address Required",
        description: "Enter the suspicious wallet address to report.",
        variant: "destructive",
      });
      return;
    }
    if (!reportDescription.trim()) {
      toast({
        title: "Description Required",
        description: "Describe why this address is suspicious.",
        variant: "destructive",
      });
      return;
    }
    setIsSubmittingReport(true);
    try {
      const txHash = await reportScam(
        reportAddress.trim(),
        reportDescription.trim(),
        reportEvidence.trim(),
      );
      setSecurityScore((p) => Math.min(100, p + 5));
      setLastAction("report");
      setShowAIFeedback(true);
      setReportAddress("");
      setReportDescription("");
      setReportEvidence("");
      toast({
        title: "✅ Report Submitted On-Chain",
        description: `Tx: ${txHash.slice(0, 10)}...${txHash.slice(-8)} — DAO voting is now open.`,
      });
    } catch (e) {
      toast({
        title: "❌ Report Failed",
        description: e.message || "Could not submit report.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const handleCivicSuccess = (gatewayToken) => {
    if (currentAddress) {
      useCivicStore.getState().setGatewayToken(currentAddress, gatewayToken);
      toast({
        title: "Identity Verified",
        description: "Your wallet is now verified with Civic",
      });
    }
  };
  const handleCivicError = (error) => {
    toast({
      title: "Verification Failed",
      description: error.message,
      variant: "destructive",
    });
  };

  const navItems = [
    { id: "overview", label: "Overview", Icon: Shield },
    { id: "analytics", label: "Analytics", Icon: PieChart },
    { id: "dao", label: "DAO", Icon: Users },
    { id: "reports", label: "Reports", Icon: FileText },
    { id: "sbt", label: "SBT", Icon: Fingerprint },
    { id: "oracle", label: "Oracle", Icon: Zap },
    { id: "settings", label: "Settings", Icon: Settings },
  ];

  const protocols = [
    { sym: "₿", name: "bitcoin" },
    { sym: "Ξ", name: "ethereum" },
    { sym: "◈", name: "monad" },
    { sym: "◎", name: "soulbound" },
  ];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="af-page">
        {/* BG layers */}
        <div className="af-bg" />
        <div className="af-bg-grid" />

        {/* ═══════════════════════════════
            HERO CARD — full width
        ═══════════════════════════════ */}
        <div className={`af-hero-card ${cardShow ? "show" : ""}`}>
          {/* ── Header row ── */}
          <div className="af-card-header">
            <div className="af-logo" onClick={() => setActiveTab("overview")}>
              <NeuroShieldLogo size={34} />
              <span className="af-logo-text">
                Neuro<em>Shield</em>
              </span>
            </div>

            <nav className="af-nav-list">
              {navItems.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  className={`af-nav-btn ${activeTab === id ? "active" : ""}`}
                  onClick={() => {
                    if (id === "oracle") {
                      navigate("/oracle");
                    } else {
                      setActiveTab(id);
                    }
                  }}
                >
                  <Icon style={{ width: 12, height: 12 }} />
                  {label}
                </button>
              ))}
            </nav>

            <WalletConnect
              onConnect={(address) => {
                setWalletConnected(true);
                setCurrentAddress(address);
                toast({
                  title: "Wallet Connected",
                  description: `Connected to ${address.slice(0, 6)}...${address.slice(-4)}`,
                });
              }}
              isConnected={walletConnected}
              address={currentAddress}
            />
          </div>

          {/* ── 2-col body ── */}
          <div className="af-card-body">
            {/* LEFT */}
            <div className="af-left">
              <h1 className="af-h1">
                SECURE
                <br />
                THE
                <br />
                <span className="hl">WEB3</span>
              </h1>
              <p className="af-sub">
                AI-powered smart wallet with real-time threat detection,
                DAO-driven scam reporting, and on-chain Soulbound identity.
              </p>
              <div className="af-cta-row">
                <button
                  className="af-btn-primary"
                  onClick={() => navigate("/send")}
                >
                  Start now
                </button>
                <button
                  className="af-btn-ghost"
                  onClick={simulateScamTransaction}
                  disabled={showInterceptor || isProcessing}
                >
                  <Zap
                    style={{ width: 13, height: 13, color: "var(--cyan)" }}
                  />
                  {isProcessing ? "Analyzing…" : "Try AI Demo"}
                </button>
              </div>
              <div className="af-protocols">
                {protocols.map((p) => (
                  <div key={p.name} className="af-proto-item">
                    <div className="af-proto-icon">{p.sym}</div>
                    <span>{p.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT */}
            <div className="af-right">
              <div className="af-right-glow" />
              <div className="af-right-shards" />
              <div className="af-visual">
                <div className="af-diamond-wrap">
                  <div className="af-pulse-ring" />
                  <div className="af-inner-glow" />
                  <div className="af-diamond-3d">
                    <Diamond3D />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* end hero-card */}

        {/* ═══════════════════════════════
            DASHBOARD — full width
        ═══════════════════════════════ */}
        <div className="af-dash">
          {activeTab === "overview" && (
            <div className="space-y-6">
              <SecurityScore />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-black/20 backdrop-blur-lg border-white/10 hover:border-emerald-500/30 transition-all duration-300">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <Shield className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div className="flex-1 space-y-3">
                        <div>
                          <h3 className="text-base font-semibold text-white">
                            Send Tokens
                          </h3>
                          <p className="text-xs text-gray-400 mt-1">
                            Every outgoing transaction is scanned by our ML
                            fraud detection model before your wallet signs.
                          </p>
                        </div>
                        <Button
                          asChild
                          className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 w-full rounded-lg h-9 text-sm"
                        >
                          <Link
                            to="/send"
                            className="flex items-center justify-center gap-2"
                          >
                            Send Securely <Zap className="w-3.5 h-3.5" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-black/20 backdrop-blur-lg border-white/10 hover:border-amber-500/30 transition-all duration-300">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                      </div>
                      <div className="flex-1 space-y-3">
                        <div>
                          <h3 className="text-base font-semibold text-white">
                            AI Threat Demo
                          </h3>
                          <p className="text-xs text-gray-400 mt-1">
                            Simulate a scam transaction to see the ML model
                            intercept and analyze it in real time.
                          </p>
                        </div>
                        <Button
                          onClick={simulateScamTransaction}
                          disabled={showInterceptor || isProcessing}
                          className="bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 w-full rounded-lg h-9 text-sm disabled:opacity-40"
                        >
                          {isProcessing
                            ? "Analyzing..."
                            : showInterceptor
                              ? "Threat Active"
                              : "Run Simulation"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              <TransactionHistory />
            </div>
          )}

          {activeTab === "analytics" && (
            <WalletAnalytics walletAddress={currentAddress} />
          )}

          {activeTab === "dao" && (
            <div className="space-y-6">
              <DAOPanel onNavigateToReports={() => setActiveTab("reports")} />
            </div>
          )}

          {activeTab === "reports" && (
            <Card className="group bg-black/20 backdrop-blur-lg border-white/10 hover:bg-black/30 transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl hover:shadow-purple-500/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <span>Community Threat Reports</span>
                  <div className="relative h-6 w-6">
                    <div className="absolute inset-0 bg-purple-500 rounded-full opacity-20 group-hover:animate-ping"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      🛡️
                    </div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <p className="text-gray-400 group-hover:text-gray-300 transition-colors">
                    Help protect the Web3 community by reporting suspicious
                    contracts and activities.
                    <span className="text-purple-400 font-medium">
                      {" "}
                      Earn +5 Shield Points per verified report!
                    </span>
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="group/card p-4 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-all duration-300">
                      <h4 className="text-white font-medium mb-4 flex items-center gap-2">
                        <span>Recent Blocked Transactions</span>
                        <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></div>
                      </h4>
                      <div className="text-sm text-gray-400 space-y-3">
                        {(() => {
                          try {
                            const rawLogs =
                              localStorage.getItem("transaction-logs");
                            const logs = rawLogs ? JSON.parse(rawLogs) : [];
                            const blocked = logs
                              .filter((l) => l.blocked)
                              .slice(0, 3);
                            if (blocked.length === 0)
                              return (
                                <div className="text-center py-4 text-gray-500">
                                  No blocked transactions yet. Use the AI Demo
                                  or send a transaction to see real reports
                                  here.
                                </div>
                              );
                            return blocked.map((log, i) => (
                              <div
                                key={i}
                                className="flex justify-between items-center p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                              >
                                <span className="group-hover/card:text-white transition-colors font-mono text-xs">
                                  {log.to
                                    ? `${log.to.slice(0, 6)}...${log.to.slice(-4)}`
                                    : "Unknown"}
                                </span>
                                <Badge
                                  className={`${log.riskLevel === "High" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}`}
                                >
                                  {log.riskLevel || "Medium"} Risk —{" "}
                                  {(log.riskScore || 0).toFixed(0)}%
                                </Badge>
                              </div>
                            ));
                          } catch {
                            return (
                              <div className="text-gray-500">
                                No reports available
                              </div>
                            );
                          }
                        })()}
                      </div>
                    </div>
                    <div className="group/card p-4 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-all duration-300">
                      <h4 className="text-white font-medium mb-4 flex items-center gap-2">
                        <span>Submit New Report</span>
                        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
                      </h4>
                      <div className="space-y-3">
                        <input
                          type="text"
                          placeholder="Suspicious wallet address (0x...)"
                          value={reportAddress}
                          onChange={(e) => setReportAddress(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-mono"
                        />
                        <input
                          type="text"
                          placeholder="Description — why is this address suspicious?"
                          value={reportDescription}
                          onChange={(e) => setReportDescription(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                        />
                        <input
                          type="text"
                          placeholder="Evidence URL or IPFS hash (optional)"
                          value={reportEvidence}
                          onChange={(e) => setReportEvidence(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                        />
                        <Button
                          className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/20 rounded-xl py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={handleThreatReport}
                          disabled={
                            isSubmittingReport ||
                            !reportAddress.trim() ||
                            !reportDescription.trim()
                          }
                        >
                          <span className="flex items-center justify-center gap-2">
                            {isSubmittingReport ? (
                              <>
                                <span className="animate-spin">⏳</span>
                                <span>Submitting to Blockchain...</span>
                              </>
                            ) : (
                              <>
                                <span>Report Suspicious Activity</span>
                                <span className="text-sm bg-white/20 px-2 py-1 rounded-full">
                                  +5 Points
                                </span>
                              </>
                            )}
                          </span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "recovery" && (
            <Card className="bg-black/20 backdrop-blur-lg border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center space-x-2">
                  <Key className="h-5 w-5 text-cyan-400" />
                  <span>Social Recovery Settings</span>
                </CardTitle>
                <p className="text-gray-400 mt-2">
                  Set up trusted guardians who can help you recover your wallet.
                  A minimum of 2 guardians must approve the recovery process.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <SimpleCivicAuth
                  clientId={civicClientId}
                  walletAddress={currentAddress}
                  onSuccess={handleCivicSuccess}
                  onError={handleCivicError}
                />
                <GuardianManager walletAddress={currentAddress} />
              </CardContent>
            </Card>
          )}

          {activeTab === "sbt" && (
            <div className="space-y-6">
              <Card className="group bg-black/20 backdrop-blur-lg border-white/10 hover:bg-black/30 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/20">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Fingerprint className="h-5 w-5 text-purple-400" />
                    <span>Soulbound Token</span>
                    <Badge className="bg-purple-500/20 text-purple-400 ml-2">
                      On-Chain Identity
                    </Badge>
                  </CardTitle>
                  <p className="text-gray-400 mt-2">
                    Your permanent on-chain reputation. Cannot be transferred,
                    cannot be faked, cannot be taken down.
                  </p>
                </CardHeader>
                <CardContent>
                  <SoulboundToken />
                </CardContent>
              </Card>
              <Card className="group bg-black/20 backdrop-blur-lg border-white/10 hover:bg-black/30 transition-all duration-300">
                <CardHeader>
                  <CardTitle className="text-white">
                    How Your Trust Score Works
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="font-mono text-sm bg-white/5 rounded-lg p-4 mb-4 border border-white/10">
                    <div className="text-purple-400">
                      +40 Are you a verified human?
                    </div>
                    <div className="text-blue-400">
                      +20 Do you have transaction history?
                    </div>
                    <div className="text-green-400">
                      +20 Do you vote correctly in the DAO?
                    </div>
                    <div className="text-amber-400">
                      +20 Do you actually participate?
                    </div>
                    <div className="text-gray-500 mt-1">────</div>
                    <div className="text-white font-bold">
                      100 Your permanent on-chain reputation
                    </div>
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Every component is independently verifiable from on-chain
                    data. The trust score lives forever as Base64-encoded JSON
                    directly inside the smart contract — no IPFS, no server, no
                    dependency.
                  </p>
                </CardContent>
              </Card>
              <Card className="group bg-black/20 backdrop-blur-lg border-white/10 hover:bg-black/30 transition-all duration-300">
                <CardHeader>
                  <CardTitle className="text-white">
                    Technical Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    {[
                      ["Token Standard", "ERC-721 (Soulbound)", "text-white"],
                      [
                        "Transfer Behavior",
                        'revert("SBTs cannot be transferred")',
                        "text-red-400",
                      ],
                      [
                        "Metadata Storage",
                        "On-chain Base64 JSON",
                        "text-green-400",
                      ],
                      ["Network", "Sepolia Testnet (11155111)", "text-white"],
                      [
                        "Updatable By",
                        "WalletVerifier (authorized only)",
                        "text-white",
                      ],
                    ].map(([k, v, c]) => (
                      <div
                        key={k}
                        className="flex justify-between items-center p-3 bg-white/5 rounded-lg"
                      >
                        <span className="text-gray-400">{k}</span>
                        <span className={`font-mono ${c}`}>{v}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="space-y-6">
              <Card className="bg-black/20 backdrop-blur-lg border-white/10">
                <CardHeader>
                  <CardTitle className="text-white">
                    Security Settings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      [
                        "Real-time Protection",
                        "Enable AI-powered transaction scanning",
                      ],
                      [
                        "Auto-block High Risk",
                        "Automatically block transactions with 90%+ risk score",
                      ],
                      [
                        "Community Reports",
                        "Show warnings from community-reported contracts",
                      ],
                    ].map(([title, desc]) => (
                      <div
                        key={title}
                        className="flex items-center justify-between p-4 bg-white/5 rounded-lg"
                      >
                        <div>
                          <h4 className="text-white font-medium">{title}</h4>
                          <p className="text-sm text-gray-400">{desc}</p>
                        </div>
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                          Active
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
        {/* end af-dash */}
      </div>

      {showInterceptor && (
        <TransactionInterceptor
          onClose={handleCloseInterceptor}
          onBlock={handleBlockTransaction}
          fromAddress={transactionDetails.fromAddress}
          toAddress={transactionDetails.toAddress}
          value={transactionDetails.value}
          gasPrice={transactionDetails.gasPrice}
        />
      )}
      <AILearningFeedback
        trigger={showAIFeedback}
        actionType={lastAction}
        onComplete={() => setShowAIFeedback(false)}
      />
    </>
  );
};

export default Index;
