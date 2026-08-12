"""Swarm orchestrator — wires the agents in a CrewAI-style sequential flow.

Flow:
    NutritionAgent  (calories burned -> meal plan)
        -> LogisticsAgent (meal plan -> grocery cart)
        -> SummarizerAgent (form verdict + agents -> voice script)
"""
from typing import Any

from agents.nutrition_agent import NutritionAgent
from agents.logistics_agent import LogisticsAgent
from agents.summarizer import SummarizerAgent


class SwarmOrchestrator:
    def __init__(self, verbose: bool = True):
        self.verbose = verbose
        self.agents = [NutritionAgent(verbose), LogisticsAgent(verbose), SummarizerAgent(verbose)]

    def run(self, context: dict[str, Any]) -> dict[str, Any]:
        state: dict[str, Any] = dict(context)

        nutrition = self.agents[0].run(state)
        state["nutrition"] = nutrition

        logistics = self.agents[1].run({"meals": nutrition["meals"], "store": state.get("store", "Instacart")})
        state["logistics"] = logistics

        summary = self.agents[2].run(state)

        return {
            "nutrition": nutrition,
            "logistics": logistics,
            "summary": summary,
        }


# Convenience entry points matching the Express orchestrator's expectations
def run_nutrition(user_id: str, kcal_burned: float, weight_kg: float, goal: str) -> dict[str, Any]:
    return NutritionAgent().run({"userId": user_id, "kcalBurned": kcal_burned, "weightKg": weight_kg, "goal": goal})


def run_logistics(nutrition_plan_id: int, store: str, meals: list[dict[str, Any]]) -> dict[str, Any]:
    return LogisticsAgent().run({"nutritionPlanId": nutrition_plan_id, "store": store, "meals": meals})


def run_summarize(context: dict[str, Any]) -> dict[str, Any]:
    return SummarizerAgent().run(context)
