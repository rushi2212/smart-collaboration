from groq import Groq
import os
import json


def _get_client():
    return Groq(api_key=os.getenv("GROQ_API_KEY"))


def project_manager_agent(state):
    """AI Project Manager Agent that provides high-level decision guidance."""
    tasks = state.get("tasks", [])

    # Convert Task objects to dicts if needed
    if tasks and hasattr(tasks[0], 'title'):
        task_list = [{"title": t.title, "priority": t.priority,
                      "status": t.status, "dueDate": t.dueDate} for t in tasks]
    else:
        task_list = tasks

    prompt = f"""
You are an AI Project Manager providing high-level decision guidance.

Analyze this project:

Tasks Overview:
- Total: {len(task_list)}
- In Progress: {len([t for t in task_list if t.get('status') == 'inProgress'])}
- Todo: {len([t for t in task_list if t.get('status') == 'todo'])}
- Done: {len([t for t in task_list if t.get('status') == 'done'])}

Tasks:
{json.dumps(task_list, indent=2)}

Provide strategic project management guidance in JSON format:
{{
  "overall_health": "HEALTHY" | "AT_RISK" | "CRITICAL",
  "key_insights": ["insight 1", "insight 2", ...],
  "priority_actions": ["action 1", "action 2", ...],
  "resource_recommendations": ["recommendation 1", ...],
  "timeline_concerns": "any timeline concerns",
  "success_probability": 0.0-1.0,
  "next_steps": ["immediate next steps"]
}}

Focus on:
- Project health assessment
- Strategic priorities
- Resource allocation
- Risk mitigation
- Timeline optimization
"""

    try:
        client = _get_client()
        res = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=1000,
            response_format={"type": "json_object"}
        )

        result = json.loads(res.choices[0].message.content)
        return json.dumps(result)  # Return as JSON string for graph state
    except Exception as e:
        raise RuntimeError(f"Project manager analysis failed: {e}")
