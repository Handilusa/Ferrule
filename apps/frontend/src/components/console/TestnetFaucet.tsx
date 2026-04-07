"use client";

import { useState, useRef, useCallback } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useWallet } from "@/context/WalletContext";
import { StellarLogo } from "@/components/svg/StellarLogo";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000";

type StepStatus = "idle" | "running" | "sign_required" | "signing" | "submitting" | "success" | "error" | "skipped";

interface FaucetStep {
  id: string;
  label: string;
  icon: string;
  status: StepStatus;
  detail: string;
  txHash?: string;
  xdr?: string;
  extra?: Record<string, string>;
}

const INITIAL_STEPS: FaucetStep[] = [
  { id: "friendbot", label: "Claim 10,000 XLM", icon: "☀️", status: "idle", detail: "Request testnet XLM from Friendbot" },
  { id: "trustline", label: "USDC Trustline", icon: "🔗", status: "idle", detail: "Authorize USDC asset on your wallet" },
  { id: "swap", label: "Swap XLM → USDC", icon: "💱", status: "idle", detail: "Convert XLM to USDC via Stellar DEX" },
];

export function TestnetFaucet() {
  const { address, kit, connect } = useWallet();
  const [steps, setSteps] = useState<FaucetStep[]>(INITIAL_STEPS);
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // GSAP entrance animations
  useGSAP(() => {
    if (!containerRef.current) return;
    gsap.fromTo(
      containerRef.current,
      { autoAlpha: 0, y: 20, scale: 0.97 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.6, ease: "expo.out", delay: 0.5 }
    );
    gsap.fromTo(
      ".faucet-step",
      { x: -20, autoAlpha: 0 },
      { x: 0, autoAlpha: 1, duration: 0.5, stagger: 0.12, ease: "power3.out", delay: 0.8 }
    );
  }, { scope: containerRef });

  // Animate step status changes
  const animateStep = useCallback((stepId: string, status: StepStatus) => {
    const el = document.querySelector(`[data-step="${stepId}"]`);
    if (!el) return;

    if (status === "running" || status === "signing" || status === "submitting") {
      gsap.fromTo(el, 
        { borderColor: "rgba(59, 130, 246, 0)" },
        { borderColor: "rgba(59, 130, 246, 0.4)", duration: 0.8, repeat: -1, yoyo: true, ease: "sine.inOut" }
      );
      gsap.to(el.querySelector(".step-indicator"), {
        scale: 1.2, duration: 0.3, ease: "back.out(3)",
      });
    } else if (status === "success" || status === "skipped") {
      gsap.killTweensOf(el);
      gsap.to(el, { borderColor: "rgba(52, 211, 153, 0.3)", duration: 0.4 });
      gsap.fromTo(el.querySelector(".step-indicator"),
        { scale: 1.4 },
        { scale: 1, duration: 0.5, ease: "elastic.out(1.2, 0.5)" }
      );
      // Flash pulse
      gsap.fromTo(el,
        { boxShadow: "0 0 0 0 rgba(52, 211, 153, 0.3)" },
        { boxShadow: "0 0 20px 4px rgba(52, 211, 153, 0)", duration: 0.8, ease: "power2.out" }
      );
    } else if (status === "error") {
      gsap.killTweensOf(el);
      gsap.to(el, { borderColor: "rgba(239, 68, 68, 0.4)", duration: 0.3 });
      gsap.fromTo(el, { x: -3 }, { x: 0, duration: 0.4, ease: "elastic.out(1, 0.3)" });
    } else if (status === "sign_required") {
      gsap.killTweensOf(el);
      gsap.fromTo(el,
        { borderColor: "rgba(251, 191, 36, 0.2)" },
        { borderColor: "rgba(251, 191, 36, 0.5)", duration: 1, repeat: -1, yoyo: true, ease: "sine.inOut" }
      );
    }
  }, []);

  // Animate progress bar
  const animateProgress = useCallback((pct: number) => {
    if (progressRef.current) {
      gsap.to(progressRef.current, {
        width: `${pct}%`,
        duration: 0.6,
        ease: "power2.out",
      });
    }
  }, []);

  const updateStep = useCallback((stepId: string, update: Partial<FaucetStep>) => {
    setSteps(prev => prev.map(s =>
      s.id === stepId ? { ...s, ...update } : s
    ));
    if (update.status) animateStep(stepId, update.status);
  }, [animateStep]);

  // Submit signed XDR to Horizon via backend
  const submitSigned = useCallback(async (signedXdr: string): Promise<string | null> => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/faucet/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedXdr }),
      });
      const data = await res.json();
      if (data.success) return data.hash;
      console.error("Submit failed:", data);
      return null;
    } catch (e) {
      console.error("Submit error:", e);
      return null;
    }
  }, []);

  // Main faucet flow
  const runFaucet = useCallback(async () => {
    if (isRunning) return;

    // Use current context address or fallback to localStorage
    let walletAddr = address;
    if (!walletAddr) {
      walletAddr = localStorage.getItem("ferrule_wallet_address");
    }

    if (!walletAddr) {
      await connect();
      // Wait a bit and try again
      await new Promise(r => setTimeout(r, 800));
      walletAddr = localStorage.getItem("ferrule_wallet_address");
      if (!walletAddr) {
        console.warn("Faucet: No wallet address found after connection attempt.");
        return;
      }
    }

    console.log("Faucet: Starting for address", walletAddr);
    setIsRunning(true);
    setIsDone(false);
    setSteps(INITIAL_STEPS);
    animateProgress(0);

    // Initial buffer for steps
    let currentSteps = [...INITIAL_STEPS];

    // Collect XDRs we need to sign
    const pendingXdrs: { step: string; xdr: string }[] = [];

    // Open SSE stream
    try {
      const response = await fetch(`${BACKEND_URL}/api/faucet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey: walletAddr }),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamDone = false;
      let buffer = "";

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) {
          streamDone = true;
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.includes("data: ")) continue;
          try {
            const jsonStr = line.replace(/^data: /, "").trim();
            if (!jsonStr) continue;
            const data = JSON.parse(jsonStr);
            
            if (data.step === "done") {
              if (data.status === "error") {
                 // Map to the last running step if any
                 setSteps(prev => prev.map(s => s.status === "running" ? { ...s, status: "error", detail: data.detail } : s));
              }
              continue;
            }

            const stepId = data.step;
            const status = data.status as StepStatus;

            if (status === "sign_required") {
              pendingXdrs.push({ step: stepId, xdr: data.xdr });
            }

            // Immediately update local state for the UI
            setSteps(prev => prev.map(s => 
              s.id === stepId ? { 
                ...s, 
                status: status === "sign_required" ? "sign_required" : status, 
                detail: data.detail,
                xdr: data.xdr,
                extra: data.extra
              } : s
            ));
            animateStep(stepId, status);

            // Update individual progress markers
            if (stepId === "friendbot" && status === "success") animateProgress(30);
            if (stepId === "trustline" && status === "success") animateProgress(60);
          } catch (e) { 
            console.error("Faucet: Error parsing SSE line", e, line);
          }
        }
      }

      // ─── Phase 2: Sequential Signing ───
      console.log("Faucet: Phase 1 (SSE) complete. Pending XDRs:", pendingXdrs.length);

      for (const { step, xdr } of pendingXdrs) {
        if (!kit || !walletAddr) {
          console.warn("Faucet: Kit or address lost during signing phase.");
          break;
        }

        try {
          updateStep(step, { status: "signing", detail: "Awaiting wallet signature…" });
          
          const signed = await kit.signTransaction(xdr, {
            networkPassphrase: "Test SDF Network ; September 2015",
            address: walletAddr,
          });

          if (!signed?.signedTxXdr) {
            updateStep(step, { status: "error", detail: "Transaction signing rejected by user." });
            continue;
          }

          updateStep(step, { status: "submitting", detail: "Submitting to Stellar network…" });
          const hash = await submitSigned(signed.signedTxXdr);

          if (hash) {
            updateStep(step, {
              status: "success",
              detail: step === "trustline" ? "Trustline active ✓" : "Swap complete ✓",
              txHash: hash,
            });
            if (step === "trustline") animateProgress(75);
            if (step === "swap") animateProgress(100);
          } else {
            updateStep(step, { status: "error", detail: "Transaction failed to land on ledger." });
          }

        } catch (e) {
          console.error(`Faucet: Error in signing ${step}`, e);
          updateStep(step, { status: "error", detail: (e as Error).message });
        }
      }

    } catch (err) {
      console.error("Faucet stream error:", err);
      updateStep("friendbot", { status: "error", detail: `Stream failed: ${(err as Error).message}` });
    }

    // Finalize
    animateProgress(100);
    setIsDone(true);
    setIsRunning(false);

    if (containerRef.current) {
      gsap.to(containerRef.current, { boxShadow: "0 0 40px 8px rgba(52, 211, 153, 0.1)", duration: 0.8 });
    }

  }, [address, kit, connect, isRunning, updateStep, animateProgress, animateStep, submitSigned]);

  const getStatusIcon = (status: StepStatus) => {
    switch (status) {
      case "idle": return <div className="w-3 h-3 rounded-full border-2 border-zinc-700" />;
      case "running":
      case "signing":
      case "submitting":
        return (
          <div className="w-3.5 h-3.5 border-2 border-blue-400/60 border-t-blue-400 rounded-full animate-spin" />
        );
      case "sign_required":
        return (
          <div className="w-3.5 h-3.5 rounded-full bg-amber-500/20 border border-amber-500/60 flex items-center justify-center">
            <span className="text-[7px]">✍️</span>
          </div>
        );
      case "success":
      case "skipped":
        return (
          <div className="w-3.5 h-3.5 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
        );
      case "error":
        return (
          <div className="w-3.5 h-3.5 rounded-full bg-red-500/20 flex items-center justify-center">
            <span className="text-red-400 text-[10px] font-bold">✕</span>
          </div>
        );
    }
  };

  const getStatusColor = (status: StepStatus): string => {
    switch (status) {
      case "running":
      case "signing":
      case "submitting": return "text-blue-400";
      case "sign_required": return "text-amber-400";
      case "success":
      case "skipped": return "text-emerald-400";
      case "error": return "text-red-400";
      default: return "text-zinc-600";
    }
  };

  const getStatusLabel = (status: StepStatus): string => {
    switch (status) {
      case "running": return "In Progress";
      case "signing": return "Sign in Wallet";
      case "submitting": return "Submitting TX";
      case "sign_required": return "Awaiting Signature";
      case "success": return "Complete";
      case "skipped": return "Skipped";
      case "error": return "Failed";
      default: return "Pending";
    }
  };

  const hasAnyError = steps.some(s => s.status === "error");
  const allDone = steps.every(s => s.status === "success" || s.status === "skipped" || s.status === "error");

  return (
    <div
      ref={containerRef}
      className="w-full max-w-md mx-auto mt-6"
      style={{ opacity: 0, visibility: "hidden" }}
    >
      {/* Card container */}
      <div className="relative bg-zinc-950/80 backdrop-blur-md border border-zinc-800/60 rounded-2xl overflow-hidden">

        {/* Ambient glow */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-500/5 rounded-full blur-[60px] pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-emerald-500/5 rounded-full blur-[60px] pointer-events-none" />

        {/* Header */}
        <div className="px-5 pt-5 pb-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-emerald-500/20 border border-zinc-800/60 flex items-center justify-center">
            <StellarLogo className="w-4 h-4 text-zinc-300" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-zinc-200 tracking-tight">Testnet Faucet</h3>
            <p className="text-[10px] text-zinc-600 tracking-wide uppercase">XLM + USDC One-Click Setup</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-5 pb-3">
          <div className="h-1 bg-zinc-800/80 rounded-full overflow-hidden">
            <div
              ref={progressRef}
              className="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 rounded-full"
              style={{ width: "0%" }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="px-5 pb-4 space-y-2">
          {steps.map((step) => (
            <div
              key={step.id}
              data-step={step.id}
              className="faucet-step group relative flex items-start gap-3 px-3 py-2.5 rounded-xl border border-zinc-800/40 bg-zinc-900/30 transition-all"
            >
              {/* Indicator */}
              <div className="step-indicator mt-0.5 shrink-0">
                {getStatusIcon(step.status)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs">{step.icon}</span>
                  <span className="text-xs font-medium text-zinc-300">{step.label}</span>
                  <span className={`text-[9px] font-mono uppercase tracking-wider ml-auto ${getStatusColor(step.status)}`}>
                    {getStatusLabel(step.status)}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed truncate">
                  {step.detail}
                </p>
                {step.txHash && (
                  <a
                    href={`https://stellar.expert/explorer/testnet/tx/${step.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[9px] font-mono text-cyan-500/70 hover:text-cyan-400 mt-1 inline-flex items-center gap-1 transition-colors"
                  >
                    TX: {step.txHash.slice(0, 12)}…{step.txHash.slice(-4)}
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7M17 7H7M17 7v10"/></svg>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Action Button */}
        <div className="px-5 pb-5">
          <button
            onClick={runFaucet}
            disabled={isRunning}
            className={`w-full h-10 rounded-xl text-xs font-medium tracking-wide transition-all duration-300 relative overflow-hidden ${
              isRunning
                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                : isDone && !hasAnyError
                  ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                  : "bg-gradient-to-r from-blue-600/80 to-cyan-500/80 text-white hover:from-blue-500 hover:to-cyan-400 shadow-[0_0_20px_rgba(59,130,246,0.15)]"
            }`}
          >
            {isRunning ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3 h-3 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
                Funding Wallet…
              </span>
            ) : isDone && !hasAnyError ? (
              <span className="flex items-center justify-center gap-2">
                ✓ Wallet Funded — Ready to Research
              </span>
            ) : isDone && hasAnyError ? (
              "Retry Faucet"
            ) : !address ? (
              "Connect Wallet & Fund"
            ) : (
              <span className="flex items-center justify-center gap-2">
                <StellarLogo className="w-3 h-3" />
                Fund Wallet with Testnet USDC
              </span>
            )}

            {/* Animated shine effect on button */}
            {!isRunning && !isDone && (
              <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
