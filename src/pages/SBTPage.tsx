import React from "react";
import { useNavigate } from "react-router-dom";
import SoulboundToken from "@/components/SoulboundToken";
import { Fingerprint, ArrowLeft } from "lucide-react";
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
    background:rgba(107,63,255,0.12); border:1px solid rgba(107,63,255,0.25); }
  .ns-page-title { font-family:'Barlow Condensed',sans-serif; font-size:clamp(28px,4vw,42px);
    font-weight:900; color:#fff; text-transform:uppercase; letter-spacing:-0.01em; line-height:1; }
  .ns-page-title em { color:var(--cyan); font-style:normal; }
  .ns-page-sub { font-family:'Inter',sans-serif; font-size:13px; color:var(--muted);
    line-height:1.6; margin-bottom:28px; }

  .ns-card { border-radius:20px; border:1px solid rgba(0,229,212,0.15);
    background:var(--card); overflow:hidden; margin-bottom:14px;
    box-shadow:0 0 0 1px rgba(0,229,212,0.04), 0 20px 50px rgba(0,0,0,0.45); }
  .ns-card-header { padding:18px 22px; border-bottom:1px solid var(--border);
    display:flex; align-items:center; gap:10px; }
  .ns-card-title { font-family:'Barlow Condensed',sans-serif; font-size:15px; font-weight:800;
    color:#fff; text-transform:uppercase; letter-spacing:0.04em; }
  .ns-card-body { padding:20px 22px; }

  .ns-code-block { font-family:monospace; font-size:12.5px;
    background:rgba(255,255,255,0.03); border:1px solid var(--border);
    border-radius:10px; padding:16px; line-height:1.8; margin-bottom:14px; }

  .ns-kv-row { display:flex; align-items:center; justify-content:space-between;
    padding:11px 0; border-bottom:1px solid var(--border); font-size:13px; }
  .ns-kv-row:last-child { border-bottom:none; }
  .ns-kv-key { color:var(--muted); font-family:'Inter',sans-serif; }
  .ns-kv-val { font-family:monospace; font-size:12px; font-weight:500; }

  .ns-desc { font-family:'Inter',sans-serif; font-size:12.5px; color:var(--muted); line-height:1.6; }

  @keyframes nsFadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
  .ns-a  { animation:nsFadeUp 0.55s ease both; }
  .ns-a1 { animation-delay:0.05s; } .ns-a2 { animation-delay:0.12s; }
  .ns-a3 { animation-delay:0.2s;  } .ns-a4 { animation-delay:0.28s; }
`;

const SBTPage: React.FC = () => {
  const navigate = useNavigate();

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
              <Fingerprint
                style={{ width: 20, height: 20, color: "#a78bfa" }}
              />
            </div>
            <h1 className="ns-page-title">
              Soulbound <em>Token</em>
            </h1>
          </div>
          <p className="ns-page-sub ns-a ns-a1">
            Your permanent on-chain reputation. Cannot be transferred, cannot be
            faked, cannot be taken down.
          </p>

          {/* SBT component */}
          <div className="ns-a ns-a2">
            <SoulboundToken />
          </div>

          {/* Trust Score */}
          <div className="ns-card ns-a ns-a3">
            <div className="ns-card-header">
              <span className="ns-card-title">How Your Trust Score Works</span>
            </div>
            <div className="ns-card-body">
              <div className="ns-code-block">
                <div style={{ color: "#c084fc" }}>
                  +40 Are you a verified human?
                </div>
                <div style={{ color: "#60a5fa" }}>
                  +20 Do you have transaction history?
                </div>
                <div style={{ color: "#4ade80" }}>
                  +20 Do you vote correctly in the DAO?
                </div>
                <div style={{ color: "#fbbf24" }}>
                  +20 Do you actually participate?
                </div>
                <div style={{ color: "rgba(255,255,255,0.2)", marginTop: 4 }}>
                  ────
                </div>
                <div style={{ color: "#fff", fontWeight: 700 }}>
                  100 Your permanent on-chain reputation
                </div>
              </div>
              <p className="ns-desc">
                Every component is independently verifiable from on-chain data.
                The trust score lives forever as Base64-encoded JSON directly
                inside the smart contract — no IPFS, no server, no dependency.
                If every server on earth goes offline, your reputation still
                exists on the blockchain.
              </p>
            </div>
          </div>

          {/* Technical Details */}
          <div className="ns-card ns-a ns-a4">
            <div className="ns-card-header">
              <span className="ns-card-title">Technical Details</span>
            </div>
            <div className="ns-card-body">
              {[
                ["Token Standard", "ERC-721 (Soulbound)", "#fff"],
                [
                  "Transfer Behavior",
                  'revert("SBTs cannot be transferred")',
                  "#f87171",
                ],
                ["Metadata Storage", "On-chain Base64 JSON", "#4ade80"],
                ["Network", "Sepolia Testnet (11155111)", "#fff"],
                ["Updatable By", "WalletVerifier (authorized only)", "#fff"],
              ].map(([k, v, c]) => (
                <div key={k} className="ns-kv-row">
                  <span className="ns-kv-key">{k}</span>
                  <span className="ns-kv-val" style={{ color: c }}>
                    {v}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SBTPage;
