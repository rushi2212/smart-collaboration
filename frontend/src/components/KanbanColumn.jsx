import TaskCard from "./TaskCard";

export default function KanbanColumn({ title, tasks, onMove }) {
  const statusColors = {
    Todo: "from-purple-500 to-pink-500",
    "In Progress": "from-blue-500 to-cyan-500",
    Done: "from-emerald-500 to-teal-500",
  };

  return (
    <div className="flex-1 min-w-[280px] md:min-w-[300px]">
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-visible">
        <div
          className={`bg-gradient-to-r ${statusColors[title] || "from-gray-500 to-gray-600"} px-4 py-3`}
        >
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-white text-base sm:text-lg">
              {title}
            </h2>
            <span className="bg-white/30 backdrop-blur-sm text-white text-xs sm:text-sm font-semibold px-2 sm:px-3 py-1 rounded-full">
              {tasks.length}
            </span>
          </div>
        </div>
        <div className="p-3 sm:p-4 bg-gray-50 min-h-[400px] space-y-3">
          {tasks.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <svg
                className="w-12 h-12 mx-auto mb-2 opacity-50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="text-sm">No tasks</p>
            </div>
          ) : (
            tasks.map((task) => (
              <div key={task._id} onClick={() => onMove(task)}>
                <TaskCard task={task} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
