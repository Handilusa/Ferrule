"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

// Pre-computed particle positions
const PARTICLES = [
  { w: 3, h: 3, l: 5, t: 12 },
  { w: 4, h: 4, l: 15, t: 35 },
  { w: 2, h: 2, l: 25, t: 8 },
  { w: 5, h: 5, l: 38, t: 62 },
  { w: 3, h: 3, l: 48, t: 22 },
  { w: 4, h: 4, l: 58, t: 78 },
  { w: 3, h: 3, l: 68, t: 45 },
  { w: 5, h: 5, l: 78, t: 88 },
  { w: 2, h: 2, l: 88, t: 55 },
  { w: 4, h: 4, l: 95, t: 18 },
  { w: 3, h: 3, l: 10, t: 72 },
  { w: 4, h: 4, l: 32, t: 92 },
  { w: 2, h: 2, l: 52, t: 42 },
  { w: 5, h: 5, l: 72, t: 15 },
  { w: 3, h: 3, l: 42, t: 68 },
  { w: 4, h: 4, l: 62, t: 28 },
  { w: 2, h: 2, l: 82, t: 52 },
  { w: 5, h: 5, l: 22, t: 82 },
  { w: 3, h: 3, l: 92, t: 38 },
  { w: 4, h: 4, l: 3, t: 95 },
  // Extra particles
  { w: 2, h: 2, l: 8, t: 85 },
  { w: 5, h: 5, l: 18, t: 15 },
  { w: 3, h: 3, l: 28, t: 50 },
  { w: 4, h: 4, l: 45, t: 85 },
  { w: 2, h: 2, l: 55, t: 12 },
  { w: 5, h: 5, l: 65, t: 65 },
  { w: 3, h: 3, l: 75, t: 30 },
  { w: 4, h: 4, l: 85, t: 75 },
  { w: 2, h: 2, l: 98, t: 45 },
  { w: 4, h: 4, l: 35, t: 35 },
  { w: 3, h: 3, l: 12, t: 58 },
  { w: 5, h: 5, l: 88, t: 12 },
];

export function AmbientBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    // Use GSAP's robust recursive `onComplete` method to ensure true continuous, non-static drifting.
    const particles = gsap.utils.toArray<HTMLElement>(".ambient-particle");
    
    particles.forEach((el) => {
      // 1. Organic breathing glow
      gsap.to(el, {
        autoAlpha: gsap.utils.random(0.3, 0.9),
        duration: gsap.utils.random(2, 6),
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        delay: gsap.utils.random(0, 2),
      });

      // 2. Endless floating logic
      const float = () => {
        // Move between -150px and +150px from its CURRENT position for noticeable kinetic drift
        gsap.to(el, {
          x: `+=${gsap.utils.random(-150, 150)}`,
          y: `+=${gsap.utils.random(-150, 150)}`,
          duration: gsap.utils.random(5, 12),
          ease: "sine.inOut",
          onComplete: float // Recursively call itself to generate new target coordinates infinitely
        });
      };
      
      // Kick off the floating
      float();
    });


    // Orbs — slow breathing scale + drift
    gsap.utils.toArray<HTMLElement>(".ambient-orb").forEach((el, i) => {
      gsap.to(el, {
        scale: 1.2 + i * 0.1,
        duration: 8 + i * 2,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
      gsap.to(el, {
        x: -50 + i * 40,
        y: -40 + i * 30,
        duration: 12 + i * 3,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    });
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Large gradient orbs — clearly visible */}
      <div className="ambient-orb absolute w-[700px] h-[700px] rounded-full blur-[120px]"
           style={{ top: "-10%", left: "5%", background: "radial-gradient(circle, rgba(140,150,170,0.25) 0%, transparent 70%)" }} />
      <div className="ambient-orb absolute w-[500px] h-[500px] rounded-full blur-[100px]"
           style={{ top: "35%", right: "-5%", background: "radial-gradient(circle, rgba(160,170,195,0.22) 0%, transparent 70%)" }} />
      <div className="ambient-orb absolute w-[800px] h-[800px] rounded-full blur-[140px]"
           style={{ bottom: "-15%", left: "25%", background: "radial-gradient(circle, rgba(130,140,165,0.20) 0%, transparent 70%)" }} />
      <div className="ambient-orb absolute w-[600px] h-[600px] rounded-full blur-[120px]"
           style={{ top: "50%", right: "20%", background: "radial-gradient(circle, rgba(100,200,180,0.12) 0%, transparent 70%)" }} />

      {/* Floating particles — visible silver dots */}
      {PARTICLES.map((p, i) => (
        <div
          key={i}
          className="ambient-particle absolute rounded-full"
          style={{
            width: `${p.w}px`,
            height: `${p.h}px`,
            left: `${p.l}%`,
            top: `${p.t}%`,
            backgroundColor: "rgba(220, 230, 255, 0.8)",
            boxShadow: `0 0 ${p.w * 3}px 1px rgba(220, 230, 255, 0.4)`,
            opacity: 0.6,
          }}
        />
      ))}

    </div>
  );
}
