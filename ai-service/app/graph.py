from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, START, END
from app.agents.project_manager import project_manager_agent
from app.mcp.timeline_optimizer import timeline_optimizer
from app.mcp.risk_predictor import risk_predictor
from app.mcp.workload_allocator import workload_allocator


class GraphState(TypedDict):
    tasks: list
    pm_analysis: str
    timeline_suggestions: dict
    risk_analysis: dict
    workload_analysis: dict


def pm_node(state: GraphState) -> GraphState:
    """Project Manager Agent Node"""
    analysis = project_manager_agent(state)
    return {"pm_analysis": analysis}


def timeline_node(state: GraphState) -> GraphState:
    """Timeline Optimizer Node"""
    suggestions = timeline_optimizer(state.get("tasks", []))
    return {"timeline_suggestions": suggestions}


def risk_node(state: GraphState) -> GraphState:
    """Risk Predictor Node"""
    risks = risk_predictor(state.get("tasks", []))
    return {"risk_analysis": risks}


def workload_node(state: GraphState) -> GraphState:
    """Workload Allocator Node"""
    workload = workload_allocator(state.get("tasks", []))
    return {"workload_analysis": workload}


def run_graph(data):
    """Run the AI agent workflow graph"""
    workflow = StateGraph(GraphState)

    # Add all nodes
    workflow.add_node("pm_agent", pm_node)
    workflow.add_node("timeline", timeline_node)
    workflow.add_node("risk", risk_node)
    workflow.add_node("workload", workload_node)

    # Define workflow: PM Agent -> parallel analysis -> END
    workflow.add_edge(START, "pm_agent")
    workflow.add_edge("pm_agent", "timeline")
    workflow.add_edge("pm_agent", "risk")
    workflow.add_edge("pm_agent", "workload")
    workflow.add_edge("timeline", END)
    workflow.add_edge("risk", END)
    workflow.add_edge("workload", END)

    app = workflow.compile()

    result = app.invoke(data)
    return result
