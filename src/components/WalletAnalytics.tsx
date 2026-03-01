import React, { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, AlertCircle, Shield, Network } from "lucide-react";
import walletConnector from "@/web3/wallet";
import contractService from "@/web3/contract";
import { JsonRpcProvider } from "ethers";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

const MONAD_RPC = "https://ethereum-sepolia-rpc.publicnode.com";
const getReadProvider = () => new JsonRpcProvider(MONAD_RPC);

// Etherscan V2 API (unified endpoint for all chains)
const ETHERSCAN_KEY = ((import.meta as any).env?.VITE_ETHERSCAN_API_KEY || "").trim();
const etherscanBase = `https://api.etherscan.io/v2/api?chainid=11155111`;
const etherscanApiSuffix = ETHERSCAN_KEY ? `&apikey=${ETHERSCAN_KEY}` : "";

// ------- Types -------

interface TransactionLog {
  timestamp: string;
  from: string;
  to: string;
  value: number;
  gasPrice: number;
  riskScore: number;
  riskLevel: string;
  blocked: boolean;
  whitelisted: boolean;
}
interface TimelinePoint {
  time: string;
  fullTime: string;
  score: number;
  address: string;
  blocked: boolean;
  isScammer: boolean;
}
interface GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  status: "scam" | "safe" | "unknown";
  isCenter: boolean;
  txCount: number;
}
interface GraphEdge {
  source: string;
  target: string;
  riskScore: number;
}
interface WalletAnalyticsData {
  sent_tx_count: number;
  received_tx_count: number;
  total_ether_balance: string;
  wallet_age_days: number;
}
interface WalletAnalyticsProps {
  walletAddress?: string;
}

// ------- Shared glass style -------

const glass: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  border: "1px solid rgba(255,255,255,0.08)",
};

// ------- Network Graph (Canvas) -------

