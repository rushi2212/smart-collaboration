# AI-Powered Smart Collaboration Platform

A full-stack real-time collaboration platform with AI-driven project management, featuring task prioritization, risk analysis, video meetings, and team chat.

## Tech Stack

### Frontend
- **React 19** with Vite
- **Tailwind CSS** for styling
- **Socket.IO Client** for real-time communication
- **WebRTC** for video meetings

### Backend
- **Node.js** with Express
- **MongoDB** with Mongoose
- **Socket.IO** for real-time events
- **JWT** for authentication

### AI Service
- **FastAPI** (Python)
- **LangGraph** for agentic AI workflows
- **Groq API** (LLaMA 3.3 70B) for LLM inference

## Features

- **Workspace Management** — Create workspaces, invite members, manage teams
- **Kanban Board** — Drag-and-drop task management with todo/in-progress/done columns
- **AI Task Prioritization** — AI reorders tasks based on urgency, priority, and deadlines
- **AI Agentic Analysis** — Multi-agent system providing:
  - Project Manager insights & health assessment
  - Risk prediction & mitigation recommendations
  - Timeline optimization & parallelization suggestions
  - Workload balancing across team members
- **Real-time Chat** — Project-scoped messaging with Socket.IO
- **Video Meetings** — WebRTC-powered video conferencing with screen sharing
- **Authentication** — JWT-based login & registration

## Project Structure

```
├── frontend/          # React + Vite frontend
├── backend/           # Node.js + Express API server
├── ai-service/        # FastAPI AI service with LangGraph
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+
- MongoDB
- Groq API key

### 1. Backend Setup

```bash
cd backend
npm install
```

Create `backend/.env`:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/smart-collaboration
JWT_SECRET=your_jwt_secret
```

```bash
npm run dev
```

### 2. AI Service Setup

```bash
cd ai-service
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

Create `ai-service/.env`:
```env
GROQ_API_KEY=your_groq_api_key
```

```bash
uvicorn app.main:app --reload
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The app runs at `http://localhost:5173` by default.

## API Endpoints

### Auth
- `POST /api/auth/register` — Register a new user
- `POST /api/auth/login` — Login

### Workspaces
- `GET /api/workspaces` — Get user's workspaces
- `POST /api/workspaces` — Create workspace
- `POST /api/workspaces/:id/members` — Add member
- `DELETE /api/workspaces/:id/members/:memberId` — Remove member
- `DELETE /api/workspaces/:id` — Delete workspace

### Tasks
- `GET /api/tasks/:projectId` — Get project tasks
- `POST /api/tasks` — Create task
- `PATCH /api/tasks/:id` — Update task

### AI
- `POST /api/ai/prioritize` — AI task prioritization
- `POST /api/ai/agentic` — Multi-agent AI analysis

### Chat
- `GET /api/chat/:projectId` — Get messages
- `POST /api/chat` — Send message

## License

ISC
