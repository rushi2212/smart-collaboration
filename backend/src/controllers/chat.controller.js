import Message from "../models/Message.js";
import { getIO } from "../config/socket.js";

export const sendMessage = async (req, res) => {
  const { content, projectId } = req.body;

  const message = await Message.create({
    sender: req.user.id,
    content,
    projectId,
  });

  // Populate sender before emitting
  await message.populate("sender", "name");

  const io = getIO();
  io.to(projectId).emit("receiveMessage", message);

  res.status(201).json(message);
};

export const getMessages = async (req, res) => {
  const messages = await Message.find({
    projectId: req.params.projectId,
  }).populate("sender", "name");

  res.json(messages);
};
