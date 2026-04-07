"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export function NodeNetwork({ className = "" }: { className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useGSAP(() => {
      // Animate nodes pulsing
      gsap.to(".node-core", {
        scale: 1.15,
        transformOrigin: "center",
        repeat: -1,
        yoyo: true,
        duration: 2,
        ease: "sine.inOut",
        stagger: 0.3,
      });
      // Draw connection lines
      gsap.from(".net-line", {
        strokeDashoffset: 200,
        duration: 2,
        stagger: 0.15,
        ease: "power2.out",
      });
      // Pulse the center glow
      gsap.to(".center-glow", {
        opacity: 0.6,
        repeat: -1,
        yoyo: true,
        duration: 3,
        ease: "sine.inOut",
      });
    }, { scope: svgRef });

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 400 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="silver-line" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e5e7eb" stopOpacity="0.1" />
          <stop offset="50%" stopColor="#d1d5db" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#9ca3af" stopOpacity="0.1" />
        </linearGradient>
        <radialGradient id="node-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#e5e7eb" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#6b7280" stopOpacity="0" />
        </radialGradient>
        <filter id="blur-glow">
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>

      {/* Central glow */}
      <circle className="center-glow" cx="200" cy="150" r="60" fill="url(#node-glow)" opacity="0.3" filter="url(#blur-glow)" />

      {/* Connection lines */}
      <line className="net-line" x1="200" y1="150" x2="80" y2="60" stroke="url(#silver-line)" strokeWidth="1" strokeDasharray="200" />
      <line className="net-line" x1="200" y1="150" x2="320" y2="60" stroke="url(#silver-line)" strokeWidth="1" strokeDasharray="200" />
      <line className="net-line" x1="200" y1="150" x2="60" y2="220" stroke="url(#silver-line)" strokeWidth="1" strokeDasharray="200" />
      <line className="net-line" x1="200" y1="150" x2="340" y2="220" stroke="url(#silver-line)" strokeWidth="1" strokeDasharray="200" />
      <line className="net-line" x1="200" y1="150" x2="200" y2="40" stroke="url(#silver-line)" strokeWidth="1" strokeDasharray="200" />
      <line className="net-line" x1="80" y1="60" x2="60" y2="220" stroke="url(#silver-line)" strokeWidth="0.5" strokeDasharray="200" />
      <line className="net-line" x1="320" y1="60" x2="340" y2="220" stroke="url(#silver-line)" strokeWidth="0.5" strokeDasharray="200" />

      {/* Center node */}
      <circle className="node-core" cx="200" cy="150" r="6" fill="#d1d5db" />
      <circle cx="200" cy="150" r="3" fill="#f9fafb" />

      {/* Satellite nodes */}
      <circle className="node-core" cx="80" cy="60" r="4" fill="#9ca3af" />
      <circle cx="80" cy="60" r="2" fill="#d1d5db" />

      <circle className="node-core" cx="320" cy="60" r="4" fill="#9ca3af" />
      <circle cx="320" cy="60" r="2" fill="#d1d5db" />

      <circle className="node-core" cx="60" cy="220" r="4" fill="#9ca3af" />
      <circle cx="60" cy="220" r="2" fill="#d1d5db" />

      <circle className="node-core" cx="340" cy="220" r="4" fill="#9ca3af" />
      <circle cx="340" cy="220" r="2" fill="#d1d5db" />

      <circle className="node-core" cx="200" cy="40" r="4" fill="#9ca3af" />
      <circle cx="200" cy="40" r="2" fill="#d1d5db" />
    </svg>
  );
}
