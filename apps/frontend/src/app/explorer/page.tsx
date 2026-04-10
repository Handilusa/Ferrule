"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useExplorerSocket } from "@/hooks/useExplorerSocket";
import { FerruleLogo } from "@/components/svg/FerruleLogo";
import { AmbientBackground } from "@/components/AmbientBackground";
import { ExplorerStatsRow } from "@/components/explorer/ExplorerStats";
import { LedgerFeed } from "@/components/explorer/LedgerFeed";
import { AgentOpFeed } from "@/components/explorer/AgentOpFeed";
import { AgentLeaderboard } from "@/components/explorer/AgentLeaderboard";
import { OpsPerHourChart } from "@/components/explorer/OpsPerHourChart";
import { MissionsPerDayChart } from "@/components/explorer/MissionsPerDayChart";
import {
  ExplorerTabBar,
  LedgersTab,
  OperationsTab,
  ContractsTab,
  type ExplorerTabKey,
} from "@/components/explorer/ExplorerTabs";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000";

export default function ExplorerPage() {
  const explorer = useExplorerSocket(BACKEND_URL);
  const [activeTab, setActiveTab] = useState<ExplorerTabKey>("overview");
  const [agentRefresh, setAgentRefresh] = useState(0);

  // Compute chart data from stats (accumulated during session)
  const opsPerHourData = useMemo(() => {
    // Simulated hourly data — in production this would come from a time-series endpoint
    // For hackathon: generate from current ops_per_second with slight variance
    const base = explorer.stats.ops_per_second;
    return Array.from({ length: 24 }, (_, i) => {
      const variance = Math.sin(i * 0.5) * 0.3 + 0.7;
      return Math.max(0, Math.round(base * 3600 * variance * (0.3 + Math.random() * 0.7)));
    });
  }, [explorer.stats.ops_per_second]);

  const missionsPerDayData = useMemo(() => {
    const base = explorer.stats.total_missions;
    return Array.from({ length: 7 }, (_, i) => {
      const dayFactor = i === 6 ? 1 : 0.5 + Math.random() * 0.5;
      return Math.max(0, Math.round(base * dayFactor / 7));
    });
  }, [explorer.stats.total_missions]);

  return (
    <div className="flex flex-col h-screen bg-black text-white overflow-hidden relative">
      <AmbientBackground />

      {/* ═══ Top Bar ═══ */}
      <header className="shrink-0 relative z-50 flex items-center justify-between px-4 lg:px-8 py-2 bg-black border-b border-white/[0.05]">
        <Link href="/" className="flex items-center gap-3">
          <FerruleLogo animated={false} className="w-9 h-9" />
          <div className="flex items-center gap-2 pt-1.5">
            <span className="text-2xl font-medium tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-400">
              Ferrule
            </span>
            <span className="text-sm text-zinc-500 font-mono pt-1 tracking-wide">Explorer</span>
          </div>
        </Link>

        <div className="flex items-center gap-4 pt-1.5">
          {/* Connection status */}
          <span className={`flex items-center gap-2 text-sm font-mono ${explorer.connected ? "text-emerald-400/80" : "text-red-400/80"}`}>
            <span className={`w-2 h-2 rounded-full ${explorer.connected ? "bg-emerald-400 animate-pulse" : "bg-red-500"}`} />
            {explorer.connected ? "Live" : "Reconnecting..."}
          </span>

          {/* Navigation back to Console */}
          <Link
            href="/console"
            className="flex items-center gap-2 h-9 px-4 text-xs font-mono rounded-full bg-zinc-900/50 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            ← Console
          </Link>
        </div>
      </header>

      {/* ═══ Main Content ═══ */}
      <main className="flex-1 w-full px-4 lg:px-8 pt-6 pb-8 flex flex-col gap-5 overflow-y-auto scrollbar-thin">
        {/* Tab Bar */}
        <div className="flex justify-center">
          <ExplorerTabBar activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        {/* ════════════ OVERVIEW TAB ════════════ */}
        {activeTab === "overview" && (
          <div className="flex flex-col gap-5 animate-fade-in">
            {/* Hero Stats */}
            <ExplorerStatsRow stats={explorer.stats} connected={explorer.connected} />

            {/* Two-column: Ledgers + Agent Ops */}
            <div className="grid lg:grid-cols-2 gap-4" style={{ minHeight: 340 }}>
              <LedgerFeed ledgers={explorer.ledgers} />
              <AgentOpFeed agentOps={explorer.agentOps} />
            </div>

            {/* Agent Leaderboard */}
            <AgentLeaderboard backendUrl={BACKEND_URL} refreshTrigger={agentRefresh} />

            {/* Mini Charts */}
            <div className="grid lg:grid-cols-2 gap-4">
              <OpsPerHourChart data={opsPerHourData} />
              <MissionsPerDayChart data={missionsPerDayData} />
            </div>
          </div>
        )}

        {/* ════════════ LEDGERS TAB ════════════ */}
        {activeTab === "ledgers" && (
          <div className="animate-fade-in">
            <LedgersTab backendUrl={BACKEND_URL} />
          </div>
        )}

        {/* ════════════ OPERATIONS TAB ════════════ */}
        {activeTab === "operations" && (
          <div className="animate-fade-in">
            <OperationsTab backendUrl={BACKEND_URL} />
          </div>
        )}

        {/* ════════════ CONTRACTS TAB ════════════ */}
        {activeTab === "contracts" && (
          <div className="animate-fade-in">
            <ContractsTab />
          </div>
        )}

        {/* ════════════ AGENTS TAB ════════════ */}
        {activeTab === "agents" && (
          <div className="animate-fade-in space-y-4">
            <AgentLeaderboard backendUrl={BACKEND_URL} refreshTrigger={agentRefresh} />

            {/* Agent detail info */}
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/80 p-5">
              <span className="text-[10px] text-zinc-600 tracking-[0.15em] uppercase font-medium block mb-3">
                Agent Architecture
              </span>
              <div className="grid sm:grid-cols-3 gap-4 text-[11px] font-mono">
                <div className="p-3 rounded-lg border border-zinc-800/40 bg-zinc-900/30">
                  <span className="text-orange-400 text-xs font-medium block mb-1">ferrule_search</span>
                  <span className="text-zinc-500">Protocol: x402 HTTP</span><br />
                  <span className="text-zinc-500">Cost: 0.0002 USDC/query</span><br />
                  <span className="text-zinc-600 text-[10px]">Tavily API → Due diligence web search</span>
                </div>
                <div className="p-3 rounded-lg border border-zinc-800/40 bg-zinc-900/30">
                  <span className="text-purple-400 text-xs font-medium block mb-1">ferrule_llm</span>
                  <span className="text-zinc-500">Protocol: MPP Session</span><br />
                  <span className="text-zinc-500">Cost: 0.00001 USDC/batch</span><br />
                  <span className="text-zinc-600 text-[10px]">Gemini 2.5 → Research synthesizer</span>
                </div>
                <div className="p-3 rounded-lg border border-zinc-800/40 bg-zinc-900/30">
                  <span className="text-red-400 text-xs font-medium block mb-1">ferrule_risk</span>
                  <span className="text-zinc-500">Protocol: x402 HTTP</span><br />
                  <span className="text-zinc-500">Cost: 0.005 USDC/eval</span><br />
                  <span className="text-zinc-600 text-[10px]">Adversarial risk evaluator</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════ MISSIONS TAB ════════════ */}
        {activeTab === "missions" && (
          <div className="animate-fade-in">
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/80 p-5">
              <span className="text-[10px] text-zinc-600 tracking-[0.15em] uppercase font-medium block mb-3">
                Mission History
              </span>
              <div className="text-[11px] text-zinc-500 font-mono space-y-2">
                <p>Total missions recorded on-chain: <span className="text-white">{explorer.stats.total_missions}</span></p>
                <p>Reports anchored (SHA-256): <span className="text-blue-400">{explorer.stats.reports_anchored}</span></p>
                <p>Success rate: <span className="text-emerald-400">{explorer.stats.success_rate}%</span></p>
              </div>

              <div className="mt-4 pt-4 border-t border-zinc-800/40">
                <span className="text-[9px] text-zinc-600 uppercase tracking-wider font-medium block mb-2">
                  Verify Report Integrity
                </span>
                <p className="text-[10px] text-zinc-600 font-mono mb-2">
                  Each mission report is SHA-256 hashed and anchored on the Stellar ledger via <code className="text-zinc-400">manageData</code>.
                  Visit the verification page to check any report hash.
                </p>
                <Link
                  href="/verify"
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-mono text-teal-400 border border-teal-400/30 rounded-full bg-teal-400/5 hover:bg-teal-400/10 transition-colors"
                >
                  Open Verifier →
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
