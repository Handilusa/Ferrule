"use client";

import { useState, useEffect, useRef } from "react";
import gsap from "gsap";

interface HITLModalProps {
  visible: boolean;
  query: string;
  context: string;
  sessionId: string | null;
  backendUrl: string;
  onResolved: () => void;
}

export function HITLModal({ visible, query, context, sessionId, backendUrl, onResolved }: HITLModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [directive, setDirective] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Animate in
  useEffect(() => {
    if (visible && overlayRef.current && panelRef.current) {
      gsap.fromTo(overlayRef.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, ease: "power2.out" });
      gsap.fromTo(panelRef.current,
        { autoAlpha: 0, y: 40, scale: 0.95 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.5, ease: "back.out(1.5)", delay: 0.1 }
      );
      // Start countdown
      setCountdown(30);
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            // Auto-approve on timeout
            handleAction("approve");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [visible]);

  const animateOut = (callback: () => void) => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (panelRef.current) {
      gsap.to(panelRef.current, { autoAlpha: 0, y: 20, scale: 0.97, duration: 0.3, ease: "power2.in" });
    }
    if (overlayRef.current) {
      gsap.to(overlayRef.current, { autoAlpha: 0, duration: 0.3, ease: "power2.in", delay: 0.1, onComplete: callback });
    }
  };

  const handleAction = async (action: "approve" | "edit" | "cancel") => {
    if (isSending) return;
    setIsSending(true);

    try {
      let directiveText = "";
      if (action === "approve") {
        directiveText = "[APPROVED] Proceed with autonomous risk analysis.";
      } else if (action === "edit") {
        directiveText = directive.trim() || "[APPROVED] Proceed with autonomous risk analysis.";
      } else if (action === "cancel") {
        directiveText = "[CANCELLED] Skip risk analysis, finalize report as-is.";
      }

      await fetch(`${backendUrl}/api/orchestrate/directive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, agentName: "risk", directive: directiveText })
      });
    } catch (err) {
      console.error("Failed to send HITL directive:", err);
    }

    animateOut(() => {
      setIsSending(false);
      setDirective("");
      onResolved();
    });
  };

  if (!visible) return null;

  // Determine if the query seems off-topic for B2B research
  const words = query.trim().split(/\s+/);
  const lowered = query.toLowerCase().trim();
  const offTopicKeywords = ["hola", "hols", "hello", "hi", "lol", "jaja", "xd", "test", "ping", "hey", "sup", "yo", "que tal", "buenos dias", "good morning", "whats up", "como estas"];
  const isOffTopic = (words.length <= 3 && offTopicKeywords.some(k => lowered.includes(k))) || 
    (words.length === 1 && lowered.length < 8);

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[200] flex items-center justify-center" style={{ opacity: 0, visibility: "hidden" }}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal Panel */}
      <div
        ref={panelRef}
        className="relative z-10 w-full max-w-lg mx-4 bg-zinc-950 border border-zinc-800/80 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] overflow-hidden"
        style={{ opacity: 0, visibility: "hidden" }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-zinc-800/60">
          <div className="flex items-center gap-3 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.7)] animate-pulse" />
            <h2 className="text-sm font-mono font-bold tracking-widest uppercase text-amber-400">
              Human-in-the-Loop
            </h2>
            <span className="ml-auto text-xs font-mono text-zinc-600">
              Auto-approve in <span className="text-amber-400/80">{countdown}s</span>
            </span>
          </div>
          <p className="text-xs text-zinc-500 font-mono">
            The orchestrator is requesting your authorization before proceeding.
          </p>
        </div>

        {/* Context */}
        <div className="px-6 py-4 space-y-4">
          {/* Query context */}
          <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800/40">
            <div className="text-[10px] text-zinc-600 uppercase tracking-[0.2em] mb-2">Mission Query</div>
            <p className="text-sm text-zinc-300 font-mono leading-relaxed">{query}</p>
          </div>

          {/* Off-topic warning or normal context */}
          {isOffTopic ? (
            <div className="p-3 rounded-xl bg-orange-950/30 border border-orange-900/40">
              <div className="flex items-center gap-2 mb-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-400">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
                  <path d="M12 9v4" /><path d="M12 17h.01" />
                </svg>
                <span className="text-[10px] text-orange-400 uppercase tracking-[0.2em] font-mono font-bold">Off-Topic Query Detected</span>
              </div>
              <p className="text-xs text-orange-300/80 leading-relaxed">
                This doesn&apos;t appear to be a professional B2B, SaaS, or financial research query.
                Ferrule is optimized for due diligence missions. Are you sure you want to spend USDC on this?
              </p>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800/40">
              <div className="text-[10px] text-zinc-600 uppercase tracking-[0.2em] mb-2">Risk Agent Context</div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {context || "The Risk Agent will evaluate the LLM report for gaps in security, compliance, pricing, and vendor maturity. Any detected gaps will trigger autonomous x402 searches."}
              </p>
            </div>
          )}

          {/* Directive input */}
          <div>
            <label className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 font-mono block mb-2">
              Optional Directive <span className="text-zinc-700">(steer the analysis)</span>
            </label>
            <textarea
              value={directive}
              onChange={(e) => setDirective(e.target.value)}
              disabled={isSending}
              placeholder="e.g. Focus on GDPR compliance gaps and data residency..."
              rows={2}
              className="w-full bg-black border border-zinc-800/80 rounded-xl p-3 text-sm text-zinc-300 placeholder:text-zinc-700 focus:outline-none focus:border-amber-900/60 transition-colors resize-none disabled:opacity-50 font-mono"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={() => handleAction("cancel")}
            disabled={isSending}
            className="flex-1 h-10 rounded-xl border border-zinc-800 text-zinc-400 text-sm font-mono hover:bg-zinc-900 hover:text-zinc-300 transition-colors disabled:opacity-30"
          >
            Cancel
          </button>
          {directive.trim() ? (
            <button
              onClick={() => handleAction("edit")}
              disabled={isSending}
              className="flex-[2] h-10 rounded-xl bg-amber-500 text-black text-sm font-bold font-mono hover:bg-amber-400 transition-colors disabled:opacity-30 flex items-center justify-center gap-2"
            >
              {isSending ? (
                <span className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : null}
              Inject &amp; Approve
            </button>
          ) : (
            <button
              onClick={() => handleAction("approve")}
              disabled={isSending}
              className="flex-[2] h-10 rounded-xl bg-white text-black text-sm font-bold font-mono hover:bg-zinc-200 transition-colors disabled:opacity-30 flex items-center justify-center gap-2"
            >
              {isSending ? (
                <span className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : null}
              Approve ▶
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
