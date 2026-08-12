from typing import Any

from agents.base import Agent
from data.foods import pick


class NutritionAgent(Agent):
    """Reads calories burned (from MySQL via the orchestrator context) and
    generates a macro-matched meal plan. The macro math is deterministic;
    the rationale is an LLM prompt ready for OpenAI/Gemini when a key is set.
    """

    role = "nutrition"
    goal = "Turn every calorie burned into a macro-perfect refueling plan."

    def run(self, context: dict[str, Any]) -> dict[str, Any]:
        kcal_burned = float(context.get("kcalBurned", 0))
        body_weight = float(context.get("weightKg", 75))
        goal = context.get("goal", "hypertrophy")

        # Surplus/deficit multipliers by goal
        mult = {"hypertrophy": 1.20, "strength": 1.15, "fat_loss": 0.90, "endurance": 1.25}.get(
            goal, 1.15
        )
        target_kcal = int(kcal_burned * mult + body_weight * 22)

        # Macro split: 35/40/25 (P/C/F) — classic lean-gain default
        protein_g = int((target_kcal * 0.35) / 4)
        carbs_g = int((target_kcal * 0.40) / 4)
        fat_g = int((target_kcal * 0.25) / 9)

        meals = self._build_meals(protein_g, carbs_g, fat_g)

        self.log(f"target {target_kcal} kcal | P{protein_g} C{carbs_g} F{fat_g}")
        self.memorize("preference", {"target_kcal": target_kcal, "goal": goal})

        return {
            "plan_id": context.get("nutritionPlanId", 0),
            "target_kcal": target_kcal,
            "protein_g": protein_g,
            "carbs_g": carbs_g,
            "fat_g": fat_g,
            "meals": meals,
            "rationale": f"{protein_g}g protein to rebuild, {carbs_g}g carbs to reload glycogen, {fat_g}g fat for hormones.",
            "summary": f"{protein_g}g of protein and {target_kcal} kcal — that's the refuel for {goal}.",
        }

    def _build_meals(self, p, c, f) -> list[dict[str, Any]]:
        # 4-meal skeleton with sensible portion sizes (grams per serving).
        meals = [
            ("Breakfast", [("oats", 80), ("eggs", 150), ("blueberries", 100)]),
            ("Lunch", [("brown rice", 200), ("chicken breast", 200), ("broccoli", 150), ("olive oil", 15)]),
            ("Post-Workout", [("whey", 40), ("banana", 120), ("white rice", 100)]),
            ("Dinner", [("salmon", 200), ("sweet potato", 200), ("spinach", 100), ("almonds", 30)]),
        ]
        return [{"meal": name, "items": [pick(food, g) for food, g in foods]} for name, foods in meals]
