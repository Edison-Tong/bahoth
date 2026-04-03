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

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "bahoth-server" });
});

app.get("/api/ping", (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (socket, request) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  const token = url.searchParams.get("token") || "";

  if (AUTH_SHARED_SECRET && token !== AUTH_SHARED_SECRET) {
    socket.send(JSON.stringify({ type: "error", message: "Unauthorized" }));
    socket.close(1008, "Unauthorized");
    return;
  }

  socket.send(
    JSON.stringify({
      type: "connected",
      message: "WebSocket connected",
      ts: Date.now(),
    })
  );

  socket.on("message", (raw) => {
    let payload = null;
    try {
      payload = JSON.parse(String(raw));
    } catch {
      socket.send(JSON.stringify({ type: "error", message: "Invalid JSON payload" }));
      return;
    }

    socket.send(
      JSON.stringify({
        type: "echo",
        payload,
        ts: Date.now(),
      })
    );
  });
});

server.listen(PORT, () => {
  console.log(`bahoth-server listening on port ${PORT}`);
});
