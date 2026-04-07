"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

interface AgentNetworkVizProps {
  agentStatuses: { llm: string; search: string; risk: string };
  channelStatus: "idle" | "open" | "streaming" | "closing" | "settled";
  onNodeClick?: (agent: string) => void;
  className?: string;
}

export function AgentNetworkViz({ agentStatuses, channelStatus, onNodeClick, className = "" }: AgentNetworkVizProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isActive = channelStatus === "streaming" || channelStatus === "open";
  const llmActive = agentStatuses.llm && agentStatuses.llm !== "idle";
  const searchActive = agentStatuses.search && agentStatuses.search !== "idle";
  const riskActive = agentStatuses.risk && agentStatuses.risk !== "idle";
  const riskSearching = agentStatuses.risk === "re_searching";
  const isSettled = channelStatus === "settled";
  const channelOpen = channelStatus !== "idle" && channelStatus !== "settled";

  /* ═══ One-time entrance animation ═══ */
  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    // 1. Core appears with elastic pop
    tl.from(".viz-core", {
      scale: 0, autoAlpha: 0, duration: 0.9,
      ease: "elastic.out(1, 0.55)",
    });

    // 2. Ring arcs sweep in
    tl.from(".viz-arc", {
      autoAlpha: 0, scale: 0.4, duration: 0.5,
      stagger: 0.06, ease: "back.out(2)",
    }, "-=0.5");

    // 3. Nodes pop in from their edges
    tl.from(".viz-node", {
      scale: 0, autoAlpha: 0, duration: 0.6,
      stagger: { amount: 0.3, from: "edges" },
      ease: "back.out(1.7)",
    }, "-=0.3");

    // 4. Beams draw in
    tl.from(".viz-beam", {
      strokeDashoffset: 300, duration: 0.7,
      stagger: 0.12, ease: "power2.inOut",
    }, "-=0.4");

    // 5. Labels fade in
    tl.from(".viz-label", {
      autoAlpha: 0, y: 6, duration: 0.4,
      stagger: 0.08,
    }, "-=0.3");

    /* ─── Infinite core ring rotation (using svgOrigin for perfect centers) ─── */
    gsap.to(".viz-ring-outer", {
      rotation: 360, duration: 18, repeat: -1, ease: "none",
      svgOrigin: "200 125",
    });
    gsap.to(".viz-ring-inner", {
      rotation: -360, duration: 12, repeat: -1, ease: "none",
      svgOrigin: "200 125",
    });

    /* ─── Smooth Vertical Float ─── */
    gsap.utils.toArray<HTMLElement>(".viz-leg").forEach((leg, i) => {
      gsap.to(leg, {
        y: i % 2 === 0 ? 10 : -12,
        duration: 2.2 + i * 0.3,
        repeat: -1, yoyo: true, 
        ease: "power1.inOut",
        force3D: true // Forces GPU rendering to prevent SVG pixel snapping
      });
    });

  }, { scope: containerRef });

  /* ═══ Reactive state animations ═══ */
  useGSAP(() => {
    // Core glow intensity
    gsap.to(".viz-core-ring", {
      borderColor: isActive ? "rgba(45,212,191,0.7)" : isSettled ? "rgba(52,211,153,0.6)" : "rgba(63,63,70,0.4)",
      boxShadow: isActive
        ? "0 0 30px rgba(45,212,191,0.3), inset 0 0 20px rgba(45,212,191,0.08)"
        : isSettled
        ? "0 0 20px rgba(52,211,153,0.2)"
        : "0 0 8px rgba(45,212,191,0.05)",
      duration: 0.8, ease: "power2.out",
    });

    // Core glow halo
    gsap.to(".viz-glow", {
      scale: isActive ? 2 : 1, autoAlpha: isActive ? 0.3 : 0.06,
      duration: 1, ease: "power2.out",
    });

    // Ring speed: faster when active
    gsap.to(".viz-ring-outer", { timeScale: isActive ? 4 : 1, duration: 0.8, ease: "power2.out" });
    gsap.to(".viz-ring-inner", { timeScale: isActive ? 4 : 1, duration: 0.8, ease: "power2.out" });

    // LLM node
    gsap.to(".viz-node-llm .viz-node-border", {
      borderColor: llmActive ? "rgba(96,165,250,0.8)" : "rgba(63,63,70,0.4)",
      boxShadow: llmActive ? "0 0 20px rgba(96,165,250,0.35)" : "none",
      duration: 0.5, ease: "power2.out", overwrite: "auto",
    });
    gsap.to("#beam-llm", {
      autoAlpha: llmActive || isActive ? 0.8 : 0.12,
      strokeWidth: llmActive ? 2 : 1,
      duration: 0.5,
    });

    // Search node
    gsap.to(".viz-node-search .viz-node-border", {
      borderColor: searchActive ? "rgba(167,139,250,0.8)" : "rgba(63,63,70,0.4)",
      boxShadow: searchActive ? "0 0 20px rgba(167,139,250,0.35)" : "none",
      duration: 0.5, ease: "power2.out", overwrite: "auto",
    });
    gsap.to("#beam-search", {
      autoAlpha: searchActive || isActive ? 0.8 : 0.12,
      strokeWidth: searchActive ? 2 : 1,
      duration: 0.5,
    });

    // Risk node
    gsap.to(".viz-node-risk .viz-node-border", {
      borderColor: riskActive ? "rgba(249,115,22,0.8)" : "rgba(63,63,70,0.4)",
      boxShadow: riskActive ? "0 0 20px rgba(249,115,22,0.35)" : "none",
      duration: 0.5, ease: "power2.out", overwrite: "auto",
    });
    gsap.to("#beam-risk", {
      autoAlpha: riskActive || isActive ? 0.8 : 0.12,
      strokeWidth: riskActive ? 2 : 1,
      duration: 0.5,
    });
    gsap.to("#beam-risk-search", {
      autoAlpha: riskSearching ? 0.8 : 0.05,
      strokeWidth: riskSearching ? 2 : 0.5,
      duration: 0.5,
    });

    // Wallet node
    gsap.to(".viz-node-wallet .viz-node-border", {
      borderColor: channelOpen ? "rgba(212,212,216,0.6)" : "rgba(63,63,70,0.4)",
      boxShadow: channelOpen ? "0 0 12px rgba(212,212,216,0.15)" : "none",
      duration: 0.5, overwrite: "auto",
    });
    gsap.to("#beam-wallet", {
      autoAlpha: channelOpen ? 0.5 : 0.08,
      duration: 0.5,
    });

    /* ─── Pulse active nodes ─── */
    if (llmActive) {
      gsap.to(".viz-node-llm", {
        scale: 1.08, duration: 0.6, repeat: -1, yoyo: true, ease: "sine.inOut",
      });
    } else {
      gsap.to(".viz-node-llm", { scale: 1, duration: 0.4, overwrite: "auto" });
    }
    if (searchActive) {
      gsap.to(".viz-node-search", {
        scale: 1.08, duration: 0.6, repeat: -1, yoyo: true, ease: "sine.inOut",
      });
    } else {
      gsap.to(".viz-node-search", { scale: 1, duration: 0.4, overwrite: "auto" });
    }
    if (riskActive) {
      gsap.to(".viz-node-risk", {
        scale: 1.08, duration: 0.6, repeat: -1, yoyo: true, ease: "sine.inOut",
      });
    } else {
      gsap.to(".viz-node-risk", { scale: 1, duration: 0.4, overwrite: "auto" });
    }

    /* ─── Flowing dash animation on active beams ─── */
    if (isActive) {
      gsap.to("#beam-llm", {
        strokeDashoffset: "+=40", duration: 1, repeat: -1, ease: "none",
      });
      gsap.to("#beam-search", {
        strokeDashoffset: "+=40", duration: 0.8, repeat: -1, ease: "none",
      });
      gsap.to("#beam-risk", {
        strokeDashoffset: "+=40", duration: 0.8, repeat: -1, ease: "none",
      });
      gsap.to("#beam-wallet", {
        strokeDashoffset: "+=30", duration: 1.5, repeat: -1, ease: "none",
      });
    }
    if (riskSearching) {
      gsap.to("#beam-risk-search", {
        strokeDashoffset: "-=40", duration: 0.8, repeat: -1, ease: "none",
      });
    }

  }, { scope: containerRef, dependencies: [isActive, llmActive, searchActive, riskActive, riskSearching, channelStatus, channelOpen, isSettled] });

  return (
    <div ref={containerRef} className={`rounded-xl border border-zinc-800/60 bg-zinc-950/80 relative overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1 relative z-10">
        <span className="text-[10px] text-zinc-600 tracking-[0.2em] uppercase">Agent Network</span>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-teal-400" : isSettled ? "bg-emerald-400" : "bg-zinc-600"}`} />
          <span className={`text-[9px] font-mono uppercase ${isActive ? "text-teal-400" : isSettled ? "text-emerald-400" : "text-zinc-600"}`}>
            {channelStatus}
          </span>
        </div>
      </div>

      {/* Visualization area */}
      <div className="relative flex items-center justify-center" style={{ height: 280 }}>

        {/* ─── SVG: Beams + Ring arcs ─── */}
        <svg className="absolute inset-0 w-full h-full -translate-y-3" viewBox="0 0 400 250" fill="none" preserveAspectRatio="xMidYMid meet">
          {/* Orbit track - intermediate scale */}
          <circle cx="200" cy="125" r="95" stroke="rgba(63,63,70,0.1)" strokeWidth="0.5" strokeDasharray="3 8" />

          {/* Scaled Ring Groups wrapper (1.15x) */}
          <g transform="translate(-30, -18.75) scale(1.15)">
            {/* Spinning ring arcs (outer) */}
            <g className="viz-ring-outer" style={{ transformOrigin: "200px 125px" }}>
              <path className="viz-arc" d="M 200 93 A 32 32 0 0 1 228 109" stroke="rgba(45,212,191,0.3)" strokeWidth="2" strokeLinecap="round" />
              <path className="viz-arc" d="M 228 141 A 32 32 0 0 1 200 157" stroke="rgba(45,212,191,0.2)" strokeWidth="1.5" strokeLinecap="round" />
              <path className="viz-arc" d="M 172 109 A 32 32 0 0 1 200 93" stroke="rgba(45,212,191,0.15)" strokeWidth="1" strokeLinecap="round" />
            </g>

            {/* Spinning ring arcs (inner, counter) */}
            <g className="viz-ring-inner" style={{ transformOrigin: "200px 125px" }}>
              <path className="viz-arc" d="M 200 108 A 17 17 0 0 1 217 125" stroke="rgba(45,212,191,0.22)" strokeWidth="1.5" strokeLinecap="round" />
              <path className="viz-arc" d="M 183 125 A 17 17 0 0 1 200 108" stroke="rgba(45,212,191,0.12)" strokeWidth="1" strokeLinecap="round" />
            </g>
          </g>

          {/* ─── LEG 1: LLM ─── */}
          <g className="viz-leg">
            <path id="beam-llm" className="viz-beam"
              d="M 172 108 Q 130 80 80 55"
              stroke="rgba(96,165,250,0.5)" strokeWidth="1.2" strokeDasharray="5 5" strokeLinecap="round"
              style={{ opacity: 0.12 }}
            />
            <text className="viz-label" x="142" y="68" fill="rgba(45,212,191,0.55)" fontSize="9" fontFamily="'Geist Mono', monospace">MPP</text>
            <foreignObject x="45" y="20" width="70" height="70" className="overflow-visible" onClick={() => onNodeClick?.("llm")}>
              <div className="viz-node viz-node-llm w-full h-full transform-gpu relative cursor-pointer group">
                <div className="viz-node-border w-full h-full rounded-full border border-zinc-700/40 flex flex-col items-center justify-center shadow-md transition-colors group-hover:border-blue-400/50"
                  style={{ background: "radial-gradient(circle at 50% 35%, rgba(96,165,250,0.06) 0%, rgba(9,9,11,0.8) 70%)" }}
                >
                  <span className="text-[10px] font-mono font-bold text-blue-400/90 tracking-wide">LLM</span>
                  <span className="text-[6.5px] font-mono text-zinc-400 mt-0.5 whitespace-nowrap">Gemini · MPP</span>
                </div>
              </div>
            </foreignObject>
          </g>

          {/* ─── LEG 2: SEARCH ─── */}
          <g className="viz-leg">
            <path id="beam-search" className="viz-beam"
              d="M 172 148 Q 135 175 75 205"
              stroke="rgba(167,139,250,0.5)" strokeWidth="1.2" strokeDasharray="4 6" strokeLinecap="round"
              style={{ opacity: 0.12 }}
            />
            <text className="viz-label" x="135" y="188" fill="rgba(167,139,250,0.5)" fontSize="9" fontFamily="'Geist Mono', monospace">x402</text>
            <foreignObject x="40" y="170" width="70" height="70" className="overflow-visible" onClick={() => onNodeClick?.("search")}>
              <div className="viz-node viz-node-search w-full h-full transform-gpu relative cursor-pointer group">
                <div className="viz-node-border w-full h-full rounded-full border border-zinc-700/40 flex flex-col items-center justify-center shadow-md transition-colors group-hover:border-purple-400/50"
                  style={{ background: "radial-gradient(circle at 50% 35%, rgba(167,139,250,0.06) 0%, rgba(9,9,11,0.8) 70%)" }}
                >
                  <span className="text-[10px] font-mono font-bold text-purple-400/90 tracking-wide">SEARCH</span>
                  <span className="text-[6.5px] font-mono text-zinc-400 mt-0.5 whitespace-nowrap">SearXNG · x402</span>
                </div>
              </div>
            </foreignObject>
          </g>

          {/* ─── LEG 3: RISK ─── */}
          <g className="viz-leg">
            <path id="beam-risk-search" className="viz-beam"
              d="M 300 215 Q 170 240 75 210"
              stroke="rgba(167,139,250,0.5)" strokeWidth="1.2" strokeDasharray="4 6" strokeLinecap="round"
              style={{ opacity: 0.05 }}
            />
            <path id="beam-risk" className="viz-beam"
              d="M 215 145 Q 260 175 310 195"
              stroke="rgba(249,115,22,0.5)" strokeWidth="1.2" strokeDasharray="4 6" strokeLinecap="round"
              style={{ opacity: 0.12 }}
            />
            <text className="viz-label" x="195" y="215" fill="rgba(249,115,22,0.5)" fontSize="9" fontFamily="'Geist Mono', monospace">Internal / x402</text>
            <foreignObject x="290" y="165" width="70" height="70" className="overflow-visible" onClick={() => onNodeClick?.("risk")}>
              <div className="viz-node viz-node-risk w-full h-full transform-gpu relative cursor-pointer group">
                <div className="viz-node-border w-full h-full rounded-full border border-zinc-700/40 flex flex-col items-center justify-center shadow-md transition-colors group-hover:border-orange-500/50"
                  style={{ background: "radial-gradient(circle at 50% 35%, rgba(249,115,22,0.06) 0%, rgba(9,9,11,0.8) 70%)" }}
                >
                  <span className="text-[10px] font-mono font-bold text-orange-500/90 tracking-wide">RISK</span>
                  <span className="text-[6.5px] font-mono text-zinc-400 mt-0.5 whitespace-nowrap">Auditor</span>
                </div>
              </div>
            </foreignObject>
          </g>

          {/* ─── LEG 4: WALLET ─── */}
          <g className="viz-leg">
            <path id="beam-wallet" className="viz-beam"
              d="M 235 112 Q 280 95 338 80"
              stroke="rgba(212,212,216,0.3)" strokeWidth="1" strokeDasharray="3 7" strokeLinecap="round"
              style={{ opacity: 0.08 }}
            />
            <text className="viz-label" x="272" y="118" fill="rgba(161,161,170,0.35)" fontSize="8" fontFamily="'Geist Mono', monospace">on-chain</text>
            <foreignObject x="308" y="50" width="60" height="60" className="overflow-visible" onClick={() => onNodeClick?.("wallet")}>
              <div className="viz-node viz-node-wallet w-full h-full transform-gpu relative cursor-pointer group">
                <div className="viz-node-border w-full h-full rounded-full border border-zinc-700/40 flex flex-col items-center justify-center shadow-md transition-colors group-hover:border-zinc-400/50"
                  style={{ background: "radial-gradient(circle at 50% 35%, rgba(212,212,216,0.04) 0%, rgba(9,9,11,0.8) 70%)" }}
                >
                  <span className="text-[9px] font-mono font-bold text-zinc-300/80 tracking-wide">WALLET</span>
                  <span className="text-[6.5px] font-mono text-zinc-400 mt-0.5 whitespace-nowrap">USDC</span>
                </div>
              </div>
            </foreignObject>
          </g>

          {/* ─── CORE NODE (Separate) ─── */}
          <foreignObject x="162" y="87" width="76" height="76" className="overflow-visible" onClick={() => onNodeClick?.("orchestrator")}>
            <div className="viz-core w-full h-full cursor-pointer group">
              <div className="viz-glow absolute -inset-6 rounded-full bg-teal-500/5 blur-xl" />
              <div className="viz-core-ring w-full h-full rounded-full border border-zinc-700/40 flex flex-col items-center justify-center relative shadow-[0_0_15px_rgba(45,212,191,0.12)] transition-colors group-hover:border-teal-400/50"
                style={{ background: "radial-gradient(circle at 50% 35%, rgba(45,212,191,0.08) 0%, rgba(9,9,11,0.8) 70%)" }}
              >
                <span className="text-[11px] font-mono font-bold text-teal-400/90 tracking-wide">ORCH</span>
                <span className="text-[7px] font-mono text-zinc-400 mt-1">ferrule-v2</span>
              </div>
            </div>
          </foreignObject>

        </svg>
      </div>
    </div>
  );
}
