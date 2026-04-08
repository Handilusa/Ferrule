// monitor-store.js
import crypto from "crypto";
import fs from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONITORS_FILE = path.resolve(__dirname, "../../monitors.json");

let initialMonitors = [];
try {
  if (fs.existsSync(MONITORS_FILE)) {
    initialMonitors = JSON.parse(fs.readFileSync(MONITORS_FILE, "utf-8"));
    console.log(`[Monitor Store] Loaded ${initialMonitors.length} monitors from disk.`);
  }
} catch(e) {
  console.warn("[Monitor Store] Could not load monitors.json:", e.message);
}

const monitors = new Map(initialMonitors);

export function saveMonitors() {
  try {
    fs.writeFileSync(MONITORS_FILE, JSON.stringify(Array.from(monitors.entries())));
  } catch(e) {
    console.error("[Monitor Store] Failed to save:", e.message);
  }
}

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
  saveMonitors();
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
    saveMonitors();
    return true;
  }
  return false;
}
