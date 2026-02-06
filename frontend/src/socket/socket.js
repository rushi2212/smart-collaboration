import { io } from "socket.io-client";

const defaultSocketUrl =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:5000`
    : "http://localhost:5000";

const socket = io(import.meta.env.VITE_SOCKET_URL || defaultSocketUrl, {
  transports: ["websocket", "polling"],
});

export default socket;
