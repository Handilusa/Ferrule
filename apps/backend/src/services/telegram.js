import { Bot, session, InlineKeyboard, webhookCallback } from "grammy";
import { conversations, createConversation } from "@grammyjs/conversations";
import crypto from "crypto";
import { getMonitorsByUser, getMonitor, deactivateMonitor } from "./monitor-store.js";
import { getPriceData } from "./price-feed.js";
import { computeIndicators, buildMarketPrompt, detectSignal, rsiSignal } from "./technical-analysis.js";
import { streamRiskAnalysis } from "./gemini.js";
import fs from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USERS_FILE = path.resolve(__dirname, "../../telegram-users.json");

// Load users from file to persist across server restarts
let userMapInitial = [];
try {
  if (fs.existsSync(USERS_FILE)) {
    userMapInitial = JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
    console.log(`[Telegram] Loaded ${userMapInitial.length} linked users from disk.`);
  }
} catch(e) {
  console.warn("[Telegram] Could not load telegram-users.json:", e.message);
}
export const users = new Map(userMapInitial);

function saveUsers() {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(Array.from(users.entries())));
  } catch(e) {
    console.error("[Telegram] Failed to save users:", e.message);
  }
}

// Helper to determine base URL
const backendUrl = () => {
    const isRender = process.env.RENDER === "true" || process.env.NODE_ENV === "production" || process.env.RENDER_EXTERNAL_URL !== undefined;
    return process.env.RENDER_EXTERNAL_URL || process.env.BACKEND_URL || (isRender ? "https://ferrule-backend.onrender.com" : `http://localhost:${process.env.PORT || 3000}`);
};

let bot = null;

