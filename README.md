# AI Gourmet MCP Server

Backend server for AI Gourmet, utilizing the Message Context Protocol (MCP) via the `FastMCP` library to provide tools for managing menu browsing, cart operations, and order placement.

## 🌟 Features

*   **Menu Management:**
    *   Retrieve menu categories.
    *   List items by category.
    *   Get detailed information for a specific item.
    *   Find items based on criteria like dietary preference, price, allergens, and category.
*   **Shopping Cart:**
    *   Create a new shopping cart session.
    *   Add items to the cart.
    *   Remove items from the cart.
    *   View current cart contents and total.
*   **Order Processing:**
    *   Checkout a cart to create an order.
    *   Get the status of a specific order.
    *   List all placed orders.

## ⚙️ Tech Stack

*   Python 3.x
*   `FastMCP` library (for defining MCP tools and running the server)
*   Standard Python libraries: `json`, `uuid`, `datetime`, `os`, `typing`

## 📋 Prerequisites

*   Python 3.8+ (or your specific version)
*   pip (Python package installer)
*   Git

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone [Your Repository URL Here e.g., https://github.com/yourusername/aigourmet-mcp-server.git]
cd aigourmet-mcp-server

### 2. Create and Activate a Virtual Environment (Recommended)

```shell
# For Linux/macOS
python3 -m venv venv
source venv/bin/activate

# For Windows
python -m venv venv
.\venv\Scripts\activate
```

### 3\. Install Dependencies

**`requirements.txt`:**

```shell
pip install -r requirements.txt
```

## 👟 Running the Server

Execute the main Python script (e.g., if your file is named `server.py`):

```shell
python3 mcp-server/src/server.py```
