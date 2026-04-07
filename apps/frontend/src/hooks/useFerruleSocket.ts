"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/* ─── Event types matching exact backend broadcast shapes ─── */

export interface FeedEvent {
  id: string;
  type: "commit" | "x402" | "onchain" | "settle" | "agent" | "error" | "system";
  label: string;
  detail: string;
  amount?: string;
  signature?: string;
  txId?: string;
  query?: string;
  timestamp: number;
  elapsed: number; // seconds since session start
}

export interface Transaction {
  type: string;
  agent: string;
  txId: string;
  description: string;
  amountUSDC?: string;
  timestamp: number;
}

export interface SocketState {
  // KPI metrics
  offChainCount: number;
  onChainCount: number;
  totalSpent: number;
  networkCost: number;
  x402Payments: number;

  // Channel state
  channelId: string | null;
  channelStatus: "idle" | "open" | "streaming" | "closing" | "settled";
  budget: number;

  // Agent statuses
  agentStatuses: { llm: string; search: string; risk: string };

  // Session timing
  sessionId: string | null;
  sessionStart: number | null;
  sessionDuration: string | null;
  
  // Due Diligence Risk
  riskScore: number | null;

  // HITL
  hitlVisible: boolean;
  hitlQuery: string;
  hitlContext: string;
  resolveHitl: () => void;

  // Data feeds
  feedEvents: FeedEvent[];
  transactions: Transaction[];
  streamedText: string;

  // Connection
  connected: boolean;

  // Controls
  reset: () => void;
  setBudget: (b: number) => void;
}

let eventCounter = 0;

