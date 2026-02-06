import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    name: String,
    description: String,
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Project", projectSchema);
