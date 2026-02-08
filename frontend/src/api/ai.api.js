import { api2 } from "./axios";

export const prioritizeTasks = async (tasks) => {
  const response = await api2.post("/ai/prioritize-tasks", { tasks });
  return response.data;
};

export const agenticAnalysis = async (tasks) => {
  const response = await api2.post("/ai/agentic-analysis", { tasks });
  return response.data;
};
