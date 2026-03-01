import React, { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import TransactionInterceptor from "@/components/TransactionInterceptor";
import { ethers } from "ethers";
import walletConnector from "@/web3/wallet";
import { isValidAddress } from "@/web3/utils";
import { Shield, ArrowRight, Zap } from "lucide-react";
import NeuroShieldLogo from "@/components/NeuroShieldLogo";
import { useNavigate } from "react-router-dom";

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=Inter:wght@300;400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:   #07090f;
    --card: #0a0c16;
    --cyan: #00e5d4;
    --muted: rgba(255,255,255,0.4);
    --border: rgba(255,255,255,0.07);
  }

  body { background: var(--bg); font-family: 'Inter', sans-serif; }

  .send-page {
    min-height: 100vh;
    background: var(--bg);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px;
    position: relative;
    overflow: hidden;
  }

  /* Same BG geometry as hero */
  .send-page::before {
    content: '';
    position: fixed;
    inset: 0;
    background: repeating-linear-gradient(
      -48deg, transparent, transparent 90px,
      rgba(30,60,200,0.04) 90px, rgba(30,60,200,0.04) 91px
    );
    pointer-events: none;
  }
  .send-page::after {
    content: '';
    position: fixed;
    top: -15%; left: -10%;
    width: 55%; height: 80%;
    background: linear-gradient(135deg, rgba(20,40,160,0.12) 0%, transparent 60%);
    transform: skew(-12deg,-8deg);
    pointer-events: none;
  }

  /* Back link */
  .send-back {
    position: fixed;
    top: 22px; left: 32px;
    display: flex; align-items: center; gap: 8px;
    font-family: 'Inter', sans-serif;
    font-size: 13px; color: var(--muted);
    cursor: pointer; z-index: 20;
    transition: color 0.18s;
    background: none; border: none;
  }
  .send-back:hover { color: #fff; }

  /* Card — same rounded-rect with cyan border */
  .send-card {
    position: relative; z-index: 10;
    width: 100%; max-width: 480px;
    border-radius: 24px;
    border: 1.5px solid rgba(0,229,212,0.28);
    background: var(--card);
    box-shadow:
      0 0 0 1px rgba(0,229,212,0.05),
      0 0 70px rgba(0,150,255,0.06),
      0 40px 100px rgba(0,0,0,0.7);
    overflow: hidden;
    opacity: 0;
    transform: translateY(24px) scale(0.982);
    transition: opacity 0.65s cubic-bezier(.22,.68,0,1.2), transform 0.65s cubic-bezier(.22,.68,0,1.2);
  }
  .send-card.show { opacity: 1; transform: translateY(0) scale(1); }

  /* Card top bar */
  .send-card-top {
    display: flex; align-items: center; gap: 10px;
    padding: 20px 28px;
    border-bottom: 1px solid var(--border);
  }
  .send-card-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 18px; font-weight: 800;
    color: #fff; text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .send-card-title em { color: var(--cyan); font-style: normal; }

  /* Badge */
  .send-secure-badge {
    margin-left: auto;
    display: flex; align-items: center; gap: 5px;
    font-family: 'Inter', sans-serif;
    font-size: 11px; font-weight: 400;
    color: var(--cyan);
    background: rgba(0,229,212,0.07);
    border: 1px solid rgba(0,229,212,0.18);
    border-radius: 99px;
    padding: 4px 10px;
  }
  .send-secure-badge span {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: var(--cyan);
    animation: dotPulse 2s infinite;
  }
  @keyframes dotPulse { 0%,100%{opacity:1} 50%{opacity:0.3} }

  /* Form body */
  .send-body { padding: 28px; display: flex; flex-direction: column; gap: 22px; }

  /* Error box */
  .send-error {
    padding: 10px 14px;
    background: rgba(239,68,68,0.1);
    border: 1px solid rgba(239,68,68,0.25);
    border-radius: 10px;
    font-family: 'Inter', sans-serif;
    font-size: 12.5px; color: #f87171;
    animation: fadeUp 0.3s ease;
  }

  /* Field */
  .send-field { display: flex; flex-direction: column; gap: 8px; }
  .send-label {
    font-family: 'Inter', sans-serif;
    font-size: 12px; font-weight: 500;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .send-input {
    width: 100%;
    padding: 13px 16px;
    border-radius: 10px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    color: #fff;
    font-family: 'Inter', sans-serif;
    font-size: 14px; font-weight: 400;
    outline: none;
    transition: border-color 0.2s, background 0.2s;
    -moz-appearance: textfield;
  }
  .send-input::placeholder { color: rgba(255,255,255,0.2); }
  .send-input:focus {
    border-color: rgba(0,229,212,0.45);
    background: rgba(0,229,212,0.03);
  }
  .send-input[type=number]::-webkit-inner-spin-button,
  .send-input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }

  /* Input with prefix unit */
  .send-input-wrap { position: relative; }
  .send-input-unit {
    position: absolute; right: 14px; top: 50%;
    transform: translateY(-50%);
    font-family: 'Inter', sans-serif;
    font-size: 12px; font-weight: 500;
    color: var(--muted);
    pointer-events: none;
  }

  /* Gas info row */
  .send-gas-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px;
    border-radius: 10px;
    background: rgba(255,255,255,0.025);
    border: 1px solid var(--border);
  }
  .send-gas-label {
    font-family: 'Inter', sans-serif;
    font-size: 12px; color: var(--muted);
  }
  .send-gas-val {
    font-family: 'Inter', sans-serif;
    font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.7);
  }
  .send-gas-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--cyan); animation: dotPulse 2s infinite;
  }

  /* Submit button — white pill like hero */
  .send-submit {
    width: 100%;
    padding: 14px;
    border-radius: 999px;
    background: #ffffff;
    color: #080c1e;
    font-family: 'Inter', sans-serif;
    font-size: 14px; font-weight: 600;
    border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    transition: all 0.2s;
    box-shadow: 0 4px 20px rgba(255,255,255,0.12);
  }
  .send-submit:hover:not(:disabled) {
    background: #dce8ff;
    transform: translateY(-1px);
    box-shadow: 0 8px 28px rgba(255,255,255,0.18);
  }
  .send-submit:disabled { opacity: 0.4; cursor: not-allowed; }

  /* Disclaimer */
  .send-disclaimer {
    display: flex; align-items: flex-start; gap: 8px;
    font-family: 'Inter', sans-serif;
    font-size: 11.5px; color: var(--muted); line-height: 1.5;
  }
  .send-disclaimer svg { flex-shrink: 0; margin-top: 1px; }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

