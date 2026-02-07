import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import socket from "../socket/socket";
import KanbanBoard from "../components/KanbanBoard";
import { getTasks, createTask, updateTaskPriority } from "../api/task.api";
import { getMessages, sendMessage as sendMessageAPI } from "../api/chat.api";
import { prioritizeTasks, agenticAnalysis } from "../api/ai.api";
import Navbar from "../components/Navbar";

export default function Project() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [showAiPanel, setShowAiPanel] = useState(false);

  useEffect(() => {
    // Join socket room
    socket.emit("joinRoom", { roomId: projectId });

    // Load initial data
    getTasks(projectId).then((res) => setTasks(res.data));
    getMessages(projectId)
      .then((res) => setMessages(res.data))
      .catch(console.error);

    // Socket listeners
    socket.on("taskCreated", (task) => setTasks((prev) => [...prev, task]));
    socket.on("taskUpdated", (updatedTask) => {
      setTasks((prev) =>
        prev.map((t) => (t._id === updatedTask._id ? updatedTask : t)),
      );
    });
    socket.on("taskDeleted", (taskId) => {
      setTasks((prev) => prev.filter((t) => t._id !== taskId));
    });
    socket.on("receiveMessage", (msg) => setMessages((prev) => [...prev, msg]));

    return () => {
      socket.off("taskCreated");
      socket.off("taskUpdated");
      socket.off("taskDeleted");
      socket.off("receiveMessage");
    };
  }, [projectId]);

  const addTask = async () => {
    if (!title.trim()) return;
    await createTask({
      title,
      projectId,
      status: "todo",
      dueDate: dueDate || undefined,
    });
    setTitle("");
    setDueDate("");
  };

  const sendMessage = async () => {
    if (!text.trim()) return;

    try {
      await sendMessageAPI({ content: text, projectId });
      // Don't add to local state - socket event will handle it
      setText("");
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message");
    }
  };

  const handlePrioritizeTasks = async () => {
    if (tasks.length === 0) {
      alert("No tasks to prioritize");
      return;
    }

    setAiLoading(true);
    setShowAiPanel(true);
    setAiResult(null);
    try {
      const aiPayload = tasks.map((task) => ({
        id: task._id,
        title: task.title,
        status: task.status,
        priority: task.priority || null,
        dueDate: task.dueDate || null,
      }));

      const result = await prioritizeTasks(aiPayload);
      const responsePayload = result.result || result;
      const prioritizedList = Array.isArray(responsePayload)
        ? responsePayload
        : Array.isArray(responsePayload?.tasks)
          ? responsePayload.tasks
          : Array.isArray(result.tasks)
            ? result.tasks
            : [];

      const priorityById = new Map(
        prioritizedList
          .filter((task) => task.id)
          .map((task) => [task.id, task.priority || null]),
      );

      const updatedTasks = tasks.map((task) =>
        priorityById.has(task._id)
          ? { ...task, priority: priorityById.get(task._id) }
          : task,
      );

      const orderedIds = prioritizedList.map((task) => task.id).filter(Boolean);
      const orderedTasks = orderedIds
        .map((id) => updatedTasks.find((task) => task._id === id))
        .filter(Boolean);
      const remainingTasks = updatedTasks.filter(
        (task) => !orderedIds.includes(task._id),
      );

      setTasks([...orderedTasks, ...remainingTasks]);
      await Promise.all(
        prioritizedList
          .filter((task) => task.id && task.priority)
          .map((task) => updateTaskPriority(task.id, task.priority)),
      );

      setAiResult({ type: "prioritize", data: result });
    } catch (error) {
      console.error("Error with AI prioritization:", error);
      alert("Failed to get AI prioritization");
      setAiResult({ type: "error", message: "AI prioritization failed." });
    } finally {
      setAiLoading(false);
    }
  };

  const handleAgenticAnalysis = async () => {
    if (tasks.length === 0) {
      alert("No tasks to analyze");
      return;
    }

    setAiLoading(true);
    setShowAiPanel(true);
    setAiResult(null);
    try {
      const result = await agenticAnalysis(tasks);
      setAiResult({ type: "agentic", data: result });
    } catch (error) {
      console.error("Error with AI analysis:", error);
      alert("Failed to get AI analysis");
      setAiResult({ type: "error", message: "AI analysis failed." });
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-blue-50 to-indigo-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with AI Buttons */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Project Board
            </h1>
            <p className="text-gray-600 text-lg">
              Manage tasks and collaborate with your team
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate(`/meeting/${projectId}`)}
              className="bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold px-6 py-3 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center space-x-2"
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
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <span>Join Meeting</span>
            </button>
            <button
              onClick={handlePrioritizeTasks}
              disabled={aiLoading}
              className="bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold px-6 py-3 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              <span>AI Prioritize</span>
            </button>
            <button
              onClick={handleAgenticAnalysis}
              disabled={aiLoading}
              className="bg-linear-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white font-semibold px-6 py-3 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
              <span>AI Analysis</span>
            </button>
          </div>
        </div>

        {/* AI Results Panel */}
        {showAiPanel && (
          <div className="bg-linear-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl shadow-lg p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center">
                <svg
                  className="w-6 h-6 mr-2 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                AI Insights
              </h2>
              <button
                onClick={() => setShowAiPanel(false)}
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
            {aiLoading ? (
              <div className="flex items-center justify-center py-8">
                <svg
                  className="animate-spin h-10 w-10 text-purple-600"
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
                <span className="ml-3 text-lg font-semibold text-gray-700">
                  AI is thinking...
                </span>
              </div>
            ) : aiResult ? (
              <div className="space-y-4">
                {aiResult.type === "error" ? (
                  <div className="bg-white rounded-lg p-4 border border-red-200">
                    <p className="text-sm text-red-700 font-semibold">
                      {aiResult.message}
                    </p>
                  </div>
                ) : null}
                {aiResult.type === "prioritize" ? (
                  <div>
                    <h3 className="font-semibold text-lg text-gray-900 mb-3">
                      📋 Task Prioritization Results
                    </h3>
                    <div className="bg-white rounded-lg p-4 space-y-2">
                      {Array.isArray(aiResult.data.result || aiResult.data) ? (
                        (aiResult.data.result || aiResult.data).map(
                          (task, idx) => (
                            <div
                              key={idx}
                              className="border-l-4 border-blue-500 bg-blue-50 p-3 rounded"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-gray-900">
                                  {idx + 1}. {task.title}
                                </span>
                                <span
                                  className={`text-xs px-2 py-1 rounded ${
                                    task.priority === "high"
                                      ? "bg-red-100 text-red-800"
                                      : task.priority === "medium"
                                        ? "bg-yellow-100 text-yellow-800"
                                        : task.priority === "low"
                                          ? "bg-blue-100 text-blue-800"
                                          : "bg-gray-100 text-gray-700"
                                  }`}
                                >
                                  {task.priority || "unassigned"}
                                </span>
                              </div>
                              {task.reasoning && (
                                <p className="text-sm text-gray-600 mt-1">
                                  💡 {task.reasoning}
                                </p>
                              )}
                            </div>
                          ),
                        )
                      ) : (
                        <pre className="text-sm text-gray-800 whitespace-pre-wrap">
                          {JSON.stringify(aiResult.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                ) : aiResult.type === "agentic" ? (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg text-gray-900 mb-3">
                      🤖 AI Project Manager Analysis
                    </h3>

                    {/* Project Manager Analysis */}
                    {aiResult.data.pm_analysis && (
                      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4">
                        <h4 className="font-semibold text-purple-900 mb-2 flex items-center">
                          <svg
                            className="w-5 h-5 mr-2"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                          </svg>
                          Project Manager Insights
                        </h4>
                        <div className="text-sm text-gray-700">
                          {typeof aiResult.data.pm_analysis === "string" ? (
                            (() => {
                              try {
                                const parsed = JSON.parse(
                                  aiResult.data.pm_analysis,
                                );
                                return (
                                  <div className="space-y-2">
                                    {parsed.overall_health && (
                                      <p>
                                        <strong>Health:</strong>{" "}
                                        <span
                                          className={
                                            parsed.overall_health === "HEALTHY"
                                              ? "text-green-600"
                                              : parsed.overall_health ===
                                                  "AT_RISK"
                                                ? "text-yellow-600"
                                                : "text-red-600"
                                          }
                                        >
                                          {parsed.overall_health}
                                        </span>
                                      </p>
                                    )}
                                    {parsed.key_insights && (
                                      <div>
                                        <strong>Key Insights:</strong>
                                        <ul className="list-disc list-inside ml-2">
                                          {parsed.key_insights.map(
                                            (insight, i) => (
                                              <li key={i}>{insight}</li>
                                            ),
                                          )}
                                        </ul>
                                      </div>
                                    )}
                                    {parsed.priority_actions && (
                                      <div>
                                        <strong>Priority Actions:</strong>
                                        <ul className="list-disc list-inside ml-2">
                                          {parsed.priority_actions.map(
                                            (action, i) => (
                                              <li key={i}>{action}</li>
                                            ),
                                          )}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                );
                              } catch {
                                return <p>{aiResult.data.pm_analysis}</p>;
                              }
                            })()
                          ) : (
                            <pre className="whitespace-pre-wrap">
                              {JSON.stringify(
                                aiResult.data.pm_analysis,
                                null,
                                2,
                              )}
                            </pre>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Risk Analysis */}
                    {aiResult.data.risk_analysis && (
                      <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-lg p-4">
                        <h4 className="font-semibold text-red-900 mb-2 flex items-center">
                          <svg
                            className="w-5 h-5 mr-2"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Risk Prediction
                        </h4>
                        <div className="text-sm text-gray-700 space-y-2">
                          <p>
                            <strong>Risk Level:</strong>{" "}
                            <span
                              className={
                                aiResult.data.risk_analysis.risk_level ===
                                "HIGH"
                                  ? "text-red-600 font-bold"
                                  : aiResult.data.risk_analysis.risk_level ===
                                      "MEDIUM"
                                    ? "text-yellow-600 font-bold"
                                    : "text-green-600 font-bold"
                              }
                            >
                              {aiResult.data.risk_analysis.risk_level}
                            </span>
                          </p>
                          {aiResult.data.risk_analysis.deadline_risks && (
                            <p>
                              <strong>Deadline Risks:</strong>{" "}
                              {aiResult.data.risk_analysis.deadline_risks}
                            </p>
                          )}
                          {aiResult.data.risk_analysis.recommendations && (
                            <div>
                              <strong>Recommendations:</strong>
                              <ul className="list-disc list-inside ml-2">
                                {aiResult.data.risk_analysis.recommendations.map(
                                  (rec, i) => (
                                    <li key={i}>{rec}</li>
                                  ),
                                )}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Timeline Suggestions */}
                    {aiResult.data.timeline_suggestions && (
                      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-4">
                        <h4 className="font-semibold text-blue-900 mb-2 flex items-center">
                          <svg
                            className="w-5 h-5 mr-2"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Timeline Optimization
                        </h4>
                        <div className="text-sm text-gray-700 space-y-2">
                          {aiResult.data.timeline_suggestions
                            .time_saving_suggestions && (
                            <div>
                              <strong>Time-Saving Suggestions:</strong>
                              <ul className="list-disc list-inside ml-2">
                                {aiResult.data.timeline_suggestions.time_saving_suggestions.map(
                                  (sug, i) => (
                                    <li key={i}>{sug}</li>
                                  ),
                                )}
                              </ul>
                            </div>
                          )}
                          {aiResult.data.timeline_suggestions
                            .parallel_tasks && (
                            <div>
                              <strong>Can Be Parallelized:</strong>
                              <ul className="list-disc list-inside ml-2">
                                {aiResult.data.timeline_suggestions.parallel_tasks.map(
                                  (task, i) => (
                                    <li key={i}>{task}</li>
                                  ),
                                )}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Workload Analysis */}
                    {aiResult.data.workload_analysis && (
                      <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-lg p-4">
                        <h4 className="font-semibold text-green-900 mb-2 flex items-center">
                          <svg
                            className="w-5 h-5 mr-2"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                          </svg>
                          Workload Balancing
                        </h4>
                        <div className="text-sm text-gray-700 space-y-2">
                          <p>
                            <strong>Balance Status:</strong>{" "}
                            {aiResult.data.workload_analysis.workload_balance}
                          </p>
                          {aiResult.data.workload_analysis.recommendations && (
                            <div>
                              <strong>Recommendations:</strong>
                              <ul className="list-disc list-inside ml-2">
                                {aiResult.data.workload_analysis.recommendations.map(
                                  (rec, i) => (
                                    <li key={i}>{rec}</li>
                                  ),
                                )}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}

        {/* Task Creation */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <svg
              className="w-5 h-5 mr-2 text-blue-600"
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
            Add New Task
          </h2>
          <div className="flex gap-3">
            <input
              className="flex-1 px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 outline-none"
              placeholder="Enter task title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && addTask()}
            />
            <input
              type="date"
              className="px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 outline-none text-gray-700"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              title="Due date"
            />
            <button
              onClick={addTask}
              className="bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold px-8 py-3 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center space-x-2"
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
              <span>Add</span>
            </button>
          </div>
        </div>

        {/* Kanban Board */}
        <KanbanBoard tasks={tasks} />

        {/* Chat Section */}
        <div className="mt-8 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="bg-linear-to-r from-emerald-500 to-teal-600 px-6 py-4">
            <h2 className="text-xl font-bold text-white flex items-center">
              <svg
                className="w-6 h-6 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              Project Chat
            </h2>
          </div>

          <div className="p-6">
            <div className="bg-gray-50 rounded-lg h-64 p-4 overflow-y-auto mb-4 space-y-3">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((m, i) => (
                  <div
                    key={m._id || i}
                    className="bg-white rounded-lg px-4 py-3 shadow-sm border border-gray-200"
                  >
                    {m.sender && (
                      <p className="text-xs font-semibold text-blue-600 mb-1">
                        {m.sender.name || "Unknown User"}
                      </p>
                    )}
                    <p className="text-gray-800">{m.content}</p>
                    {m.createdAt && (
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(m.createdAt).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-3">
              <input
                className="flex-1 px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition-all duration-200 outline-none"
                placeholder="Type your message..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && sendMessage()}
              />
              <button
                onClick={sendMessage}
                className="bg-linear-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold px-8 py-3 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center space-x-2"
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
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
                <span>Send</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
