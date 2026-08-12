from typing import Any

from agents.base import Agent

# Simulated grocery/retailer inventory (the "API integration" in dev mode).
STORE_PRICES: dict[str, float] = {
    "oats": 3.99, "eggs": 4.49, "blueberries": 3.50,
    "brown rice": 2.89, "chicken breast": 9.99, "broccoli": 1.99, "olive oil": 8.49,
    "whey": 24.99, "banana": 1.29, "white rice": 2.49,
    "salmon": 12.99, "sweet potato": 2.29, "spinach": 2.49, "almonds": 6.99,
}
STORE_STOCK: set[str] = {"oats", "eggs", "blueberries", "brown rice", "chicken breast",
                         "broccoli", "olive oil", "whey", "banana", "white rice",
                         "salmon", "sweet potato", "spinach", "almonds"}


class LogisticsAgent(Agent):
    """Simulates building a grocery cart against a retailer API.
    Checks stock, prices the cart, and flags out-of-stock substitutions.
    In production this calls a real grocery API (Instacart/Walmart) via httpx.
    """

    role = "logistics"
    goal = "Turn the meal plan into a shoppable cart in one tap."

    def run(self, context: dict[str, Any]) -> dict[str, Any]:
        meals = context.get("meals", [])
        store = context.get("store", "Instacart")
        cart: list[dict[str, Any]] = []
        missing: list[str] = []
        total = 0.0

        for meal in meals:
            for item in meal["items"]:
                name = item["name"].lower()
                if name in STORE_STOCK:
                    price = round(STORE_PRICES.get(name, 2.0) * (item["grams"] / 100.0), 2)
                    cart.append({
                        "name": item["name"], "qty": 1, "grams": item["grams"],
                        "price": price, "stock": True,
                    })
                    total += price
                else:
                    missing.append(item["name"])

        self.log(f"cart at {store}: {len(cart)} items, ${total:.2f}, {len(missing)} missing")
        self.memorize("event", {"cart_total": round(total, 2), "store": store})

        return {
            "store": store,
            "items": cart,
            "missing": missing,
            "total_estimate": round(total, 2),
            "summary": f"Your ${total:.2f} cart is packed and ready at {store}.",
        }
