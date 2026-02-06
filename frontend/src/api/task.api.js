import api from "./axios";

export const getTasks = (projectId) => api.get(`/tasks/${projectId}`);

export const createTask = (data) => api.post("/tasks", data);

export const updateTaskStatus = (id, status) =>
  api.patch(`/tasks/${id}`, { status });

export const deleteTask = (id) => api.delete(`/tasks/${id}`);
