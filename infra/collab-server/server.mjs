// OnlineCode real-time collaboration server (Hocuspocus).
// Listens on PORT (default 1234) and bridges Y.Doc updates between
// concurrent WebSocket clients in the same room.
//
// Room names are namespaced:
//   p:<project-uuid>          - project file (per-file Y.Doc)
//   s:<snippet-uuid>          - snippet Y.Doc
//
// Auth:
//   onAuthenticate receives `token` from the client. We use it as a
//   user identifier (already validated upstream by the Next.js API).
//   Set COLLAB_REQUIRE_AUTH=true to require a shared secret in
//   `token` (configured via COLLAB_SHARED_SECRET). When false, any
//   non-empty token is accepted (good for local dev).

import { Hocuspocus, onAuthenticatePayload, onConnectPayload } from "@hocuspocus/server";
import { WebSocket } from "ws";
import * as Y from "yjs";

const PORT = Number.parseInt(process.env.PORT ?? "1234", 10);
const HOST = process.env.HOST ?? "0.0.0.0";
const REQUIRE_AUTH = process.env.COLLAB_REQUIRE_AUTH === "true";
const SHARED_SECRET = process.env.COLLAB_SHARED_SECRET ?? "";
const LOG_LEVEL = process.env.COLLAB_LOG_LEVEL ?? "info";
const MAX_DOCS = Number.parseInt(process.env.COLLAB_MAX_DOCS ?? "1000", 10);
const DOC_TTL_MS = Number.parseInt(process.env.COLLAB_DOC_TTL_MS ?? "3600000", 10);

if (REQUIRE_AUTH && !SHARED_SECRET) {
  console.error("[collab] COLLAB_REQUIRE_AUTH=true but COLLAB_SHARED_SECRET is empty");
  process.exit(1);
}

const docs = new Map();

function gcDocs() {
  const now = Date.now();
  for (const [name, entry] of docs) {
    if (entry.lastAccessedAt + DOC_TTL_MS < now && entry.connections.size === 0) {
      Y.encodeStateAsUpdate(entry.doc);
      entry.doc.destroy();
      docs.delete(name);
      console.log(`[collab] gc'd document ${name}`);
    }
  }
}

setInterval(gcDocs, 60_000).unref();

const server = new Hocuspocus({
  name: "onlinecode-collab",
  timeout: 30_000,
  debounce: 1_500,
  maxDebounce: 5_000,
  quiet: LOG_LEVEL === "warn" || LOG_LEVEL === "error",

  onConnect(data: onConnectPayload) {
    const room = data.documentName;
    if (!/^p:[a-z0-9-]{8,64}$/.test(room) && !/^s:[a-z0-9-]{8,64}$/.test(room)) {
      console.warn(`[collab] rejected connection to invalid room ${room}`);
      throw new Error("invalid_room");
    }
    if (docs.size >= MAX_DOCS && !docs.has(room)) {
      throw new Error("server_full");
    }
    return Promise.resolve();
  },

  async onAuthenticate(data: onAuthenticatePayload) {
    const token = (data.token ?? "").trim();
    if (!token) {
      throw new Error("missing_token");
    }
    if (REQUIRE_AUTH && token !== SHARED_SECRET) {
      throw new Error("invalid_token");
    }
    return Promise.resolve({ userId: token });
  },

  onLoadDocument(data) {
    const name = data.documentName;
    const existing = docs.get(name);
    if (existing) {
      existing.lastAccessedAt = Date.now();
      return existing.doc;
    }
    const doc = new Y.Doc();
    docs.set(name, { doc, lastAccessedAt: Date.now(), connections: new Set() });
    return doc;
  },

  onChange(data) {
    const entry = docs.get(data.documentName);
    if (entry) {
      entry.lastAccessedAt = Date.now();
    }
  },

  onConnectHook(data) {
    const entry = docs.get(data.documentName);
    if (entry) {
      entry.connections.add(data.context?.userId ?? "anon");
    }
  },

  onDisconnect(data) {
    const entry = docs.get(data.documentName);
    if (entry) {
      entry.connections.delete(data.context?.userId ?? "anon");
    }
  },
});

const ws = new WebSocket.Server({ port: PORT, host: HOST });

ws.on("connection", (conn, req) => {
  server.handleConnection(conn, req);
  console.log(`[collab] +1 client (room=${req.url ?? "?"}) total=${ws.clients.size}`);
});

ws.on("listening", () => {
  console.log(`[collab] listening on ws://${HOST}:${PORT}`);
  console.log(`[collab] auth=${REQUIRE_AUTH ? "shared-secret" : "open"} maxDocs=${MAX_DOCS} docTtl=${DOC_TTL_MS}ms`);
});

ws.on("error", (err) => {
  console.error("[collab] ws error", err);
});

const shutdown = (signal) => {
  console.log(`[collab] received ${signal}, shutting down`);
  for (const [, entry] of docs) {
    entry.doc.destroy();
  }
  docs.clear();
  ws.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
