"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useFerruleSocket } from "@/hooks/useFerruleSocket";
import { useWallet } from "@/context/WalletContext";
import { FerruleLogo } from "@/components/svg/FerruleLogo";
import { KPIStrip } from "@/components/console/KPIStrip";
import { EventStream } from "@/components/console/EventStream";
import { ChannelCards } from "@/components/console/ChannelCards";
import { AgentNetworkViz } from "@/components/console/AgentNetworkViz";
import { ResearchOutput } from "@/components/console/ResearchOutput";
import { SessionEconomics } from "@/components/console/SessionEconomics";
import { AgentConsole } from "@/components/console/AgentConsole";
import { HITLModal } from "@/components/console/HITLModal";
import { HistoryPanel } from "@/components/console/HistoryPanel";
import { TestnetFaucet } from "@/components/console/TestnetFaucet";
import { AmbientBackground } from "@/components/AmbientBackground";
import { MonitorSetup } from "@/components/console/MonitorSetup";
import { MonitorPanel } from "@/components/console/MonitorPanel";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000";

function BudgetDropdown({ budget, setBudget, disabled }: { budget: number; setBudget: (val: number) => void; disabled: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const options = [0.05, 0.10, 0.15, 0.25, 0.50, 1.00];

  useGSAP(() => {
    if (!menuRef.current) return;
    
    if (isOpen) {
      gsap.fromTo(menuRef.current, 
        { autoAlpha: 0, y: -10, scaleY: 0.9 },
        { autoAlpha: 1, y: 0, scaleY: 1, duration: 0.3, ease: "expo.out", transformOrigin: "top center" }
      );
    } else {
      gsap.to(menuRef.current, {
        autoAlpha: 0, y: -5, scaleY: 0.95, duration: 0.2, ease: "power2.in"
      });
    }
  }, [isOpen]);

  return (
    <>
      {/* Invisible overlay to capture outside clicks reliably */}
      {isOpen && (
        <div className="fixed inset-0 z-[90]" onClick={() => setIsOpen(false)} />
      )}
      <div className="relative flex items-center gap-2 bg-zinc-950 border border-zinc-800/80 rounded-xl px-3 h-full min-h-[44px]">
        <span className="text-[10px] text-zinc-500 uppercase font-medium tracking-wide">Budget</span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 bg-transparent text-sm font-mono text-white hover:text-zinc-300 focus:outline-none disabled:opacity-50 transition-colors z-[91]"
        >
          ${budget.toFixed(2)}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-zinc-500 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}>
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </button>

        <div 
          ref={menuRef}
          style={{ opacity: 0, visibility: "hidden" }}
          className="absolute top-full mt-2 -left-2 w-32 bg-zinc-950/95 backdrop-blur-md border border-zinc-800/80 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.8)] overflow-hidden z-[100] py-1 border-emerald-500/20"
        >
          {options.map((option) => (
            <button
              key={option}
              type="button"
              className={`w-full text-left px-4 py-2.5 text-sm font-mono transition-colors focus:outline-none ${budget === option ? "text-emerald-400 bg-emerald-400/5 font-medium border-l-2 border-emerald-400 pl-[14px]" : "text-zinc-400 hover:bg-zinc-800 hover:text-white border-l-2 border-transparent"}`}
              onClick={() => {
                setBudget(option);
                setIsOpen(false);
              }}
            >
              ${option.toFixed(2)}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function WalletBadge({ address, disconnect }: { address: string; disconnect: () => void }) {
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const badgeRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  useGSAP(() => {
    // We animate states dynamically based on confirmDisconnect
    if (confirmDisconnect) {
      gsap.to(badgeRef.current, {
        backgroundColor: "rgba(69, 10, 10, 0.4)", // red-950/40
        borderColor: "rgba(127, 29, 29, 0.5)", // red-900/50
        boxShadow: "0 0 20px rgba(239, 68, 68, 0.15)",
        duration: 0.3,
        ease: "power2.out",
      });
      gsap.to(iconRef.current, {
        background: "linear-gradient(to bottom right, #ef4444, #b91c1c)", // red-500 to red-700
        duration: 0.3,
      });
      gsap.fromTo(textRef.current, 
        { y: -5, opacity: 0 }, 
        { y: 0, opacity: 1, duration: 0.3, ease: "back.out(2)" }
      );
    } else {
      gsap.to(badgeRef.current, {
        backgroundColor: "rgba(24, 24, 27, 0.8)", // zinc-900/80
        borderColor: "rgba(6, 78, 59, 0.3)", // emerald-900/30
        boxShadow: "0 0 15px rgba(52, 211, 153, 0.05)",
        duration: 0.4,
        ease: "power2.out",
      });
      gsap.to(iconRef.current, {
        background: "linear-gradient(to bottom right, #10b981, #0f766e)", // emerald-500 to teal-700
        duration: 0.4,
      });
    }
  }, { dependencies: [confirmDisconnect], scope: badgeRef });

  const handleMouseEnter = () => {
    if (!confirmDisconnect) {
      gsap.to(badgeRef.current, { borderColor: "rgba(239, 68, 68, 0.4)", duration: 0.2 });
      gsap.to(iconRef.current, { background: "linear-gradient(to bottom right, #f87171, #b91c1c)", duration: 0.2 });
    }
  };

  const handleMouseLeave = () => {
    if (!confirmDisconnect) {
      gsap.to(badgeRef.current, { borderColor: "rgba(6, 78, 59, 0.3)", duration: 0.3 });
      gsap.to(iconRef.current, { background: "linear-gradient(to bottom right, #10b981, #0f766e)", duration: 0.3 });
    }
    setConfirmDisconnect(false);
  };

  return (
    <div 
      ref={badgeRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => {
        if (confirmDisconnect) {
          disconnect();
        } else {
          setConfirmDisconnect(true);
        }
      }} 
      className="flex items-center h-9 pr-4 pl-1.5 font-mono rounded-full border backdrop-blur-md cursor-pointer overflow-hidden relative"
    >
      <div ref={iconRef} className="w-6 h-6 rounded-full flex items-center justify-center mr-2 relative shadow-inner shrink-0 z-10">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-90 drop-shadow-sm">
          <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>
        </svg>
        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 border border-[rgb(24,24,27)] rounded-full transition-colors duration-300 ${
          confirmDisconnect ? "bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.8)]" : "bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.8)]"
        }`}></span>
      </div>
      <div className="relative h-full flex items-center min-w-[70px]">
        {confirmDisconnect ? (
          <span ref={textRef} className="text-red-400 font-medium tracking-wide text-xs relative z-10 w-full text-center">
            Disconnect?
          </span>
        ) : (
          <span ref={textRef} className="text-zinc-300 tracking-wide text-xs transition-colors group-hover:text-red-300 relative z-10">
            {address.slice(0, 4)}<span className="text-zinc-600 mx-0.5">…</span>{address.slice(-4)}
          </span>
        )}
      </div>
    </div>
  );
}

export default function ConsolePage() {
  const [isRunning, setIsRunning] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [resultText, setResultText] = useState("");
  const [goal, setGoal] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"mission"|"monitor">("mission");
  const [monitorRefresh, setMonitorRefresh] = useState(0);
  const [mobileTab, setMobileTab] = useState<"session" | "feed" | "network" | "output">("session");
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  // AP2 Mandate Sources — abstract checkboxes map to real domain CSV
  const MANDATE_SOURCE_MAP: Record<string, string> = {
    "Official Docs": "docs.*",
    "GitHub": "github.com",
    "Tech Blogs": "medium.com,dev.to,blog.*",
    "Security DBs": "nvd.nist.gov,cve.mitre.org",
    "Compliance": "iso.org,soc2.org,aicpa.org",
  };
  const [mandateSources, setMandateSources] = useState<Record<string, boolean>>({
    "Official Docs": true,
    "GitHub": true,
    "Tech Blogs": true,
    "Security DBs": true,
    "Compliance": true,
  });

  const getMandateDomainsCSV = () => {
    return Object.entries(mandateSources)
      .filter(([, v]) => v)
      .map(([k]) => MANDATE_SOURCE_MAP[k])
      .join(",");
  };

  const { address, kit, connect, disconnect } = useWallet();
  const socket = useFerruleSocket(BACKEND_URL, isRunning);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to economics when session completes
  useEffect(() => {
    if (sessionComplete && !isRunning && bottomRef.current) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    }
  }, [sessionComplete, isRunning]);

  // Force HTML/Body overflow hidden only while on this page
  useEffect(() => {
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, []);

  const handleDeploy = useCallback(async () => {
    if (!goal.trim() || isRunning) return;

    socket.reset();
    setResultText("");
    setSessionComplete(false);
    setIsRunning(true);

    try {
      let signedXdr: string | undefined;
      let funderPublicKey = address;

      if (!funderPublicKey || !kit) {
        await connect();
        const kitAddr = await kit?.getAddress();
        funderPublicKey = (typeof kitAddr === "string" ? kitAddr : kitAddr?.address) || null;
        if (!funderPublicKey) throw new Error("Wallet connection required.");
      }

      const preRes = await fetch(`${BACKEND_URL}/api/orchestrate/preauth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ funderPublicKey, budget: socket.budget }),
      });
      if (!preRes.ok) throw new Error("Failed to prepare transaction.");
      const preData = await preRes.json();

      const signed = await kit?.signTransaction(preData.xdr, {
        networkPassphrase: "Test SDF Network ; September 2015",
        address: funderPublicKey,
      });
      if (!signed) throw new Error("Transaction rejected.");
      signedXdr = signed.signedTxXdr;

      const res = await fetch(`${BACKEND_URL}/api/orchestrate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: goal.trim(),
          budget: socket.budget,
          mode: "mission",
          signedXdr,
          funderPublicKey,
          mandateSources: getMandateDomainsCSV(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setResultText(data.report || "");
      } else {
        setResultText(`Error: ${data.error || "Execution failed"}`);
      }
    } catch (err) {
      setResultText(`Error: ${(err as Error).message}`);
    } finally {
      setIsRunning(false);
      setSessionComplete(true);
    }
  }, [goal, isRunning, socket, address, kit, connect, mandateSources]);

  const handleSendDirective = useCallback(async (directive: string) => {
    if (!socket.sessionId || !selectedAgent) return;
    try {
      await fetch(`${BACKEND_URL}/api/orchestrate/directive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: socket.sessionId, agentName: selectedAgent, directive })
      });
    } catch (err) {
      console.error("Failed to send directive:", err);
    }
  }, [socket.sessionId, selectedAgent]);

  const displayText = isRunning ? socket.streamedText : resultText;
  const showDashboard = isRunning || sessionComplete;

  return (
    <div className="flex flex-col h-screen bg-black text-white overflow-hidden relative">
      <AmbientBackground />
      {/* ═══ Top Bar ═══ */}
      <header className="shrink-0 relative z-50 flex items-center justify-between px-4 lg:px-8 py-2 bg-black border-b border-white/[0.05]">
        <Link href="/" className="flex items-center gap-3">
          <FerruleLogo animated={false} className="w-9 h-9" />
          <div className="flex items-center gap-2 pt-1.5">
            <span className="text-2xl font-medium tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-400">
              Ferrule
            </span>
            <span className="text-sm text-zinc-500 font-mono pt-1 tracking-wide">Console</span>
          </div>
        </Link>

        <div className="flex items-center gap-4 pt-1.5">
          {socket.connected && (
            <span className="hidden sm:flex items-center gap-2 text-sm text-emerald-400/80 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              WS Live
            </span>
          )}
          {address ? (
            <>
              <button 
                onClick={() => setHistoryOpen(true)}
                className="hidden sm:flex items-center gap-2 h-9 px-4 text-xs font-mono rounded-full bg-zinc-900/50 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                History
              </button>
              <WalletBadge address={address} disconnect={disconnect} />
            </>
          ) : (
            <button
              onClick={connect}
              className="flex items-center h-9 px-4 text-sm font-medium rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 w-full px-4 lg:px-8 pt-6 pb-8 flex flex-col gap-4 overflow-y-auto scrollbar-thin">
        {/* ═══ Mode Toggle Tabs ═══ */}
        <div className="flex justify-center mb-2">
            <div className="flex bg-zinc-900 border border-zinc-800 rounded-full p-1 sticky top-0 z-50 shadow-2xl">
                <button onClick={() => setActiveTab("mission")} className={`flex items-center gap-2 px-6 py-2 rounded-full text-sm font-mono transition-colors ${activeTab === 'mission' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}>
                    <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    Mission
                </button>
                <button onClick={() => setActiveTab("monitor")} className={`flex items-center gap-2 px-6 py-2 rounded-full text-sm font-mono transition-colors ${activeTab === 'monitor' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}>
                    <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" /></svg>
                    Monitor
                </button>
            </div>
        </div>

        {activeTab === "monitor" && (
           !address ? (
            <div className="flex flex-col items-center justify-center p-12 bg-zinc-950/50 rounded-2xl border border-zinc-800/50 mt-6 border-dashed h-[50vh]">
               <div className="w-16 h-16 mb-6 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                  <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
               </div>
               <h3 className="text-xl font-light text-white mb-2">Connect Your Wallet</h3>
               <p className="text-zinc-500 font-mono text-sm max-w-sm text-center mb-6">Authenticate with your Stellar wallet to set up autonomous quantitative monitors on the Testnet.</p>
               <button onClick={connect} className="px-8 py-3 bg-emerald-500/20 text-emerald-400 rounded-full font-mono text-sm border border-emerald-500/30 hover:bg-emerald-500/30 transition-all shadow-xl shadow-emerald-900/20">
                 Connect Stellar Wallet
               </button>
            </div>
           ) : (
           <div className="grid lg:grid-cols-3 gap-6">
             <div className="lg:col-span-1">
                <MonitorSetup backendUrl={BACKEND_URL} onMonitorCreated={() => setMonitorRefresh(r => r + 1)} />
             </div>
             <div className="lg:col-span-2">
                <MonitorPanel backendUrl={BACKEND_URL} refreshTrigger={monitorRefresh} />
             </div>
           </div>
           )
        )}

        {/* ═══ Mission Input Bar ═══ */}
        {activeTab === "mission" && (
        <div className="shrink-0 relative z-50 bg-black rounded-xl border border-zinc-900 shadow-2xl p-1">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch">
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (!isRunning && goal.trim() && address) handleDeploy();
                }
              }}
              disabled={isRunning}
              placeholder="Research objective — e.g. Competitive analysis of AI agent payment architectures in 2026"
              rows={1}
              className="flex-1 bg-zinc-950 border border-zinc-800/60 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 font-mono resize-none focus:outline-none focus:border-zinc-700 transition-colors disabled:opacity-50"
            />

            <div className="flex gap-2 items-center shrink-0">
              <BudgetDropdown budget={socket.budget} setBudget={socket.setBudget} disabled={isRunning} />

              <button
                onClick={handleDeploy}
                disabled={isRunning || !goal.trim() || !address}
                className="h-full min-h-[44px] px-5 rounded-xl bg-white text-black text-sm font-medium hover:bg-zinc-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {isRunning ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    Running
                  </span>
                ) : (
                  "Deploy ▶"
                )}
              </button>
            </div>
          </div>

          {/* AP2 Mandate Sources */}
          {address && (
            <div className="flex flex-wrap items-center gap-2 px-1 pt-1">
              <span className="text-[10px] text-zinc-600 uppercase tracking-wider font-medium mr-1">AP2 Mandate Sources</span>
              {Object.keys(MANDATE_SOURCE_MAP).map((label) => (
                <button
                  key={label}
                  type="button"
                  disabled={isRunning}
                  onClick={() => setMandateSources(prev => ({ ...prev, [label]: !prev[label] }))}
                  className={`px-3 py-1 rounded-full text-[11px] font-medium border transition-all duration-200 ${
                    mandateSources[label] 
                      ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.1)]" 
                      : "bg-zinc-950 border-zinc-800 text-zinc-600 hover:border-zinc-700 hover:text-zinc-400"
                  } disabled:opacity-40`}
                >
                  {mandateSources[label] ? "✓ " : ""}{label}
                </button>
              ))}
            </div>
          )}
        </div>
        )}

        {/* ═══ Empty state ═══ */}
        {!showDashboard && activeTab === "mission" && (
          <div className="flex-1 flex flex-col items-center justify-center py-10 text-center relative z-10">
            <FerruleLogo className="w-16 h-16 mb-6 opacity-20" />
            <p className="text-zinc-600 text-sm max-w-md">
              Connect your Stellar wallet, set a USDC budget, and deploy an autonomous research mission.
              Every micropayment is real, every transaction is verifiable on-chain.
            </p>
            <TestnetFaucet />
          </div>
        )}

        {/* ═══ Dashboard ═══ */}
        {showDashboard && activeTab === "mission" && (
          <div className="flex flex-col gap-4">
            
            {/* KPI Strip */}
            <div className="shrink-0 z-40 bg-black/80 pb-1">
              <KPIStrip
                offChainCount={socket.offChainCount}
                onChainCount={socket.onChainCount}
                totalSpent={socket.totalSpent}
                networkCost={socket.networkCost}
                x402Payments={socket.x402Payments}
                riskScore={socket.riskScore}
              />
            </div>

            {/* Desktop Layout: 2 columns */}
            <div className="hidden lg:grid lg:grid-cols-5 gap-4">
              {/* Left column (flex-col so children share remaining height) */}
              <div className="lg:col-span-3 flex flex-col gap-4">
                <div className="h-[625px] flex flex-col shrink-0">
                  <ResearchOutput
                    text={displayText}
                    isStreaming={isRunning}
                    x402Payments={socket.x402Payments}
                    sessionDuration={socket.sessionDuration}
                    transactions={socket.transactions}
                  />
                </div>
                <div className="h-[200px] flex flex-col shrink-0">
                  <EventStream events={socket.feedEvents} />
                </div>
              </div>

              {/* Right column */}
              <div className="lg:col-span-2 flex flex-col gap-4">
                <AgentNetworkViz
                  agentStatuses={socket.agentStatuses}
                  channelStatus={socket.channelStatus}
                  onNodeClick={setSelectedAgent}
                  className="shrink-0"
                />
                <div className="flex-1 flex flex-col pt-1 pb-4">
                  <ChannelCards
                    channelId={socket.channelId}
                    channelStatus={socket.channelStatus}
                    budget={socket.budget}
                    totalSpent={socket.totalSpent}
                    offChainCount={socket.offChainCount}
                    x402Payments={socket.x402Payments}
                    transactions={socket.transactions}
                  />
                </div>
              </div>
            </div>

            {/* Mobile Layout: Tab content */}
            <div className="lg:hidden flex-1 min-h-0 flex flex-col">
              <div className="flex-1 min-h-0 overflow-y-auto pb-16">
                {mobileTab === "session" && (
                  <ChannelCards
                    channelId={socket.channelId}
                    channelStatus={socket.channelStatus}
                    budget={socket.budget}
                    totalSpent={socket.totalSpent}
                    offChainCount={socket.offChainCount}
                    x402Payments={socket.x402Payments}
                    transactions={socket.transactions}
                  />
                )}
                {mobileTab === "feed" && <EventStream events={socket.feedEvents} />}
                {mobileTab === "network" && (
                  <AgentNetworkViz
                    agentStatuses={socket.agentStatuses}
                    channelStatus={socket.channelStatus}
                    onNodeClick={setSelectedAgent}
                  />
                )}
                {mobileTab === "output" && (
                  <ResearchOutput
                    text={displayText}
                    isStreaming={isRunning}
                    x402Payments={socket.x402Payments}
                    sessionDuration={socket.sessionDuration}
                    transactions={socket.transactions}
                  />
                )}
              </div>
            </div>

            {/* Session Economics (bottom strip Desktop) */}
            {sessionComplete && !isRunning && (
              <div className="hidden lg:block shrink-0 mt-2 pb-0 animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out fill-mode-both">
                <SessionEconomics
                  offChainCount={socket.offChainCount}
                  onChainCount={socket.onChainCount}
                  x402Payments={socket.x402Payments}
                  totalSpent={socket.totalSpent}
                  networkCost={socket.networkCost}
                  budget={socket.budget}
                  sessionDuration={socket.sessionDuration}
                  isComplete={sessionComplete && !isRunning}
                />
              </div>
            )}
            
            {/* Scroll Anchor & Spacer */}
            <div ref={bottomRef} className="h-1 shrink-0 w-full" />
          </div>
        )}
      </main>

      {/* ═══ Mobile Bottom Tabs & Economics ═══ */}
      {showDashboard && (
        <div className="lg:hidden shrink-0 mt-auto bg-black">
          <SessionEconomics
            offChainCount={socket.offChainCount}
            onChainCount={socket.onChainCount}
            x402Payments={socket.x402Payments}
            totalSpent={socket.totalSpent}
            networkCost={socket.networkCost}
            budget={socket.budget}
            sessionDuration={socket.sessionDuration}
            isComplete={sessionComplete && !isRunning}
            mobileCompact={true}
          />
          <nav className="flex items-center justify-around h-14 border-t border-white/[0.05]">
            {(
              [
                { key: "session", label: "Session", icon: "◆" },
                { key: "feed", label: "Feed", icon: "≡" },
                { key: "network", label: "Network", icon: "◎" },
                { key: "output", label: "Output", icon: "📄" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setMobileTab(tab.key)}
                className={`flex flex-col items-center gap-0.5 text-[10px] font-medium transition-colors ${
                  mobileTab === tab.key ? "text-teal-400" : "text-zinc-600"
                }`}
              >
                <span className="text-base">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* Slide-in Agent Console */}
      <AgentConsole
        agent={selectedAgent}
        agentStatus={selectedAgent ? (socket.agentStatuses as any)[selectedAgent] || "idle" : "idle"}
        sessionId={socket.sessionId}
        onClose={() => setSelectedAgent(null)}
        onSendDirective={handleSendDirective}
      />

      {/* Human-in-the-Loop Modal */}
      <HITLModal
        visible={socket.hitlVisible}
        query={goal}
        context={socket.hitlContext}
        sessionId={socket.sessionId}
        backendUrl={BACKEND_URL}
        onResolved={socket.resolveHitl}
      />

      {/* Slide-over History Panel */}
      <HistoryPanel 
        isOpen={historyOpen} 
        onClose={() => setHistoryOpen(false)} 
        address={address} 
        backendUrl={BACKEND_URL} 
      />
    </div>
  );
}
