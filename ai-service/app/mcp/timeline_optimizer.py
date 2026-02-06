import os
import json
from groq import Groq
from datetime import datetime

client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def timeline_optimizer(tasks):
    """Optimize task timeline based on deadlines and dependencies using AI."""
    # Convert Task objects to dicts
    task_list = [{"title": t.title, "priority": t.priority,
                  "status": t.status, "dueDate": t.dueDate} for t in tasks]

    prompt = f"""
You are an AI Timeline Optimizer for project management.

Analyze these tasks and suggest timeline optimizations:

Tasks:
{json.dumps(task_list, indent=2)}

Provide a JSON response with:
{{
  "parallel_tasks": ["tasks that can be done in parallel"],
  "sequential_tasks": ["tasks that must be done in sequence"],
  "quick_wins": ["tasks that can be completed quickly"],
  "time_saving_suggestions": ["specific suggestions to save time"],
  "estimated_completion": "estimated timeline",
  "optimized": true
}}

Focus on:
- Identifying tasks that can run in parallel
- Suggesting task splitting for better efficiency
- Prioritizing near-deadline tasks
- Recommending workflow improvements
"""

    try:
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=800,
            response_format={"type": "json_object"}
        )

        result = json.loads(completion.choices[0].message.content)
        return result
    except Exception as e:
        # Fallback to basic suggestions
        return {
            "parallel_tasks": ["Tasks can be parallelized for efficiency"],
            "sequential_tasks": ["High priority tasks should be completed first"],
            "quick_wins": [t["title"] for t in task_list if t["priority"] == "low"][:2],
            "time_saving_suggestions": [
                "Split large tasks into smaller subtasks",
                "Parallelize independent work streams",
                "Focus on near-deadline items first"
            ],
            "estimated_completion": "Pending AI analysis",
            "optimized": False,
            "error": str(e)
        }
