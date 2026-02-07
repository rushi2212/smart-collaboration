from pydantic import BaseModel
from typing import List


class Task(BaseModel):
    id: str | None = None
    title: str
    priority: str | None = None
    status: str
    dueDate: str | None = None


class TaskList(BaseModel):
    tasks: List[Task]
