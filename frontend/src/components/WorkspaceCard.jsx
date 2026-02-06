export default function WorkspaceCard({ workspace, onClick }) {
  return (
    <div
      className="p-4 border rounded shadow cursor-pointer hover:bg-gray-100"
      onClick={onClick}
    >
      <h2 className="font-semibold">{workspace.name}</h2>
      <p className="text-sm text-gray-500">
        Members: {workspace.members?.length || 0}
      </p>
    </div>
  );
}
