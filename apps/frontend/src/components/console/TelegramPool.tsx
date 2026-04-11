"use client";

import { useState } from "react";
import { useWallet } from "@/context/WalletContext";
import gsap from "gsap";

export function TelegramPool({ backendUrl }: { backendUrl: string }) {
  const { address, kit, connect } = useWallet();
  const [amount, setAmount] = useState(0.25);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleDelegate = async () => {
    if (!address || !kit) return connect();
    setLoading(true);
    setErrorMsg("");
    setSuccess(false);

    try {
      // 1. Get XDR from backend (reusing orchestrator preauth which funds the platform pool)
      const preRes = await fetch(`${backendUrl}/api/orchestrate/preauth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ funderPublicKey: address, budget: amount })
      });
      const preData = await preRes.json();
      if (!preRes.ok) throw new Error(preData.error || "Failed to fetch preauth XDR");

      // 2. Sign transaction with Freighter/Albedo
      const signed = await kit.signTransaction(preData.xdr, {
        networkPassphrase: "Test SDF Network ; September 2015",
        address
      });
      
      // 3. Submit transaction natively (or let backend do it, but we have signedXdr.
      // Wait, preauth just gives XDR. Does the orchestrator automatically submit if deployed?
      // For Telegram pool, we must submit it here and then call /delegate to register it.
      // So we use Horizon directly here to submit.
      
      const { Horizon, TransactionBuilder, Networks } = await import("@stellar/stellar-sdk");
      const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
      const txToSubmit = TransactionBuilder.fromXDR(signed.signedTxXdr, Networks.TESTNET);
      const submitRes = await horizon.submitTransaction(txToSubmit);
      const txHash = submitRes.hash;

      // 4. Notify backend 
      const delRes = await fetch(`${backendUrl}/api/orchestrate/telegram/delegate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address, txHash, amount })
      });

      const delData = await delRes.json();
      if (!delRes.ok) throw new Error(delData.error || "Backend validation failed");
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to delegate funds");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-zinc-950 p-6 rounded-2xl border border-blue-900/40 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-blue-900" />
      <h2 className="text-xl font-light tracking-tight text-white mb-2">Telegram Pool</h2>
      <p className="text-sm text-zinc-500 mb-6">Delegate USDC to your Telegram Bot account to enable on-the-go x402 analysis directly from the Telegram chat.</p>

      <div className="space-y-6">
        <div>
          <label className="block text-xs font-mono text-zinc-500 uppercase tracking-widest mb-2">Deposit Amount (USDC)</label>
          <div className="flex items-center gap-4">
            <input 
               type="range" min="0.25" max="5.00" step="0.25" 
               value={amount} 
               onChange={e => setAmount(parseFloat(e.target.value))} 
               className="flex-1 accent-blue-500" 
            />
            <span className="text-sm font-mono text-zinc-300 w-16 text-right">${amount.toFixed(2)}</span>
          </div>
        </div>

        {errorMsg && (
            <div className="text-xs text-red-400 bg-red-950/30 p-2 rounded border border-red-900/50">
               {errorMsg}
            </div>
        )}
        
        {success && (
            <div className="text-xs text-emerald-400 bg-emerald-950/30 p-2 rounded border border-emerald-900/50">
               Successfully delegated {amount} USDC! You can now use /analyze in Telegram.
            </div>
        )}

        <button 
          onClick={handleDelegate} 
          disabled={loading} 
          className="w-full h-12 bg-zinc-800 text-white font-medium text-sm rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50 mt-4 flex justify-center items-center gap-2"
        >
           {loading ? (
             <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Signing...</>
           ) : (
             <>Delegate {amount.toFixed(2)} USDC</>
           )}
        </button>
      </div>
    </div>
  );
}
