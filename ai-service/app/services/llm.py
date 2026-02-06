import os
import json
from groq import Groq

client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def prioritize_tasks(tasks):
    # Convert Task objects to dicts for the prompt
    task_list = [{"title": t.title, "priority": t.priority,
                  "status": t.status, "dueDate": t.dueDate} for t in tasks]

    prompt = f"""
You are an AI project manager. Reorder the following tasks based on urgency, priority, due dates, and current status.

Tasks:
{json.dumps(task_list, indent=2)}

Return ONLY a JSON array of the reordered tasks with a brief reasoning field added. Use this exact format:
[
  {{"title": "task name", "priority": "high", "status": "inProgress", "dueDate": null, "reasoning": "brief reason"}},
  ...
]

Rules:
- Prioritize tasks that are inProgress over todo
- High priority over medium over low
- Earlier due dates first
- Return valid JSON only, no extra text
"""

    completion = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "user", "content": prompt}
        ],
        temperature=0.3,
        max_tokens=1000,
        response_format={"type": "json_object"}
    )

    response_text = completion.choices[0].message.content

    # Parse JSON response
    try:
        result = json.loads(response_text)
        # If the response is wrapped in an object, extract the array
        if isinstance(result, dict) and "tasks" in result:
            return result["tasks"]
        elif isinstance(result, list):
            return result
        else:
            return result
    except json.JSONDecodeError:
        # Fallback: return original task order if parsing fails
        return task_list
