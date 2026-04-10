"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface AgentData {
  name: string;
  total_missions: number;
  successful_missions: number;
  success_rate: number;
  usdc_earned: string;
  status: string;
  protocol: string;
  price: string;
}

interface AgentLeaderboardProps {
  backendUrl: string;
  refreshTrigger?: number; // incremented to force refresh
}

export function AgentLeaderboard({ backendUrl, refreshTrigger = 0 }: AgentLeaderboardProps) {
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${backendUrl}/api/explorer/agents`)
      .then((r) => r.json())
      .then((data) => {
        setAgents(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [backendUrl, refreshTrigger]);

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/80 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800/40 flex items-center justify-between">
        <span className="text-[10px] text-zinc-600 tracking-[0.2em] uppercase font-medium">
          Agent Leaderboard
        </span>
        <span className="text-[10px] text-zinc-600 font-mono">
          {agents.length} agents registered
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] font-mono">
          <thead>
            <tr className="text-zinc-600 text-left text-[9px] uppercase tracking-wider border-b border-zinc-800/30">
              <th className="px-4 py-2.5 font-medium">Agent</th>
              <th className="px-4 py-2.5 font-medium text-right">Missions</th>
              <th className="px-4 py-2.5 font-medium text-right">Success%</th>
              <th className="px-4 py-2.5 font-medium text-right">USDC Earned</th>
              <th className="px-4 py-2.5 font-medium text-right">Protocol</th>
              <th className="px-4 py-2.5 font-medium text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(3)].map((_, i) => (
                <tr key={i} className="border-b border-zinc-800/20 animate-pulse">
                  <td className="px-4 py-3"><div className="w-24 h-4 bg-zinc-800/60 rounded" /></td>
                  <td className="px-4 py-3 text-right"><div className="w-10 h-4 bg-zinc-800/40 rounded ml-auto" /></td>
                  <td className="px-4 py-3 text-right"><div className="w-12 h-4 bg-zinc-800/40 rounded ml-auto" /></td>
                  <td className="px-4 py-3 text-right"><div className="w-14 h-4 bg-zinc-800/40 rounded ml-auto" /></td>
                  <td className="px-4 py-3 text-right"><div className="w-10 h-4 bg-zinc-800/30 rounded ml-auto" /></td>
                  <td className="px-4 py-3 text-center"><div className="w-6 h-4 bg-zinc-800/30 rounded mx-auto" /></td>
                </tr>
              ))
            ) : (
              agents.map((agent, i) => {
                const successColor =
                  agent.success_rate >= 95
                    ? "text-emerald-400"
                    : agent.success_rate >= 80
                    ? "text-amber-400"
                    : "text-red-400";

                const protocolBadge: Record<string, { color: string; bg: string }> = {
                  x402: { color: "text-orange-400", bg: "bg-orange-400/10" },
                  mpp: { color: "text-purple-400", bg: "bg-purple-400/10" },
                };
                const pb = protocolBadge[agent.protocol] || protocolBadge.x402;

                return (
                  <motion.tr
                    key={agent.name}
                    className="border-b border-zinc-800/20 last:border-0 hover:bg-zinc-900/40 transition-colors"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08, duration: 0.3 }}
                  >
                    <td className="px-4 py-3">
                      <span className="text-zinc-200">{agent.name}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-300">
                      {agent.total_missions.toLocaleString()}
                    </td>
                    <td className={`px-4 py-3 text-right ${successColor}`}>
                      {agent.success_rate.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right text-amber-400">
                      ${agent.usdc_earned}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-medium ${pb.color} ${pb.bg}`}>
                        {agent.protocol.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span title={agent.status === "active" ? "Active" : "Inactive"}>
                        {agent.status === "active" ? "🟢" : "🔴"}
                      </span>
                    </td>
                  </motion.tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
