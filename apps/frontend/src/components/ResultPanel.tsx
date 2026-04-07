"use client";

interface ResultPanelProps {
  text: string;
  isStreaming: boolean;
  stats: Record<string, unknown> | null;
}

export function ResultPanel({ text, isStreaming, stats }: ResultPanelProps) {
  return (
    <section className="result-section animate-fade-in">
      <div className="glass-card-glow result-card">
        <div className="result-title">
          <span>📄</span>
          Research Report
          {isStreaming && (
            <span
              style={{
                fontSize: "0.7rem",
                color: "var(--amber)",
                fontWeight: 500,
              }}
            >
              • STREAMING
            </span>
          )}
        </div>
        <div className="result-body">
          {text}
          {isStreaming && <span className="result-cursor" />}
        </div>

        {stats && !isStreaming && (
          <div
            style={{
              marginTop: "1.5rem",
              paddingTop: "1rem",
              borderTop: "1px solid var(--border-subtle)",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: "1rem",
            }}
          >
            {Object.entries(stats).map(([key, value]) => (
              <div key={key}>
                <div
                  style={{
                    fontSize: "0.7rem",
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: "0.25rem",
                  }}
                >
                  {key.replace(/([A-Z])/g, " $1").trim()}
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: "0.9rem",
                    color: "var(--text-primary)",
                    fontWeight: 600,
                  }}
                >
                  {String(value)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