export async function initBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("⚠️ TELEGRAM_BOT_TOKEN missing in environment. Telegram bot will not be started.");
    return false;
  }

  try {
    bot = new Bot(token);

    // Provide default session structure
    bot.use(session({
      initial: () => ({ monitors: [], history: [] }),
      getSessionKey: (ctx) => ctx.from?.id.toString()
    }));
    
    // GLOBAL ERROR HANDLER
    bot.catch((err) => {
      const ctx = err.ctx;
      console.error(`[Telegram Error] error while handling update ${ctx.update.update_id}:`);
      console.error(err.error);
    });

    // Logging middleware
    bot.use(async (ctx, next) => {
      if (ctx.message) {
        console.log(`[Telegram Input] from ${ctx.from?.id}: "${ctx.message.text}"`);
      }
      await next();
    });
    
    bot.use(conversations());
    bot.use(createConversation(marketReportConversation));

    // START COMMAND & DEEP LINKING (Stateless HMAC verification)
    bot.command("start", async (ctx) => {
      const rawParam = ctx.match || "";
      const param = rawParam.trim();
      console.log(`[Telegram] /start command received. Param: "${param}" (len: ${param.length})`);
      
      if (param && param.length >= 62) {
        // Deterministic Stateless Verification
        // format: [WALLET(56 chars)][SIG(6+ chars)]
        const walletAddress = param.slice(0, 56).toUpperCase();
        const signature = param.slice(56);
        
        const salt = process.env.TELEGRAM_BOT_TOKEN || "FERRULE_INTERNAL_SALT";
        const expectedSig = crypto.createHmac("sha256", salt)
          .update(walletAddress)
          .digest("hex")
          .slice(0, 6);

        if (signature === expectedSig) {
          console.log(`[Telegram] ✅ Signature verified for ${walletAddress}. Linking...`);
          
          users.set(ctx.from.id, walletAddress);
          saveUsers();

          await ctx.reply(`✅ *Account linked with Ferrule*\n\nWallet: \`${walletAddress.slice(0,6)}...${walletAddress.slice(-4)}\`\n\nYou will now receive market alerts here.`, { parse_mode: "Markdown" });
          return showMainMenu(ctx);
        } else {
          console.warn(`[Telegram] ❌ Signature mismatch. Expected ${expectedSig}, got ${signature}`);
          await ctx.reply("❌ The linking code is invalid or has expired. Please refresh the Ferrule Dashboard and try again.");
          return;
        }
      } else if (param) {
          console.warn(`[Telegram] ❌ Invalid param length: ${param.length}`);
          await ctx.reply("❌ Invalid link format. Please generate a new one from the Ferrule Dashboard.");
          return;
      }

      // See if user is already linked
      const walletAddress = users.get(ctx.from.id);
      if (!walletAddress) {
        await ctx.reply(`👋 Welcome to Ferrule.\n\nTo link this Telegram account, go to the Ferrule Dashboard in the web app, open the Monitor tab, and generate a new deep link.`);
        return;
      }

      return showMainMenu(ctx);
    });

    bot.callbackQuery("monitors_list", async (ctx) => {
      const walletAddress = users.get(ctx.from.id);
      if (!walletAddress) return ctx.reply("You are not linked to any account.");
      
      const userMonitors = await getMonitorsByUser(walletAddress);

      if (!userMonitors.length) {
        return ctx.reply("📡 You have no active monitors. Create one from the web app.");
      }

      for (const m of userMonitors) {
        // Build simple progress bar
        const perc = Math.min(100, Math.floor((m.spentUsdc / m.budgetUsdc) * 100));
        const filled = Math.floor(perc / 10);
        const bar = "█".repeat(filled) + "░".repeat(10 - filled);

        const keyboard = new InlineKeyboard();
        if (m.active) {
            keyboard.text("⏸ Pause / Cancel", `cancel_${m.id}`);
        }

        const timeString = m.lastRun ? new Date(m.lastRun).toLocaleString() : "Pending";
        
        await ctx.reply(
          `📡 *${m.pair} Monitor*\n` +
          `Status: ${m.active ? "🟢 Active" : "🔴 Expired/Paused"}\n` +
          `Budget: ${bar} \`${m.spentUsdc.toFixed(4)}/${m.budgetUsdc} USDC\`\n` +
          `Last check: ${timeString}\n` +
          `Signals sent: ${m.signalsCount}\n` +
          `Interval: every ${m.intervalHours} hours\n`,
          { parse_mode: "Markdown", reply_markup: m.active ? keyboard : undefined }
        );
      }
      
      // Acknowledge the callback query to remove loading state
      await ctx.answerCallbackQuery();
    });


    bot.callbackQuery("history_list", async (ctx) => {
      await ctx.answerCallbackQuery();
      const walletAddress = users.get(ctx.from.id);
      if (!walletAddress) return ctx.reply("You are not linked to any account.");
      
      try {
        const res = await fetch(`${backendUrl()}/api/orchestrate/history?wallet=${walletAddress}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        
        const reports = data.history || [];
        
        if (reports.length === 0) {
            return ctx.reply("You have no previous reports or alerts.");
        }

        const keyboard = new InlineKeyboard();
        for (const r of reports.slice(0, 5)) {
          const status = r.anchorHash ? "✅" : "⚠️";
          const queryShort = r.query ? r.query.slice(0, 20) + "..." : "Monitor Analysis";
          const d = new Date(r.timestamp).toLocaleDateString();
          
          keyboard.text(
            `${status} ${queryShort} — ${d}`,
            `report_${r.reportHash.slice(0, 40)}`
          ).row();
        }

        await ctx.reply("*Past Conversations*\nSelect a report:", {
          parse_mode: "Markdown",
          reply_markup: keyboard
        });
      } catch (err) {
        console.error("Telegram fetch history error:", err);
        await ctx.reply("❌ There was an error retrieving the history.");
      }
    });

    bot.callbackQuery(/^report_(.+)$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const txHash = ctx.match[1];
      
      try {
        const res = await fetch(`${backendUrl()}/api/orchestrate/verify/${txHash}`);
        if (!res.ok) throw new Error("Report not found");
        const reportRaw = await res.json();
        
        const report = reportRaw.report || "";
        const riskMatch = report.match(/([0-9]{1,3}\/100)/);
        const riskScoreStr = riskMatch ? riskMatch[1] : "N/A";
        
        const cleanSummary = report.slice(0, 300).replace(/#/g, "").trim();

        await ctx.reply(
          `📋 *Recovered Report*\n` +
          `🗓 ${new Date(reportRaw.timestamp).toLocaleString()}\n` +
          `🔐 Saved HASH: \`${txHash.slice(0, 24)}...\`\n` +
          `✅ Verified on-chain: ${reportRaw.anchorHash ? "Yes" : "No"}\n\n` +
          `*Summary:* ${cleanSummary}...\n\n` +
          `🔗 [Verify on-chain](https://stellar.expert/explorer/testnet/tx/${reportRaw.anchorHash})`,
          { parse_mode: "Markdown" }
        );
      } catch (err) {
         await ctx.reply("❌ Could not locate that report in current memory.");
      }
    });

    bot.callbackQuery("new_monitor", async (ctx) => {
        await ctx.answerCallbackQuery();
        await ctx.reply("To start a recurring monitoring mission, open the Ferrule Dashboard (web interface) and configure your interval and budget preferences in the 'Monitor' tab.");
    });

    bot.callbackQuery("market_report_flow", async (ctx) => {
        await ctx.answerCallbackQuery();
        await ctx.conversation.enter("marketReportConversation");
    });

    bot.callbackQuery("monitors_list", async (ctx) => {
      await ctx.answerCallbackQuery();
      const walletAddress = users.get(ctx.from.id);
      if (!walletAddress) {
        return ctx.reply("You need to link your wallet first. Use the Ferrule Dashboard to generate a deep link.");
      }

      const monitors = getMonitorsByUser(walletAddress);
      const active = monitors.filter(m => m.active);

      if (active.length === 0) {
        return ctx.reply("No active monitors found.\n\nCreate one from the Ferrule Dashboard → Monitor tab.");
      }

      const keyboard = new InlineKeyboard();
      for (const m of active) {
        const spent = m.spentUsdc.toFixed(4);
        const budget = m.budgetUsdc.toFixed(4);
        const signals = m.signalsCount || 0;
        keyboard.text(
          `${m.pair} | ${spent}/${budget} USDC | ${signals} signals`,
          `cancel_${m.id}`
        ).row();
      }

      await ctx.reply(
        `*Active Monitors (${active.length})*\nTap a monitor to pause it:`,
        { parse_mode: "Markdown", reply_markup: keyboard }
      );
    });

    bot.callbackQuery(/^cancel_(.+)$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const monitorId = ctx.match[1];
      const success = await deactivateMonitor(monitorId);
      if (success) {
        await ctx.reply(`Monitor \`${monitorId.slice(0, 8)}...\` has been paused.`, { parse_mode: "Markdown" });
      } else {
        await ctx.reply("Could not find that monitor. It may have already been deactivated.");
      }
    });

    bot.callbackQuery("help", async (ctx) => {
        await ctx.answerCallbackQuery();
        await ctx.reply("*Ferrule Monitor*\nThis identity serves to autonomously notify you if Ferrule detects risks or market movements based on its assigned x402 budget on Soroban.\n\nType /start to view the main menu.", { parse_mode: "Markdown" });
    });

    // Persistent Commands Menu for Telegram UI
    bot.api.setMyCommands([
      { command: "start", description: "Open Ferrule Console" },
      { command: "menu", description: "Show Action Menu" },
    ]).catch(err => console.error("Could not set bot commands:", err));

    // Allow /menu to also trigger the UI
    bot.command("menu", async (ctx) => {
      const walletAddress = users.get(ctx.from.id);
      if (!walletAddress) {
        return ctx.reply("👋 Welcome to Ferrule.\n\nTo link this Telegram account, go to the Ferrule Dashboard in the web app, open the Monitor tab, and generate a deep link.");
      }
      return showMainMenu(ctx);
    });

    // Use webhook mode for production (Render), polling for local dev
    const isRender = process.env.RENDER === "true" || process.env.NODE_ENV === "production" || process.env.RENDER_EXTERNAL_URL !== undefined;
    const webhookBase = process.env.RENDER_EXTERNAL_URL || process.env.BACKEND_URL || (isRender ? "https://ferrule-backend.onrender.com" : null);
    
    if (webhookBase) {
      // Production: Webhook mode
      const webhookUrl = `${webhookBase}/api/telegram/webhook`;
      
      // First delete any existing webhook, then set the new one
      await bot.api.deleteWebhook({ drop_pending_updates: false });
      await bot.api.setWebhook(webhookUrl, {
        allowed_updates: ["message", "callback_query"],
      });
      
      const botInfo = await bot.api.getMe();
      console.log(`🤖 Telegram Bot @${botInfo.username} configured with webhook: ${webhookUrl}`);
    } else {
      // Local development: Long polling
      bot.start({
        onStart: (botInfo) => {
          console.log(`🤖 Telegram Bot started natively as @${botInfo.username} (polling mode)`);
        }
      });
    }

    return true;
  } catch (error) {
    console.error("❌ Fallo al inicializar Telegram Bot:", error);
    return false;
  }
}

