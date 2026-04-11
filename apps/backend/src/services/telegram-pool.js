import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POOL_FILE = path.join(__dirname, "..", "..", "telegram-pool.json");

// Define basic pool store functions
function readPool() {
  if (!fs.existsSync(POOL_FILE)) {
    return {};
  }
  try {
    const data = fs.readFileSync(POOL_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    return {};
  }
}

function writePool(data) {
  fs.writeFileSync(POOL_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export function getPoolBalance(walletAddress) {
  if (!walletAddress) return 0;
  const pool = readPool();
  return pool[walletAddress] || 0;
}

export function addPoolBalance(walletAddress, amount) {
  if (!walletAddress) return;
  const pool = readPool();
  const current = pool[walletAddress] || 0;
  pool[walletAddress] = parseFloat((current + parseFloat(amount)).toFixed(4));
  writePool(pool);
  return pool[walletAddress];
}

export function deductPoolBalance(walletAddress, amount) {
  if (!walletAddress) return false;
  const pool = readPool();
  const current = pool[walletAddress] || 0;
  
  if (current < amount) {
    return false; // insufficient
  }
  
  pool[walletAddress] = parseFloat((current - parseFloat(amount)).toFixed(4));
  writePool(pool);
  return pool[walletAddress];
}
