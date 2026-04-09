"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { NodeNetwork } from "@/components/svg/NodeNetwork";
import { StreamChannel } from "@/components/svg/StreamChannel";
import { SettlementCore } from "@/components/svg/SettlementCore";
import { FerruleLogo } from "@/components/svg/FerruleLogo";
import { StellarLogo } from "@/components/svg/StellarLogo";
import { AmbientBackground } from "@/components/AmbientBackground";

export default function Home() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  useGSAP(() => {
    /* ── Hero entrance ── */
    const heroTl = gsap.timeline({ defaults: { ease: "power4.out" } });
    heroTl
      .fromTo(".hero-logo", { scale: 0.8, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.8 })
      .fromTo(".hero-badge", { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6 }, "-=0.6")
      .fromTo(".hero-title span", { y: 60, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1, stagger: 0.12 }, "-=0.3")
      .fromTo(".hero-sub", { y: 20, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8 }, "-=0.5")
      .fromTo(".hero-cta", { y: 20, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, stagger: 0.1 }, "-=0.4")
      .fromTo(".hero-metric", { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.08 }, "-=0.3");

    /* ── Problem cards ── */
    gsap.fromTo(".problem-card",
      { y: 40, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.8, stagger: 0.15, ease: "power3.out", delay: 0.3 }
    );

    /* ── How-it-works SVG cards ── */
    gsap.fromTo(".step-block",
      { y: 40, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.8, stagger: 0.2, ease: "power3.out", delay: 0.3 }
    );

    /* ── Comparison rows ── */
    gsap.fromTo(".comparison-row",
      { x: -30, autoAlpha: 0 },
      { x: 0, autoAlpha: 1, duration: 0.6, stagger: 0.08, ease: "power2.out", delay: 0.3 }
    );

    /* ── FAQ ── */
    gsap.fromTo(".section-faq",
      { y: 30, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.7, ease: "power3.out", delay: 0.3 }
    );

    /* ── Smart Sticky Navbar ── */
    let isNavigating = false;
    let navTimeout: NodeJS.Timeout;

    // Intercept anchor clicks to prevent navbar from hiding during smooth scroll
    const anchorLinks = rootRef.current?.querySelectorAll('a[href^="#"]');
    anchorLinks?.forEach(anchor => {
      anchor.addEventListener("click", (e) => {
        e.preventDefault();
        const targetId = anchor.getAttribute("href");
        if (!targetId) return;
        
        isNavigating = true;
        if (navTimeout) clearTimeout(navTimeout);
        
        document.querySelector(targetId)?.scrollIntoView({ behavior: "smooth" });
        
        // Re-enable scroll listening after smooth scroll finishes
        navTimeout = setTimeout(() => {
          isNavigating = false;
        }, 1200); // 1.2s to be perfectly safe for slow scrolling
      });
    });

    const showNav = gsap.fromTo(".navbar-main", 
      { yPercent: 0 },
      { yPercent: -100, duration: 0.3, paused: true, ease: "power2.inOut" }
    );

    ScrollTrigger.create({
      start: "top top",
      end: 99999,
      onUpdate: (self) => {
        if (isNavigating) return; // Ignore programmatic scrolls from nav clicks

        if (self.direction === 1 && self.scroll() > 60) {
          showNav.play(); // Scroll down -> hide
        } else {
          showNav.reverse(); // Scroll up -> show
        }
      }
    });
  }, { scope: rootRef });

  return (
    <div ref={rootRef} className="min-h-screen bg-black text-white overflow-x-hidden pt-20">
      {/* ═══════════════ NAVBAR ═══════════════ */}
      <nav className="navbar-main fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 h-20 bg-black/40 backdrop-blur-xl border-b border-white/[0.05]">
        <div className="flex items-center gap-3">
          <FerruleLogo animated={false} className="w-9 h-9 -ml-1 drop-shadow-[0_0_15px_rgba(255,255,255,0.15)]" />
          <span className="text-xl font-light tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-400">
            Ferrule
          </span>
        </div>
        
        <div className="hidden md:flex items-center gap-8 text-xs font-medium tracking-wide text-zinc-500">
          <a href="#problem" className="hover:text-zinc-200 transition-colors">The Problem</a>
          <a href="#architecture" className="hover:text-zinc-200 transition-colors">Architecture</a>
          <a href="#stellar" className="hover:text-zinc-200 transition-colors">Why Stellar</a>
          <a href="#registry" className="hover:text-zinc-200 transition-colors">Registry</a>
          <a href="#faq" className="hover:text-zinc-200 transition-colors">FAQ</a>
        </div>

        <Link href="/console">
          <Button variant="outline" className="h-9 px-5 text-xs rounded-full bg-zinc-950 border-zinc-800 hover:bg-zinc-800 hover:text-white transition-colors">
            Launch App
          </Button>
        </Link>
      </nav>

      {/* ═══════════════ AMBIENT BG ═══════════════ */}
      <AmbientBackground />

      {/* ═══════════════ HERO ═══════════════ */}
      <section className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center">
        {/* Ambient silver glow behind title */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-zinc-500/5 blur-[100px]" />

        <Badge variant="outline" className="hero-badge mb-8 border-zinc-700 bg-zinc-900/60 backdrop-blur text-zinc-400 py-1.5 px-5 text-xs tracking-wide">
          <StellarLogo className="w-3.5 h-3.5 mr-2 text-zinc-400" />
          Autonomous B2B Due Diligence · Anchored on Stellar
        </Badge>

        <h1 className="hero-title max-w-4xl text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-light tracking-tight leading-[1.05] mb-8">
          <span className="block bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-500">SaaS Due diligence.</span>
          <span className="block bg-clip-text text-transparent bg-gradient-to-b from-zinc-300 to-zinc-600">Verified on-chain.</span>
        </h1>

        <p className="hero-sub max-w-2xl text-zinc-500 text-lg sm:text-xl leading-relaxed mb-10 font-light">
          Stop trusting generic LLMs. Ferrule deploys autonomous agents to cross-examine B2B vendors for lock-in, security gaps, and pricing risks — strictly governed by on-chain AP2 Risk Mandates and verifiable via Stellar micropayments.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mb-16">
          <Link href="/console" className="hero-cta">
            <Button className="h-12 px-7 bg-white text-black hover:bg-zinc-200 text-sm font-medium tracking-wide transition-all shadow-[0_0_60px_-15px_rgba(255,255,255,0.15)]">
              Launch Console
            </Button>
          </Link>
          <Link href="/console" className="hero-cta">
            <Button variant="outline" className="h-12 px-7 border-zinc-800 bg-transparent text-zinc-400 hover:text-white hover:border-zinc-600 text-sm font-medium tracking-wide">
              Watch Demo
            </Button>
          </Link>
        </div>

        {/* Live metrics strip */}
        <div className="flex flex-wrap justify-center gap-8 sm:gap-12 text-center">
          {[
            { value: "4", label: "Specialized Agents" },
            { value: "100%", label: "On-Chain Verified" },
            { value: "x402", label: "Agent Micropayments" },
          ].map((m, i) => (
            <div key={i} className="hero-metric">
              <div className="text-2xl sm:text-3xl font-light text-white tracking-tight">{m.value}</div>
              <div className="text-xs text-zinc-600 tracking-wider uppercase mt-1">{m.label}</div>
            </div>
          ))}
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-zinc-700">
          <div className="w-px h-10 bg-gradient-to-b from-zinc-600 to-transparent" />
        </div>
      </section>

      {/* ═══════════════ THE PROBLEM ═══════════════ */}
      <section id="problem" className="section-problem relative z-10 max-w-5xl mx-auto px-6 py-32 mt-16">
        <div className="text-center mb-16">
          <p className="text-xs text-zinc-600 tracking-[0.3em] uppercase mb-4">The Problem</p>
          <h2 className="text-3xl sm:text-4xl font-light text-zinc-200 tracking-tight">
            Generic LLMs fail at B2B evaluation
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="problem-card bg-zinc-950 border-zinc-800/60 hover:border-zinc-700/60 transition-colors">
            <CardHeader>
              <Badge variant="outline" className="w-fit border-red-900/50 text-red-400/80 text-[10px]">DANGEROUS</Badge>
              <CardTitle className="text-lg font-medium text-zinc-300 mt-3">Hallucinations &amp; Bias</CardTitle>
              <CardDescription>
                Asking ChatGPT to evaluate a cybersecurity vendor is reckless. It invents compliance 
                certifications, glosses over vendor lock-in, and tells you what it thinks you want to hear.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="problem-card bg-zinc-950 border-zinc-800/60 hover:border-zinc-700/60 transition-colors">
            <CardHeader>
              <Badge variant="outline" className="w-fit border-amber-900/50 text-amber-400/80 text-[10px]">SLOW</Badge>
              <CardTitle className="text-lg font-medium text-zinc-300 mt-3">Manual Research</CardTitle>
              <CardDescription>
                Having engineers or ops leads spend two weeks scraping API docks, cross-referencing ISO 
                certifications, and mapping out pricing tiers is a massive waste of high-value human capital.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="problem-card md:col-span-2 bg-zinc-950 border-zinc-800/60 hover:border-zinc-600/40 transition-colors">
            <CardHeader>
              <Badge variant="outline" className="w-fit border-emerald-900/50 text-emerald-400/80 text-[10px]">FERRULE</Badge>
              <CardTitle className="text-lg font-medium text-zinc-300 mt-3">Autonomous, Verifiable Swarm</CardTitle>
              <CardDescription className="max-w-2xl">
                Ferrule orchestrates specialized sub-agents (Search, Risk, LLM). The <span className="text-zinc-300">Risk Agent</span> actively 
                attacks the primary research, triggering autonomous <span className="text-zinc-300">x402</span> micropayments for newly discovered information gaps. 
                Everything anchors on the Stellar ledger for cryptographic proof of diligence.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      <Separator className="max-w-5xl mx-auto bg-zinc-900" />

      {/* ═══════════════ HOW IT WORKS ═══════════════ */}
      <section id="architecture" className="section-how relative z-10 max-w-6xl mx-auto px-6 py-32">
        <div className="text-center mb-20">
          <p className="text-xs text-zinc-600 tracking-[0.3em] uppercase mb-4">Architecture</p>
          <h2 className="text-3xl sm:text-4xl font-light text-zinc-200 tracking-tight">
            Three Agents. Immutable Proof.
          </h2>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Step 1 — Discovery */}
          <Card className="step-block bg-zinc-950/80 border-zinc-800/50 overflow-hidden group hover:border-zinc-700/60 transition-all">
            <CardContent className="p-0">
              <div className="h-48 flex items-center justify-center bg-zinc-950 border-b border-zinc-800/40">
                <NodeNetwork className="w-full h-full p-4 opacity-60 group-hover:opacity-90 transition-opacity" />
              </div>
              <div className="p-6">
                <p className="text-[10px] text-zinc-600 tracking-[0.2em] uppercase mb-2">Stage 01</p>
                <h3 className="text-base font-medium text-zinc-200 mb-2">Agent Swarm Strategy</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  The orchestrator coordinates specialized agents: the Search agent scrapes 
                  docs, the Risk agent flags security gaps, and the LLM agent synthesizes data.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Step 2 — Streaming */}
          <Card className="step-block bg-zinc-950/80 border-zinc-800/50 overflow-hidden group hover:border-zinc-700/60 transition-all">
            <CardContent className="p-0">
              <div className="h-48 flex items-center justify-center bg-zinc-950 border-b border-zinc-800/40">
                <StreamChannel className="w-full h-full p-4 opacity-60 group-hover:opacity-90 transition-opacity" />
              </div>
              <div className="p-6">
                <p className="text-[10px] text-zinc-600 tracking-[0.2em] uppercase mb-2">Stage 02</p>
                <h3 className="text-base font-medium text-zinc-200 mb-2">Autonomous Commerce (x402)</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  If the Risk Agent finds a blind spot, it autonomously negotiates and pays 
                  the Search Agent via x402 micropayments to fetch missing technical docs.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Step 3 — Settlement */}
          <Card className="step-block bg-zinc-950/80 border-zinc-800/50 overflow-hidden group hover:border-zinc-700/60 transition-all">
            <CardContent className="p-0">
              <div className="h-48 flex items-center justify-center bg-zinc-950 border-b border-zinc-800/40">
                <SettlementCore className="w-full h-full p-4 opacity-60 group-hover:opacity-90 transition-opacity" />
              </div>
              <div className="p-6">
                <p className="text-[10px] text-zinc-600 tracking-[0.2em] uppercase mb-2">Stage 03</p>
                <h3 className="text-base font-medium text-zinc-200 mb-2">On-Chain Anchoring</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  The final report is hashed using SHA-256 and anchored directly to the Stellar 
                  ledger via a manageData transaction — creating an immutable audit trail.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <Separator className="max-w-5xl mx-auto bg-zinc-900" />

      {/* ═══════════════ COMPARISON ═══════════════ */}
      <section id="stellar" className="section-compare relative z-10 max-w-4xl mx-auto px-6 py-32">
        <div className="text-center mb-16">
          <p className="text-xs text-zinc-600 tracking-[0.3em] uppercase mb-4">Why Stellar</p>
          <h2 className="text-3xl sm:text-4xl font-light text-zinc-200 tracking-tight">
            This is only possible on one network
          </h2>
        </div>

        <Card className="bg-zinc-950 border-zinc-800/60 overflow-hidden">
          <CardContent className="p-0">
            {/* Table header */}
            <div className="comparison-row grid grid-cols-4 text-[10px] tracking-[0.15em] uppercase text-zinc-600 border-b border-zinc-800/40 px-6 py-4">
              <div>Feature</div>
              <div className="text-center">Ethereum</div>
              <div className="text-center">Solana</div>
              <div className="text-center text-zinc-400">Stellar</div>
            </div>

            {[
              { feature: "Agent Commerce", eth: "Impossible", sol: "Unfeasible", stl: "Native x402" },
              { feature: "Micro-settlement", eth: "$15.00/tx", sol: "$0.001/tx", stl: "$0.0000001 (MPP)" },
              { feature: "On-Chain Anchoring", eth: "Expensive", sol: "Custom", stl: "Native manageData" },
              { feature: "B2B Scale", eth: "No", sol: "Maybe", stl: "Built for Institutional" },
            ].map((row, i) => (
              <div
                key={i}
                className="comparison-row grid grid-cols-4 text-sm border-b border-zinc-800/20 last:border-0 px-6 py-4 hover:bg-zinc-900/50 transition-colors"
              >
                <div className="text-zinc-400 font-medium">{row.feature}</div>
                <div className="text-center text-zinc-600">{row.eth}</div>
                <div className="text-center text-zinc-600">{row.sol}</div>
                <div className="text-center text-zinc-300 font-medium">{row.stl}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Separator className="max-w-5xl mx-auto bg-zinc-900" />

      {/* ═══════════════ PUBLIC AGENT REGISTRY ═══════════════ */}
      <section id="registry" className="section-registry relative z-10 max-w-5xl mx-auto px-6 py-32">
        <div className="text-center mb-16">
          <p className="text-xs text-zinc-600 tracking-[0.3em] uppercase mb-4">Public Infrastructure</p>
          <h2 className="text-3xl sm:text-4xl font-light text-zinc-200 tracking-tight">
            On-Chain Agent Registry
          </h2>
          <p className="text-zinc-500 text-base mt-4 max-w-2xl mx-auto">
            Ferrule&apos;s agents are public x402 services registered on a Soroban smart contract.
            Any developer in the Stellar ecosystem can discover and consume them.
          </p>
        </div>

        {/* Contract Badge */}
        <div className="flex justify-center mb-10">
          <a
            href="https://stellar.expert/explorer/testnet/contract/CBFO7Y74GBX5C5CVBVGXAX5LG4GSVK44OSKZNOZCMOTZXKA7WGROYLH2"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 px-5 py-3 rounded-full bg-zinc-900/80 border border-zinc-700/50 hover:border-zinc-500/60 transition-all group"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-zinc-400 font-mono group-hover:text-zinc-200 transition-colors">
              CBFO7Y74GBX5...WGROYLH2
            </span>
            <Badge variant="outline" className="border-emerald-900/50 text-emerald-400/80 text-[9px] ml-1">
              LIVE ON TESTNET
            </Badge>
          </a>
        </div>

        {/* Agent Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              name: "ferrule.search",
              protocol: "x402",
              price: "0.0001 USDC",
              desc: "Due diligence web search — SaaS, security, compliance",
              icon: "🔍",
              successRate: 94,
              totalMissions: 37,
            },
            {
              name: "ferrule.llm",
              protocol: "MPP",
              price: "0.00001 USDC",
              desc: "Token streamer — Architecture parsing & synthesis",
              icon: "🧠",
              successRate: 98,
              totalMissions: 41,
            },
            {
              name: "ferrule.risk",
              protocol: "x402",
              price: "0.005 USDC",
              desc: "Adversarial risk evaluator & agent coordinator",
              icon: "🛡️",
              successRate: 89,
              totalMissions: 29,
            },
          ].map((agent, i) => (
            <Card
              key={i}
              className="step-block bg-zinc-950/80 border-zinc-800/50 hover:border-zinc-600/60 transition-all group"
            >
              <CardHeader>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl">{agent.icon}</span>
                  <Badge
                    variant="outline"
                    className={`text-[9px] ${
                      agent.protocol === "x402"
                        ? "border-blue-900/50 text-blue-400/80"
                        : "border-purple-900/50 text-purple-400/80"
                    }`}
                  >
                    {agent.protocol}
                  </Badge>
                </div>
                <CardTitle className="text-sm font-mono text-zinc-300">{agent.name}</CardTitle>
                <CardDescription className="text-xs mt-1">{agent.desc}</CardDescription>
                
                {/* Reputation SLA */}
                <div className="mt-4 pt-3 border-t border-zinc-800/40">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-zinc-600">On-Chain SLA</span>
                    <span className={`text-xs font-mono font-medium ${
                      agent.successRate >= 95 ? "text-emerald-400" : 
                      agent.successRate >= 85 ? "text-amber-400" : "text-red-400"
                    }`}>
                      {agent.successRate}% success
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-2">
                    <div 
                      className={`h-full rounded-full transition-all duration-700 ${
                        agent.successRate >= 95 ? "bg-emerald-500/70" : 
                        agent.successRate >= 85 ? "bg-amber-500/70" : "bg-red-500/70"
                      }`}
                      style={{ width: `${agent.successRate}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-600">{agent.totalMissions} missions</span>
                    <span className="text-xs text-zinc-600">Price: <span className="text-zinc-400">{agent.price}</span></span>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Usage Example */}
        <Card className="mt-10 bg-zinc-950 border-zinc-800/60 overflow-hidden">
          <CardContent className="p-6">
            <p className="text-[10px] text-zinc-600 tracking-[0.2em] uppercase mb-4">Any developer can use it</p>
            <pre className="text-xs text-zinc-400 font-mono leading-relaxed overflow-x-auto">
{`# Discover agents
curl https://your-ferrule-instance/api/registry

# Use search agent (responds to HTTP 402 challenge)
curl https://your-ferrule-instance/api/search?q=datadog+SOC2
# → HTTP 402 → pay 0.0001 USDC → receive results`}
            </pre>
          </CardContent>
        </Card>
      </section>

      <Separator className="max-w-5xl mx-auto bg-zinc-900" />

      {/* ═══════════════ FAQ ═══════════════ */}
      <section id="faq" className="section-faq relative z-10 max-w-3xl mx-auto px-6 py-32">
        <div className="text-center mb-16">
          <p className="text-xs text-zinc-600 tracking-[0.3em] uppercase mb-4">Technical FAQ</p>
          <h2 className="text-3xl sm:text-4xl font-light text-zinc-200 tracking-tight">
            Under the hood
          </h2>
        </div>

        <Accordion type="single" collapsible className="space-y-3">
          <AccordionItem value="mpp" className="border border-zinc-800/60 rounded-lg bg-zinc-950 px-6">
            <AccordionTrigger className="text-sm text-zinc-300 hover:text-white hover:no-underline">
              What is an MPP Session Channel?
            </AccordionTrigger>
            <AccordionContent className="text-sm text-zinc-500 leading-relaxed">
              A one-way payment channel built on Soroban smart contracts. The payer deposits 
              USDC upfront, then signs off-chain ed25519 commitments for incremental amounts. 
              Only the final commitment is submitted on-chain, settling thousands of 
              micropayments in a single transaction.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="x402" className="border border-zinc-800/60 rounded-lg bg-zinc-950 px-6">
            <AccordionTrigger className="text-sm text-zinc-300 hover:text-white hover:no-underline">
              How does x402 integrate?
            </AccordionTrigger>
            <AccordionContent className="text-sm text-zinc-500 leading-relaxed">
              x402 is used for discrete pay-per-request calls — specifically for our Search 
              sub-agent that queries external APIs. Each search call carries a verifiable 
              USDC payment on Stellar testnet, returning results only upon confirmed settlement.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="trust" className="border border-zinc-800/60 rounded-lg bg-zinc-950 px-6">
            <AccordionTrigger className="text-sm text-zinc-300 hover:text-white hover:no-underline">
              What prevents the agent from overcharging?
            </AccordionTrigger>
            <AccordionContent className="text-sm text-zinc-500 leading-relaxed">
              Trust is enforced cryptographically through AP2 Risk Mandates. Before a mission, 
              the user deploys a strict budget ceiling and domain whitelist to a Soroban mandate contract. 
              The orchestrator enforces this on-chain state in real-time, instantly blocking any x402 micropayment 
              that exceeds the budget or attempts to retrieve data from unapproved intelligence sources.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="verify" className="border border-zinc-800/60 rounded-lg bg-zinc-950 px-6">
            <AccordionTrigger className="text-sm text-zinc-300 hover:text-white hover:no-underline">
              Can I verify the transactions?
            </AccordionTrigger>
            <AccordionContent className="text-sm text-zinc-500 leading-relaxed">
              Every channel open and close produces a real Soroban transaction hash viewable 
              on <a href="https://stellar.expert" target="_blank" rel="noopener noreferrer" className="text-zinc-300 underline underline-offset-2 hover:text-white">stellar.expert</a>. 
              The console displays all transaction IDs with direct links to the Stellar testnet explorer.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      {/* ═══════════════ FINAL CTA ═══════════════ */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 pt-8 pb-32 text-center">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-zinc-800/10 blur-[80px]" />
        
        <div className="flex justify-center mb-10 relative">
          <FerruleLogo className="w-24 h-24 sm:w-32 sm:h-32 opacity-90 drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]" />
        </div>

        <h2 className="text-3xl sm:text-4xl font-light text-zinc-200 tracking-tight mb-4 relative">
          Ready to see it live?
        </h2>
        <p className="text-zinc-500 text-base mb-10 relative">
          Connect your Stellar wallet, set a USDC budget, and watch the agents work.
        </p>
        <Link href="/console" className="relative">
          <Button className="h-12 px-8 bg-white text-black hover:bg-zinc-200 text-sm font-medium tracking-wide shadow-[0_0_80px_-20px_rgba(255,255,255,0.12)]">
            Open Research Console
          </Button>
        </Link>
      </section>

      {/* ═══════════════ FOOTER ═══════════════ */}
      <footer className="relative z-10 border-t border-zinc-900 py-8 text-center flex flex-col items-center">
        <div className="flex items-center justify-center gap-6 text-xs text-zinc-600 mb-6">
          <span>Built on <a href="https://stellar.org" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-white transition-colors">Stellar</a></span>
          <Separator orientation="vertical" className="h-3 bg-zinc-800" />
          <span>Powered by <a href="https://mpp.dev" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-white transition-colors">MPP</a></span>
          <Separator orientation="vertical" className="h-3 bg-zinc-800" />
          <span><a href="https://www.x402.org" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-white transition-colors">x402</a></span>
        </div>
        
        <div className="flex items-center justify-center gap-5">
          <button onClick={() => setRedirectUrl("https://github.com/Handilusa/Ferrule")} className="text-zinc-500 hover:text-white transition-colors" title="GitHub Repository">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
          </button>
          <button onClick={() => setRedirectUrl("https://t.me/Furrule_monitor_bot")} className="text-zinc-500 hover:text-white transition-colors" title="Ferrule Monitor Telegram Bot">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.223-.548.223l.188-2.623 4.823-4.35c.212-.188-.045-.292-.325-.105l-5.96 3.75-2.525-.791c-.553-.173-.564-.553.115-.819l9.855-3.797c.465-.172.88.113.633.916z"/></svg>
          </button>
          <button onClick={() => setRedirectUrl("https://x.com/Cebohia18")} className="text-zinc-500 hover:text-white transition-colors" title="Developer X / Twitter">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1227" fill="currentColor" className="w-4 h-4"><path d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.854V687.828Z"/></svg>
          </button>
        </div>
      </footer>

      {/* Redirect Pop-up Modal */}
      {redirectUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 max-w-sm w-full shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <h3 className="text-lg font-medium text-white mb-2">Leaving Ferrule</h3>
            <p className="text-sm text-zinc-400 mb-6 font-light">
              You are about to securely leave this page and navigate to an external site. Do you want to continue?
            </p>
            <div className="flex gap-3 justify-end">
              <Button 
                variant="outline" 
                size="sm"
                className="border-zinc-800 bg-transparent text-zinc-300 hover:bg-zinc-900 hover:text-white"
                onClick={() => setRedirectUrl(null)}
              >
                Cancel
              </Button>
              <Button 
                size="sm"
                className="bg-white text-black hover:bg-zinc-200 shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                onClick={() => {
                  window.open(redirectUrl, "_blank");
                  setRedirectUrl(null);
                }}
              >
                Continue <span className="font-mono text-zinc-500 ml-2 border-l border-zinc-300 pl-2">↗</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
