"use client";

import { useEffect, useId, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface AnimatedBeamProps {
  className?: string;
  path: string;
  duration?: number;
  delay?: number;
  color?: string;
  reverse?: boolean;
  viewBox?: string;
}

export function AnimatedBeam({
  className,
  path,
  duration = 2,
  delay = 0,
  color = "#2dd4bf",
  reverse = false,
  viewBox = "0 0 320 220",
}: AnimatedBeamProps) {
  const id = useId();

  return (
    <svg
      fill="none"
      viewBox={viewBox}
      className={cn("pointer-events-none absolute left-0 top-0 h-full w-full", className)}
      style={{ overflow: "visible" }}
    >
      <path
        d={path}
        stroke="url(#gradient)"
        strokeLinecap="round"
        strokeWidth="2.5"
        strokeDasharray="4 4"
        className="opacity-30"
      />
      
      <motion.path
        d={path}
        stroke={`url(#gradient-${id})`}
        strokeLinecap="round"
        strokeWidth="3.5"
        initial={{
          strokeDashoffset: reverse ? -100 : 100,
          strokeDasharray: "10 100",
        }}
        animate={{
          strokeDashoffset: reverse ? 100 : -100,
          strokeDasharray: "20 100",
        }}
        transition={{
          duration,
          delay,
          repeat: Infinity,
          ease: "linear",
        }}
      />
      <defs>
        <linearGradient id={`gradient-${id}`} gradientUnits="userSpaceOnUse">
          <stop stopColor={color} stopOpacity="0" />
          <stop stopColor={color} />
          <stop stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}
