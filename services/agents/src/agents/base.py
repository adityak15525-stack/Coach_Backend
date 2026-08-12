from abc import ABC, abstractmethod
from typing import Any


class Agent(ABC):
    """Base class for swarm agents.

    Each agent has a role, a goal, and a memory hook so actions can be
    persisted to the `agent_memory` table for future reasoning.
    """

    role: str = "generic"
    goal: str = ""

    def __init__(self, verbose: bool = True):
        self.verbose = verbose

    @abstractmethod
    def run(self, context: dict[str, Any]) -> dict[str, Any]:
        ...

    def log(self, msg: str) -> None:
        if self.verbose:
            print(f"  [{self.role}] {msg}")

    def memorize(self, kind: str, payload: dict[str, Any]) -> dict[str, Any]:
        # In production this POSTs to the Express `/api/memory` endpoint
        # which writes into `agent_memory` (optionally embedding the JSON).
        self.log(f"memorized ({kind}): {str(payload)[:80]}...")
        return {"memorized": True, "kind": kind}
