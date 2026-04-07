"use client";

import { useState, useEffect, useRef } from "react";
import gsap from "gsap";

interface AgentConsoleProps {
  agent: string | null;
  agentStatus: string;
  sessionId: string | null;
  onClose: () => void;
  onSendDirective: (directive: string) => Promise<void>;
}

export function AgentConsole({ agent, agentStatus, sessionId, onClose, onSendDirective }: AgentConsoleProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [directive, setDirective] = useState("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (agent && panelRef.current) {
      gsap.fromTo(panelRef.current, 
        { x: "100%" }, 
        { x: 0, duration: 0.4, ease: "power3.out" }
      );
    }
  }, [agent]);

  const handleClose = () => {
    if (panelRef.current) {
      gsap.to(panelRef.current, {
        x: "100%", duration: 0.3, ease: "power3.in", onComplete: onClose
      });
    } else {
      onClose();
    }
  };

  const handleSend = async () => {
    if (!directive.trim() || isSending || !agent) return;
    setIsSending(true);
    await onSendDirective(directive);
    setIsSending(false);
    setDirective("");
    handleClose();
  };

  if (!agent) return null;

  const isAwaiting = agentStatus === "AWAITING_DIRECTIVE";
  const canSend = isAwaiting || agentStatus === "working"; // allow sending anytime they are active

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 pointer-events-auto transition-opacity duration-300" 
        onClick={handleClose} 
      />
      
      {/* Panel */}
      <div 
        ref={panelRef}
        className="w-full max-w-sm h-full bg-zinc-950 border-l border-zinc-800/80 p-6 shadow-2xl relative pointer-events-auto flex flex-col"
        style={{ transform: "translateX(100%)" }}
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-sm font-mono font-bold tracking-widest uppercase text-white flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isAwaiting ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
              {agent} Agent Console
            </h2>
            <p className="text-xs font-mono text-zinc-500 mt-1 uppercase tracking-wider">
              Status: <span className={isAwaiting ? "text-amber-400" : "text-emerald-400"}>{agentStatus || "IDLE"}</span>
            </p>
          </div>
          <button onClick={handleClose} className="text-zinc-500 hover:text-white transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="mb-6">
            <p className="text-sm text-zinc-400 leading-relaxed">
              Inject a human directive into the autonomous flow. This is currently supported by the Risk Agent to steer vendor evaluation during the verification pause.
            </p>
          </div>

          <div className="space-y-3">
            <label className="text-xs uppercase tracking-widest text-zinc-500 font-mono">Directive Input</label>
            <textarea
              value={directive}
              onChange={(e) => setDirective(e.target.value)}
              disabled={isSending || !canSend}
              placeholder={isAwaiting ? "Enter instructions (e.g. 'Focus heavily on GDPR compliance gaps')" : "Agent is not accepting directives right now."}
              className="w-full h-32 bg-black border border-zinc-800 rounded-lg p-3 text-sm text-zinc-300 placeholder:text-zinc-700 focus:outline-none focus:border-zinc-500 transition-colors resize-none disabled:opacity-50 font-mono"
            />
          </div>
        </div>

        <div className="mt-auto pt-6 border-t border-zinc-800/80">
          <button
            onClick={handleSend}
            disabled={!directive.trim() || isSending || !canSend}
            className="w-full h-11 bg-white text-black font-medium text-sm rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSending ? (
              <>
                <span className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Injecting...
              </>
            ) : (
              "Inject Directive"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
