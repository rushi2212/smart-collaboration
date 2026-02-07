import KanbanColumn from "./KanbanColumn";

export default function KanbanBoard({ tasks, moveTask }) {
  return (
    <div className="flex gap-6 overflow-x-auto overflow-y-visible pb-4">
      <KanbanColumn
        title="Todo"
        tasks={tasks.filter((t) => t.status === "todo")}
        onMove={(task) => moveTask && moveTask(task, "inProgress")}
      />

      <KanbanColumn
        title="In Progress"
        tasks={tasks.filter((t) => t.status === "inProgress")}
        onMove={(task) => moveTask && moveTask(task, "done")}
      />

      <KanbanColumn
        title="Done"
        tasks={tasks.filter((t) => t.status === "done")}
        onMove={() => {}}
      />
    </div>
  );
}
