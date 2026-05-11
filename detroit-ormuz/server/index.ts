import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"]
  }
});

const games = new Map<string, { host?: string; guest?: string }>();

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, name: "Ormuz 2026" });
});

io.on("connection", (socket) => {
  socket.on("create-game", (callback: (payload: { code: string }) => void) => {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    games.set(code, { host: socket.id });
    socket.join(code);
    callback({ code });
  });

  socket.on("join-game", (code: string, callback: (payload: { ok: boolean; message?: string }) => void) => {
    const normalized = code.trim().toUpperCase();
    const game = games.get(normalized);
    if (!game) {
      callback({ ok: false, message: "Partie introuvable." });
      return;
    }

    game.guest = socket.id;
    socket.join(normalized);
    io.to(normalized).emit("player-joined", { code: normalized });
    callback({ ok: true });
  });

  socket.on("relay-action", ({ code, action }) => {
    socket.to(code).emit("remote-action", action);
  });

  socket.on("disconnect", () => {
    for (const [code, game] of games.entries()) {
      if (game.host === socket.id || game.guest === socket.id) {
        socket.to(code).emit("player-left");
        games.delete(code);
      }
    }
  });
});

httpServer.listen(3027, () => {
  console.log("Ormuz 2026 server listening on http://localhost:3027");
});
