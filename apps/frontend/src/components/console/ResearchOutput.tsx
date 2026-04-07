import { useState, useEffect } from "react";

interface ResearchOutputProps {
  text: string;
  isStreaming: boolean;
  x402Payments: number;
  sessionDuration: string | null;
  transactions?: any[];
}

// Custom hook to smooth out large chunks of text from LLM web sockets into a character-by-character flow
function HackerBootSequence() {
  const [lines, setLines] = useState<string[]>([]);
  const phrases = [
    "Negotiating x402 payment channel...",
    "Awaiting Stellar testnet ledger consensus...",
    "Bypassing standard rate limits...",
    "Synthesizing due diligence heuristic...",
    "Anchoring cryptographic telemetry..."
  ];

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < phrases.length) {
        setLines(prev => [...prev, phrases[i]]);
        i++;
      }
    }, 800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-1 mt-2 text-[11px] font-mono pl-3 relative">
      <div className="absolute left-0 top-1.5 bottom-1.5 w-px bg-zinc-800/60"></div>
      {lines.map((line, idx) => (
        <div key={idx} className="flex items-center gap-2 text-zinc-500 pl-2">
          <span className="text-emerald-500/30">›</span>
          <span className={idx === lines.length - 1 ? "text-emerald-400/80" : "text-zinc-600"}>{line}</span>
        </div>
      ))}
      <div className="flex items-center gap-2 text-emerald-400 mt-0.5 pl-2">
        <span className="text-emerald-500/30">›</span>
        <span className="inline-block w-1.5 h-3 bg-emerald-500/80 animate-pulse"></span>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4 mt-2">
      <div className="h-4 w-3/4 bg-zinc-800/60 rounded animate-pulse"></div>
      <div className="h-4 w-full bg-zinc-800/60 rounded animate-pulse" style={{ animationDelay: '150ms' }}></div>
      <div className="h-4 w-5/6 bg-zinc-800/60 rounded animate-pulse" style={{ animationDelay: '300ms' }}></div>
      <div className="flex flex-col gap-0.5 mt-4">
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 relative">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse relative z-10 shadow-[0_0_8px_rgba(20,184,166,0.8)]"></span>
          Orchestrator requesting LLM stream...
        </div>
        <HackerBootSequence />
      </div>
    </div>
  );
}
function useSmoothText(rawText: string, isStreaming: boolean) {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    if (!isStreaming && rawText.length > 0) {
      setDisplayedText(rawText);
      return;
    }
    
    if (rawText.length === 0) {
      setDisplayedText("");
      return;
    }

    if (displayedText.length > rawText.length) {
      setDisplayedText("");
      return;
    }

    const interval = setInterval(() => {
      setDisplayedText((prev) => {
        if (prev.length >= rawText.length) {
          clearInterval(interval);
          return prev;
        }
        // Stream 4 characters per frame (~60 FPS) = ~240 cps. Smooth but fast enough for reading.
        return rawText.slice(0, prev.length + 4);
      });
    }, 16);

    return () => clearInterval(interval);
  }, [rawText, isStreaming, displayedText.length]);

  return displayedText;
}

function renderMarkdown(raw: string, isMaximized: boolean): React.ReactNode[] {
  // Strip citation markers like [1], [1, 3], [1-3] — they add noise
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
      // Parse HITL type from marker
      const isCancel = trimmed.includes("[HITL:CANCEL]");
      const isRedirect = trimmed.includes("[HITL:REDIRECT]");
      // isApprove is the default
      
      const borderColor = isCancel ? "border-red-900/50 bg-red-950/20" : isRedirect ? "border-amber-900/50 bg-amber-950/20" : "border-emerald-900/50 bg-emerald-950/20";
      const textColor = isCancel ? "text-red-400" : isRedirect ? "text-amber-400" : "text-emerald-400";
      const dotColor = isCancel ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.7)]" : isRedirect ? "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.7)]" : "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.7)]";
      const iconStroke = isCancel ? "#f87171" : isRedirect ? "#fbbf24" : "#34d399";
      
      // Strip markers to get clean title
      const bannerTitle = trimmed.replace(/\*\*/g, "").replace(/\[HITL:(CANCEL|APPROVE|REDIRECT)\]\s*/, "");
      
      // Look ahead for the description line
      const nextLine = i + 1 < lines.length ? lines[i + 1]?.trim() : "";
      if (nextLine && !nextLine.startsWith("---") && nextLine !== "") {
        i++;
      }

      const svgIcon = isCancel ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={iconStroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-80">
          <circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>
        </svg>
      ) : isRedirect ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={iconStroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-80">
          <path d="M18 8L22 12L18 16"/><path d="M2 12H22"/><path d="M6 16L2 12L6 8"/>
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={iconStroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-80">
          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/>
        </svg>
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
      // IDE Terminal Style with Line Numbers
      nodes.push(
        <div key={i} className="flex gap-4 group w-full hover:bg-zinc-900/30 -mx-4 px-4 rounded-sm transition-colors">
          <div className="w-8 shrink-0 text-right text-[10px] text-zinc-700 font-mono select-none pt-[3px] group-hover:text-zinc-500">
            {i + 1}
          </div>
          <div className="flex-1 min-w-0">{content}</div>
        </div>
      );
    } else {
      // Normal reading mode
      nodes.push(<div key={i}>{content}</div>);
    }
  }

  return nodes;
}

