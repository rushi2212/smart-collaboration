import os
import json
from groq import Groq

client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def workload_allocator(tasks, team=None):
    """Allocate workload across team members using AI."""
    # Convert Task objects to dicts
    task_list = [{"title": t.title, "priority": t.priority,
                  "status": t.status, "dueDate": t.dueDate} for t in tasks]

    pending_tasks = [t for t in task_list if t["status"] != "done"]

    prompt = f"""
You are an AI Workload Allocation Expert for project management.

Analyze the workload distribution for these tasks:

Total tasks: {len(task_list)}
Pending tasks: {len(pending_tasks)}

Tasks:
{json.dumps(task_list, indent=2)}

Provide a JSON response with:
{{
  "workload_balance": "BALANCED" | "OVERLOADED" | "UNDERUTILIZED",
  "distribution_strategy": "recommended strategy",
  "task_grouping": [["related tasks that should go to same person"]],
  "recommendations": ["specific recommendations for fair distribution"],
  "warning_flags": ["any workload concerns"]
}}

Consider:
- Fair distribution of high-priority tasks
- Balancing different task types
- Avoiding single points of failure
- Skill requirements and task complexity
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
        # Fallback to basic allocation
        return {
            "workload_balance": "UNKNOWN",
            "distribution_strategy": "Distribute tasks evenly across team members",
            "task_grouping": [],
            "recommendations": [
                "Assign high-priority tasks to experienced members",
                "Balance workload to prevent burnout",
                "Group related tasks together"
            ],
            "warning_flags": ["AI analysis unavailable"],
            "error": str(e)
        }
