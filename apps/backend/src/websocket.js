import { WebSocketServer } from "ws";

/**
 * Sets up WebSocket server for real-time payment event streaming to the frontend.
 * Events:
 *  - commitment: off-chain MPP commitment signed
 *  - x402_payment: x402 search payment settled
 *  - onchain_tx: channel open/close on Stellar
 *  - agent_status: agent started/completed
 *  - result_chunk: streamed LLM text
 *  - session_complete: full research session done
 */
export function setupWebSocket(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws) => {
    console.log("[WS] Client connected");
    ws.send(JSON.stringify({ type: "connected", message: "Ferrule WebSocket active" }));

    ws.on("close", () => {
      console.log("[WS] Client disconnected");
    });
  });

  return wss;
}

/**
 * Broadcast an event to all connected WebSocket clients.
 */
export function broadcast(wss, event) {
  const data = JSON.stringify(event);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(data);
    }
  });
}
