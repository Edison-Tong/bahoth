import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import { createServer } from "node:http";
import process from "node:process";

const PORT = Number(process.env.PORT || 10000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "*";
const AUTH_SHARED_SECRET = process.env.AUTH_SHARED_SECRET || "";

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: CLIENT_ORIGIN === "*" ? true : CLIENT_ORIGIN,
    credentials: false,
  })
);

app.get("/health", (_req, res) => res.json({ ok: true, service: "bahoth-server" }));
app.get("/api/ping", (_req, res) => res.json({ ok: true, ts: Date.now() }));

const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

// rooms: Map<code, { players: [{ ws, name, color, playerIndex }], started, gameState }>
const rooms = new Map();
// socketMeta: Map<ws, { code, playerIndex }>
const socketMeta = new Map();

const PLAYER_COLORS = ["#c0392b", "#2980b9", "#27ae60", "#f39c12", "#8e44ad", "#e67e22"];

function safeSend(ws, obj) {
  if (ws?.readyState === 1) ws.send(JSON.stringify(obj));
}

function broadcastRoom(code, obj, exceptWs = null) {
  const room = rooms.get(code);
  if (!room) return;
  for (const p of room.players) {
    if (p.ws !== exceptWs) safeSend(p.ws, obj);
  }
}

function roomPlayerList(room) {
  return room.players.map((p) => ({ name: p.name, color: p.color, playerIndex: p.playerIndex }));
}

function handleDisconnect(ws) {
  const meta = socketMeta.get(ws);
  if (!meta) return;
  socketMeta.delete(ws);
  const { code, playerIndex } = meta;
  const room = rooms.get(code);
  if (!room) return;

  if (room.started) {
    const player = room.players.find((p) => p.playerIndex === playerIndex);
    if (player) player.ws = null;
    broadcastRoom(code, { type: "player-disconnected", playerIndex });
    return;
  }

  room.players = room.players.filter((p) => p.playerIndex !== playerIndex);
  if (room.players.length === 0) {
    rooms.delete(code);
    return;
  }
  if (playerIndex === 0) {
    broadcastRoom(code, { type: "room-closed", message: "Host left the game" });
    rooms.delete(code);
    return;
  }
  broadcastRoom(code, { type: "player-left", players: roomPlayerList(room) });
}

wss.on("connection", (socket, request) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  const token = url.searchParams.get("token") || "";

  if (AUTH_SHARED_SECRET && token !== AUTH_SHARED_SECRET) {
    safeSend(socket, { type: "error", message: "Unauthorized" });
    socket.close(1008, "Unauthorized");
    return;
  }

  safeSend(socket, { type: "connected", ts: Date.now() });

  socket.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      safeSend(socket, { type: "error", message: "Invalid JSON" });
      return;
    }

    const { type, code } = msg;

    if (type === "create-room") {
      const { playerName, color } = msg;
      if (!code || !playerName) {
        safeSend(socket, { type: "error", message: "Missing code or playerName" });
        return;
      }
      if (rooms.has(code)) {
        safeSend(socket, { type: "error", message: "Room code already in use" });
        return;
      }
      const player = { ws: socket, name: playerName, color: color || PLAYER_COLORS[0], playerIndex: 0 };
      rooms.set(code, { players: [player], started: false, gameState: null });
      socketMeta.set(socket, { code, playerIndex: 0 });
      safeSend(socket, { type: "room-created", code, players: roomPlayerList(rooms.get(code)), myPlayerIndex: 0 });
      return;
    }

    if (type === "join-room") {
      const { playerName, color } = msg;
      const room = rooms.get(code);
      if (!room) {
        safeSend(socket, { type: "error", message: "Room not found" });
        return;
      }
      if (room.started) {
        safeSend(socket, { type: "error", message: "Game already started" });
        return;
      }
      if (room.players.length >= 6) {
        safeSend(socket, { type: "error", message: "Room is full" });
        return;
      }
      const playerIndex = room.players.length;
      const player = {
        ws: socket,
        name: playerName || "Player",
        color: color || PLAYER_COLORS[playerIndex % PLAYER_COLORS.length],
        playerIndex,
      };
      room.players.push(player);
      socketMeta.set(socket, { code, playerIndex });
      safeSend(socket, { type: "room-joined", code, players: roomPlayerList(room), myPlayerIndex: playerIndex });
      broadcastRoom(code, { type: "player-joined", players: roomPlayerList(room) }, socket);
      return;
    }

    if (type === "start-char-select") {
      const meta = socketMeta.get(socket);
      if (!meta || meta.playerIndex !== 0) {
        safeSend(socket, { type: "error", message: "Only the host can start character select" });
        return;
      }
      const room = rooms.get(code);
      if (!room) return;
      room.charPicks = {};
      // Broadcast to ALL players including host
      for (const p of room.players) safeSend(p.ws, { type: "char-select-started" });
      return;
    }

    if (type === "char-pick") {
      const meta = socketMeta.get(socket);
      if (!meta) return;
      const room = rooms.get(code);
      if (!room) return;
      const { character } = msg;
      if (!room.charPicks) room.charPicks = {};
      room.charPicks[meta.playerIndex] = character;
      // Broadcast updated picks map to all players
      for (const p of room.players) safeSend(p.ws, { type: "char-picks-update", picks: room.charPicks });
      return;
    }

    if (type === "start-game") {
      const meta = socketMeta.get(socket);
      if (!meta || meta.playerIndex !== 0) {
        safeSend(socket, { type: "error", message: "Only the host can start the game" });
        return;
      }
      const room = rooms.get(code);
      if (!room) return;
      const { gameState, players } = msg;
      room.started = true;
      room.gameState = gameState ?? null;
      // Broadcast to non-host players only (host already has the state locally)
      broadcastRoom(code, { type: "game-started", players, gameState }, socket);
      return;
    }

    if (type === "state-update") {
      const room = rooms.get(code);
      if (!room?.started) return;
      room.gameState = msg.gameState;
      // Relay to everyone except sender
      broadcastRoom(code, { type: "state-update", gameState: msg.gameState }, socket);
      return;
    }

    if (type === "leave-room") {
      handleDisconnect(socket);
      return;
    }
  });

  socket.on("close", () => handleDisconnect(socket));
});

server.listen(PORT, () => {
  console.log(`bahoth-server listening on port ${PORT}`);
});
