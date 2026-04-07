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

      <main className="w-full max-w-6xl px-4 md:px-8 py-12">
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
              <div className="text-zinc-300 text-sm md:text-base leading-relaxed font-sans">
                {renderMarkdown(data.report, false)}
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

function boldify(text: string): string {
  let result = text;
  result = result.replace(/\*\*(.*?)\*\*/g, '<strong class="text-zinc-200 font-medium">$1</strong>');
  result = result.replace(/`([^`]+)`/g, '<code class="text-teal-400/80 bg-teal-400/5 px-1 py-0.5 rounded text-xs font-mono">$1</code>');
  return result;
}

function renderMarkdown(raw: string, isMaximized: boolean): React.ReactNode[] {
  const cleaned = raw.replace(/\s*\[[\d,\s-]+\]/g, "");
  const lines = cleaned.split("\n");
  const nodes: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    let content: React.ReactNode = null;

    if (trimmed.startsWith("### ")) {
      content = (
        <h3 className="text-sm font-semibold text-teal-400/90 mt-6 mb-2 flex items-center gap-2">
          <span className="w-1 h-4 bg-teal-400/40 rounded-full shrink-0" />
          {trimmed.slice(4)}
        </h3>
      );
    } else if (trimmed.startsWith("## ")) {
      const headingText = trimmed.slice(3);
      const isRisk = headingText.trim() === "Risk Assessment";
      
      content = (
        <h2 className={`text-xs font-semibold mt-7 mb-3 tracking-[0.15em] uppercase border-b pb-2 flex items-center gap-2 ${isRisk ? "text-orange-400 border-orange-900/40" : "text-zinc-300 border-zinc-800/60"}`}>
          {isRisk && <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)] animate-pulse" />}
          {headingText}
        </h2>
      );
    } else if (trimmed.startsWith("# ")) {
      content = <h1 className="text-base font-semibold text-zinc-100 mt-5 mb-3">{trimmed.slice(2)}</h1>;
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      content = (
        <div className="flex gap-2.5 text-zinc-400 text-sm leading-relaxed ml-3 my-0.5">
          <span className="text-zinc-600 shrink-0 mt-1.5">•</span>
          <span dangerouslySetInnerHTML={{ __html: boldify(trimmed.slice(2)) }} />
        </div>
      );
    } else if (/^\d+\.\s/.test(trimmed)) {
      const match = trimmed.match(/^(\d+)\.\s(.*)$/);
      if (match) {
        content = (
          <div className="flex gap-2.5 text-zinc-400 text-sm leading-relaxed ml-3 my-0.5">
            <span className="text-teal-400/50 shrink-0 font-mono text-xs mt-0.5 w-4 text-right">{match[1]}.</span>
            <span dangerouslySetInnerHTML={{ __html: boldify(match[2]) }} />
          </div>
        );
      }
    } else if (trimmed === "---") {
      content = <div className="my-4 border-t border-zinc-800/40" />;
    } else if (trimmed.startsWith("**[HITL:")) {
      const isCancel = trimmed.includes("[HITL:CANCEL]");
      const isRedirect = trimmed.includes("[HITL:REDIRECT]");
      
      const borderColor = isCancel ? "border-red-900/50 bg-red-950/20" : isRedirect ? "border-amber-900/50 bg-amber-950/20" : "border-emerald-900/50 bg-emerald-950/20";
      const textColor = isCancel ? "text-red-400" : isRedirect ? "text-amber-400" : "text-emerald-400";
      const dotColor = isCancel ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.7)]" : isRedirect ? "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.7)]" : "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.7)]";
      const iconStroke = isCancel ? "#f87171" : isRedirect ? "#fbbf24" : "#34d399";
      
      const bannerTitle = trimmed.replace(/\*\*/g, "").replace(/\[HITL:(CANCEL|APPROVE|REDIRECT)\]\s*/, "");
      
      const nextLine = i + 1 < lines.length ? lines[i + 1]?.trim() : "";
      if (nextLine && !nextLine.startsWith("---") && nextLine !== "") {
        i++;
      }

      const svgIcon = isCancel ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={iconStroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-80"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
      ) : isRedirect ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={iconStroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-80"><path d="M18 8L22 12L18 16"/><path d="M2 12H22"/><path d="M6 16L2 12L6 8"/></svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={iconStroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-80"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
      );
      
      content = (
        <div className={`my-4 p-4 rounded-xl border ${borderColor} flex flex-col gap-2`}>
          <div className={`flex items-center gap-2.5 text-xs font-mono tracking-widest uppercase ${textColor}`}>
            <span className={`w-2 h-2 rounded-full ${dotColor} animate-pulse`} />
            {svgIcon}
            {bannerTitle}
          </div>
          {nextLine && !nextLine.startsWith("---") && nextLine !== "" && (
            <p className="text-xs text-zinc-400 leading-relaxed pl-[26px]" dangerouslySetInnerHTML={{ __html: boldify(nextLine) }} />
          )}
        </div>
      );
    } else if (trimmed === "") {
      content = <div className="h-3" />;
    } else {
      content = (
        <p className="text-sm text-zinc-400 leading-[1.75] mb-1" dangerouslySetInnerHTML={{ __html: boldify(trimmed) }} />
      );
    }

    if (isMaximized) {
      nodes.push(
        <div key={i} className="flex gap-4 group w-full hover:bg-zinc-900/30 -mx-4 px-4 rounded-sm transition-colors">
          <div className="w-8 shrink-0 text-right text-[10px] text-zinc-700 font-mono select-none pt-[3px] group-hover:text-zinc-500">
            {i + 1}
          </div>
          <div className="flex-1 min-w-0">{content}</div>
        </div>
      );
    } else {
      nodes.push(<div key={i}>{content}</div>);
    }
  }

  return nodes;
}
