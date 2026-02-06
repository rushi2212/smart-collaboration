from pydantic import BaseModel
from typing import List

class Task(BaseModel):
    title: str
    priority: str
    status: str
    dueDate: str | None = None

class TaskList(BaseModel):
    tasks: List[Task]
