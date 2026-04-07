"use client";

interface CostBreakdownProps {
  totalSpent: number;
  offChainCount: number;
  onChainCount: number;
  x402Payments: number;
  isComplete: boolean;
}

export function CostBreakdown({
  totalSpent,
  offChainCount,
  onChainCount,
  x402Payments,
  isComplete,
}: CostBreakdownProps) {
  return (
    <div className="glass-card cost-banner">
      <div className="cost-total">
        Total spent:{" "}
        <span className="amount mono">${totalSpent.toFixed(6)}</span>
        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginLeft: "0.5rem" }}>
          USDC
        </span>
      </div>
      <div className="cost-detail">
        <div className="cost-item">
          LLM (MPP Session):{" "}
          <strong className="mono">{offChainCount} commitments</strong>
        </div>
        <div className="cost-item">
          Search (x402):{" "}
          <strong className="mono">{x402Payments} payments</strong>
        </div>
        <div className="cost-item">
          On-chain fees:{" "}
          <strong className="mono">${(onChainCount * 0.00001).toFixed(6)}</strong>
        </div>
        {isComplete && (
          <div className="cost-item" style={{ color: "var(--emerald)" }}>
            ✓ {offChainCount + x402Payments} micropayments → {onChainCount} on-chain txs
          </div>
        )}
      </div>
    </div>
  );
}
