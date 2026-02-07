import { Server } from "socket.io";

let io;

// Track active meetings and participants
const activeMeetings = new Map(); // meetingId -> Set of socket.id
const socketToUser = new Map(); // socket.id -> { userId, userName, meetingId }
const meetingRooms = new Map(); // roomId -> Map of socket.id -> { name }

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*",
    },
  });

  io.on("connection", (socket) => {
    console.log("🟢 User connected:", socket.id);

    // Existing chat functionality
    socket.on("joinRoom", ({ roomId }) => {
      socket.join(roomId);
      console.log(`User joined room ${roomId}`);
    });

    socket.on("sendMessage", ({ roomId, message }) => {
      socket.to(roomId).emit("receiveMessage", message);
    });

    // ==================== WebRTC Room Signaling (test-webrtc) ====================

    socket.on("room:join", ({ roomId, name }) => {
      if (!roomId || !name) {
        socket.emit("room:error", { message: "Missing room or name." });
        return;
      }

      socket.data.meetingRoomId = roomId;
      socket.data.meetingName = name;

      const room = ensureMeetingRoom(roomId);
      room.set(socket.id, { name });

      socket.join(roomId);

      const peers = Array.from(room.entries())
        .filter(([peerId]) => peerId !== socket.id)
        .map(([peerId, data]) => ({ id: peerId, name: data.name }));

      socket.emit("room:peers", { peers });
      socket.to(roomId).emit("peer:joined", { peerId: socket.id, name });
    });

    socket.on("room:leave", () => {
      removeFromMeetingRoom(socket);
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
      const roomId = socket.data.meetingRoomId;
      const name = socket.data.meetingName;
      if (!roomId || !name || !text) return;

      io.to(roomId).emit("chat:message", {
        senderId: socket.id,
        name,
        text,
        timestamp: Date.now(),
      });
    });

    // ==================== WebRTC Meeting Signaling ====================

    /**
     * User joins a meeting room
     * - Adds user to meeting room
     * - Notifies existing participants
     * - Returns list of existing participants to new user
     */
    socket.on("join-meeting", ({ meetingId, userId, userName }) => {
      console.log(`📹 ${userName} joining meeting: ${meetingId}`);

      // Join the Socket.IO room
      socket.join(meetingId);

      // Track user info
      socketToUser.set(socket.id, { userId, userName, meetingId });

      // Track meeting participants
      if (!activeMeetings.has(meetingId)) {
        activeMeetings.set(meetingId, new Set());
      }
      activeMeetings.get(meetingId).add(socket.id);

      // Get existing participants in the meeting
      const existingParticipants = Array.from(activeMeetings.get(meetingId))
        .filter((id) => id !== socket.id)
        .map((id) => ({
          socketId: id,
          userId: socketToUser.get(id)?.userId,
          userName: socketToUser.get(id)?.userName,
        }));

      // Send existing participants to the new user
      socket.emit("existing-participants", existingParticipants);

      // Notify existing participants about new user
      socket.to(meetingId).emit("user-joined", {
        socketId: socket.id,
        userId,
        userName,
      });

      console.log(
        `✅ ${userName} joined. Total in meeting: ${activeMeetings.get(meetingId).size}`,
      );
    });

    /**
     * WebRTC Offer (sent by caller to establish connection)
     */
    socket.on("offer", ({ offer, to }) => {
      const from = socket.id;
      const userInfo = socketToUser.get(from);

      console.log(`📤 Sending offer from ${from} to ${to}`);

      // Send offer to specific peer
      io.to(to).emit("offer", {
        offer,
        from,
        userId: userInfo?.userId,
        userName: userInfo?.userName,
      });
    });

    /**
     * WebRTC Answer (response to offer)
     */
    socket.on("answer", ({ answer, to }) => {
      const from = socket.id;
      console.log(`📥 Sending answer from ${from} to ${to}`);

      // Send answer back to original caller
      io.to(to).emit("answer", {
        answer,
        from,
      });
    });

    /**
     * ICE Candidate (network path discovery for WebRTC)
     */
    socket.on("ice-candidate", ({ candidate, to }) => {
      const from = socket.id;

      // Forward ICE candidate to specific peer
      io.to(to).emit("ice-candidate", {
        candidate,
        from,
      });
    });

    /**
     * Meeting chat message
     */
    socket.on("meeting-chat-message", ({ meetingId, message }) => {
      console.log(`💬 Chat message in meeting ${meetingId}:`, message.text);
      // Broadcast to all other participants in the meeting
      socket.to(meetingId).emit("meeting-chat-message", message);
    });

    /**
     * Screen sharing started/stopped
     */
    socket.on("screen-share-status", ({ meetingId, isSharing }) => {
      const userInfo = socketToUser.get(socket.id);
      console.log(`🖥️ ${userInfo?.userName} screen sharing: ${isSharing}`);
      // Notify all participants about screen share status
      socket.to(meetingId).emit("screen-share-status", {
        socketId: socket.id,
        userName: userInfo?.userName,
        isSharing,
      });
    });

    /**
     * User leaves meeting
     */
    socket.on("leave-meeting", () => {
      handleUserLeaveMeeting(socket);
    });

    /**
     * Handle disconnect
     */
    socket.on("disconnect", () => {
      console.log("🔴 User disconnected:", socket.id);
      removeFromMeetingRoom(socket);
      handleUserLeaveMeeting(socket);
    });
  });

  return io;
};

/**
 * Helper function to handle user leaving meeting
 */
function handleUserLeaveMeeting(socket) {
  const userInfo = socketToUser.get(socket.id);

  if (userInfo && userInfo.meetingId) {
    const { meetingId, userName } = userInfo;

    console.log(`👋 ${userName} leaving meeting: ${meetingId}`);

    // Remove from active meeting
    if (activeMeetings.has(meetingId)) {
      activeMeetings.get(meetingId).delete(socket.id);

      // Clean up empty meetings
      if (activeMeetings.get(meetingId).size === 0) {
        activeMeetings.delete(meetingId);
      }
    }

    // Notify other participants
    socket.to(meetingId).emit("user-left", {
      socketId: socket.id,
      userName,
    });

    // Leave Socket.IO room
    socket.leave(meetingId);
  }

  // Clean up user tracking
  socketToUser.delete(socket.id);
}

export const getIO = () => io;

function ensureMeetingRoom(roomId) {
  if (!meetingRooms.has(roomId)) {
    meetingRooms.set(roomId, new Map());
  }
  return meetingRooms.get(roomId);
}

function removeFromMeetingRoom(socket) {
  const roomId = socket.data.meetingRoomId;
  if (!roomId) return;

  const room = meetingRooms.get(roomId);
  if (!room) return;

  room.delete(socket.id);
  socket.leave(roomId);

  socket.to(roomId).emit("peer:left", { peerId: socket.id });

  if (room.size === 0) {
    meetingRooms.delete(roomId);
  }

  socket.data.meetingRoomId = undefined;
  socket.data.meetingName = undefined;
}
