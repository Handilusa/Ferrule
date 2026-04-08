// monitor-store.js
// In-memory store for active monitors (acceptable for hackathon demo)
import crypto from "crypto";

const monitors = new Map();

/**
 * Creates a new active monitor.
 */
export function createMonitor({ userId, pair, budgetUsdc, telegramChatId, intervalHours }) {
  const id = crypto.randomUUID();
  const monitor = {
    id,
    userId, // mapped to user's wallet address
    pair,
    budgetUsdc,
    spentUsdc: 0,
    telegramChatId,
    intervalHours,
    lastRun: null,
    active: true,
    history: [], // previous signals and timestamps
    signalsCount: 0
  };
  monitors.set(id, monitor);
  return id;
}

export function getMonitor(id) {
  return monitors.get(id);
}

export function getMonitorsByUser(userId) {
  const result = [];
  for (const m of monitors.values()) {
    if (m.userId === userId) {
      result.push(m);
    }
  }
  return result;
}

export function getAllActiveMonitors() {
  const result = [];
  for (const m of monitors.values()) {
    if (m.active) result.push(m);
  }
  return result;
}

export function getDueMonitors() {
  const now = Date.now();
  const result = [];
  for (const m of monitors.values()) {
    if (!m.active) continue;
    // Check if enough time has passed from lastRun
    // intervalHours * 3600000 = ms
    if (!m.lastRun || (now - m.lastRun >= m.intervalHours * 3600000)) {
      result.push(m);
    }
  }
  return result;
}

export function deactivateMonitor(id) {
  const m = monitors.get(id);
  if (m) {
    m.active = false;
    return true;
  }
  return false;
}
