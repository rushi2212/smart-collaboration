import api from "./axios";

export const getMessages = (projectId) => api.get(`/chat/${projectId}`);
export const sendMessage = (data) => api.post("/chat", data);
