import api from "./axios";

export const getProjects = (workspaceId) =>
  api.get(`/projects/${workspaceId}`);

export const createProject = (data) =>
  api.post("/projects", data);
