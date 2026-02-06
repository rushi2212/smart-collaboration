const express = require("express");
const http = require("http");
const path = require("path");
const cors = require("cors");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));

const distPath = path.resolve(__dirname, "..", "frontend", "dist");
app.use(express.static(distPath));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN,
  },
});

const rooms = new Map();

const ensureRoom = (roomId) => {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Map());
  }
  return rooms.get(roomId);
};

const removeFromRoom = (socket) => {
  const roomId = socket.data.roomId;
  if (!roomId) return;

  const room = rooms.get(roomId);
  if (!room) return;

  room.delete(socket.id);
  socket.leave(roomId);

  socket.to(roomId).emit("peer:left", { peerId: socket.id });

  if (room.size === 0) {
    rooms.delete(roomId);
  }
};

io.on("connection", (socket) => {
  socket.on("room:join", ({ roomId, name }) => {
    if (!roomId || !name) {
      socket.emit("room:error", { message: "Missing room or name." });
      return;
    }

    socket.data.roomId = roomId;
    socket.data.name = name;

    const room = ensureRoom(roomId);
    room.set(socket.id, { name });

    socket.join(roomId);

    const peers = Array.from(room.entries())
      .filter(([peerId]) => peerId !== socket.id)
      .map(([peerId, data]) => ({ id: peerId, name: data.name }));

    socket.emit("room:peers", { peers });
    socket.to(roomId).emit("peer:joined", { peerId: socket.id, name });
  });

  socket.on("room:leave", () => {
    removeFromRoom(socket);
  });

  socket.on("disconnect", () => {
    removeFromRoom(socket);
  });

  socket.on("webrtc:offer", ({ to, sdp }) => {
    if (!to || !sdp) return;
    io.to(to).emit("webrtc:offer", { from: socket.id, sdp });
  });

  socket.on("webrtc:answer", ({ to, sdp }) => {
    if (!to || !sdp) return;
    io.to(to).emit("webrtc:answer", { from: socket.id, sdp });
  });

  socket.on("webrtc:ice", ({ to, candidate }) => {
    if (!to || !candidate) return;
    io.to(to).emit("webrtc:ice", { from: socket.id, candidate });
  });

  socket.on("chat:message", ({ text }) => {
    const roomId = socket.data.roomId;
    const name = socket.data.name;
    if (!roomId || !name || !text) return;

    io.to(roomId).emit("chat:message", {
      senderId: socket.id,
      name,
      text,
      timestamp: Date.now(),
    });
  });
});

server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
