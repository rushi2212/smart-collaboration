import os
from dotenv import load_dotenv

# Load .env BEFORE any app imports that use env vars
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from app.schemas import TaskList  # noqa: E402
from app.services.llm import prioritize_tasks  # noqa: E402
from app.graph import run_graph  # noqa: E402


app = FastAPI(title="AI Collaboration Service (Groq)")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "service": "AI Collaboration Service",
        "status": "running",
        "features": [
            "Task Prioritization",
            "Risk Prediction",
            "Timeline Optimization",
            "Workload Balancing",
            "Agentic Analysis"
        ]
    }


@app.post("/ai/prioritize-tasks")
def ai_prioritize_tasks(data: TaskList):
    result = prioritize_tasks(data.tasks)
    return {"result": result}


@app.post("/ai/agentic-analysis")
def agentic_analysis(data: TaskList):
    result = run_graph({"tasks": data.tasks})
    return result
