"""FastAPI microservice exposing the agent swarm to Express."""
from fastapi import FastAPI
from pydantic import BaseModel
from typing import Any, Optional

from orchestrator import run_nutrition, run_logistics, run_summarize, SwarmOrchestrator

app = FastAPI(title="AI Coach Agent Swarm", version="0.1.0")


class NutritionRequest(BaseModel):
    userId: str
    kcalBurned: float
    weightKg: float = 75.0
    goal: str = "hypertrophy"
    date: str = ""


class LogisticsRequest(BaseModel):
    userId: str
    nutritionPlanId: int = 0
    store: str = "Instacart"


class SummarizeRequest(BaseModel):
    userId: str
    date: str = ""
    nutrition: Optional[Any] = None
    logistics: Optional[Any] = None
    form: Optional[Any] = None


class SwarmRequest(BaseModel):
    userId: str
    kcalBurned: float = 0.0
    form: Optional[dict[str, Any]] = None
    date: str = ""


@app.get("/health")
def health():
    return {"status": "ok", "agents": ["nutrition", "logistics", "summarizer"]}


@app.post("/run/nutrition")
def nutrition(req: NutritionRequest):
    return run_nutrition(req.userId, req.kcalBurned, req.weightKg, req.goal)


@app.post("/run/logistics")
def logistics(req: LogisticsRequest):
    # The Express orchestrator sends the generated meals implicitly; in a
    # real deployment it would pass nutritionPlanId and we re-fetch from MySQL.
    from data.foods import FOOD_DB  # placeholder cart from full food DB
    meals = [{"meal": "sample", "items": [{"name": k, "grams": 100} for k in list(FOOD_DB)[:6]]}]
    return run_logistics(req.nutritionPlanId, req.store, meals)


@app.post("/run/summarize")
def summarize(req: SummarizeRequest):
    return run_summarize(req.model_dump())


@app.post("/run/swarm")
def swarm(req: SwarmRequest):
    result = SwarmOrchestrator().run({
        "userId": req.userId,
        "kcalBurned": req.kcalBurned,
        "form": req.form or {},
        "date": req.date,
    })
    return result
