from mcp.server.fastmcp import FastMCP
from typing import List, Dict, Any, Optional
from uuid import uuid4
from datetime import datetime
import json
import os

mcp = FastMCP("restaurant")

# Load menu items from JSON file
MENU_JSON_PATH = os.path.join(os.path.dirname(__file__), "menu_items.json")
with open(MENU_JSON_PATH, "r") as f:
    MENU_ITEMS = json.load(f)

ORDERS: Dict[str, Dict[str, Any]] = {}
ACTIVE_SESSIONS: Dict[str, Dict[str, Any]] = {}

@mcp.tool()
async def get_menu_categories() -> List[str]:
    """Return all available menu categories."""
    return sorted(list(set(item["category"] for item in MENU_ITEMS)))

@mcp.tool()
async def list_items_by_category(category: str) -> List[Dict[str, Any]]:
    """List all menu items in a specific category."""
    return [item for item in MENU_ITEMS if item["category"] == category]

@mcp.tool()
async def get_item_details(item_identifier: str) -> Dict[str, Any]:
    """Get detailed information about a specific menu item by id or name."""
    for item in MENU_ITEMS:
        if item["id"] == item_identifier or item["name"].lower() == item_identifier.lower():
            return item
    return {"error": f"Item '{item_identifier}' not found"}

@mcp.tool()
async def find_items_by_criteria(
    dietary_preference: Optional[str] = None,
    max_price: Optional[float] = None,
    exclude_allergens: Optional[List[str]] = None,
    category: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Find menu items based on dietary preference, price, allergens, or category."""
    filtered = MENU_ITEMS.copy()
    if dietary_preference:
        pref = dietary_preference.lower()
        if pref == 'vegetarian':
            filtered = [i for i in filtered if i["is_vegetarian"]]
        elif pref == 'vegan':
            filtered = [i for i in filtered if i["is_vegan"]]
        elif pref == 'gluten_free':
            filtered = [i for i in filtered if i["is_gluten_free"]]
    if max_price is not None:
        filtered = [i for i in filtered if i["price"] <= max_price]
    if exclude_allergens:
        for allergen in exclude_allergens:
            filtered = [i for i in filtered if allergen.lower() not in [a.lower() for a in i["allergens"]]]
    if category:
        filtered = [i for i in filtered if i["category"].lower() == category.lower()]
    return filtered

@mcp.tool()
async def create_cart() -> Dict[str, Any]:
    """Create a new empty cart/session and return its session_id."""
    session_id = str(uuid4())
    now = datetime.now().isoformat()
    ACTIVE_SESSIONS[session_id] = {"cart": [], "created_at": now, "last_active": now}
    return {"session_id": session_id, "cart": []}

@mcp.tool()
async def add_to_cart(session_id: str, item_id: str, quantity: int = 1) -> Dict[str, Any]:
    """Add an item to the cart for a session."""
    session = ACTIVE_SESSIONS.get(session_id)
    if not session:
        return {"error": "Invalid session ID"}
    item = next((i for i in MENU_ITEMS if i["id"] == item_id), None)
    if not item:
        return {"error": f"Item '{item_id}' not found"}
    cart = session["cart"]
    for cart_item in cart:
        if cart_item["item_id"] == item_id:
            cart_item["quantity"] += quantity
            break
    else:
        cart.append({"item_id": item_id, "name": item["name"], "price": item["price"], "quantity": quantity})
    session["last_active"] = datetime.now().isoformat()
    total = sum(i["price"] * i["quantity"] for i in cart)
    return {"cart": cart, "total": total}

@mcp.tool()
async def remove_from_cart(session_id: str, item_id: str) -> Dict[str, Any]:
    """Remove an item from the cart for a session."""
    session = ACTIVE_SESSIONS.get(session_id)
    if not session:
        return {"error": "Invalid session ID"}
    cart = session["cart"]
    session["cart"] = [i for i in cart if i["item_id"] != item_id]
    session["last_active"] = datetime.now().isoformat()
    updated_cart = session["cart"]
    total = sum(i["price"] * i["quantity"] for i in updated_cart)
    return {"cart": updated_cart, "total": total}

@mcp.tool()
async def get_cart(session_id: str) -> Dict[str, Any]:
    """Get contents of the current cart for a session."""
    session = ACTIVE_SESSIONS.get(session_id)
    if not session:
        return {"error": "Invalid session ID"}
    cart = session["cart"]
    total = sum(i["price"] * i["quantity"] for i in cart)
    return {"cart": cart, "total": total}

@mcp.tool()
async def checkout(session_id: str, customer_info: Optional[Dict[str, Any]] = None, payment_info: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Process the checkout for a session's cart and create an order."""
    session = ACTIVE_SESSIONS.get(session_id)
    if not session:
        return {"error": "Invalid session ID"}
    cart = session["cart"]
    if not cart:
        return {"error": "Cannot checkout with empty cart"}
    order_id = f"ORD-{uuid4().hex[:8].upper()}"
    order_time = datetime.now().isoformat()
    order = {
        "order_id": order_id,
        "items": cart,
        "total": sum(i["price"] * i["quantity"] for i in cart),
        "status": "confirmed",
        "created_at": order_time,
        "customer_info": customer_info or {},
        "payment_info": {
            "method": (payment_info or {}).get('method', 'credit_card'),
            "status": "approved",
            "transaction_id": f"TXN-{uuid4().hex[:10].upper()}"
        }
    }
    ORDERS[order_id] = order
    session["cart"] = []
    session["last_active"] = datetime.now().isoformat()
    return {"order": order, "success": True, "message": "Order placed successfully"}

@mcp.tool()
async def get_order_status(order_id: str) -> Dict[str, Any]:
    """Get the status of a specific order."""
    order = ORDERS.get(order_id)
    if not order:
        return {"error": f"Order '{order_id}' not found"}
    return {"order": order}

@mcp.tool()
async def list_orders() -> List[Dict[str, Any]]:
    """List all orders."""
    return list(ORDERS.values())

if __name__ == "__main__":
    mcp.run(transport="sse")