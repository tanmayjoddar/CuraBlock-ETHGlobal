import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Key, UserCheck, ArrowLeft, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
// @ts-expect-error
import AuthClient from "@civic/auth";
import { ethers } from "ethers";
import NeuroShieldLogo from "@/components/NeuroShieldLogo";

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=Inter:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root { --bg:#07090f; --card:#0a0c16; --cyan:#00e5d4; --muted:rgba(255,255,255,0.4); --border:rgba(255,255,255,0.07); }
  body { background:var(--bg); font-family:'Inter',sans-serif; }

  .ns-page { min-height:100vh; background:var(--bg); position:relative; overflow-x:hidden; }
  .ns-page::before { content:''; position:fixed; inset:0; pointer-events:none; z-index:0;
    background:repeating-linear-gradient(-48deg,transparent,transparent 90px,rgba(30,60,200,0.04) 90px,rgba(30,60,200,0.04) 91px); }
  .ns-page::after { content:''; position:fixed; top:-15%; left:-10%; width:55%; height:80%; pointer-events:none; z-index:0;
    background:linear-gradient(135deg,rgba(20,40,160,0.1) 0%,transparent 60%); transform:skew(-12deg,-8deg); }

  .ns-topbar { position:sticky; top:0; z-index:50; display:flex; align-items:center; justify-content:space-between;
    padding:0 36px; height:58px; background:rgba(7,9,15,0.88); backdrop-filter:blur(16px);
    border-bottom:1px solid var(--border); }
  .ns-topbar-left { display:flex; align-items:center; gap:12px; cursor:pointer; }
  .ns-topbar-title { font-family:'Barlow Condensed',sans-serif; font-size:16px; font-weight:900;
    color:#fff; text-transform:uppercase; letter-spacing:0.04em; }
  .ns-topbar-title em { color:var(--cyan); font-style:normal; }
  .ns-back-btn { display:flex; align-items:center; gap:7px; font-family:'Inter',sans-serif;
    font-size:13px; color:var(--muted); background:none; border:none; cursor:pointer;
    padding:7px 14px; border-radius:8px; transition:color 0.18s,background 0.18s; }
  .ns-back-btn:hover { color:#fff; background:rgba(255,255,255,0.06); }

  .ns-content { position:relative; z-index:10; max-width:680px; margin:0 auto; padding:40px 24px 60px; }

  .ns-page-heading { display:flex; align-items:center; gap:12px; margin-bottom:6px; }
  .ns-page-icon { width:42px; height:42px; border-radius:11px; display:flex; align-items:center; justify-content:center;
    background:rgba(0,229,212,0.08); border:1px solid rgba(0,229,212,0.18); }
  .ns-page-title { font-family:'Barlow Condensed',sans-serif; font-size:clamp(28px,4vw,42px);
    font-weight:900; color:#fff; text-transform:uppercase; letter-spacing:-0.01em; line-height:1; }
  .ns-page-title em { color:var(--cyan); font-style:normal; }
  .ns-page-sub { font-family:'Inter',sans-serif; font-size:13px; color:var(--muted); line-height:1.6; margin-bottom:28px; }

  /* Status bar */
  .ns-status-bar { display:flex; align-items:center; gap:12px; flex-wrap:wrap;
    padding:12px 18px; border-radius:12px; border:1px solid var(--border);
    background:rgba(255,255,255,0.02); margin-bottom:14px; font-size:12.5px; }
  .ns-status-item { display:flex; align-items:center; gap:6px; color:var(--muted); font-family:'Inter',sans-serif; }
  .ns-status-item strong { color:#fff; font-weight:500; }
  .ns-status-item.ready { color:#4ade80; }
  .ns-status-item.error { color:#f87171; }
  .ns-status-sep { color:var(--border); }
  .ns-addr { font-family:monospace; font-size:11.5px; color:var(--cyan); }

  /* Card */
  .ns-card { border-radius:20px; border:1px solid rgba(0,229,212,0.15);
    background:var(--card); overflow:hidden; margin-bottom:14px;
    box-shadow:0 0 0 1px rgba(0,229,212,0.04), 0 20px 50px rgba(0,0,0,0.45); }

  /* Step */
  .ns-step { display:flex; align-items:flex-start; gap:16px; padding:20px 22px; border-bottom:1px solid var(--border); }
  .ns-step:last-child { border-bottom:none; }
  .ns-step-icon { width:38px; height:38px; border-radius:10px; flex-shrink:0;
    display:flex; align-items:center; justify-content:center; border:1px solid; }
  .ns-step-icon.idle { background:rgba(255,255,255,0.03); border-color:var(--border); color:var(--muted); }
  .ns-step-icon.done { background:rgba(74,222,128,0.1); border-color:rgba(74,222,128,0.25); color:#4ade80; }
  .ns-step-icon.active { background:rgba(0,229,212,0.1); border-color:rgba(0,229,212,0.25); color:var(--cyan); }
  .ns-step-icon.blocked { background:rgba(239,68,68,0.1); border-color:rgba(239,68,68,0.2); color:#f87171; }
  .ns-step-num { font-family:'Barlow Condensed',sans-serif; font-size:11px; font-weight:800;
    color:var(--muted); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:2px; }
  .ns-step-label { font-family:'Barlow Condensed',sans-serif; font-size:15px; font-weight:800;
    color:#fff; text-transform:uppercase; letter-spacing:0.03em; margin-bottom:4px; }
  .ns-step-desc { font-family:'Inter',sans-serif; font-size:12.5px; color:var(--muted); line-height:1.5; margin-bottom:14px; }

  /* Progress */
  .ns-card-header { padding:18px 22px; border-bottom:1px solid var(--border);
    display:flex; align-items:center; justify-content:space-between; }
  .ns-card-title { font-family:'Barlow Condensed',sans-serif; font-size:15px; font-weight:800;
    color:#fff; text-transform:uppercase; letter-spacing:0.04em; }
  .ns-card-body { padding:20px 22px; }
  .ns-progress-track { height:5px; border-radius:99px; background:rgba(255,255,255,0.06); overflow:hidden; }
  .ns-progress-fill { height:100%; border-radius:99px;
    background:linear-gradient(90deg,var(--cyan) 0%,#6b3fff 100%); transition:width 0.5s ease; }
  .ns-progress-pct { font-family:'Barlow Condensed',sans-serif; font-size:14px; font-weight:800; color:var(--cyan); }

  /* Buttons */
  .ns-btn-primary { display:inline-flex; align-items:center; justify-content:center; gap:8px;
    padding:10px 24px; border-radius:999px; background:#fff; color:#080c1e;
    font-family:'Inter',sans-serif; font-size:13px; font-weight:600;
    border:none; cursor:pointer; transition:all 0.2s; box-shadow:0 4px 16px rgba(255,255,255,0.1); }
  .ns-btn-primary:hover:not(:disabled) { background:#dce8ff; transform:translateY(-1px); }
  .ns-btn-primary:disabled { opacity:0.35; cursor:not-allowed; }
  .ns-btn-ghost { display:inline-flex; align-items:center; gap:7px;
    padding:9px 18px; border-radius:999px; background:transparent; color:var(--muted);
    font-family:'Inter',sans-serif; font-size:12.5px; font-weight:400;
    border:1px solid var(--border); cursor:pointer; transition:all 0.2s; }
  .ns-btn-ghost:hover:not(:disabled) { color:#fff; border-color:rgba(0,229,212,0.4); }
  .ns-btn-ghost:disabled { opacity:0.35; cursor:not-allowed; }
  .ns-btn-danger { display:inline-flex; align-items:center; gap:7px;
    padding:10px 24px; border-radius:999px; background:rgba(239,68,68,0.1); color:#f87171;
    font-family:'Inter',sans-serif; font-size:13px; font-weight:500;
    border:1px solid rgba(239,68,68,0.22); cursor:pointer; transition:all 0.2s; }
  .ns-btn-danger:hover { background:rgba(239,68,68,0.18); }
  .ns-btn-row { display:flex; align-items:center; justify-content:center; padding:20px 22px; }

  @keyframes nsFadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
  .ns-a  { animation:nsFadeUp 0.55s ease both; }
  .ns-a1{animation-delay:.05s} .ns-a2{animation-delay:.12s} .ns-a3{animation-delay:.2s} .ns-a4{animation-delay:.28s}
`;

interface AuthStatus {
  isAuthenticated: boolean;
  isCivicVerified: boolean;
  hasFaceRegistration: boolean;
}

const CivicAuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [authStatus, setAuthStatus] = useState<AuthStatus>({
    isAuthenticated: false,
    isCivicVerified: false,
    hasFaceRegistration: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [civicReady, setCivicReady] = useState(false);
  const civicAuth = useRef<any>(null);

  useEffect(() => {
    const appId = import.meta.env.VITE_CIVIC_APP_ID || "";
    const walletConnectProjectId =
      import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID || "";
    if (!appId || !walletConnectProjectId) {
      toast({
        variant: "destructive",
        title: "Civic Auth Config Error",
        description: "Missing env variables.",
      });
      setCivicReady(false);
      return;
    }
    civicAuth.current = new AuthClient({
      appId,
      walletConnectProjectId,
      network: "mainnet",
      defaultWeb3AuthLoginProvider: "civic",
      logLevel: "info",
      web3AuthNetwork: "cyan",
      scope: "openid wallet offline_access",
    });
    setCivicReady(true);
  }, [toast]);

  useEffect(() => {
    if (walletAddress) checkCivicStatus(walletAddress);
  }, [walletAddress]);

  const connectWallet = async () => {
    try {
      setIsLoading(true);
      if (!window.ethereum) throw new Error("No Ethereum provider found");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      setWalletAddress(address);
      toast({
        title: "Wallet Connected",
        description: "Your wallet has been successfully connected.",
      });
      if (civicReady && civicAuth.current) await startCivicVerification();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Connection Failed",
        description: "Could not connect to your wallet.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startCivicVerification = async () => {
    if (!walletAddress) {
      toast({
        variant: "destructive",
        title: "Wallet Required",
        description: "Please connect your wallet first.",
      });
      return;
    }
    if (!civicReady || !civicAuth.current) {
      toast({ variant: "destructive", title: "Civic Auth Not Ready" });
      return;
    }
    try {
      setIsLoading(true);
      const response = await civicAuth.current.signIn();
      if (response.status === "completed") {
        setAuthStatus((prev) => ({ ...prev, isCivicVerified: true }));
        toast({
          title: "Civic Verification Complete",
          description: "Your identity has been successfully verified.",
        });
      } else {
        toast({ variant: "destructive", title: "Verification Incomplete" });
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Verification Failed",
        description: "Could not complete Civic verification.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const proceedToFaceRegistration = () => {
    if (!authStatus.isCivicVerified) {
      toast({ variant: "destructive", title: "Verification Required" });
      return;
    }
    setAuthStatus((prev) => ({ ...prev, hasFaceRegistration: true }));
    toast({
      title: "Face Registration Complete",
      description: "Your biometrics have been registered.",
    });
  };

  const checkCivicStatus = async (address: string) => {
    try {
      if (!civicAuth.current) return;
      const authState = await civicAuth.current.getAuthState();
      setAuthStatus((prev) => ({
        ...prev,
        isCivicVerified: authState.status === "completed",
      }));
    } catch {}
  };

  const securityPct =
    (walletAddress ? 33 : 0) +
    (authStatus.isCivicVerified ? 33 : 0) +
    (authStatus.hasFaceRegistration ? 34 : 0);

  const steps = [
    {
      num: "01",
      label: "Connect Wallet",
      desc: "Connect your Ethereum wallet to begin the verification process.",
      icon: <Shield style={{ width: 18, height: 18 }} />,
      state: walletAddress ? "done" : "active",
      action: connectWallet,
      actionLabel: walletAddress ? "Wallet Connected" : "Connect Wallet",
      disabled: !!walletAddress || isLoading,
    },
    {
      num: "02",
      label: "Civic Identity Verification",
      desc: civicReady
        ? "Verify your identity using Civic's secure protocol."
        : "Civic Auth is not ready. Please check your configuration.",
      icon: <Key style={{ width: 18, height: 18 }} />,
      state: authStatus.isCivicVerified
        ? "done"
        : civicReady
          ? "active"
          : "blocked",
      action: startCivicVerification,
      actionLabel: authStatus.isCivicVerified
        ? "Verified with Civic"
        : "Start Civic Verification",
      disabled:
        !walletAddress ||
        authStatus.isCivicVerified ||
        isLoading ||
        !civicReady,
    },
    {
      num: "03",
      label: "Biometric Registration",
      desc: "Register your face for an additional security layer.",
      icon: <UserCheck style={{ width: 18, height: 18 }} />,
      state: authStatus.hasFaceRegistration ? "done" : "idle",
      action: proceedToFaceRegistration,
      actionLabel: authStatus.hasFaceRegistration
        ? "Biometrics Registered"
        : "Start Face Registration",
      disabled: !authStatus.isCivicVerified || isLoading,
    },
  ];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ns-page">
        <nav className="ns-topbar">
          <div className="ns-topbar-left" onClick={() => navigate("/")}>
            <NeuroShieldLogo size={28} />
            <span className="ns-topbar-title">
              Cura<em>Block</em>
            </span>
          </div>
          <button className="ns-back-btn" onClick={() => navigate(-1 as any)}>
            <ArrowLeft style={{ width: 14, height: 14 }} />
            Back
          </button>
        </nav>

        <div className="ns-content">
          <div className="ns-page-heading ns-a ns-a1">
            <div className="ns-page-icon">
              <Shield style={{ width: 18, height: 18, color: "var(--cyan)" }} />
            </div>
            <h1 className="ns-page-title">
              Civic <em>Authentication</em>
            </h1>
          </div>
          <p className="ns-page-sub ns-a ns-a1">
            Secure your wallet and identity with Civic's decentralized
            authentication.
          </p>

          {/* Status bar */}
          <div className="ns-status-bar ns-a ns-a2">
            <div className={`ns-status-item ${civicReady ? "ready" : "error"}`}>
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "currentColor",
                }}
              />
              Civic: <strong>{civicReady ? "Ready" : "Not Ready"}</strong>
            </div>
            <span className="ns-status-sep">·</span>
            <div className="ns-status-item">
              Wallet:{" "}
              <span className="ns-addr">
                {walletAddress
                  ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
                  : "Not Connected"}
              </span>
            </div>
            <span className="ns-status-sep">·</span>
            <div
              className={`ns-status-item ${authStatus.isCivicVerified ? "ready" : ""}`}
            >
              Verified:{" "}
              <strong>{authStatus.isCivicVerified ? "Yes" : "No"}</strong>
            </div>
            <button
              className="ns-btn-ghost"
              style={{ marginLeft: "auto", padding: "5px 12px", fontSize: 11 }}
              onClick={() => window.location.reload()}
            >
              <RefreshCw style={{ width: 11, height: 11 }} /> Reload
            </button>
          </div>

          {/* Steps card */}
          <div className="ns-card ns-a ns-a3">
            {steps.map((s) => (
              <div className="ns-step" key={s.num}>
                <div className={`ns-step-icon ${s.state}`}>{s.icon}</div>
                <div style={{ flex: 1 }}>
                  <div className="ns-step-num">Step {s.num}</div>
                  <div className="ns-step-label">{s.label}</div>
                  <p className="ns-step-desc">{s.desc}</p>
                  <button
                    className="ns-btn-primary"
                    onClick={s.action}
                    disabled={s.disabled}
                  >
                    {s.actionLabel}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Security Level */}
          <div className="ns-card ns-a ns-a4">
            <div className="ns-card-header">
              <span className="ns-card-title">Security Level</span>
              <span className="ns-progress-pct">{securityPct}%</span>
            </div>
            <div className="ns-card-body">
              <div className="ns-progress-track">
                <div
                  className="ns-progress-fill"
                  style={{ width: `${securityPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Reset */}
          <div className="ns-btn-row ns-a ns-a4">
            <button
              className="ns-btn-danger"
              onClick={() => {
                setAuthStatus({
                  isAuthenticated: false,
                  isCivicVerified: false,
                  hasFaceRegistration: false,
                });
                setWalletAddress(null);
                toast({
                  title: "Recovery Triggered",
                  description:
                    "All authentication factors have been reset. Please re-verify.",
                });
              }}
            >
              Simulate Account Recovery
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default CivicAuthPage;
