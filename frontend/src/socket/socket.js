import { io } from "socket.io-client";

const defaultSocketUrl = "https://smart-collaboration.onrender.com";

const socket = io(import.meta.env.VITE_SOCKET_URL || defaultSocketUrl, {
  transports: ["websocket", "polling"],
});

export default socket;
