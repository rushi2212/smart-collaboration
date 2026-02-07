import os
import json
from groq import Groq


def _get_client():
    return Groq(api_key=os.getenv("GROQ_API_KEY"))


def risk_predictor(tasks):
    """Predict project risks based on task status using AI."""
    # Convert Task objects to dicts if needed
    if tasks and hasattr(tasks[0], 'title'):
        task_list = [{"title": t.title, "priority": t.priority,
                      "status": t.status, "dueDate": t.dueDate} for t in tasks]
    else:
        task_list = tasks

    pending_tasks = [t for t in task_list if t["status"] != "done"]
    in_progress = [t for t in task_list if t["status"] == "inProgress"]
    todo_tasks = [t for t in task_list if t["status"] == "todo"]
    high_priority = [t for t in task_list if t["priority"]
                     == "high" and t["status"] != "done"]

    prompt = f"""
You are an AI Risk Analyst for project management.

Analyze the following project data and identify risks:

Total tasks: {len(task_list)}
Pending tasks: {len(pending_tasks)}
In Progress: {len(in_progress)}
Todo: {len(todo_tasks)}
High priority pending: {len(high_priority)}

Tasks:
{json.dumps(task_list, indent=2)}

Provide a JSON response with:
{{
  "risk_level": "HIGH" | "MEDIUM" | "LOW",
  "confidence": 0.0-1.0,
  "risky_tasks": ["task titles that are at risk"],
  "bottlenecks": ["identified bottlenecks"],
  "recommendations": ["actionable recommendations"],
  "deadline_risks": "analysis of deadline-related risks"
}}
"""

    try:
        client = _get_client()
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=800,
            response_format={"type": "json_object"}
        )

        result = json.loads(completion.choices[0].message.content)
        return result
    except Exception as e:
        raise RuntimeError(f"Risk analysis failed: {e}")
