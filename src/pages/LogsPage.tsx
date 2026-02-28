import React from "react";
import { useNavigate } from "react-router-dom";
import TransactionLogsViewer from "@/components/TransactionLogsViewer";
import { ArrowLeft, FileText } from "lucide-react";
import NeuroShieldLogo from "@/components/NeuroShieldLogo";

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=Inter:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root { --bg:#07090f; --card:#0a0c16; --cyan:#00e5d4; --muted:rgba(255,255,255,0.4); --border:rgba(255,255,255,0.07); }
  body { background: var(--bg); font-family: 'Inter', sans-serif; }
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
  .ns-content { position:relative; z-index:10; max-width:1000px; margin:0 auto; padding:40px 24px 60px; }
  .ns-page-heading { display:flex; align-items:center; gap:12px; margin-bottom:28px; }
  .ns-page-icon { width:42px; height:42px; border-radius:11px; display:flex; align-items:center; justify-content:center;
    background:rgba(0,229,212,0.08); border:1px solid rgba(0,229,212,0.18); }
  .ns-page-title { font-family:'Barlow Condensed',sans-serif; font-size:clamp(28px,4vw,40px);
    font-weight:900; color:#fff; text-transform:uppercase; letter-spacing:-0.01em; line-height:1; }
  .ns-page-title em { color:var(--cyan); font-style:normal; }
  @keyframes nsFadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
  .ns-animate { animation:nsFadeUp 0.55s ease both; }
  .ns-d1 { animation-delay:0.05s; } .ns-d2 { animation-delay:0.15s; }
`;

const LogsPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ns-page">
        <nav className="ns-topbar">
          <div className="ns-topbar-left" onClick={() => navigate("/")}>
            <NeuroShieldLogo size={28} />
            <span className="ns-topbar-title">
              Neuro<em>Shield</em>
            </span>
          </div>
          <button className="ns-back-btn" onClick={() => navigate(-1 as any)}>
            <ArrowLeft style={{ width: 14, height: 14 }} />
            Back
          </button>
        </nav>

        <div className="ns-content">
          <div className="ns-page-heading ns-animate ns-d1">
            <div className="ns-page-icon">
              <FileText
                style={{ width: 18, height: 18, color: "var(--cyan)" }}
              />
            </div>
            <h1 className="ns-page-title">
              Transaction Security <em>Logs</em>
            </h1>
          </div>

          <div className="ns-animate ns-d2">
            <TransactionLogsViewer />
          </div>
        </div>
      </div>
    </>
  );
};

export default LogsPage;