function boldify(text: string): string {
  let result = text;
  result = result.replace(/\*\*(.*?)\*\*/g, '<strong class="text-zinc-200 font-medium">$1</strong>');
  result = result.replace(/`([^`]+)`/g, '<code class="text-teal-400/80 bg-teal-400/5 px-1 py-0.5 rounded text-xs font-mono">$1</code>');
  return result;
}

export function ResearchOutput({ text, isStreaming, x402Payments, sessionDuration, transactions }: ResearchOutputProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const smoothedText = useSmoothText(text, isStreaming);
  
  const hashTx = transactions?.find(t => t.type === "manage_data");

  if (!text && !isStreaming) return null;

  const containerClasses = isMaximized 
    ? "fixed inset-4 z-[100] flex flex-col rounded-xl border border-zinc-700 bg-zinc-950/95 backdrop-blur-2xl shadow-2xl overflow-hidden" 
    : "flex-1 min-h-0 flex flex-col rounded-xl border border-zinc-800/60 bg-zinc-950/80 overflow-hidden";

  return (
    <div className={containerClasses}>
      {/* Header bar */}
      <div className="shrink-0 px-4 py-3 border-b border-zinc-800/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-600 tracking-[0.2em] uppercase">
            {isMaximized ? "IDE OUTPUT CONSOLE" : "Research Output"}
          </span>
          {isStreaming ? (
            <span className="text-[10px] text-teal-400 font-medium animate-pulse">● STREAMING</span>
          ) : (
            <span className="text-[10px] text-emerald-400 font-medium">✓ COMPLETE</span>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          {x402Payments > 0 && (
            <span className="text-[10px] text-purple-400/70 font-mono hidden sm:inline-block">
              {x402Payments} sources · ${(x402Payments * 0.0002).toFixed(4)} USDC
            </span>
          )}
          
          <button 
            onClick={() => setIsMaximized(!isMaximized)}
            className="flex items-center justify-center w-6 h-6 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
            title={isMaximized ? "Minimize" : "Maximize"}
          >
            {isMaximized ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className={`flex-1 overflow-y-auto scrollbar-thin ${isMaximized ? 'p-8 pb-32 font-mono' : 'p-5'}`}>
        {!text && isStreaming ? (
          <LoadingSkeleton />
        ) : (
          <>
            {!isStreaming && hashTx && (
              <div className="mb-6 p-4 rounded-xl border border-emerald-900/50 bg-emerald-950/20 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono tracking-widest uppercase">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-80">
                    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/>
                  </svg>
                  Report Anchored On-Chain (manageData)
                </div>
                <div className="text-sm text-zinc-400 font-mono">
                  Tx: <a href={`https://stellar.expert/explorer/testnet/tx/${hashTx.txId}`} target="_blank" rel="noreferrer" className="text-emerald-400/80 hover:text-emerald-300 underline underline-offset-4 decoration-emerald-900">{hashTx.txId}</a>
                </div>
              </div>
            )}
            {renderMarkdown(smoothedText, isMaximized)}
          </>
        )}
        {isStreaming && (
          <div className={`inline-block w-2 ${isMaximized ? 'h-5 ml-12' : 'h-4 ml-0.5'} bg-teal-400 animate-pulse rounded-sm mt-1`} />
        )}
      </div>

      {/* Footer stats */}
      {!isStreaming && sessionDuration && (
        <div className="shrink-0 px-4 py-3 border-t border-zinc-800/40 text-[10px] text-zinc-600 font-mono flex justify-between">
          <span>Completed in {sessionDuration}</span>
          {isMaximized && <span>100% On-Chain Settled</span>}
        </div>
      )}
    </div>
  );
}
