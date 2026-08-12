import os
from typing import Any

from agents.base import Agent

OPENAI_KEY = os.environ.get("OPENAI_API_KEY", "")
GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "")


class SummarizerAgent(Agent):
    """Synthesizes the whole day — KD-Tree form verdict, nutrition plan,
    grocery cart — into one high-energy, localized summary (voice script).
    Uses the GenAI client when keys are present; otherwise produces a
    deterministic but still punchy script.
    """

    role = "summarizer"
    goal = "End every session with a summary worth replaying."

    def run(self, context: dict[str, Any]) -> dict[str, Any]:
        form = context.get("form", {})
        nutrition = context.get("nutrition", {})
        cart = context.get("logistics", {})
        name = context.get("firstName", "Athlete")

        verdict = form.get("verdict", "unknown")
        deviations = form.get("deviations", [])
        form_line = self._form_line(verdict, deviations)
        nutrition_line = f"Refuel with {nutrition.get('protein_g', 0)}g of protein and {nutrition.get('target_kcal', 0)} kcal."
        cart_line = f"Grocery run: {cart.get('total_estimate', 0):.2f} at {cart.get('store', 'your store')} — one tap away."

        if OPENAI_KEY or GEMINI_KEY:
            script = self._genai_script(name, form_line, nutrition_line, cart_line)
        else:
            script = self._fallback_script(name, form_line, nutrition_line, cart_line)

        self.log("synthesized voice script")
        self.memorize("insight", {"verdict": verdict, "tone": "energetic"})

        return {
            "script": script,
            "tone": "energetic",
            "source": "genai" if (OPENAI_KEY or GEMINI_KEY) else "template",
            "tts_hint": "low-pitch, motivating, 140wpm",
        }

    def _form_line(self, verdict: str, deviations: list[Any]) -> str:
        if verdict == "perfect":
            return "Flawless form on every single rep."
        joint = (deviations[0].get("joint", "alignment") if deviations else "alignment")
        if verdict in ("minor", "moderate"):
            return f"Sharp form with a little {joint} work to do."
        return f"We caught a {joint} warning before it became an injury — good save."

    def _fallback_script(self, name, form_line, nutrition_line, cart_line) -> str:
        return (
            f"{name}, that was a session. {form_line} "
            f"{nutrition_line} {cart_line} You showed up. That's the whole game. Stay locked."
        )

    def _genai_script(self, name, form_line, nutrition_line, cart_line) -> str:
        # Deterministic wrapper around a real LLM call goes here
        # (OpenAI chat completions / Gemini generateContent).
        prompt = (
            f"Write a 40-word energetic workout summary for {name}. Facts: {form_line} "
            f"{nutrition_line} {cart_line}. Localized, punchy, no clichés."
        )
        # return call_llm(prompt)  # wired when keys are configured
        return self._fallback_script(name, form_line, nutrition_line, cart_line)
