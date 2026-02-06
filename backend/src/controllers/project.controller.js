import Project from "../models/Project.js";

export const createProject = async (req, res) => {
  const project = await Project.create({
    name: req.body.name,
    description: req.body.description,
    workspaceId: req.body.workspaceId,
  });

  res.status(201).json(project);
};

export const getWorkspaceProjects = async (req, res) => {
  const projects = await Project.find({
    workspaceId: req.params.workspaceId,
  });

  res.json(projects);
};
