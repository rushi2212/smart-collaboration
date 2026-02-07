import { useState } from "react";
import { updateTaskStatus, deleteTask } from "../api/task.api";

export default function TaskCard({ task }) {
  const [showMenu, setShowMenu] = useState(false);
  const [updating, setUpdating] = useState(false);

  const priorityColors = {
    low: "bg-blue-100 text-blue-800 border-blue-200",
    medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
    high: "bg-red-100 text-red-800 border-red-200",
    unassigned: "bg-gray-100 text-gray-700 border-gray-200",
  };

  const statuses = [
    { value: "todo", label: "To Do", color: "text-gray-600" },
    { value: "inProgress", label: "In Progress", color: "text-blue-600" },
    { value: "done", label: "Done", color: "text-green-600" },
  ];

  const handleStatusChange = async (newStatus) => {
    if (newStatus === task.status) {
      setShowMenu(false);
      return;
    }

    setUpdating(true);
    try {
      await updateTaskStatus(task._id, newStatus);
      setShowMenu(false);
      // The socket event will update the UI
    } catch (error) {
      console.error("Error updating task:", error);
      alert("Failed to update task status");
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this task?")) {
      return;
    }

    setUpdating(true);
    try {
      await deleteTask(task._id);
      setShowMenu(false);
      // The socket event will update the UI
    } catch (error) {
      console.error("Error deleting task:", error);
      alert("Failed to delete task");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 p-4 mb-3 border-l-4 border-blue-500 relative">
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-gray-900 flex-1">{task.title}</h3>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="text-gray-400 hover:text-gray-600 transition-colors p-1"
          disabled={updating}
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
              d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
            />
          </svg>
        </button>
      </div>

      <div className="flex items-center justify-between">
        <span
          className={`text-xs font-semibold px-3 py-1 rounded-full border ${priorityColors[task.priority || "unassigned"]}`}
        >
          {task.priority || "unassigned"}
        </span>
      </div>

      {/* Status Change Menu */}
      {showMenu && (
        <div className="absolute right-2 top-12 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-20 min-w-40">
          <div className="px-3 py-1 text-xs font-semibold text-gray-500 border-b border-gray-200">
            Move to:
          </div>
          {statuses
            .filter((s) => s.value !== task.status)
            .map((status) => (
              <button
                key={status.value}
                onClick={() => handleStatusChange(status.value)}
                disabled={updating}
                className={`w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors ${status.color} font-medium text-sm disabled:opacity-50`}
              >
                {status.label}
              </button>
            ))}
          <div className="border-t border-gray-200 mt-2 pt-2">
            <button
              onClick={handleDelete}
              disabled={updating}
              className="w-full text-left px-4 py-2 hover:bg-red-50 transition-colors text-red-600 font-medium text-sm disabled:opacity-50 flex items-center space-x-2"
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
              <span>Delete Task</span>
            </button>
          </div>
        </div>
      )}

      {/* Click outside to close menu */}
      {showMenu && (
        <div className="fixed inset-0 z-0" onClick={() => setShowMenu(false)} />
      )}
    </div>
  );
}