const NetworkGraph: React.FC<{ nodes: GraphNode[]; edges: GraphEdge[] }> = ({
  nodes: initialNodes,
  edges,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const animRef = useRef<number>(0);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    nodesRef.current = initialNodes.map((n) => ({ ...n }));
  }, [initialNodes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width,
      H = canvas.height,
      CX = W / 2,
      CY = H / 2;

    const others = nodesRef.current.filter((n) => !n.isCenter);
    const center = nodesRef.current.find((n) => n.isCenter);
    if (center) {
      center.x = CX;
      center.y = CY;
    }
    others.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / Math.max(others.length, 1);
      const radius = Math.min(W, H) * 0.32;
      n.x = CX + Math.cos(angle) * radius;
      n.y = CY + Math.sin(angle) * radius;
      n.vx = 0;
      n.vy = 0;
    });

    let tick = 0;
    const maxTicks = 200;

    const simulate = () => {
      const nodes = nodesRef.current;
      if (tick < maxTicks) {
        const alpha = 1 - tick / maxTicks;
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const dx = nodes[j].x - nodes[i].x,
              dy = nodes[j].y - nodes[i].y;
            const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
            const force = (800 * alpha) / (dist * dist);
            const fx = (dx / dist) * force,
              fy = (dy / dist) * force;
            if (!nodes[i].isCenter) {
              nodes[i].vx -= fx;
              nodes[i].vy -= fy;
            }
            if (!nodes[j].isCenter) {
              nodes[j].vx += fx;
              nodes[j].vy += fy;
            }
          }
        }
        for (const edge of edges) {
          const src = nodes.find((n) => n.id === edge.source);
          const tgt = nodes.find((n) => n.id === edge.target);
          if (!src || !tgt) continue;
          const dx = tgt.x - src.x,
            dy = tgt.y - src.y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const idealDist = Math.min(W, H) * 0.25;
          const force = (dist - idealDist) * 0.01 * alpha;
          if (!src.isCenter) {
            src.vx += (dx / dist) * force;
            src.vy += (dy / dist) * force;
          }
          if (!tgt.isCenter) {
            tgt.vx -= (dx / dist) * force;
            tgt.vy -= (dy / dist) * force;
          }
        }
        for (const n of nodes) {
          if (n.isCenter) continue;
          n.vx *= 0.6;
          n.vy *= 0.6;
          n.x += n.vx;
          n.y += n.vy;
          n.x = Math.max(40, Math.min(W - 40, n.x));
          n.y = Math.max(40, Math.min(H - 40, n.y));
        }
        tick++;
      }

      ctx.clearRect(0, 0, W, H);

      // Animated dashed edges (matches HTML node-link animation)
      for (const edge of edges) {
        const src = nodes.find((n) => n.id === edge.source);
        const tgt = nodes.find((n) => n.id === edge.target);
        if (!src || !tgt) continue;
        ctx.beginPath();
        ctx.setLineDash([8, 6]);
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(tgt.x, tgt.y);
        ctx.strokeStyle =
          edge.riskScore > 70
            ? "rgba(248,113,113,0.6)"
            : edge.riskScore > 40
              ? "rgba(250,204,21,0.4)"
              : "rgba(74,222,128,0.3)";
        ctx.lineWidth = Math.min(3, 1 + (tgt.txCount || 1) * 0.5);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Nodes
      for (const n of nodes) {
        const radius = n.isCenter ? 18 : 8 + Math.min(n.txCount, 5) * 2;
        const color = n.isCenter
          ? "#818cf8"
          : n.status === "scam"
            ? "#f87171"
            : n.status === "safe"
              ? "#4ade80"
              : "#9ca3af";

        // Outer glow
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius + 6, 0, Math.PI * 2);
        ctx.fillStyle = n.isCenter
          ? "rgba(129,140,248,0.15)"
          : n.status === "scam"
            ? "rgba(248,113,113,0.2)"
            : "rgba(255,255,255,0.04)";
        ctx.fill();

        // Main circle
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Label
        ctx.fillStyle = "#ffffff";
        ctx.font = n.isCenter
          ? "bold 10px 'JetBrains Mono', monospace"
          : "9px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText(n.label, n.x, n.y + radius + 14);

        if (n.status === "scam" && !n.isCenter) {
          ctx.fillStyle = "#fca5a5";
          ctx.font = "bold 7px sans-serif";
          ctx.fillText("SCAM", n.x, n.y + radius + 24);
        }
      }

      animRef.current = requestAnimationFrame(simulate);
    };

    animRef.current = requestAnimationFrame(simulate);
    return () => cancelAnimationFrame(animRef.current);
  }, [initialNodes, edges]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x =
        (e.clientX - rect.left) * (canvasRef.current!.width / rect.width);
      const y =
        (e.clientY - rect.top) * (canvasRef.current!.height / rect.height);
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      const hit = nodesRef.current.find((n) => {
        const r = n.isCenter ? 18 : 10;
        return Math.sqrt((n.x - x) ** 2 + (n.y - y) ** 2) < r + 5;
      });
      setHoveredNode(hit || null);
    },
    [],
  );

  return (
    <div style={{ position: "relative" }}>
      <canvas
        ref={canvasRef}
        width={600}
        height={400}
        style={{
          width: "100%",
          borderRadius: 16,
          background: "rgba(0,0,0,0.4)",
          border: "1px solid rgba(255,255,255,0.05)",
          display: "block",
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredNode(null)}
      />

      {/* Hover tooltip */}
      {hoveredNode && (
        <div
          style={{
            position: "absolute",
            pointerEvents: "none",
            left: mousePos.x + 12,
            top: mousePos.y - 10,
            background: "rgba(10,11,16,0.95)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 10,
            padding: "8px 12px",
            fontSize: 12,
            zIndex: 10,
          }}
        >
          <div style={{ color: "#fff", fontFamily: "monospace" }}>
            {hoveredNode.id}
          </div>
          <div style={{ color: "#94a3b8" }}>
            {hoveredNode.txCount} transaction
            {hoveredNode.txCount !== 1 ? "s" : ""}
          </div>
          <div
            style={{
              color:
                hoveredNode.status === "scam"
                  ? "#f87171"
                  : hoveredNode.status === "safe"
                    ? "#4ade80"
                    : "#6b7280",
              fontWeight: hoveredNode.status === "scam" ? 700 : 400,
            }}
          >
            {hoveredNode.status === "scam"
              ? "⚠ DAO Confirmed Scam"
              : hoveredNode.status === "safe"
                ? "✓ Whitelisted"
                : "Unknown"}
          </div>
        </div>
      )}

      {/* Bottom-left legend badge — mirrors the HTML overlay */}
      <div
        style={{
          position: "absolute",
          bottom: 16,
          left: 16,
          ...glass,
          borderRadius: 10,
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div style={{ display: "flex" }}>
          {(["#22c55e", "#3b82f6", "#f43f5e"] as string[]).map((c, i) => (
            <div
              key={c}
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: c,
                border: "2px solid #0a0b10",
                marginLeft: i > 0 ? -6 : 0,
              }}
            />
          ))}
        </div>
        <span
          style={{
            fontSize: 10,
            letterSpacing: "0.1em",
            color: "#475569",
            fontFamily: "'JetBrains Mono', monospace",
            textTransform: "uppercase",
          }}
        >
          {initialNodes.length} NODES DETECTED
        </span>
      </div>
    </div>
  );
};

