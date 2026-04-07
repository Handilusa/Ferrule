"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { FerruleLogo } from "@/components/svg/FerruleLogo";

interface HistorySession {
  sessionId: string;
  query: string;
  report?: string;
  reportHash?: string;
  budget: number;
  totalSpentUSDC: number;
  offChainCommitments: number;
  onChainTxs: number;
  x402Payments: number;
  networkCost: number;
  timestamp: number;
  anchorHash: string | null;
}

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  address: string | null;
  backendUrl: string;
}

export function HistoryPanel({ isOpen, onClose, address, backendUrl }: HistoryPanelProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [history, setHistory] = useState<HistorySession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredHistory = history.filter(session => 
    session.query.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    if (isOpen && address) {
      setIsLoading(true);
      fetch(`${backendUrl}/api/orchestrate/history?wallet=${encodeURIComponent(address)}`)
        .then((res) => res.json())
        .then((data) => {
          setHistory(data.history || []);
        })
        .catch((err) => console.error("Failed to load history:", err))
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, address, backendUrl]);

  useEffect(() => {
    if (isOpen) {
      gsap.to(overlayRef.current, { autoAlpha: 1, duration: 0.3, ease: "power2.out" });
      gsap.to(panelRef.current, { x: 0, duration: 0.4, ease: "expo.out" });
    } else {
      gsap.to(overlayRef.current, { autoAlpha: 0, duration: 0.3, ease: "power2.in" });
      gsap.to(panelRef.current, { x: "100%", duration: 0.3, ease: "expo.in" });
      // Reset expansions when closed
      setTimeout(() => setExpandedId(null), 300);
    }
  }, [isOpen]);

  const formatDate = (ts: number) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
    }).format(new Date(ts));
  };

  return (
    <>
      <div 
        ref={overlayRef}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] invisible opacity-0"
        onClick={onClose}
      />
      <div 
        ref={panelRef}
        className="fixed top-0 right-0 h-full w-full max-w-md bg-zinc-950 border-l border-zinc-800/80 shadow-2xl z-[101] flex flex-col translate-x-full"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.05]">
          <div className="flex items-center gap-3">
            <FerruleLogo className="w-5 h-5 text-emerald-400" theme="emerald" />
            <h2 className="text-lg font-mono tracking-tight text-white">Mission History</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
            </svg>
          </button>
        </div>

        <div className="px-6 pt-4 pb-2 border-b border-white/[0.05]">
          <input
            type="text"
            placeholder="Search missions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 text-sm text-zinc-200 px-3 py-2 rounded-lg font-mono placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-4">
          {!address ? (
            <div className="text-center text-zinc-500 font-mono py-10">Wallet not connected</div>
          ) : isLoading ? (
            <div className="flex justify-center py-10">
              <span className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center text-zinc-500 font-mono py-10">
              No anchored missions found for this wallet in the current session memory.
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center text-zinc-500 font-mono py-10">
              No missions match your search "{searchTerm}".
            </div>
          ) : (
            filteredHistory.map((session) => {
              const refund = Math.max(0, session.budget - session.totalSpentUSDC - session.networkCost);
              const isExpanded = expandedId === session.sessionId;
              
              return (
                <div key={session.sessionId} className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 font-mono group transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-[10px] text-zinc-500">{formatDate(session.timestamp)}</span>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      SETTLED
                    </span>
                  </div>
                  <p className="text-sm text-zinc-300 mb-4 line-clamp-2 leading-relaxed">
                    "{session.query}"
                  </p>
                  
                  <div className="grid grid-cols-2 gap-2 text-[10px] mb-4">
                    <div className="bg-black/50 p-2 rounded-lg border border-white/5">
                      <span className="text-zinc-500 block mb-1 uppercase">Spent</span>
                      <span className="text-zinc-300">${session.totalSpentUSDC.toFixed(4)} USDC</span>
                    </div>
                    <div className="bg-black/50 p-2 rounded-lg border border-white/5">
                      <span className="text-zinc-500 block mb-1 uppercase">Refunded</span>
                      <span className="text-emerald-400">${refund.toFixed(4)} USDC</span>
                    </div>
                    <div className="bg-black/50 p-2 rounded-lg border border-white/5">
                      <span className="text-zinc-500 block mb-1 uppercase">Commits</span>
                      <span className="text-zinc-300">{session.offChainCommitments} MPP</span>
                    </div>
                    <div className="bg-black/50 p-2 rounded-lg border border-white/5">
                      <span className="text-zinc-500 block mb-1 uppercase">Searches</span>
                      <span className="text-zinc-300">{session.x402Payments} x402</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 mt-2">
                    {session.report && (
                      <button 
                        onClick={() => setExpandedId(isExpanded ? null : session.sessionId)}
                        className="w-full text-center py-2 text-[10px] uppercase tracking-wider text-zinc-400 bg-zinc-800/30 hover:bg-zinc-800/60 border border-zinc-700/50 rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        {isExpanded ? "Hide Report" : "View Final Report"}
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6"/></svg>
                      </button>
                    )}

                    {isExpanded && session.report && (
                      <div className="mt-2 p-3 bg-zinc-950/80 border border-zinc-800/80 rounded-lg max-h-[300px] overflow-y-auto scrollbar-thin text-xs text-zinc-400 whitespace-pre-wrap leading-relaxed">
                        {session.report}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      {session.reportHash && (
                        <a
                          href={`/verify/${session.reportHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center py-2 text-[10px] uppercase tracking-wider text-blue-400 bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/20 rounded-lg transition-colors cursor-pointer gap-2"
                        >
                          Open Report
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        </a>
                      )}

                      {session.anchorHash && (
                        <a 
                          href={`https://stellar.expert/explorer/testnet/tx/${session.anchorHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center py-2 text-[10px] uppercase tracking-wider text-emerald-500/80 bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/20 rounded-lg transition-colors cursor-pointer gap-2"
                        >
                          Verify On-Chain
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
