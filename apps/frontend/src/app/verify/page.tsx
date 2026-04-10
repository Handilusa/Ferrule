"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FerruleLogo } from "@/components/svg/FerruleLogo";

export default function VerifyIndexPage() {
  const [hash, setHash] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = hash.trim();
    if (cleaned.length > 0) {
      router.push(`/verify/${cleaned}`);
    }
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

      <main className="flex-1 flex flex-col items-center justify-center px-4 max-w-2xl w-full -mt-16">
        {/* Icon */}
        <div className="w-20 h-20 mb-8 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-2xl">
          <svg className="w-10 h-10 text-emerald-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
        </div>

        <h1 className="text-2xl font-medium text-white mb-2 text-center">
          Verify Report Integrity
        </h1>
        <p className="text-sm text-zinc-500 text-center mb-8 max-w-md leading-relaxed">
          Every Ferrule research report is SHA-256 hashed and anchored on the Stellar ledger. 
          Paste a report hash below to verify its authenticity.
        </p>

        {/* Search form */}
        <form onSubmit={handleSubmit} className="w-full max-w-lg">
          <div className="flex gap-2">
            <input
              type="text"
              value={hash}
              onChange={(e) => setHash(e.target.value)}
              placeholder="Paste SHA-256 hash — e.g. a1b2c3d4e5f6..."
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 font-mono focus:outline-none focus:border-zinc-700 transition-colors"
              spellCheck={false}
              autoFocus
            />
            <button
              type="submit"
              disabled={!hash.trim()}
              className="px-5 py-3 rounded-xl bg-white text-black text-sm font-medium hover:bg-zinc-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
            >
              Verify
            </button>
          </div>
        </form>

        {/* Info */}
        <div className="mt-12 grid sm:grid-cols-3 gap-4 w-full max-w-lg text-center">
          <div className="p-4 rounded-xl border border-zinc-800/40 bg-zinc-950/50">
            <span className="text-emerald-400 text-lg block mb-1">SHA-256</span>
            <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Hash Algorithm</span>
          </div>
          <div className="p-4 rounded-xl border border-zinc-800/40 bg-zinc-950/50">
            <span className="text-blue-400 text-lg block mb-1">manageData</span>
            <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Stellar Op</span>
          </div>
          <div className="p-4 rounded-xl border border-zinc-800/40 bg-zinc-950/50">
            <span className="text-amber-400 text-lg block mb-1">Immutable</span>
            <span className="text-[10px] text-zinc-600 uppercase tracking-wider">On-Chain Proof</span>
          </div>
        </div>
      </main>
    </div>
  );
}
