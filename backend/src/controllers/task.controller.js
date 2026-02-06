import Task from "../models/Task.js";
import { getIO } from "../config/socket.js";

export const createTask = async (req, res) => {
  try {
    const task = await Task.create(req.body);

    const io = getIO();
    io.to(task.projectId.toString()).emit("taskCreated", task);

    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getProjectTasks = async (req, res) => {
  try {
    const tasks = await Task.find({
      projectId: req.params.projectId,
    })
      .populate("assignee", "name email")
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateTaskStatus = async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true },
    );

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const io = getIO();
    io.to(task.projectId.toString()).emit("taskUpdated", task);

    res.json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteTask = async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const io = getIO();
    io.to(task.projectId.toString()).emit("taskDeleted", task._id);

    res.json({ message: "Task deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
