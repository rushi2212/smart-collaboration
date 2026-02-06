from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.schemas import TaskList
from app.services.llm import prioritize_tasks
from app.graph import run_graph

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
