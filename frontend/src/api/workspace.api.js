import api from "./axios";

export const getWorkspaces = () => api.get("/workspaces");
export const createWorkspace = (data) => api.post("/workspaces", data);
export const addWorkspaceMember = (workspaceId, userId) =>
  api.post(`/workspaces/${workspaceId}/members`, { userId });
export const removeWorkspaceMember = (workspaceId, memberId) =>
  api.delete(`/workspaces/${workspaceId}/members/${memberId}`);
export const deleteWorkspace = (workspaceId) =>
  api.delete(`/workspaces/${workspaceId}`);
