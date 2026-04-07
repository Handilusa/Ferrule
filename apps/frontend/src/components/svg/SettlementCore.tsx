"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export function SettlementCore({ className = "" }: { className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useGSAP(() => {
    gsap.to(".outer-ring", {
      rotation: 360, transformOrigin: "center", duration: 20, repeat: -1, ease: "none",
    });
    gsap.to(".inner-core", {
      scale: 1.1, transformOrigin: "center", repeat: -1, yoyo: true, duration: 2, ease: "sine.inOut",
    });
    gsap.to(".hash-mark", {
      autoAlpha: 0.3, repeat: -1, yoyo: true, duration: 1.5, stagger: 0.2, ease: "sine.inOut",
    });
  }, { scope: svgRef });

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 300 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="core-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e5e7eb" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#6b7280" stopOpacity="0.3" />
        </linearGradient>
        <radialGradient id="core-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f3f4f6" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#4b5563" stopOpacity="0" />
        </radialGradient>
        <filter id="settlement-blur">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      {/* Background glow */}
      <circle cx="150" cy="150" r="80" fill="url(#core-glow)" filter="url(#settlement-blur)" opacity="0.5" />

      {/* Outer rotating ring — dashed */}
      <circle
        className="outer-ring"
        cx="150"
        cy="150"
        r="90"
        fill="none"
        stroke="#9ca3af"
        strokeWidth="0.5"
        strokeDasharray="8 12"
      />

      {/* Middle geometric ring */}
      <polygon
        points="150,70 220,110 220,190 150,230 80,190 80,110"
        fill="none"
        stroke="#d1d5db"
        strokeWidth="0.8"
        opacity="0.4"
      />

      {/* Inner core */}
      <circle className="inner-core" cx="150" cy="150" r="24" fill="none" stroke="url(#core-grad)" strokeWidth="1.5" />
      <circle className="inner-core" cx="150" cy="150" r="8" fill="#d1d5db" opacity="0.6" />
      <circle cx="150" cy="150" r="3" fill="#f9fafb" />

      {/* Hash/settlement marks radiating out */}
      {[0, 60, 120, 180, 240, 300].map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const x1 = 150 + Math.cos(rad) * 35;
        const y1 = 150 + Math.sin(rad) * 35;
        const x2 = 150 + Math.cos(rad) * 55;
        const y2 = 150 + Math.sin(rad) * 55;
        return (
          <line
            key={i}
            className="hash-mark"
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#d1d5db"
            strokeWidth="1"
            opacity="0.7"
          />
        );
      })}
    </svg>
  );
}
