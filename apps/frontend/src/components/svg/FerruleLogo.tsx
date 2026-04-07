"use client";

import { useRef, useId } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

export function FerruleLogo({ 
  className = "", 
  animated = true,
  theme = "silver"
}: { 
  className?: string; 
  animated?: boolean;
  theme?: "silver" | "emerald";
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const reactId = useId();
  const gradientId = theme === "emerald" ? `emerald-fade${reactId}` : `unified-fade${reactId}`;

  useGSAP(() => {
    if (!animated) return;

    // Flowing data packets in the braids
    gsap.to(".ferrule-data-stream", {
      strokeDashoffset: -20,
      duration: 1.5,
      repeat: -1,
      ease: "none"
    });

    // Slow floating breathing effect for the crystal prism
    gsap.to(".ferrule-crystal", {
      y: -1.5,
      duration: 2,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut"
    });
    
    // Output energy blast heartbeat
    gsap.to(".ferrule-output", {
      opacity: 0.5,
      duration: 0.8,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut"
    });

  }, { scope: svgRef, dependencies: [animated] });

  return (
    <svg
      ref={svgRef}
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* A single diagonal gradient spanning the entire 64x64 coordinate space */}
        <linearGradient
          id={gradientId}
          x1="0"
          y1="64"
          x2="64"
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          {theme === "emerald" ? (
            <>
              <stop offset="0%" stopColor="#047857" />
              <stop offset="50%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#a7f3d0" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#4b5563" />
              <stop offset="50%" stopColor="#d1d5db" />
              <stop offset="100%" stopColor="#ffffff" />
            </>
          )}
        </linearGradient>
      </defs>

      {/* Input stream 1 (Agent AI) - Perfectly symmetrical braid */}
      <path
        className="ferrule-data-stream"
        d="M 12 60 C 24 56, 16 40, 32 32"
        stroke={`url(#${gradientId})`}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="4 6"
      />
      {/* Input stream 2 (Stellar Payment) */}
      <path
        className="ferrule-data-stream"
        d="M 4 52 C 8 40, 24 48, 32 32"
        stroke={`url(#${gradientId})`}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="4 6"
      />

      {/* Unified Output Line (Emerges from the exact center) */}
      <path
        className="ferrule-output"
        d="M 32 32 L 52 12"
        stroke={`url(#${gradientId})`}
        strokeWidth="6"
        strokeLinecap="round"
      />

      {/* The Ferrule: 3D Faceted Crystal Prism */}
      <g className="ferrule-crystal drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
        {/* Top/Left Facet */}
        <polygon 
          points="26,26 40,24 32,32" 
          fill={`url(#${gradientId})`} 
          opacity="1" 
        />
        {/* Left/Bottom Facet */}
        <polygon 
          points="24,40 26,26 32,32" 
          fill={`url(#${gradientId})`} 
          opacity="0.85" 
        />
        {/* Bottom/Right Facet */}
        <polygon 
          points="38,38 24,40 32,32" 
          fill={`url(#${gradientId})`} 
          opacity="0.6" 
        />
        {/* Right/Top Facet */}
        <polygon 
          points="40,24 38,38 32,32" 
          fill={`url(#${gradientId})`} 
          opacity="0.4" 
        />
        {/* Crisp edge highlights to emphasize the prism shape */}
        <line x1="24" y1="40" x2="40" y2="24" stroke="#ffffff" strokeWidth="0.5" opacity="0.5" />
        <line x1="26" y1="26" x2="38" y2="38" stroke="#ffffff" strokeWidth="0.5" opacity="0.3" />
      </g>

    </svg>
  );
}
