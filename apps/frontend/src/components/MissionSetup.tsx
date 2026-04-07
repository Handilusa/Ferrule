"use client";

import { useState } from "react";

export function MissionSetup({
  onSubmit,
  isRunning,
  connected,
  walletAddress,
}: {
  onSubmit: (query: string, budget: number, mode: "mission" | "assist") => void;
  isRunning: boolean;
  connected: boolean;
  walletAddress?: string | null;
}) {
  const [goal, setGoal] = useState("");
  const [budget, setBudget] = useState(0.25);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim() || isRunning) return;
    
    // If wallet is connected, always run as mission. Otherwise, use assist mode.
    const mode = walletAddress ? "mission" : "assist";
    
    onSubmit(goal.trim(), budget, mode);
  };

  return (
    <div className="mission-setup-card">
      <div className="mission-header">
        <h2>Target Mission Parameters</h2>
        <span className={`status-badge ${connected ? "connected" : "disconnected"}`}>
          {connected ? "● Agent Network Active" : "○ Reconnecting..."}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="mission-form">
        <div className="form-group">
          <label htmlFor="mission-goal">Objective / Goal</label>
          <textarea
            id="mission-goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            disabled={isRunning || !walletAddress}
            placeholder="e.g. Conduct a comprehensive analysis of the AI agent payments market, focusing on API aggregators and state channel architectures."
            rows={4}
            className="mission-textarea"
          />
        </div>

        <div className="form-group budget-group">
          <label htmlFor="mission-budget">
            Max Mission Budget (USDC)
            <span className="budget-value">${budget.toFixed(2)}</span>
          </label>
          <input
            id="mission-budget"
            type="range"
            min="0.05"
            max="1.00"
            step="0.05"
            value={budget}
            onChange={(e) => setBudget(parseFloat(e.target.value))}
            disabled={isRunning || !walletAddress}
            className="budget-slider"
          />
          <div className="budget-scale">
            <span>$0.05</span>
            <span>$0.50</span>
            <span>$1.00</span>
          </div>
        </div>

        <button
          type="submit"
          className="deploy-button"
          disabled={isRunning || (walletAddress ? !goal.trim() : false)}
        >
          {isRunning ? (
            <span className="pulsing">Agents Executing Mission...</span>
          ) : walletAddress ? (
            "Deploy Agents & Approve Budget"
          ) : (
            "Connect Wallet to Deploy"
          )}
        </button>
      </form>
    </div>
  );
}
