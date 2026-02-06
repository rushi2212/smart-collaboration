import api from "./axios";

export const prioritizeTasks = async (tasks) => {
  const response = await api.post("/ai/prioritize", { tasks });
  return response.data;
};

export const agenticAnalysis = async (tasks) => {
  const response = await api.post("/ai/agentic", { tasks });
  return response.data;
};
