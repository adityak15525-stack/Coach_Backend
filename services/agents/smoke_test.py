"""Smoke test for the agent swarm core (stdlib only — no FastAPI needed)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[0] / "src"))

from orchestrator import SwarmOrchestrator, run_nutrition, run_logistics  # noqa: E402

ok = True


def check(label, cond):
    global ok
    print(f"  {'✅' if cond else '❌'} {label}")
    ok = ok and cond


print("HYPER-ADAPTIVE COACH — AGENT SWARM SMOKE TEST")
result = SwarmOrchestrator(verbose=False).run(
    {"userId": "u-1", "kcalBurned": 420, "weightKg": 75, "goal": "hypertrophy", "form": {"verdict": "minor", "deviations": [{"joint": "left_knee"}]}}
)

nut = result["nutrition"]
log = result["logistics"]
summ = result["summary"]

check("nutrition agent returns macros", all(k in nut for k in ("target_kcal", "protein_g", "carbs_g", "fat_g", "meals")))
check("meal plan has 4 meals", len(nut["meals"]) == 4)
check("every meal has food items", all(m["items"] for m in nut["meals"]))
check("macros roughly add up to kcal", abs(nut["protein_g"] * 4 + nut["carbs_g"] * 4 + nut["fat_g"] * 9 - nut["target_kcal"]) < 50)

check("logistics agent prices a cart", log["total_estimate"] > 0 and len(log["items"]) > 5)
check("logistics flags missing items", isinstance(log["missing"], list))

check("summarizer produces a voice script", len(summ["script"]) > 30)
check("summary mentions the joint deviation", "left_knee" in summ["script"] or "knee" in summ["script"])
print(f"\n  script: {summ['script']}")

single = run_nutrition("u-2", 350, 70, "fat_loss")
check("single nutrition call works", single["protein_g"] > 0)

log2 = run_logistics(7, "Instacart", nut["meals"])
check("single logistics call works", log2["total_estimate"] > 0)

print("\n  ✅ swarm smoke passed" if ok else "\n  ❌ swarm smoke FAILED")
sys.exit(0 if ok else 1)
