import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getWorkspaces,
  createWorkspace,
  addWorkspaceMember,
  removeWorkspaceMember,
  deleteWorkspace,
} from "../api/workspace.api";
import { getUsers } from "../api/user.api";
import Navbar from "../components/Navbar";

export default function Dashboard() {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [workspaceName, setWorkspaceName] = useState("");
  const [creating, setCreating] = useState(false);
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [adding, setAdding] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
      return;
    }

    loadWorkspaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const loadWorkspaces = () => {
    getWorkspaces()
      .then((res) => setWorkspaces(res.data))
      .catch((error) => {
        console.error("Error loading workspaces:", error);
        if (error.response?.status === 401) {
          localStorage.removeItem("token");
          navigate("/");
        }
      })
      .finally(() => setLoading(false));
  };

  const refreshWorkspaces = async (workspaceId) => {
    const res = await getWorkspaces();
    setWorkspaces(res.data);
    if (workspaceId) {
      const updated = res.data.find((w) => w._id === workspaceId) || null;
      setSelectedWorkspace(updated);
    }
  };

  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
    if (!workspaceName.trim()) return;

    setCreating(true);
    try {
      await createWorkspace({ name: workspaceName });
      setWorkspaceName("");
      setShowModal(false);
      loadWorkspaces();
    } catch (err) {
      console.error("Create workspace error:", err);
      alert("Failed to create workspace. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const openMembersModal = async (workspace) => {
    setSelectedWorkspace(workspace);
    setShowMembersModal(true);
    try {
      const response = await getUsers();
      setUsers(response);
    } catch (err) {
      console.error("Error loading users:", err);
    }
  };

  const handleAddMember = async (userId) => {
    if (!selectedWorkspace) return;

    setAdding(true);
    try {
      await addWorkspaceMember(selectedWorkspace._id, userId);
      alert("Member added successfully!");
      await refreshWorkspaces(selectedWorkspace._id);
    } catch (error) {
      alert(error.response?.data?.message || "Failed to add member");
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!selectedWorkspace) return;

    if (!window.confirm("Remove this member from the workspace?")) {
      return;
    }

    setAdding(true);
    try {
      await removeWorkspaceMember(selectedWorkspace._id, memberId);
      await refreshWorkspaces(selectedWorkspace._id);
    } catch (error) {
      alert(error.response?.data?.message || "Failed to remove member");
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteWorkspace = async (workspaceId, e) => {
    e.stopPropagation();
    if (
      !window.confirm(
        "Are you sure you want to delete this workspace? This action cannot be undone.",
      )
    ) {
      return;
    }

    try {
      await deleteWorkspace(workspaceId);
      alert("Workspace deleted successfully!");
      loadWorkspaces();
    } catch (error) {
      alert(error.response?.data?.message || "Failed to delete workspace");
    }
  };

  const currentUserId = localStorage.getItem("userId") || "";

  const filteredUsers = users.filter((user) => {
    // Exclude current user
    if (user._id === currentUserId) return false;

    // Exclude already added members (check both populated and non-populated formats)
    const memberIds =
      selectedWorkspace?.members?.map((m) =>
        typeof m === "string" ? m : m._id,
      ) || [];
    if (memberIds.includes(user._id)) return false;

    // Filter by search term
    const matchesSearch =
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  const workspaceMembers = selectedWorkspace?.members || [];
  const isOwner = selectedWorkspace?.owner?._id === currentUserId;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Header */}
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
              Your Workspaces
            </h1>
            <p className="text-gray-600 text-base sm:text-lg">
              Select a workspace to start collaborating
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold px-6 py-3 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center justify-center space-x-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            <span>Create Workspace</span>
          </button>
        </div>

        {/* Workspaces Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <svg
              className="animate-spin h-12 w-12 text-blue-600"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        ) : workspaces.length === 0 ? (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-24 w-24 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
            <h3 className="mt-4 text-xl font-semibold text-gray-900">
              No workspaces yet
            </h3>
            <p className="mt-2 text-gray-600 mb-6">
              Get started by creating your first workspace
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold px-8 py-3 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl inline-flex items-center space-x-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              <span>Create Your First Workspace</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workspaces.map((w) => (
              <div
                key={w._id}
                className="group bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-200 overflow-hidden"
              >
                <div
                  className="p-5 cursor-pointer"
                  onClick={() => navigate(`/project/${w._id}`)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                        />
                      </svg>
                    </div>
                    <svg
                      className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                    {w.name}
                  </h3>
                  <p className="text-gray-500 text-xs">
                    {w.members?.length || 1} member
                    {(w.members?.length || 1) > 1 ? "s" : ""}
                  </p>
                </div>
                {w.owner?._id === currentUserId && (
                  <div className="px-5 pb-4 flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openMembersModal(w);
                      }}
                      className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-1.5 px-3 rounded-lg transition-colors flex items-center justify-center space-x-1 text-sm"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                      <span>Members</span>
                    </button>
                    <button
                      onClick={(e) => handleDeleteWorkspace(w._id, e)}
                      className="bg-red-100 hover:bg-red-200 text-red-700 font-medium py-1.5 px-3 rounded-lg transition-colors flex items-center justify-center text-sm"
                      title="Delete Workspace"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                )}
                <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Workspace Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 transform transition-all">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                Create Workspace
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateWorkspace}>
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Workspace Name
                </label>
                <input
                  type="text"
                  placeholder="Enter workspace name"
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 outline-none"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold px-6 py-3 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Members Modal */}
      {showMembersModal && selectedWorkspace && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-8 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  Add Members to {selectedWorkspace.name}
                </h2>
                <button
                  onClick={() => setShowMembersModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <input
                type="text"
                placeholder="Search users by name or email..."
                className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="p-8 overflow-y-auto max-h-96 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Current Members
                </h3>
                {workspaceMembers.length === 0 ? (
                  <p className="text-sm text-gray-500">No members found.</p>
                ) : (
                  <div className="space-y-3">
                    {workspaceMembers.map((member) => (
                      <div
                        key={member._id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold">
                            {member.name?.charAt(0).toUpperCase() || "U"}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">
                              {member.name}
                              {selectedWorkspace?.owner?._id === member._id && (
                                <span className="ml-2 text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                  Owner
                                </span>
                              )}
                            </p>
                            <p className="text-sm text-gray-600">
                              {member.email}
                            </p>
                          </div>
                        </div>
                        {isOwner &&
                          member._id !== selectedWorkspace?.owner?._id && (
                            <button
                              onClick={() => handleRemoveMember(member._id)}
                              disabled={adding}
                              className="text-red-600 hover:text-red-700 font-semibold px-3 py-2 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Remove
                            </button>
                          )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {filteredUsers.length === 0 ? (
                <div className="text-center py-8">
                  <svg
                    className="mx-auto h-16 w-16 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                  <p className="mt-4 text-gray-600">No users found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredUsers.map((user) => (
                    <div
                      key={user._id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold">
                          {user.name?.charAt(0).toUpperCase() || "U"}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {user.name}
                          </p>
                          <p className="text-sm text-gray-600">{user.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleAddMember(user._id)}
                        disabled={adding}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold px-4 py-2 rounded-lg transition-all duration-300 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