/**
 * Express middleware for Telegram webhook endpoint.
 * Use with: app.post("/api/telegram/webhook", getWebhookHandler())
 */
export function getWebhookHandler() {
  if (!bot) return (_req, res) => res.status(503).json({ error: "Bot not initialized" });
  return webhookCallback(bot, "express");
}

async function showMainMenu(ctx) {
  const keyboard = new InlineKeyboard()
    .text("🔍 Individual Report", "new_monitor")
    .row()
    .text("📊 Market Report", "market_report_flow")
    .row()
    .text("📡 My active Monitors", "monitors_list")
    .row()
    .text("📋 Verified History", "history_list")
    .row()
    .text("ℹ️ Help", "help");

  await ctx.reply("*Ferrule Panel*\nWhat would you like to do?", { 
    parse_mode: "Markdown",
    reply_markup: keyboard 
  });
}

/**
 * Generate a deterministic stateless link code using HMAC.
 * 62 chars = 56 (address) + 6 (signature)
 */
export function generateDeepLinkCode(walletAddress) {
    const cleanWallet = walletAddress.trim().toUpperCase();
    const salt = process.env.TELEGRAM_BOT_TOKEN || "FERRULE_INTERNAL_SALT";
    
    const signature = crypto.createHmac("sha256", salt)
        .update(cleanWallet)
        .digest("hex")
        .slice(0, 6);
        
    const code = `${cleanWallet}${signature}`;
    console.log(`[Telegram] Generated stateless code for ${cleanWallet.slice(0,8)}...: ${code}`);
    return code;
}

