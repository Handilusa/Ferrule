/**
 * Explorer Stats Aggregator
 * 
 * Computes in-memory stats, updated from Horizon streams.
 * Broadcasts snapshot every 10 seconds via WebSocket.
 * 
 * Stats:
 *  - total_ops          ← cumulative from streamed operations
 *  - ops_per_second     ← moving average from 1s buckets
 *  - avg_ledger_time    ← mean close_time delta of last 20 ledgers
 *  - total_usdc_x402    ← sum of x402 USDC payments
 *  - reports_anchored   ← count of manageData ops with FRL_ prefix
 *  - active_monitors    ← from monitor-store activeJobs
 *  - success_rate       ← from in-memory mission tracking
 *  - total_missions     ← cumulative mission count
 */

import { broadcast } from "../websocket.js";

// --- In-Memory State ---
const stats = {
  total_ops: 0,
  ops_per_second: 0,
  avg_ledger_time: 5.0,      // Default for Testnet
  total_usdc_x402: 0,
  reports_anchored: 0,
  active_monitors: 0,
  success_rate: 100,
  total_missions: 0,
};

// OPS/s tracking: ring buffer of 1-second buckets
const OPS_BUCKETS = 10;
const opsBuckets = new Array(OPS_BUCKETS).fill(0);
let currentBucketIdx = 0;
let lastBucketFlip = Date.now();

// Ledger timing: store timestamps for delta calculation
const ledgerTimestamps = [];
const MAX_LEDGER_TIMESTAMPS = 20;

// Mission tracking
let totalMissionsSuccess = 0;
let totalMissionsFail = 0;

// Broadcast interval handle
let broadcastInterval = null;

/**
 * Called by horizon-stream.js on each new ledger.
 */
export function updateStatsFromLedger(ledgerData) {
  // Parse close timestamp
  const closeTime = new Date(ledgerData.closed_at).getTime();
  ledgerTimestamps.push(closeTime);
  if (ledgerTimestamps.length > MAX_LEDGER_TIMESTAMPS) ledgerTimestamps.shift();

  // Calculate average ledger time from deltas
  if (ledgerTimestamps.length >= 2) {
    let totalDelta = 0;
    for (let i = 1; i < ledgerTimestamps.length; i++) {
      totalDelta += (ledgerTimestamps[i] - ledgerTimestamps[i - 1]);
    }
    stats.avg_ledger_time = parseFloat(
      (totalDelta / (ledgerTimestamps.length - 1) / 1000).toFixed(1)
    );
  }

  // NOTE: Do NOT count ledger operation_count here — that includes ALL testnet ops.
  // total_ops is only incremented from Ferrule-tagged operations in updateStatsFromOperation().
}

/**
 * Called by horizon-stream.js on each classified operation.
 */
export function updateStatsFromOperation(opData) {
  // Count only Ferrule-tagged operations
  stats.total_ops++;

  // Flip bucket if ≥1s has passed
  const now = Date.now();
  if (now - lastBucketFlip >= 1000) {
    currentBucketIdx = (currentBucketIdx + 1) % OPS_BUCKETS;
    opsBuckets[currentBucketIdx] = 0;
    lastBucketFlip = now;
  }
  opsBuckets[currentBucketIdx]++;

  // Recalculate ops/s as moving average
  const sum = opsBuckets.reduce((a, b) => a + b, 0);
  stats.ops_per_second = parseFloat((sum / OPS_BUCKETS).toFixed(1));

  // Track x402 USDC
  if (opData.ferruleType === "x402") {
    const match = opData.ferruleDetail?.match(/([\d.]+)\s*USDC/);
    if (match) {
      stats.total_usdc_x402 += parseFloat(match[1]);
    }
  }

  // Track MPP USDC (larger budget payments)
  if (opData.ferruleType === "MPP") {
    // Not counted in x402 total
  }

  // Track anchored reports
  if (opData.ferruleType === "ANC") {
    stats.reports_anchored++;
  }

  // Track SLA missions
  if (opData.ferruleType === "SLA" && opData.ferruleDetail === "record_mission") {
    stats.total_missions++;
    totalMissionsSuccess++;
    recalcSuccessRate();
  }
}

/**
 * Track a mission result (called from orchestrator flow too).
 */
export function recordMissionStat(success) {
  stats.total_missions++;
  if (success) {
    totalMissionsSuccess++;
  } else {
    totalMissionsFail++;
  }
  recalcSuccessRate();
}

function recalcSuccessRate() {
  const total = totalMissionsSuccess + totalMissionsFail;
  if (total === 0) {
    stats.success_rate = 100;
  } else {
    stats.success_rate = parseFloat(((totalMissionsSuccess / total) * 100).toFixed(1));
  }
}

/**
 * Update active_monitors count from monitor store.
 */
function refreshMonitorCount() {
  try {
    // Dynamic import to avoid circular deps
    import("./monitor-store.js").then((mod) => {
      if (mod.activeJobs) {
        stats.active_monitors = mod.activeJobs.size || 0;
      }
    }).catch(() => {
      // monitor-store may not export activeJobs directly
      stats.active_monitors = 0;
    });
  } catch (_) {
    stats.active_monitors = 0;
  }
}

/**
 * Get current stats snapshot (used by REST endpoint).
 */
export function getExplorerStats() {
  refreshMonitorCount();
  return { ...stats };
}

/**
 * Start broadcasting stats every 10 seconds via WebSocket.
 */
export function startStatsBroadcast(wss) {
  if (broadcastInterval) clearInterval(broadcastInterval);

  broadcastInterval = setInterval(() => {
    refreshMonitorCount();
    if (wss) {
      broadcast(wss, {
        type: "explorer:stats",
        ...stats,
        timestamp: Date.now(),
      });
    }
  }, 10_000);

  console.log("[Explorer] Stats broadcast started (every 10s)");
}

/**
 * Stop broadcasting.
 */
export function stopStatsBroadcast() {
  if (broadcastInterval) clearInterval(broadcastInterval);
}
