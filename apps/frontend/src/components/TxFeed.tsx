"use client";

interface Transaction {
  type: string;
  agent: string;
  txId: string;
  description: string;
  amountUSDC?: string;
  timestamp: number;
}

interface TxFeedProps {
  transactions: Transaction[];
}

function getTxBadgeClass(type: string): string {
  if (type.includes("open")) return "open";
  if (type.includes("close")) return "close";
  return "x402";
}

function getTxLabel(type: string): string {
  if (type.includes("open")) return "OPEN";
  if (type.includes("close")) return "CLOSE";
  return "x402";
}

export function TxFeed({ transactions }: TxFeedProps) {
  if (transactions.length === 0) return null;

  return (
    <div className="glass-card tx-card">
      <div className="tx-title">
        On-Chain Transactions ({transactions.length})
      </div>
      <div className="tx-list">
        {transactions.map((tx, i) => (
          <div key={`${tx.txId}-${i}`} className="tx-item animate-slide-in">
            <div className="tx-item-left">
              <span className={`tx-type-badge ${getTxBadgeClass(tx.type)}`}>
                {getTxLabel(tx.type)}
              </span>
              <span className="tx-desc">
                {tx.description}
                {tx.amountUSDC && (
                  <span style={{ color: "var(--amber)", marginLeft: "0.5rem" }}>
                    {tx.amountUSDC} USDC
                  </span>
                )}
              </span>
            </div>
            {tx.txId === "pending_settlement" ? (
              <span className="tx-link mono" style={{ color: "var(--text-dim)", textDecoration: "none", cursor: "help" }} title="Settlement is queued for off-peak processing">
                In Queue 🕒
              </span>
            ) : (
              <a
                className="tx-link mono"
                href={`https://stellar.expert/explorer/testnet/tx/${tx.txId}`}
                target="_blank"
                rel="noopener noreferrer"
                title="View on Stellar Explorer"
              >
                {tx.txId.slice(0, 8)}...{tx.txId.slice(-4)} ↗
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