interface PendingTransaction {
  to: string;
  value: bigint;
  gasLimit: bigint;
  gasPrice: bigint;
  signer: any;
}

const Send = () => {
  const navigate = useNavigate();
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [gasPrice, setGasPrice] = useState(20);
  const [showInterceptor, setShowInterceptor] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingTx, setPendingTx] = useState<PendingTransaction | null>(null);
  const [cardShow, setCardShow] = React.useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    setTimeout(() => setCardShow(true), 60);
  }, []);

  const resetForm = () => {
    setToAddress("");
    setAmount("");
    setPendingTx(null);
    setError(null);
    setIsProcessing(false);
    setShowInterceptor(false);
  };

  const prepareSendTransaction = async () => {
    // Force MetaMask to Sepolia before building the tx
    const chainId = await window.ethereum.request({ method: "eth_chainId" });
    if (chainId !== "0xaa36a7") {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0xaa36a7" }], // Sepolia 11155111
        });
      } catch (switchErr: any) {
        if (switchErr.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: "0xaa36a7",
              chainName: "Sepolia Testnet",
              nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
              rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
              blockExplorerUrls: ["https://sepolia.etherscan.io"],
            }],
          });
        } else {
          throw new Error("Please switch to Sepolia Testnet to send transactions.");
        }
      }
    }
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const value = ethers.parseEther(amount.toString());
    const feeData = await provider.getFeeData();
    const gp = feeData.gasPrice || 20n * 10n ** 9n;
    const gasEstimate = await provider.estimateGas({
      to: toAddress,
      value,
      from: await signer.getAddress(),
    });
    const gasLimit = gasEstimate + (gasEstimate * 20n) / 100n;
    return { to: toAddress, value, gasLimit, gasPrice: gp, signer };
  };

  const executeTransaction = async () => {
    if (!pendingTx) return;
    try {
      const { signer, ...tx } = pendingTx;
      const transaction = await signer.sendTransaction(tx);
      toast({
        title: "Transaction Sent",
        description: `Hash: ${transaction.hash}`,
      });
      resetForm();
    } catch (err: any) {
      toast({
        title: "Transaction Failed",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!walletConnector.address)
        throw new Error("Please connect your wallet first");
      if (!isValidAddress(toAddress))
        throw new Error("Please enter a valid recipient address");
      if (!amount || parseFloat(amount) <= 0)
        throw new Error("Please enter a valid amount");

      setIsProcessing(true);
      setError(null);

      const provider = new ethers.BrowserProvider(window.ethereum);
      const balance = await provider.getBalance(walletConnector.address);
      if (balance < ethers.parseEther(amount))
        throw new Error("Insufficient balance");

      const tx = await prepareSendTransaction();
      setPendingTx(tx);
      try {
        setGasPrice(Number(ethers.formatUnits(tx.gasPrice, "gwei")));
      } catch {}
      setShowInterceptor(true);
    } catch (err: any) {
      setError(err.message);
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBlockTransaction = () => {
    toast({
      title: "Transaction Blocked",
      description: "Blocked due to security concerns.",
    });
    resetForm();
  };

  const handleDismissInterceptor = () => {
    setShowInterceptor(false);
    setPendingTx(null);
    setIsProcessing(false);
  };

  const handleProceedAnyway = async () => {
    setShowInterceptor(false);
    await executeTransaction();
    setIsProcessing(false);
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="send-page">
        {/* Back button */}
        <button className="send-back" onClick={() => navigate("/")}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Back
        </button>

        {/* Card */}
        <div className={`send-card ${cardShow ? "show" : ""}`}>
          {/* Top bar */}
          <div className="send-card-top">
            <NeuroShieldLogo size={28} />
            <span className="send-card-title">
              Send <em>Tokens</em>
            </span>
            <div className="send-secure-badge">
              <span />
              AI Protected
            </div>
          </div>

          {/* Form */}
          <form className="send-body" onSubmit={handleSend}>
            {error && <div className="send-error">{error}</div>}

            <div className="send-field">
              <label className="send-label">Recipient Address</label>
              <input
                className="send-input"
                placeholder="0x..."
                value={toAddress}
                onChange={(e) => setToAddress(e.target.value)}
                required
              />
            </div>

            <div className="send-field">
              <label className="send-label">Amount</label>
              <div className="send-input-wrap">
                <input
                  className="send-input"
                  type="number"
                  step="0.000000000000000001"
                  min="0"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  style={{ paddingRight: 52 }}
                  required
                />
                <span className="send-input-unit">ETH</span>
              </div>
            </div>

            {/* Gas info */}
            <div className="send-gas-row">
              <span className="send-gas-label">Estimated gas</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div className="send-gas-dot" />
                <span className="send-gas-val">{gasPrice} Gwei</span>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="send-disclaimer">
              <Shield
                style={{
                  width: 13,
                  height: 13,
                  color: "#00e5d4",
                  marginTop: 1,
                }}
              />
              Every transaction is scanned by our ML model before signing.
              You'll review the risk score before it goes through.
            </div>

            <button
              type="submit"
              className="send-submit"
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <svg
                    style={{
                      animation: "spin 1s linear infinite",
                      width: 16,
                      height: 16,
                    }}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  Analyzing…
                </>
              ) : (
                <>
                  Send Tokens
                  <ArrowRight style={{ width: 15, height: 15 }} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {showInterceptor && (
        <TransactionInterceptor
          onClose={handleProceedAnyway}
          onBlock={handleBlockTransaction}
          onDismiss={handleDismissInterceptor}
          fromAddress={walletConnector.address || ""}
          toAddress={toAddress}
          value={parseFloat(amount)}
          gasPrice={gasPrice}
        />
      )}
    </>
  );
};

export default Send;
