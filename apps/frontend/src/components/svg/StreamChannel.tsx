"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export function StreamChannel({ className = "" }: { className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useGSAP(() => {
    // Animate streaming particles horizontally through the channel
    gsap.to(".stream-dot", {
      x: 300,
      duration: 3,
      repeat: -1,
      stagger: 0.5,
      ease: "none",
    });
    // Draw channel outline
    gsap.fromTo(".channel-stroke",
      { strokeDashoffset: 600 },
      { strokeDashoffset: 0, duration: 2.5, ease: "power2.out" }
    );
    // Pulse the payment ticks
    gsap.fromTo(".pay-tick",
      { scaleY: 0 },
      { scaleY: 1, transformOrigin: "bottom", duration: 0.4, stagger: 0.08, ease: "back.out(3)", delay: 1.5 }
    );
  }, { scope: svgRef });

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 400 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="channel-grad" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#6b7280" stopOpacity="0.1" />
          <stop offset="30%" stopColor="#d1d5db" stopOpacity="0.5" />
          <stop offset="70%" stopColor="#d1d5db" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#6b7280" stopOpacity="0.1" />
        </linearGradient>
        <linearGradient id="tick-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f3f4f6" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#9ca3af" stopOpacity="0.2" />
        </linearGradient>
      </defs>

      {/* Channel outline — two parallel lines */}
      <path
        className="channel-stroke"
        d="M 40 80 L 360 80"
        stroke="url(#channel-grad)"
        strokeWidth="1"
        strokeDasharray="600"
      />
      <path
        className="channel-stroke"
        d="M 40 120 L 360 120"
        stroke="url(#channel-grad)"
        strokeWidth="1"
        strokeDasharray="600"
      />

      {/* Micropayment ticks — 847 commitments visualized as vertical marks */}
      {Array.from({ length: 24 }).map((_, i) => (
        <rect
          key={i}
          className="pay-tick"
          x={55 + i * 12.5}
          y={90}
          width="1"
          height={8 + Math.sin(i * 0.8) * 6}
          rx="0.5"
          fill="url(#tick-grad)"
        />
      ))}

      {/* Streaming particles */}
      <circle className="stream-dot" cx="40" cy="100" r="2" fill="#e5e7eb" opacity="0.8" />
      <circle className="stream-dot" cx="40" cy="100" r="1.5" fill="#f9fafb" opacity="0.6" />
      <circle className="stream-dot" cx="40" cy="100" r="1" fill="#d1d5db" opacity="0.7" />

      {/* Labels */}
      <text x="30" y="70" fill="#6b7280" fontSize="8" fontFamily="var(--font-sans)">OPEN</text>
      <text x="340" y="70" fill="#6b7280" fontSize="8" fontFamily="var(--font-sans)">CLOSE</text>

      {/* Terminal nodes */}
      <circle cx="40" cy="100" r="4" fill="none" stroke="#9ca3af" strokeWidth="1" />
      <circle cx="40" cy="100" r="1.5" fill="#d1d5db" />
      <circle cx="360" cy="100" r="4" fill="none" stroke="#9ca3af" strokeWidth="1" />
      <circle cx="360" cy="100" r="1.5" fill="#d1d5db" />
    </svg>
  );
}
