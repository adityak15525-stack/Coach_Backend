from dataclasses import dataclass


@dataclass
class FoodItem:
    name: str
    protein_g: float
    carbs_g: float
    fat_g: float
    kcal: float


# Compact food database — the searchable universe for meal generation.
FOOD_DB: dict[str, FoodItem] = {
    "chicken breast": FoodItem("Chicken Breast", 31, 0, 3.6, 165),
    "chicken thigh": FoodItem("Chicken Thigh", 26, 0, 10, 209),
    "eggs": FoodItem("Eggs", 6, 0.6, 5, 72),
    "greek yogurt": FoodItem("Greek Yogurt", 10, 3.9, 0.4, 59),
    "whey": FoodItem("Whey Protein", 24, 3, 1, 120),
    "white rice": FoodItem("White Rice", 2.7, 28, 0.3, 130),
    "brown rice": FoodItem("Brown Rice", 2.6, 23, 0.9, 111),
    "oats": FoodItem("Oats", 5, 27, 2.5, 150),
    "sweet potato": FoodItem("Sweet Potato", 2, 20, 0.2, 90),
    "broccoli": FoodItem("Broccoli", 2.8, 7, 0.4, 34),
    "spinach": FoodItem("Spinach", 2.9, 3.6, 0.4, 23),
    "salmon": FoodItem("Salmon", 20, 0, 13, 208),
    "tuna": FoodItem("Tuna", 29, 0, 1, 132),
    "beef mince": FoodItem("Beef Mince", 26, 0, 17, 259),
    "olive oil": FoodItem("Olive Oil", 0, 0, 14, 119),
    "peanut butter": FoodItem("Peanut Butter", 8, 6, 16, 190),
    "banana": FoodItem("Banana", 1.3, 27, 0.3, 105),
    "blueberries": FoodItem("Blueberries", 0.7, 14, 0.3, 57),
    "almonds": FoodItem("Almonds", 6, 6, 14, 164),
    "cottage cheese": FoodItem("Cottage Cheese", 11, 3, 4, 98),
}


def pick(name: str, grams: float) -> dict:
    f = FOOD_DB.get(name.lower())
    if not f:
        raise KeyError(name)
    mult = grams / 100.0
    return {
        "name": f.name,
        "grams": round(grams),
        "kcal": round(f.kcal * mult),
        "protein_g": round(f.protein_g * mult),
        "carbs_g": round(f.carbs_g * mult),
        "fat_g": round(f.fat_g * mult),
    }
