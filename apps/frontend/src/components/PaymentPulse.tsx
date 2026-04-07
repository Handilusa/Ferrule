"use client";

import { useEffect, useRef } from "react";

interface PaymentPulseProps {
  label: string;
  value: number;
  sublabel: string;
  variant: "amber" | "emerald";
}

export function PaymentPulse({ label, value, sublabel, variant }: PaymentPulseProps) {
  const prevValue = useRef(value);
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (value !== prevValue.current && spanRef.current) {
      spanRef.current.classList.remove("tick");
      // Force reflow
      void spanRef.current.offsetWidth;
      spanRef.current.classList.add("tick");
      prevValue.current = value;
    }
  }, [value]);

  return (
    <div className={`glass-card pulse-card ${variant}`}>
      <div className="pulse-label">{label}</div>
      <span
        ref={spanRef}
        className={`pulse-value ${variant} mono`}
      >
        {value.toLocaleString()}
      </span>
      <div className="pulse-sub">{sublabel}</div>
    </div>
  );
}
