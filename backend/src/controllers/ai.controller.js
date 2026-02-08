import axios from "axios";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

export const prioritizeTasksAI = async (req, res) => {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/ai/prioritize-tasks`, {
      tasks: req.body.tasks,
    });
    res.json(response.data);
  } catch (error) {
    console.error("AI Prioritization Error:", error.message);
    res.status(500).json({
      error: "Failed to get AI prioritization",
      details: error.response?.data || error.message,
    });
  }
};

export const agenticAnalysis = async (req, res) => {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/ai/agentic-analysis`, {
      tasks: req.body.tasks,
    });
    res.json(response.data);
  } catch (error) {
    console.error("AI Agentic Analysis Error:", error.message);
    res.status(500).json({
      error: "Failed to get agentic analysis",
      details: error.response?.data || error.message,
    });
  }
};
