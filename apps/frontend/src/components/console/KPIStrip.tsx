"use client";

import { NumberTicker } from "@/components/magicui/number-ticker";

interface KPICardProps {
  label: string;
  prefix?: string;
  value: number;
  decimalPlaces?: number;
  sublabel: string;
  color: string;
}

function KPICard({ label, prefix = "", value, decimalPlaces = 0, sublabel, color }: KPICardProps) {
  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/80 p-4 flex flex-col gap-1">
      <span className="text-[10px] text-zinc-600 tracking-[0.15em] uppercase font-medium">
        {label}
      </span>
      <div className={`text-2xl sm:text-3xl font-mono font-light tracking-tight ${color} flex items-center`}>
        {prefix && <span>{prefix}</span>}
        <NumberTicker value={value} decimalPlaces={decimalPlaces} />
      </div>
      <span className="text-[10px] text-zinc-600 font-mono">{sublabel}</span>
    </div>
  );
}

interface KPIStripProps {
  offChainCount: number;
  onChainCount: number;
  totalSpent: number;
  networkCost: number;
  x402Payments: number;
  riskScore: number | null;
}

export function KPIStrip({
  offChainCount,
  onChainCount,
  totalSpent,
  networkCost,
  x402Payments,
  riskScore,
}: KPIStripProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <KPICard
        label="Off-Chain Commits"
        value={offChainCount}
        sublabel={`MPP ed25519 sigs`}
        color="text-white"
      />
      <KPICard
        label="Active Channels"
        value={onChainCount}
        sublabel={`+ ${x402Payments} x402 calls`}
        color="text-white"
      />
      <KPICard
        label="USDC Processed"
        prefix="$"
        value={totalSpent}
        decimalPlaces={6}
        sublabel="total session value"
        color="text-white"
      />
      <KPICard
        label="Network Cost"
        prefix="$"
        value={networkCost}
        decimalPlaces={6}
        sublabel="on-chain fees only"
        color="text-emerald-400"
      />
      <KPICard
        label="Risk Score"
        value={riskScore ?? 0}
        sublabel={riskScore ? "Out of 100" : "Awaiting agent..."}
        color={riskScore ? (riskScore > 75 ? "text-red-400" : riskScore > 40 ? "text-orange-400" : "text-emerald-400") : "text-zinc-600"}
      />
    </div>
  );
}
