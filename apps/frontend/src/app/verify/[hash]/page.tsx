"use client";

import { useEffect, useState } from "react";
import { FerruleLogo } from "@/components/svg/FerruleLogo";
import { useParams } from "next/navigation";
import Link from "next/link";

interface VerifiedReport {
  sessionId: string;
  query: string;
  report: string;
  funderPublicKey: string;
  timestamp: number;
  anchorHash: string | null;
  costUSDC: string;
}

export default function VerifyPage() {
  const params = useParams();
  const hash = params.hash as string;
  
  const [data, setData] = useState<VerifiedReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hash) return;
    
    const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000";
    
    fetch(`${BACKEND_URL}/api/orchestrate/verify/${hash}`)
      .then(res => {
        if (!res.ok) throw new Error("Report not found or expired from memory.");
        return res.json();
      })
      .then(json => {
        if (json.error) throw new Error(json.error);
        setData(json);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [hash]);

  const formatDate = (ts: number) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit"
    }).format(new Date(ts));
  };

  return (
    <div className="min-h-screen bg-black text-white font-mono flex flex-col items-center">
      <header className="w-full flex items-center justify-between px-6 py-4 border-b border-white/[0.05]">
        <Link href="/" className="flex items-center gap-3">
          <FerruleLogo className="w-8 h-8 text-white" />
          <span className="text-xl font-medium tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-400">
            Ferrule
          </span>
        </Link>
        <div className="flex bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/20 text-xs items-center gap-2">
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          Proof of Integrity
        </div>
      </header>

      <main className="w-full max-w-4xl px-4 py-12">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-emerald-500">
            <span className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-4" />
            <p className="text-sm">Verifying cryptographic hash on Ferrule Network...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-red-500/10 text-red-400 flex items-center justify-center rounded-full mb-6 relative">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Verification Failed</h1>
            <p className="text-zinc-500 max-w-md">{error}</p>
            <p className="text-xs text-zinc-600 mt-4">(Note: Reports are currently stored in volatile memory for the hackathon demo)</p>
          </div>
        ) : data && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Verification Badge */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-[50px] pointer-events-none" />
              
              <h1 className="text-2xl text-white font-medium mb-6">Cryptographically Verified Report</h1>
              
              <div className="grid sm:grid-cols-2 gap-6 text-sm">
                <div>
                  <div className="text-zinc-500 mb-1 text-xs uppercase tracking-wider">Original Query</div>
                  <div className="text-zinc-200">"{data.query}"</div>
                </div>
                <div>
                  <div className="text-zinc-500 mb-1 text-xs uppercase tracking-wider">Date Anchored</div>
                  <div className="text-zinc-200">{formatDate(data.timestamp)}</div>
                </div>
                <div>
                  <div className="text-zinc-500 mb-1 text-xs uppercase tracking-wider">Funded By Wallet</div>
                  <div className="text-emerald-400 truncate max-w-[200px]" title={data.funderPublicKey}>
                    {data.funderPublicKey}
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500 mb-1 text-xs uppercase tracking-wider">Mission Cost</div>
                  <div className="text-zinc-200">${data.costUSDC} USDC</div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-zinc-500 mb-1 text-xs uppercase tracking-wider">SHA-256 Hash</div>
                  <div className="text-zinc-400 font-mono text-xs bg-black/50 p-2 rounded border border-white/5 truncate">
                    {hash}
                  </div>
                </div>
                {data.anchorHash && (
                  <div className="sm:col-span-2 border-t border-zinc-800 pt-4">
                    <a 
                      href={`https://stellar.expert/explorer/testnet/tx/${data.anchorHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      View Immutable Anchor on Stellar Expert
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Document Content */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 md:p-10 shadow-2xl">
              <div className="text-zinc-300 text-sm md:text-base leading-relaxed whitespace-pre-wrap font-sans">
                {data.report}
              </div>
            </div>
            
            <div className="text-center text-zinc-600 text-xs pb-10">
              Generated by Ferrule Network
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