// ------- Custom Timeline Tooltip -------

const TimelineTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as TimelinePoint;
  return (
    <div
      style={{
        background: "rgba(10,11,16,0.95)",
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: 10,
        padding: "8px 12px",
        fontSize: 12,
      }}
    >
      <div style={{ color: "#94a3b8" }}>{d.fullTime}</div>
      <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>
        Risk: {(d.score * 100).toFixed(0)}%
      </div>
      <div style={{ color: "#64748b", fontFamily: "monospace", fontSize: 10 }}>
        → {d.address.slice(0, 10)}…{d.address.slice(-6)}
      </div>
      {d.isScammer && (
        <div style={{ color: "#f87171", fontWeight: 700, marginTop: 4 }}>
          ⚠ DAO Confirmed Scam
        </div>
      )}
      {d.blocked && <div style={{ color: "#facc15" }}>Blocked by user</div>}
    </div>
  );
};

// ------- Main Component -------

const WalletAnalytics: React.FC<WalletAnalyticsProps> = ({ walletAddress }) => {
  const [analytics, setAnalytics] = useState<WalletAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timelineData, setTimelineData] = useState<TimelinePoint[]>([]);
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  const [graphEdges, setGraphEdges] = useState<GraphEdge[]>([]);
  const [chartsLoading, setChartsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"timeline" | "network">(
    "timeline",
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const address = walletAddress || walletConnector.address;
        if (!address) {
          setError("Connect your wallet to view analytics");
          setLoading(false);
          return;
        }
        const provider = getReadProvider();
        const [balance, txCount] = await Promise.all([
          provider.getBalance(address),
          provider.getTransactionCount(address),
        ]);

        // Fetch real on-chain tx list from Etherscan Sepolia to get received count + wallet age
        let receivedCount = 0;
        let walletAgeDays = 1;
        try {
          const etherscanRes = await fetch(
            `${etherscanBase}&module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=50&sort=asc${etherscanApiSuffix}`,
          );
          const etherscanData = await etherscanRes.json();
          if (
            etherscanData.status === "1" &&
            Array.isArray(etherscanData.result)
          ) {
            const txs = etherscanData.result;
            receivedCount = txs.filter(
              (tx: any) => tx.to?.toLowerCase() === address.toLowerCase(),
            ).length;
            // Wallet age from first tx timestamp
            if (txs.length > 0) {
              const firstTxTime = parseInt(txs[0].timeStamp) * 1000;
              walletAgeDays = Math.max(
                1,
                Math.floor((Date.now() - firstTxTime) / (1000 * 60 * 60 * 24)),
              );
            }
          }
        } catch (e) {
          console.warn("Etherscan fetch failed (non-fatal):", e);
        }

        setAnalytics({
          sent_tx_count: txCount,
          received_tx_count: receivedCount,
          total_ether_balance: balance.toString(),
          wallet_age_days: walletAgeDays,
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch analytics data",
        );
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [walletAddress]);

  useEffect(() => {
    const buildChartData = async () => {
      setChartsLoading(true);
      const address = walletAddress || walletConnector.address;
      if (!address) {
        setChartsLoading(false);
        return;
      }
      try {
        // Fetch real on-chain tx history from Etherscan Sepolia
        let onChainTxs: any[] = [];
        try {
          const res = await fetch(
            `${etherscanBase}&module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=100&sort=desc${etherscanApiSuffix}`,
          );
          const data = await res.json();
          if (data.status === "1" && Array.isArray(data.result)) {
            onChainTxs = data.result;
          }
        } catch (e) {
          console.warn("Etherscan tx fetch failed:", e);
        }

        // Build scam status map for counterparties
        const uniqueAddresses = [
          ...new Set(
            onChainTxs
              .map((tx: any) => {
                const counterparty =
                  tx.from?.toLowerCase() === address.toLowerCase()
                    ? tx.to?.toLowerCase()
                    : tx.from?.toLowerCase();
                return counterparty;
              })
              .filter(Boolean),
          ),
        ];
        const scamStatusMap: Record<string, boolean> = {};
        await Promise.all(
          uniqueAddresses.slice(0, 20).map(async (addr) => {
            if (!addr) return;
            try {
              scamStatusMap[addr] = await contractService.isScamAddress(addr);
            } catch {
              scamStatusMap[addr] = false;
            }
          }),
        );

        // Build timeline from on-chain transactions
        const sortedTxs = [...onChainTxs].sort(
          (a, b) => parseInt(a.timeStamp) - parseInt(b.timeStamp),
        );
        setTimelineData(
          sortedTxs.map((tx: any) => {
            const d = new Date(parseInt(tx.timeStamp) * 1000);
            const counterparty =
              tx.from?.toLowerCase() === address.toLowerCase()
                ? tx.to
                : tx.from;
            const isFailed = tx.isError === "1";
            return {
              time: `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`,
              fullTime: d.toLocaleString(),
              score: scamStatusMap[counterparty?.toLowerCase()]
                ? 0.95
                : isFailed
                  ? 0.30
                  : 0.05,
              address: counterparty || "",
              blocked: isFailed,
              isScammer: scamStatusMap[counterparty?.toLowerCase()] || false,
            };
          }),
        );

        // Build network graph from on-chain counterparties
        const counterpartyMap: Record<
          string,
          { count: number; maxRisk: number; whitelisted: boolean }
        > = {};
        for (const tx of onChainTxs) {
          const counterparty =
            tx.from?.toLowerCase() === address.toLowerCase()
              ? tx.to?.toLowerCase()
              : tx.from?.toLowerCase();
          if (!counterparty) continue;
          if (!counterpartyMap[counterparty])
            counterpartyMap[counterparty] = {
              count: 0,
              maxRisk: 0,
              whitelisted: false,
            };
          counterpartyMap[counterparty].count++;
          const isScam = scamStatusMap[counterparty] || false;
          counterpartyMap[counterparty].maxRisk = Math.max(
            counterpartyMap[counterparty].maxRisk,
            isScam ? 95 : 5,
          );
        }

        const nodes: GraphNode[] = [
          {
            id: address,
            label: "You",
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            status: "safe",
            isCenter: true,
            txCount: onChainTxs.length,
          },
        ];
        const edgesArr: GraphEdge[] = [];
        for (const [addr, data] of Object.entries(counterpartyMap)) {
          const isScam = scamStatusMap[addr] || false;
          nodes.push({
            id: addr,
            label: `${addr.slice(0, 6)}…${addr.slice(-4)}`,
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            status: isScam ? "scam" : "unknown",
            isCenter: false,
            txCount: data.count,
          });
          edgesArr.push({
            source: address,
            target: addr,
            riskScore: data.maxRisk,
          });
        }
        setGraphNodes(nodes);
        setGraphEdges(edgesArr);
      } catch (err) {
        console.error("Error building chart data:", err);
      } finally {
        setChartsLoading(false);
      }
    };
    buildChartData();
    const handler = () => buildChartData();
    window.addEventListener("transaction-logged", handler);
    return () => window.removeEventListener("transaction-logged", handler);
  }, [walletAddress]);

  const formatEther = (v: string) => {
    try {
      return (parseFloat(v) / 1e18).toFixed(4);
    } catch {
      return "0";
    }
  };

  if (loading)
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0a0b10",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <Loader2
          style={{ width: 32, height: 32, color: "#6366f1", marginBottom: 16 }}
          className="animate-spin"
        />
        <p style={{ color: "#64748b" }}>Analyzing wallet data...</p>
      </div>
    );

  if (error || !analytics)
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0a0b10",
          padding: 32,
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <div style={{ ...glass, borderRadius: 20, padding: 32, maxWidth: 480 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "#f87171",
              marginBottom: 12,
            }}
          >
            <AlertCircle style={{ width: 20, height: 20 }} />
            <span style={{ fontWeight: 600 }}>Analytics Error</span>
          </div>
          <p style={{ color: "#64748b" }}>
            {error || "No analytics data available"}
          </p>
        </div>
      </div>
    );

  // Stat card definitions
  const statCards = [
    {
      label: "Nonce (Sent Tx Count)",
      value: String(analytics.sent_tx_count),
      unit: "",
      color: "#4ade80",
      glow: "rgba(34,197,94,0.5)",
      bg: "rgba(34,197,94,0.1)",
      dot: "#22c55e",
      badge: "On-chain",
      icon: (
        <svg
          width="20"
          height="20"
          fill="none"
          viewBox="0 0 24 24"
          stroke="#22c55e"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20 12H4m8-8l8 8-8 8"
          />
        </svg>
      ),
    },
    {
      label: "Current Balance",
      value: formatEther(analytics.total_ether_balance),
      unit: "ETH",
      color: "#60a5fa",
      glow: "rgba(59,130,246,0.5)",
      bg: "rgba(59,130,246,0.1)",
      dot: "#3b82f6",
      badge: "Verified",
      icon: (
        <svg
          width="20"
          height="20"
          fill="none"
          viewBox="0 0 24 24"
          stroke="#3b82f6"
          strokeWidth={2}
        >
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M16 12h2" />
        </svg>
      ),
    },
    {
      label: "Total Transactions",
      value: String(analytics.sent_tx_count + analytics.received_tx_count),
      unit: "",
      color: "#c084fc",
      glow: "rgba(168,85,247,0.5)",
      bg: "rgba(168,85,247,0.1)",
      dot: "#a855f7",
      badge: `${analytics.wallet_age_days}d wallet age`,
      icon: (
        <svg
          width="20"
          height="20"
          fill="none"
          viewBox="0 0 24 24"
          stroke="#a855f7"
          strokeWidth={2}
        >
          <circle cx="12" cy="12" r="3" />
          <path
            strokeLinecap="round"
            d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
          />
        </svg>
      ),
    },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0b10",
        fontFamily: "'Inter', sans-serif",
        color: "#f1f5f9",
      }}
    >
      {/* ── Header ── */}
      <header
        style={{
          padding: "32px 32px 16px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            Wallet Analytics
          </h1>
          <p style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
            Real-time threat monitoring and network analysis
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              ...glass,
              padding: "8px 16px",
              borderRadius: 999,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#22c55e",
                display: "inline-block",
                boxShadow: "0 0 6px rgba(34,197,94,0.7)",
              }}
            />
            <span style={{ fontSize: 12, fontWeight: 500 }}>
              Network: Sepolia Testnet
            </span>
          </div>
        </div>
      </header>

      <div
        style={{
          padding: "0 32px 32px",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        {/* ── Stat Cards ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 24,
          }}
        >
          {statCards.map((card) => (
            <div
              key={card.label}
              style={{
                ...glass,
                borderRadius: 20,
                padding: 24,
                position: "relative",
                overflow: "hidden",
                transition: "transform 0.3s, box-shadow 0.3s",
                cursor: "default",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.boxShadow = `0 20px 60px ${card.bg}`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {/* Glow blob */}
              <div
                style={{
                  position: "absolute",
                  right: -16,
                  top: -16,
                  width: 96,
                  height: 96,
                  borderRadius: "50%",
                  background: card.bg,
                  filter: "blur(40px)",
                }}
              />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 16,
                }}
              >
                <span
                  style={{ fontSize: 13, fontWeight: 500, color: "#94a3b8" }}
                >
                  {card.label}
                </span>
                {card.icon}
              </div>
              <div
                style={{
                  fontSize: 40,
                  fontWeight: 700,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: card.color,
                  textShadow: `0 0 10px ${card.glow}`,
                  lineHeight: 1.1,
                }}
              >
                {card.value}
                {card.unit && (
                  <span
                    style={{
                      fontSize: 14,
                      color: `${card.color}80`,
                      marginLeft: 6,
                    }}
                  >
                    {card.unit}
                  </span>
                )}
              </div>
              <div
                style={{
                  marginTop: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 10,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#475569",
                }}
              >
                <span
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: card.dot,
                    display: "inline-block",
                  }}
                />
                {card.badge}
              </div>
            </div>
          ))}
        </div>

        {/* ── Chart Card ── */}
        <div style={{ ...glass, borderRadius: 20, overflow: "hidden" }}>
          {/* Tab bar */}
          <div
            style={{
              padding: "24px 24px 0",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              {(["timeline", "network"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 14,
                    fontWeight: 500,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    paddingBottom: 16,
                    paddingLeft: 4,
                    paddingRight: 4,
                    marginBottom: -1,
                    color: activeTab === tab ? "#fff" : "#64748b",
                    borderBottom:
                      activeTab === tab
                        ? "2px solid #6366f1"
                        : "2px solid transparent",
                    transition: "color 0.2s",
                  }}
                >
                  {tab === "timeline" ? (
                    <Shield style={{ width: 14, height: 14 }} />
                  ) : (
                    <Network style={{ width: 14, height: 14 }} />
                  )}
                  {tab === "timeline"
                    ? "Threat Score Timeline"
                    : "Transaction Network"}
                </button>
              ))}
            </div>
            {activeTab === "timeline" && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  paddingBottom: 16,
                }}
              >
                <span style={{ fontSize: 11, color: "#94a3b8" }}>
                  Time Range:
                </span>
                <select
                  style={{
                    background: "transparent",
                    border: "none",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#cbd5e1",
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  <option style={{ background: "#161821" }}>Last 1 Hour</option>
                  <option style={{ background: "#161821" }}>
                    Last 24 Hours
                  </option>
                  <option style={{ background: "#161821" }}>Last 7 Days</option>
                </select>
              </div>
            )}
          </div>

          <div style={{ padding: 32 }}>
            {activeTab === "timeline" ? (
              <>
                <div
                  style={{
                    marginBottom: 24,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    fontSize: 12,
                    color: "#64748b",
                  }}
                >
                  <p>
                    Each point is a real ML scan result.{" "}
                    <span style={{ color: "#f43f5e", fontWeight: 600 }}>
                      Red zone (&gt;70%) = high risk
                    </span>
                    .
                  </p>
                  <span style={{ opacity: 0.3 }}>|</span>
                  <p>DAO confirmation line boosts score consensus.</p>
                </div>

                {chartsLoading ? (
                  <div
                    style={{
                      height: 264,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Loader2
                      style={{ width: 24, height: 24, color: "#6366f1" }}
                      className="animate-spin"
                    />
                  </div>
                ) : timelineData.length === 0 ? (
                  <div
                    style={{
                      height: 264,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#475569",
                    }}
                  >
                    <Shield
                      style={{
                        width: 40,
                        height: 40,
                        marginBottom: 12,
                        opacity: 0.4,
                      }}
                    />
                    <p>
                      No scans yet. Send a transaction to see threat scores.
                    </p>
                    <p style={{ fontSize: 12, marginTop: 4, color: "#334155" }}>
                      Try sending to the Ronin address in the demo to populate
                      this chart.
                    </p>
                  </div>
                ) : (
                  <div style={{ height: 264, width: "100%" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={timelineData}
                        margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                      >
                        <defs>
                          <linearGradient
                            id="riskGradient"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#f43f5e"
                              stopOpacity={0.3}
                            />
                            <stop
                              offset="95%"
                              stopColor="#f43f5e"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgba(255,255,255,0.05)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="time"
                          stroke="#1e293b"
                          tick={{
                            fontSize: 10,
                            fill: "#475569",
                            fontFamily: "'JetBrains Mono', monospace",
                          }}
                        />
                        <YAxis
                          stroke="#1e293b"
                          domain={[0, 1]}
                          tickFormatter={(v: number) =>
                            `${(v * 100).toFixed(0)}%`
                          }
                          tick={{
                            fontSize: 10,
                            fill: "#475569",
                            fontFamily: "'JetBrains Mono', monospace",
                          }}
                        />
                        <Tooltip content={<TimelineTooltip />} />
                        <ReferenceLine
                          y={0.7}
                          stroke="#f43f5e"
                          strokeDasharray="6 3"
                          label={{
                            value: "High Risk",
                            fill: "#f43f5e",
                            fontSize: 10,
                            position: "insideTopRight",
                          }}
                        />
                        <ReferenceLine
                          y={0.4}
                          stroke="#facc15"
                          strokeDasharray="4 4"
                          label={{
                            value: "Medium",
                            fill: "#facc15",
                            fontSize: 10,
                            position: "insideTopRight",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="score"
                          stroke="#f43f5e"
                          strokeWidth={2.5}
                          fill="url(#riskGradient)"
                          dot={(props: any) => {
                            const { cx, cy, payload } = props;
                            return (
                              <circle
                                cx={cx}
                                cy={cy}
                                r={payload.isScammer ? 6 : 4}
                                fill={
                                  payload.isScammer
                                    ? "#f87171"
                                    : payload.score > 0.7
                                      ? "#fb923c"
                                      : "#4ade80"
                                }
                                stroke={payload.isScammer ? "#fff" : "none"}
                                strokeWidth={payload.isScammer ? 2 : 0}
                              />
                            );
                          }}
                          activeDot={{ r: 7, stroke: "#fff", strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            ) : (
              /* Network tab */
              <>
                <p style={{ fontSize: 12, color: "#475569", marginBottom: 16 }}>
                  Your wallet in the center. Each node is an address you
                  interacted with.{" "}
                  <span style={{ color: "#f87171" }}>
                    Red = DAO confirmed scam
                  </span>
                  .{" "}
                  <span style={{ color: "#4ade80" }}>Green = whitelisted</span>.
                  Hover for details.
                </p>
                {chartsLoading ? (
                  <div
                    style={{
                      height: 400,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Loader2
                      style={{ width: 24, height: 24, color: "#6366f1" }}
                      className="animate-spin"
                    />
                  </div>
                ) : graphNodes.length <= 1 ? (
                  <div
                    style={{
                      height: 400,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#475569",
                    }}
                  >
                    <Network
                      style={{
                        width: 40,
                        height: 40,
                        marginBottom: 12,
                        opacity: 0.4,
                      }}
                    />
                    <p>No transaction network yet.</p>
                    <p style={{ fontSize: 12, marginTop: 4, color: "#334155" }}>
                      Send or scan transactions to build the network graph.
                    </p>
                  </div>
                ) : (
                  <NetworkGraph nodes={graphNodes} edges={graphEdges} />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletAnalytics;
