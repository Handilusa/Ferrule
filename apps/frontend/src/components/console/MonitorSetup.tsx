"use client";

import { useState, useEffect, useRef } from "react";
import gsap from "gsap";
import { useWallet } from "@/context/WalletContext";

export function MonitorSetup({ backendUrl, onMonitorCreated }: { backendUrl: string, onMonitorCreated: () => void }) {
  const { address, kit, connect } = useWallet();
  const [pair, setPair] = useState("XLM/USDC");
  const [budget, setBudget] = useState(0.20);
  const [interval, setInterval] = useState(1);
  const [loading, setLoading] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<"checking"|"unlinked"|"linked">("checking");
  const [linkCode, setLinkCode] = useState<string|null>(null);

  // --- Custom Dropdown State ---
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isDropdownOpen) {
      gsap.to(dropdownRef.current, { height: "auto", opacity: 1, duration: 0.3, ease: "power2.out" });
    } else {
      gsap.to(dropdownRef.current, { height: 0, opacity: 0, duration: 0.2, ease: "power2.in" });
    }
  }, [isDropdownOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownContainerRef.current && !dropdownContainerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  // -----------------------------

  useEffect(() => {
    if (!address) return;
    const checkTelegram = async () => {
      try {
        const res = await fetch(`${backendUrl}/api/monitor/telegram-link?wallet=${address}`);
        const data = await res.json();
        if (data.linked) {
          setTelegramStatus("linked");
        } else {
          setTelegramStatus("unlinked");
          setLinkCode(data.code);
        }
      } catch (err) {
        console.error(err);
      }
    };
    checkTelegram();
    const t = global.setInterval(checkTelegram, 5000); // poll to see if user linked
    return () => clearInterval(t);
  }, [address, backendUrl]);

  const handleDeploy = async () => {
    if (!address || !kit) return connect();
    setLoading(true);
    try {
      const preRes = await fetch(`${backendUrl}/api/monitor/preauth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ funderPublicKey: address, budget })
      });
      const preData = await preRes.json();
      if (!preRes.ok) throw new Error(preData.error);

      const signed = await kit.signTransaction(preData.xdr, {
        networkPassphrase: "Test SDF Network ; September 2015",
        address
      });
      
      const actRes = await fetch(`${backendUrl}/api/monitor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signedXdr: signed.signedTxXdr,
          funderPublicKey: address,
          pair,
          budgetUsdc: budget,
          intervalHours: interval
        })
      });

      if (!actRes.ok) throw new Error("Failed to activate");
      onMonitorCreated();
    } catch (err) {
      console.error(err);
      alert((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-800/80 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-emerald-900" />
      <h2 className="text-xl font-light tracking-tight text-white mb-6">New Risk Monitor</h2>

      <div className="space-y-6">
        <div ref={dropdownContainerRef} className="relative z-30">
          <label className="block text-xs font-mono text-zinc-500 uppercase tracking-widest mb-2">Trading Pair</label>
          <div className="relative">
            <button 
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)} 
              className={`w-full bg-zinc-900 border ${isDropdownOpen ? 'border-emerald-500/50' : 'border-zinc-800'} rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none transition-colors text-left flex justify-between items-center`}
            >
              {pair}
              <svg className={`w-4 h-4 transition-transform duration-300 ${isDropdownOpen ? "rotate-180 text-emerald-400" : "text-zinc-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            <div 
              ref={dropdownRef} 
              className="absolute left-0 right-0 top-full mt-2 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden h-0 opacity-0 shadow-2xl"
            >
              {['XLM/USDC', 'BTC/USDC', 'ETH/USDC'].map(opt => (
                <div 
                  key={opt}
                  onClick={() => { setPair(opt); setIsDropdownOpen(false); }}
                  className={`px-4 py-3 text-sm font-mono cursor-pointer transition-colors flex items-center gap-2 ${pair === opt ? 'bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-500' : 'text-zinc-400 border-l-2 border-transparent hover:bg-zinc-800 hover:text-white'}`}
                >
                  {opt}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-mono text-zinc-500 uppercase tracking-widest mb-2">Budget (USDC)</label>
          <div className="flex items-center gap-4">
            <input type="range" min="0.10" max="1.00" step="0.05" value={budget} onChange={e => setBudget(parseFloat(e.target.value))} className="flex-1 accent-emerald-500" />
            <span className="text-sm font-mono text-zinc-300 w-16 text-right">${budget.toFixed(2)}</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-mono text-zinc-500 uppercase tracking-widest mb-2">Critical Interval (Hours)</label>
          <div className="flex gap-2">
            {[1, 6, 12, 24].map(h => (
              <button key={h} onClick={() => setInterval(h)} className={`flex-1 py-2 text-sm font-mono rounded-lg border transition-colors ${interval === h ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}>
                {h}h
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
           <label className="block text-xs font-mono text-zinc-500 uppercase tracking-widest mb-2">Telegram Deep Link</label>
           {telegramStatus === "checking" && <span className="text-sm text-zinc-400">Checking...</span>}
           {telegramStatus === "linked" && (
             <div className="flex items-center gap-2">
                 <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                 <span className="text-sm text-emerald-400 font-medium">Account linked and receiving alerts.</span>
             </div>
           )}
           {telegramStatus === "unlinked" && linkCode && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Link your account for push alerts.</span>
                  <a href={`https://t.me/Furrule_monitor_bot?start=${linkCode}`} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-[#0088cc] text-white rounded-lg text-sm font-medium hover:bg-[#0077b5] transition-colors">
                    Link Telegram
                  </a>
                </div>
                <p className="text-[10px] text-zinc-500 font-mono text-center bg-zinc-800/50 py-1 rounded-md">
                  ⚠️ Remember to click the <span className="text-white font-bold">START</span> or <span className="text-white font-bold">RESTART</span> button in the Telegram app once it opens.
                </p>
              </div>
           )}
        </div>

        <button onClick={handleDeploy} disabled={loading || telegramStatus !== "linked"} className="w-full h-12 bg-white text-black font-medium text-sm rounded-xl hover:bg-zinc-200 transition-colors disabled:opacity-50 mt-4">
           {loading ? "Deploying to Soroban..." : (telegramStatus !== "linked" ? "Link Telegram first" : "Activate Monitor")}
        </button>
      </div>
    </div>
  );
}
