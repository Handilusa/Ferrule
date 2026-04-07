"use client";

interface TimelineEvent {
  event: string;
  description: string;
  timestamp: number;
  agent?: string;
}

interface AgentTimelineProps {
  events: TimelineEvent[];
}

function getAgentType(event: TimelineEvent): string {
  if (event.agent) return event.agent;
  const e = event.event || "";
  if (e.includes("search")) return "search";
  if (e.includes("llm")) return "llm";
  if (e.includes("channel")) return "onchain";
  return "system";
}

function formatTime(ts: number, firstTs?: number): string {
  if (!firstTs) return "0.0s";
  return `+${((ts - firstTs) / 1000).toFixed(1)}s`;
}

export function AgentTimeline({ events }: AgentTimelineProps) {
  if (events.length === 0) return null;

  const firstTs = events[0]?.timestamp;

  return (
    <div className="glass-card timeline-card">
      <div className="timeline-title">Agent Activity Timeline</div>
      <div className="timeline-list">
        {events.map((evt, i) => {
          const agentType = getAgentType(evt);
          return (
            <div
              key={`${evt.timestamp}-${i}`}
              className="timeline-item"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <span className={`timeline-dot ${agentType}`} />
              <span className="timeline-text">{evt.description}</span>
              <span className="timeline-time mono">
                {formatTime(evt.timestamp, firstTs)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
