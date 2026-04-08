import cron from "node-cron";
import { getDueMonitors } from "./monitor-store.js";
import { runMonitorCycle } from "./monitor-engine.js";

// Run the tick every minute 
const CRON_EXPRESSION = "* * * * *";

let cronTask = null;

export function startMonitorCron() {
  if (cronTask) {
    console.log("Monitor cron is already running.");
    return;
  }

  console.log(`⏱️ Starting monitor cron job with expression: "${CRON_EXPRESSION}"`);
  cronTask = cron.schedule(CRON_EXPRESSION, async () => {
    try {
      const dueMonitors = getDueMonitors();
      if (dueMonitors.length > 0) {
        console.log(`[Cron] Running cycle for ${dueMonitors.length} due monitors...`);
      }
      
      // Run sequentially to avoid rate limiting
      for (const monitor of dueMonitors) {
        await runMonitorCycle(monitor);
      }
    } catch (err) {
      console.error("[Cron] Error executing cycle:", err);
    }
  });
}

export function stopMonitorCron() {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
    console.log("⏱️ Stopped monitor cron.");
  }
}