/**
 * Triggered by monitor-engine 
 */
export async function sendMonitorAlert(chatId, data) {
  if (!bot) return;

  const keyboard = new InlineKeyboard();
  keyboard.text("⏸ Pause monitor", `cancel_${data.monitorId}`);

  try {
    let msg = `⚡ *FERRULE MONITOR — ${data.pair}*\n` +
      `📅 ${new Date().toUTCString()}\n` +
      `💲 Price: \`$${data.priceData.current.price}\`\n\n` +
      `📊 *TECHNICAL ANALYSIS:*\n` +
      `• RSI (14): ${data.indicators.rsi.toFixed(1)} ${rsiSignal(data.indicators.rsi)}\n` +
      `• EMA 9/21: $${data.indicators.ema9.toFixed(4)} / $${data.indicators.ema21.toFixed(4)} (${data.indicators.trend})\n` +
      `• ATR (14): $${data.indicators.atr.toFixed(4)} → volatility ${((data.indicators.atr / data.priceData.current.price)*100).toFixed(2)}%\n` +
      `• Support: $${data.indicators.support.toFixed(4)}\n` +
      `• Resistance: $${data.indicators.resistance.toFixed(4)}\n\n` +
      `🟢 *SIGNAL DETECTED:*\n` +
      `${data.primarySignal.msg}\n\n`;

    if (data.reportMarkdown) {
        msg += `💡 *SUGGESTION:*\n${data.reportMarkdown}\n\n`;
    }

    msg += `💰 Remaining budget: \`${data.budgetLeft} USDC\`\n` +
           `🔗 tx: [${data.sha256.slice(0, 16)}...](https://stellar.expert/explorer/testnet/tx/${data.sha256})`;

    await bot.api.sendMessage(chatId, msg,
      { parse_mode: "Markdown", reply_markup: keyboard }
    );
  } catch (e) {
    console.error(`Telegram send failed to chatId ${chatId}:`, e.message);
  }
}

