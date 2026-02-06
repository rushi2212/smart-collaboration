import Workspace from "../models/Workspace.js";

export const createWorkspace = async (req, res) => {
  const workspace = await Workspace.create({
    name: req.body.name,
    owner: req.user.id,
    members: [req.user.id],
  });
  res.status(201).json(workspace);
};

export const getUserWorkspaces = async (req, res) => {
  const workspaces = await Workspace.find({
    members: req.user.id,
  })
    .populate("owner", "name email")
    .populate("members", "_id name email");

  res.json(workspaces);
};

export const addMember = async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.params.id);

    if (!workspace)
      return res.status(404).json({ message: "Workspace not found" });

    // Check if user is already a member (compare ObjectIds as strings)
    const isMember = workspace.members.some(
      (memberId) => memberId.toString() === req.body.userId,
    );

    if (!isMember) {
      workspace.members.push(req.body.userId);
      await workspace.save();
    }

    res.json(workspace);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteWorkspace = async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.params.id);

    if (!workspace)
      return res.status(404).json({ message: "Workspace not found" });

    // Check if user is the owner
    if (workspace.owner.toString() !== req.user.id)
      return res
        .status(403)
        .json({ message: "Only the owner can delete this workspace" });

    await Workspace.findByIdAndDelete(req.params.id);
    res.json({ message: "Workspace deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
