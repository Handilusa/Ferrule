"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

export type ExplorerTabKey = "overview" | "ledgers" | "operations" | "contracts" | "agents" | "missions";

const TABS: { key: ExplorerTabKey; label: string; icon: string }[] = [
  { key: "overview", label: "Overview", icon: "◎" },
  { key: "ledgers", label: "Ledgers", icon: "▤" },
  { key: "operations", label: "Operations", icon: "⇄" },
  { key: "contracts", label: "Contracts", icon: "◇" },
  { key: "agents", label: "Agents", icon: "◆" },
  { key: "missions", label: "Missions", icon: "✦" },
];

interface ExplorerTabsProps {
  activeTab: ExplorerTabKey;
  onTabChange: (tab: ExplorerTabKey) => void;
}

export function ExplorerTabBar({ activeTab, onTabChange }: ExplorerTabsProps) {
  return (
    <div className="flex bg-zinc-900/80 border border-zinc-800 rounded-full p-1 overflow-x-auto scrollbar-thin">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-mono transition-all whitespace-nowrap ${
            activeTab === tab.key
              ? "bg-zinc-800 text-white shadow-lg"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <span className="opacity-60">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/* ── Tab Content: Paginated Ledgers ── */
interface PaginatedTableProps {
  backendUrl: string;
}

export function LedgersTab({ backendUrl }: PaginatedTableProps) {
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);

  const fetchLedgers = async (nextCursor?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50", order: "desc" });
      if (nextCursor) params.set("cursor", nextCursor);
      const res = await fetch(`${backendUrl}/api/explorer/ledgers?${params}`);
      const data = await res.json();
      setLedgers(data.ledgers || []);
      setCursor(data.next_cursor);
    } catch (_) {}
    setLoading(false);
  };

  useEffect(() => { fetchLedgers(); }, [backendUrl]);

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/80 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] font-mono">
          <thead>
            <tr className="text-zinc-600 text-left text-[9px] uppercase tracking-wider border-b border-zinc-800/40">
              <th className="px-4 py-3 font-medium">#Sequence</th>
              <th className="px-4 py-3 font-medium">Closed At</th>
              <th className="px-4 py-3 font-medium text-right">Ops</th>
              <th className="px-4 py-3 font-medium text-right">TXs</th>
              <th className="px-4 py-3 font-medium text-right">Failed</th>
              <th className="px-4 py-3 font-medium">Hash</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(10)].map((_, i) => (
                <tr key={i} className="border-b border-zinc-800/20 animate-pulse">
                  {[...Array(6)].map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-zinc-800/40 rounded w-16" /></td>
                  ))}
                </tr>
              ))
            ) : (
              ledgers.map((l) => (
                <tr
                  key={l.sequence}
                  className="border-b border-zinc-800/20 last:border-0 hover:bg-zinc-900/40 transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <a
                      href={`https://stellar.expert/explorer/testnet/ledger/${l.sequence}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-400 hover:text-teal-300"
                    >
                      #{l.sequence.toLocaleString()}
                    </a>
                  </td>
                  <td className="px-4 py-2.5 text-zinc-400">{new Date(l.closed_at).toLocaleTimeString()}</td>
                  <td className="px-4 py-2.5 text-right text-zinc-300">{l.operation_count}</td>
                  <td className="px-4 py-2.5 text-right text-zinc-300">{l.tx_count}</td>
                  <td className="px-4 py-2.5 text-right text-red-400/60">{l.failed_tx_count}</td>
                  <td className="px-4 py-2.5 text-zinc-600">{l.hash?.slice(0, 12)}…</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {cursor && (
        <div className="px-4 py-3 border-t border-zinc-800/40 flex justify-center">
          <button
            onClick={() => fetchLedgers(cursor)}
            className="px-4 py-1.5 text-xs font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-full hover:text-white hover:bg-zinc-800 transition-colors"
          >
            Load More
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Tab Content: Operations ── */
export function OperationsTab({ backendUrl }: PaginatedTableProps) {
  const [ops, setOps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");

  const fetchOps = async (nextCursor?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50", order: "desc" });
      if (nextCursor) params.set("cursor", nextCursor);
      const res = await fetch(`${backendUrl}/api/explorer/operations?${params}`);
      const data = await res.json();
      setOps(data.operations || []);
      setCursor(data.next_cursor);
    } catch (_) {}
    setLoading(false);
  };

  useEffect(() => { fetchOps(); }, [backendUrl]);

  const filteredOps = filterType === "all" ? ops : ops.filter((o) => o.type === filterType);
  const opTypes = [...new Set(ops.map((o) => o.type))];

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/80 overflow-hidden">
      {/* Filter bar */}
      <div className="px-4 py-2.5 border-b border-zinc-800/40 flex items-center gap-2 flex-wrap">
        <span className="text-[9px] text-zinc-600 uppercase tracking-wider font-medium">Filter:</span>
        <button
          onClick={() => setFilterType("all")}
          className={`px-3 py-1 rounded-full text-[10px] font-mono border transition-all ${
            filterType === "all"
              ? "bg-teal-400/10 border-teal-400/30 text-teal-400"
              : "bg-zinc-950 border-zinc-800 text-zinc-600 hover:text-zinc-400"
          }`}
        >
          All
        </button>
        {opTypes.map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`px-3 py-1 rounded-full text-[10px] font-mono border transition-all ${
              filterType === t
                ? "bg-teal-400/10 border-teal-400/30 text-teal-400"
                : "bg-zinc-950 border-zinc-800 text-zinc-600 hover:text-zinc-400"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[11px] font-mono">
          <thead>
            <tr className="text-zinc-600 text-left text-[9px] uppercase tracking-wider border-b border-zinc-800/40">
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">TX Hash</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(10)].map((_, i) => (
                <tr key={i} className="border-b border-zinc-800/20 animate-pulse">
                  {[...Array(4)].map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-zinc-800/40 rounded w-16" /></td>
                  ))}
                </tr>
              ))
            ) : (
              filteredOps.map((op) => (
                <tr
                  key={op.id}
                  className="border-b border-zinc-800/20 last:border-0 hover:bg-zinc-900/40 transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-medium bg-zinc-800 text-zinc-300">
                      {op.type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-zinc-400">{new Date(op.created_at).toLocaleTimeString()}</td>
                  <td className="px-4 py-2.5 text-zinc-300">
                    {op.amount ? `${op.amount} ${op.asset_code || ""}` : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <a
                      href={`https://stellar.expert/explorer/testnet/tx/${op.transaction_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-400 hover:text-teal-300"
                    >
                      {op.transaction_hash?.slice(0, 10)}…↗
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {cursor && (
        <div className="px-4 py-3 border-t border-zinc-800/40 flex justify-center">
          <button
            onClick={() => fetchOps(cursor)}
            className="px-4 py-1.5 text-xs font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-full hover:text-white hover:bg-zinc-800 transition-colors"
          >
            Load More
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Tab Content: Contracts (Simplified — static with links) ── */
export function ContractsTab() {
  const registryId = process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID || "—";
  const mandatesId = process.env.NEXT_PUBLIC_MANDATES_CONTRACT_ID || "—";

  const contracts = [
    {
      name: "agent-registry",
      id: registryId,
      description: "On-chain agent registry with SLA tracking. Functions: register, get_agent, list_agents, record_mission",
      language: "Soroban (Rust)",
      functions: ["register()", "get_agent()", "list_agents()", "record_mission()"],
    },
    {
      name: "risk-mandates",
      id: mandatesId,
      description: "AP2 risk mandate enforcement. Users define budget limits and domain whitelists on-chain.",
      language: "Soroban (Rust)",
      functions: ["set_mandate()", "get_mandate()"],
    },
  ];

  return (
    <div className="space-y-4">
      {contracts.map((c) => (
        <div key={c.name} className="rounded-xl border border-zinc-800/60 bg-zinc-950/80 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-amber-400 px-2 py-0.5 rounded bg-amber-400/10 border border-amber-400/20">
                {c.language}
              </span>
              <span className="text-sm font-mono text-white">{c.name}</span>
            </div>
            {c.id !== "—" && (
              <a
                href={`https://stellar.expert/explorer/testnet/contract/${c.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-mono text-teal-400 hover:text-teal-300"
              >
                View on Stellar Expert ↗
              </a>
            )}
          </div>

          <p className="text-[11px] text-zinc-500 mb-3">{c.description}</p>

          <div className="flex items-center gap-1 mb-2">
            <span className="text-[9px] text-zinc-600 uppercase tracking-wider font-medium">Contract ID:</span>
            <span className="text-[10px] font-mono text-zinc-400">
              {c.id === "—" ? "Not deployed" : `${c.id.slice(0, 12)}…${c.id.slice(-8)}`}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {c.functions.map((fn) => (
              <span
                key={fn}
                className="px-2 py-0.5 text-[9px] font-mono text-purple-400 bg-purple-400/10 border border-purple-400/20 rounded-full"
              >
                {fn}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