async function marketReportConversation(conversation, ctx) {
  const pairKeyboard = new InlineKeyboard()
    .text("XLM/USDC").text("BTC/USDC").row()
    .text("ETH/USDC").text("SOL/USDC");
    
  await ctx.reply("Select a trading pair:", { reply_markup: pairKeyboard });
  const pairCtx = await conversation.waitForCallbackQuery(["XLM/USDC", "BTC/USDC", "ETH/USDC", "SOL/USDC"]);
  const pair = pairCtx.match;
  await pairCtx.answerCallbackQuery();

  const typeKeyboard = new InlineKeyboard()
    .text("📸 Snapshot now", "snapshot")
    .row()
    .text("🔄 Perpetual monitor", "perpetual");
  
  await ctx.reply(`Selected pair: ${pair}\nAnalysis type:`, { reply_markup: typeKeyboard });
  const typeCtx = await conversation.waitForCallbackQuery(["snapshot", "perpetual"]);
  const analysisType = typeCtx.match;
  await typeCtx.answerCallbackQuery();

  if (analysisType === "snapshot") {
     await ctx.reply(`⏳ Contacting oracle and pulling OHLCV for ${pair}...`);
     
     try {
       const priceData = await getPriceData(pair);
       const indicators = computeIndicators(priceData.ohlcv);
       const news = []; // In a generic snapshot, we omit news to save x402 cost or execute search if we want.
       
       const quantPrompt = buildMarketPrompt(pair, priceData, indicators, news);

       const analysis = await streamRiskAnalysis(quantPrompt, "", null, "mode: trading_monitor");
       
       let msg = `📊 *Ferrule Market — ${pair}*\n` +
      `📅 ${new Date().toUTCString()}\n\n` +
      `💲 Price: \`$${priceData.current.price}\` | ${priceData.current.change24h.toFixed(2)}% 24h\n\n` +
      `📈 *INDICATORS*\n` +
      `• RSI (14): ${indicators.rsi.toFixed(1)} ${rsiSignal(indicators.rsi)}\n` +
      `• EMA 9/21: $${indicators.ema9.toFixed(4)} / $${indicators.ema21.toFixed(4)} (${indicators.trend})\n` +
      `• ATR (14): $${indicators.atr.toFixed(4)} → volatility ${((indicators.atr / priceData.current.price)*100).toFixed(2)}%\n` +
      `• Support: $${indicators.support.toFixed(4)}\n` +
      `• Resistance: $${indicators.resistance.toFixed(4)}\n\n` +
      `💡 *AI ANALYSIS*: \n${analysis.fullRiskReport}`;
       
       await ctx.reply(msg, { parse_mode: "Markdown" });
     } catch (err) {
       await ctx.reply(`❌ Failed to generate snapshot: ${err.message}`);
     }
  } else {
     const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3001";
     const link = `${FRONTEND_URL}/console?tab=monitor&pair=${pair.replace("/", "_")}`;
     
     const kb = new InlineKeyboard().url("🔗 Open Ferrule Panel", link);
     await ctx.reply(`To start a perpetual monitor, you must sign the on-chain budget using your Stellar wallet.\n\nClick below to configure the budget:`, { reply_markup: kb });
  }
}

