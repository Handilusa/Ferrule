"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/* ─── Types for Explorer WebSocket events ─── */

export interface ExplorerLedger {
  sequence: number;
  closed_at: string;
  operation_count: number;
  tx_count: number;
  failed_tx_count: number;
  base_fee: number;
  timestamp: number;
}

export interface ExplorerOperation {
  id: string;
  type: string;
  created_at: string;
  transaction_hash: string;
  source_account: string;
  ferruleType: "x402" | "ANC" | "SLA" | "MANDATE" | "MPP";
  ferruleLabel: string;
  ferruleDetail: string;
  timestamp: number;
}

export interface ExplorerStats {
  total_ops: number;
  ops_per_second: number;
  avg_ledger_time: number;
  total_usdc_x402: number;
  reports_anchored: number;
  active_monitors: number;
  success_rate: number;
  total_missions: number;
}

export interface ExplorerSocketState {
  ledgers: ExplorerLedger[];
  operations: ExplorerOperation[];
  agentOps: ExplorerOperation[];
  stats: ExplorerStats;
  connected: boolean;
}

const DEFAULT_STATS: ExplorerStats = {
  total_ops: 0,
  ops_per_second: 0,
  avg_ledger_time: 5.0,
  total_usdc_x402: 0,
  reports_anchored: 0,
  active_monitors: 0,
  success_rate: 100,
  total_missions: 0,
};

const MAX_LEDGERS = 50;
const MAX_OPS = 100;
const MAX_AGENT_OPS = 50;

export function useExplorerSocket(backendUrl: string): ExplorerSocketState {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [ledgers, setLedgers] = useState<ExplorerLedger[]>([]);
  const [operations, setOperations] = useState<ExplorerOperation[]>([]);
  const [agentOps, setAgentOps] = useState<ExplorerOperation[]>([]);
  const [stats, setStats] = useState<ExplorerStats>(DEFAULT_STATS);

  // Fetch initial stats via REST on mount
  useEffect(() => {
    fetch(`${backendUrl}/api/explorer/stats`)
      .then((r) => r.json())
      .then((data) => setStats((prev) => ({ ...prev, ...data })))
      .catch(() => {});
  }, [backendUrl]);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      const wsUrl = backendUrl.replace(/^http/, "ws") + "/ws";
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case "explorer:ledger":
              setLedgers((prev) => {
                const next = [data as ExplorerLedger, ...prev];
                return next.slice(0, MAX_LEDGERS);
              });
              break;

            case "explorer:operation":
              setOperations((prev) => {
                const next = [data as ExplorerOperation, ...prev];
                return next.slice(0, MAX_OPS);
              });
              break;

            case "explorer:agent_op":
              setAgentOps((prev) => {
                const next = [data as ExplorerOperation, ...prev];
                return next.slice(0, MAX_AGENT_OPS);
              });
              break;

            case "explorer:stats":
              setStats(data as ExplorerStats);
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
  }, [backendUrl]);

  return {
    ledgers,
    operations,
    agentOps,
    stats,
    connected,
  };
}
