"use client";
import { useState, useEffect } from "react";
import { useWallet } from "@/context/WalletContext";

export function MonitorPanel({ backendUrl, refreshTrigger }: { backendUrl: string, refreshTrigger: number }) {
    const { address } = useWallet();
    const [monitors, setMonitors] = useState<any[]>([]);

    useEffect(() => {
        if (!address) return;
        const fetchMonitors = async () => {
            try {
               const res = await fetch(`${backendUrl}/api/monitor/user/${address}`);
               const data = await res.json();
               setMonitors(data.monitors || []);
            } catch(err) {
               console.error(err);
            }
        };
        fetchMonitors();
        const t = global.setInterval(fetchMonitors, 5000);
        return () => clearInterval(t);
    }, [address, backendUrl, refreshTrigger]);

    const handleStop = async (id: string) => {
        await fetch(`${backendUrl}/api/monitor/${id}`, { method: "DELETE" });
        // Give backend time to update
        setTimeout(() => {
            // refresh manually handled by poll
        }, 500);
    };

    if (!address) return null;

    if (monitors.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-10 bg-zinc-950/50 rounded-2xl border border-zinc-800/50 mt-6 border-dashed">
                <svg className="w-12 h-12 mb-4 opacity-20 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                </svg>
                <p className="text-zinc-500 font-mono text-sm max-w-sm text-center">No active monitors. Create one above to receive Telegram signals based on autonomous x402 budgets.</p>
            </div>
        );
    }

    return (
        <div className="mt-8 space-y-4">
            <h3 className="text-sm font-mono text-zinc-500 uppercase tracking-widest pl-2">Deployed Monitors</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
               {monitors.map(m => {
                   const progress = Math.min((m.spentUsdc / m.budgetUsdc) * 100, 100);
                   const statusColor = m.active ? "bg-emerald-500" : "bg-red-500";
                   
                   return (
                       <div key={m.id} className="bg-zinc-950 p-5 rounded-xl border border-zinc-800 shadow-lg relative group transition-all hover:border-zinc-700">
                           <div className="flex justify-between items-start mb-4">
                               <div>
                                  <h4 className="text-white font-mono text-lg">{m.pair}</h4>
                                  <div className="flex items-center gap-2 mt-1">
                                      <span className={`w-2 h-2 rounded-full ${statusColor} ${m.active ? 'animate-pulse' : ''}`} />
                                      <span className="text-xs text-zinc-500 font-sans tracking-wide">{m.active ? "Active" : "Expired/Paused"}</span>
                                  </div>
                               </div>
                               {m.active && (
                                   <button onClick={() => handleStop(m.id)} className="opacity-0 group-hover:opacity-100 px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-xs transition-opacity hover:bg-red-500/20">
                                       Stop
                                   </button>
                               )}
                           </div>

                           <div className="space-y-4">
                                <div>
                                   <div className="flex justify-between text-xs font-mono text-zinc-400 mb-2">
                                       <span>Consumed Budget</span>
                                       <span className="text-zinc-200">{m.spentUsdc.toFixed(4)} / {m.budgetUsdc.toFixed(2)} USDC</span>
                                   </div>
                                   <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                                       <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500" style={{ width: `${progress}%` }} />
                                   </div>
                               </div>

                               <div className="grid grid-cols-2 gap-4 border-t border-zinc-800/50 pt-4">
                                   <div>
                                       <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">Hash Signals</p>
                                       <p className="text-zinc-300 font-mono text-sm">{m.signalsCount}</p>
                                   </div>
                                   <div>
                                       <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">Last Analysis</p>
                                       <p className="text-zinc-300 font-mono text-sm">{m.lastRun ? new Date(m.lastRun).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending'}</p>
                                   </div>
                               </div>
                           </div>
                       </div>
                   );
               })}
            </div>
        </div>
    );
}