export function useFerruleSocket(backendUrl: string, active: boolean): SocketState {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  // KPIs
  const [offChainCount, setOffChainCount] = useState(0);
  const [onChainCount, setOnChainCount] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [networkCost, setNetworkCost] = useState(0);
  const [x402Payments, setX402Payments] = useState(0);

  // Channel
  const [channelId, setChannelId] = useState<string | null>(null);
  const [channelStatus, setChannelStatus] = useState<SocketState["channelStatus"]>("idle");
  const [budget, setBudget] = useState(0.25);

  // Agents
  const [agentStatuses, setAgentStatuses] = useState<{ llm: string; search: string; risk: string }>({
    llm: "idle",
    search: "idle",
    risk: "idle",
  });

  // Session
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStart, setSessionStart] = useState<number | null>(null);
  const [sessionDuration, setSessionDuration] = useState<string | null>(null);
  const [riskScore, setRiskScore] = useState<number | null>(null);

  // HITL
  const [hitlVisible, setHitlVisible] = useState(false);
  const [hitlQuery, setHitlQuery] = useState("");
  const [hitlContext, setHitlContext] = useState("");
  const resolveHitl = useCallback(() => setHitlVisible(false), []);

  // Feeds
  const [feedEvents, setFeedEvents] = useState<FeedEvent[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [streamedText, setStreamedText] = useState("");

  const activeRef = useRef(active);
  activeRef.current = active;

  const sessionStartRef = useRef<number | null>(null);

  const reset = useCallback(() => {
    setOffChainCount(0);
    setOnChainCount(0);
    setTotalSpent(0);
    setNetworkCost(0);
    setX402Payments(0);
    setChannelId(null);
    setChannelStatus("idle");
    setAgentStatuses({ llm: "idle", search: "idle", risk: "idle" });
    setSessionId(null);
    setSessionStart(null);
    setSessionDuration(null);
    setRiskScore(null);
    setHitlVisible(false);
    setHitlQuery("");
    setHitlContext("");
    setFeedEvents([]);
    setTransactions([]);
    setStreamedText("");
    sessionStartRef.current = null;
    eventCounter = 0;
  }, []);

  // Helper: add a feed event (newest first)
  const addFeedEvent = useCallback(
    (
      type: FeedEvent["type"],
      label: string,
      detail: string,
      extra?: Partial<FeedEvent>
    ) => {
      const now = Date.now();
      if (!sessionStartRef.current) {
        sessionStartRef.current = now;
        setSessionStart(now);
      }
      const elapsed = (now - sessionStartRef.current) / 1000;
      const id = `evt_${++eventCounter}_${now}`;
      setFeedEvents((prev) => [
        { id, type, label, detail, timestamp: now, elapsed, ...extra },
        ...prev,
      ]);
    },
    []
  );

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      const wsUrl = backendUrl.replace(/^http/, "ws") + "/ws";
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);

      ws.onmessage = (event) => {
        if (!activeRef.current) return;

        try {
          const data = JSON.parse(event.data);
          
          if (data.sessionId && !activeRef.current) {
            // Ignore if active is false, but capture sessionId if active
          }
          if (data.sessionId) {
            setSessionId(data.sessionId);
          }

          switch (data.type) {
            case "commitment":
              setOffChainCount(data.offChainCount || data.batchNumber || 0);
              setTotalSpent(parseFloat(data.amount) || 0);
              setChannelStatus((prev) => 
                (prev === "closing" || prev === "settled") ? prev : "streaming"
              );
              addFeedEvent("commit", "COMMIT", `×${data.batchNumber} batch → $${data.amount} USDC`, {
                amount: data.amount,
                signature: data.signature,
              });
              break;

            case "x402_payment":
              setX402Payments((prev) => prev + 1);
              setTotalSpent((prev) => prev + 0.0002);
              addFeedEvent("x402", "x402 REQUEST", `"${data.query}" → ${data.resultCount} results`, {
                amount: "0.0002",
                query: data.query,
              });
              break;

            case "onchain_tx": {
              setOnChainCount(data.onChainCount || 0);
              setNetworkCost((prev) => prev + 0.00001);
              
              let txLabel = "TX";
              let txDesc = "On-Chain Transaction";
              
              if (data.txType === "channel_open") {
                setChannelStatus("open");
                if (data.txId) setChannelId(data.txId);
                txLabel = "OPEN";
                txDesc = "MPP Channel opened on Soroban";
              } else if (data.txType === "channel_close") {
                setChannelStatus("closing");
                txLabel = "SETTLE";
                txDesc = `${data.settledCommitments || "?"} commits settled → ${data.amountUSDC || "?"} USDC`;
              } else if (data.txType === "x402_payment") {
                txLabel = "x402_TX";
                txDesc = `x402 Gateway Payment → ${data.amountUSDC} USDC`;
              }

              setTransactions((prev) => [
                ...prev,
                {
                  type: data.txType || "unknown",
                  agent: data.agent || "",
                  txId: data.txId || "",
                  description: txDesc,
                  amountUSDC: data.amountUSDC,
                  timestamp: data.timestamp,
                },
              ]);
              addFeedEvent("onchain", txLabel, txDesc, {
                txId: data.txId,
                amount: data.amountUSDC,
              });
              break;
            }

            case "timeline":
              addFeedEvent("system", "SYSTEM", data.description);
              break;

            case "agent_status":
              setAgentStatuses((prev) => ({
                ...prev,
                [data.agent]: data.status,
              }));
              // Trigger HITL modal when risk agent is awaiting directive
              if (data.agent === "risk" && data.status === "AWAITING_DIRECTIVE") {
                setHitlQuery(data.query || "");
                setHitlContext(data.context || "");
                setHitlVisible(true);
              }
              addFeedEvent("agent", data.agent?.toUpperCase() || "AGENT", data.detail || data.status);
              break;

            case "directive_applied":
              setAgentStatuses((prev) => ({
                ...prev,
                [data.agent]: "directive_injected",
              }));
              addFeedEvent("system", "DIRECTIVE", `Human injected directive to ${data.agent.toUpperCase()}: "${data.directive}"`);
              break;
              
            case "risk_score_update":
              setRiskScore(data.score);
              break;

            case "result_chunk":
              setStreamedText((prev) => prev + (data.text || ""));
              break;

            case "session_complete":
              setTotalSpent(parseFloat(data.totalSpentUSDC) || 0);
              setSessionDuration(data.duration);
              setChannelStatus("settled");
              setAgentStatuses({ llm: "idle", search: "idle", risk: "idle" });
              addFeedEvent("settle", "COMPLETE", `Session settled in ${data.duration}`);
              break;

            case "payment_blocked":
              addFeedEvent("error", "MANDATE BLOCKED", `${data.detail} [reason: ${data.reason}]`, {
                amount: "0.0000",
              });
              break;

            case "error":
              addFeedEvent("error", "ERROR", data.message || "Unknown error");
              break;
          }
        } catch {
          // Ignore non-JSON
        }
      };

      ws.onclose = () => {
        setConnected(false);
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => setConnected(false);
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (ws) ws.close();
      wsRef.current = null;
    };
  }, [backendUrl, addFeedEvent]);

  return {
    offChainCount,
    onChainCount,
    totalSpent,
    networkCost,
    x402Payments,
    channelId,
    channelStatus,
    budget,
    agentStatuses,
    sessionId,
    sessionStart,
    sessionDuration,
    riskScore,
    hitlVisible,
    hitlQuery,
    hitlContext,
    resolveHitl,
    feedEvents,
    transactions,
    streamedText,
    connected,
    reset,
    setBudget,
  };
}
