import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { io, type Socket } from "socket.io-client";
import { chat, type ChatMessage } from "./lib/chat";

const OPENWA_URL = (process.env.OPENWA_URL ?? "http://localhost:2785").replace(
  /\/$/,
  "",
);
const OPENWA_API_KEY = process.env.OPENWA_API_KEY ?? "dev-admin-key";
const OPENWA_SESSION_ID = process.env.OPENWA_SESSION_ID ?? "";
const REPLY_IN_GROUPS =
  (process.env.REPLY_IN_GROUPS ?? "false").toLowerCase() === "true";
const LOCK_FILE = ".stonks-bot.lock";

if (!OPENWA_SESSION_ID) {
  console.error("Missing OPENWA_SESSION_ID (the session to listen on).");
  process.exit(1);
}

function acquireLock(): void {
  if (existsSync(LOCK_FILE)) {
    const pid = Number.parseInt(readFileSync(LOCK_FILE, "utf8"), 10);
    if (pid && pid !== process.pid) {
      try {
        process.kill(pid, 0);
        console.error(
          `Another stonks bot is already running (pid ${pid}). Stop it first.`,
        );
        process.exit(1);
      } catch {
        // stale lock from a crashed process
      }
    }
  }
  writeFileSync(LOCK_FILE, String(process.pid));
  const release = () => {
    try {
      if (
        existsSync(LOCK_FILE) &&
        readFileSync(LOCK_FILE, "utf8") === String(process.pid)
      ) {
        unlinkSync(LOCK_FILE);
      }
    } catch {
      // ignore
    }
  };
  process.on("exit", release);
  process.on("SIGINT", release);
  process.on("SIGTERM", release);
}

acquireLock();

const log = (...args: unknown[]) => console.log(new Date().toISOString(), ...args);

interface IncomingMessage {
  id?: string;
  from?: string;
  chatId?: string;
  body?: string;
  fromMe?: boolean;
  isGroup?: boolean;
}

interface ServerMessage {
  type: "subscribed" | "unsubscribed" | "event" | "error" | "pong";
  code?: string;
  message?: string;
  events?: string[];
  payload?: { event: string; sessionId: string; data: unknown };
}

const histories = new Map<string, ChatMessage[]>();
const inFlight = new Map<string, Promise<void>>();
const processedIds = new Set<string>();
const MAX_PROCESSED_IDS = 500;

async function sendText(chatId: string, text: string): Promise<void> {
  const res = await fetch(
    `${OPENWA_URL}/api/sessions/${OPENWA_SESSION_ID}/messages/send-text`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": OPENWA_API_KEY,
      },
      body: JSON.stringify({ chatId, text }),
    },
  );
  const body: { success?: boolean; error?: unknown } = await res
    .json()
    .catch(() => ({}));
  if (!res.ok || body?.success === false) {
    throw new Error(`OpenWA ${res.status}: ${JSON.stringify(body?.error ?? body)}`);
  }
}

async function handleIncoming(data: unknown): Promise<void> {
  const m = data as IncomingMessage;
  if (!m) return;
  if (m.fromMe) return;
  if (m.isGroup && !REPLY_IN_GROUPS) return;

  const chatId = m.chatId ?? m.from;
  const text = m.body?.trim();
  if (!chatId || !text) return;

  if (m.id) {
    if (processedIds.has(m.id)) return;
    processedIds.add(m.id);
    if (processedIds.size > MAX_PROCESSED_IDS) {
      const oldest = processedIds.values().next().value;
      if (oldest) processedIds.delete(oldest);
    }
  }

  const prev = inFlight.get(chatId) ?? Promise.resolve();
  const task = prev
    .catch(() => {})
    .then(async () => {
      log(`← ${chatId}: ${text}`);

      const history = histories.get(chatId) ?? [];
      history.push({ role: "user", content: text });

      try {
        const reply = await chat(history);
        history.push({ role: "assistant", content: reply });
        histories.set(chatId, history);

        await sendText(chatId, reply);
        log(`→ ${chatId}: ${reply.slice(0, 80)}${reply.length > 80 ? "…" : ""}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log(`✗ chat failed: ${message}`);
        await sendText(chatId, `⚠️ ${message}`);
      }
    });

  inFlight.set(chatId, task);
  await task;
  if (inFlight.get(chatId) === task) inFlight.delete(chatId);
}

const socket: Socket = io(`${OPENWA_URL}/events`, {
  transports: ["websocket"],
  query: { apiKey: OPENWA_API_KEY },
  extraHeaders: { "X-API-Key": OPENWA_API_KEY },
});

socket.on("connect", () => {
  log(
    `Connected to OpenWA events (${socket.id}). Subscribing to session ${OPENWA_SESSION_ID}…`,
  );
  socket.emit(
    "message",
    {
      type: "subscribe",
      sessionId: OPENWA_SESSION_ID,
      events: ["message.received"],
      requestId: "stonks-bot-sub",
    },
    (ack: ServerMessage) => {
      if (ack?.type === "subscribed") {
        log(
          `Subscribed to: ${ack.events?.join(", ")}. Stonks bot is live.`,
        );
      } else if (ack?.type === "error") {
        log(`Subscribe error: ${ack.code} — ${ack.message}`);
      }
    },
  );
});

socket.on("message", (msg: ServerMessage) => {
  switch (msg.type) {
    case "subscribed":
      log(`Subscribed to: ${msg.events?.join(", ")}. Stonks bot is live.`);
      break;
    case "error":
      log(`Server error: ${msg.code} — ${msg.message}`);
      break;
    case "event":
      if (msg.payload?.event === "message.received") {
        void handleIncoming(msg.payload.data);
      }
      break;
    default:
      break;
  }
});

socket.on("connect_error", (err) => log(`Connection error: ${err.message}`));
socket.on("disconnect", (reason) => log(`Disconnected: ${reason}`));

process.on("SIGINT", () => {
  log("Shutting down.");
  socket.close();
  process.exit(0);
});

if (import.meta.hot) {
  import.meta.hot.on("dispose", () => {
    log("Hot reload — closing OpenWA connection.");
    socket.close();
  });
}

log(`Stonks bot starting → ${OPENWA_URL}`);
