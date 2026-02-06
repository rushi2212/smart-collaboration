import dotenv from "dotenv";
dotenv.config();

import http from "http";
import app from "./app.js";
import connectDB from "./config/db.js";
import { initSocket } from "./config/socket.js";

connectDB();

const server = http.createServer(app);
initSocket(server);

server.listen(5000, () => {
  console.log("🚀 Server running on port 5000");
});
