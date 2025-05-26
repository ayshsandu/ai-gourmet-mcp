import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { v4 as uuidv4 } from 'uuid';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Types
interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  is_vegetarian: boolean;
  is_vegan: boolean;
  is_gluten_free: boolean;
  allergens: string[];
}

interface CartItem {
  item_id: string;
  name: string;
  price: number;
  quantity: number;
}

interface Session {
  cart: CartItem[];
  created_at: string;
  last_active: string;
}

interface Order {
  order_id: string;
  items: CartItem[];
  total: number;
  status: string;
  created_at: string;
  customer_info: Record<string, any>;
  payment_info: {
    method: string;
    status: string;
    transaction_id: string;
  };
}

// Load menu items from JSON file
const MENU_JSON_PATH = join(__dirname, "menu_items.json");
const MENU_ITEMS: MenuItem[] = JSON.parse(readFileSync(MENU_JSON_PATH, "utf-8"));

// In-memory storage
const ORDERS: Record<string, Order> = {};
const ACTIVE_SESSIONS: Record<string, Session> = {};

// Create server
const server = new Server(
  {
    name: "restaurant",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_menu_categories",
        description: "Return all available menu categories.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "list_items_by_category",
        description: "List all menu items in a specific category.",
        inputSchema: {
          type: "object",
          properties: {
            category: {
              type: "string",
              description: "Category name",
            },
          },
          required: ["category"],
        },
      },
      {
        name: "get_item_details",
        description: "Get detailed information about a specific menu item by id or name.",
        inputSchema: {
          type: "object",
          properties: {
            item_identifier: {
              type: "string",
              description: "Item ID or name",
            },
          },
          required: ["item_identifier"],
        },
      },
      {
        name: "find_items_by_criteria",
        description: "Find menu items based on dietary preference, price, allergens, or category.",
        inputSchema: {
          type: "object",
          properties: {
            dietary_preference: {
              type: "string",
              description: "Dietary preference (vegetarian, vegan, gluten_free)",
            },
            max_price: {
              type: "number",
              description: "Maximum price",
            },
            exclude_allergens: {
              type: "array",
              items: { type: "string" },
              description: "List of allergens to exclude",
            },
            category: {
              type: "string",
              description: "Category to filter by",
            },
          },
        },
      },
      {
        name: "create_cart",
        description: "Create a new empty cart/session and return its session_id.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "add_to_cart",
        description: "Add an item to the cart for a session.",
        inputSchema: {
          type: "object",
          properties: {
            session_id: {
              type: "string",
              description: "Session ID",
            },
            item_id: {
              type: "string",
              description: "Item ID to add",
            },
            quantity: {
              type: "integer",
              description: "Quantity to add",
              default: 1,
            },
          },
          required: ["session_id", "item_id"],
        },
      },
      {
        name: "remove_from_cart",
        description: "Remove an item from the cart for a session.",
        inputSchema: {
          type: "object",
          properties: {
            session_id: {
              type: "string",
              description: "Session ID",
            },
            item_id: {
              type: "string",
              description: "Item ID to remove",
            },
          },
          required: ["session_id", "item_id"],
        },
      },
      {
        name: "get_cart",
        description: "Get contents of the current cart for a session.",
        inputSchema: {
          type: "object",
          properties: {
            session_id: {
              type: "string",
              description: "Session ID",
            },
          },
          required: ["session_id"],
        },
      },
      {
        name: "checkout",
        description: "Process the checkout for a session's cart and create an order.",
        inputSchema: {
          type: "object",
          properties: {
            session_id: {
              type: "string",
              description: "Session ID",
            },
            customer_info: {
              type: "object",
              description: "Customer information",
            },
            payment_info: {
              type: "object",
              description: "Payment information",
            },
          },
          required: ["session_id"],
        },
      },
      {
        name: "get_order_status",
        description: "Get the status of a specific order.",
        inputSchema: {
          type: "object",
          properties: {
            order_id: {
              type: "string",
              description: "Order ID",
            },
          },
          required: ["order_id"],
        },
      },
      {
        name: "list_orders",
        description: "List all orders.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "get_menu_categories": {
      const categories = [...new Set(MENU_ITEMS.map(item => item.category))].sort();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(categories),
          },
        ],
      };
    }

    case "list_items_by_category": {
      const { category } = args as { category: string };
      const items = MENU_ITEMS.filter(item => item.category === category);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(items),
          },
        ],
      };
    }

    case "get_item_details": {
      const { item_identifier } = args as { item_identifier: string };
      const item = MENU_ITEMS.find(
        item => item.id === item_identifier || item.name.toLowerCase() === item_identifier.toLowerCase()
      );
      const result = item || { error: `Item '${item_identifier}' not found` };
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result),
          },
        ],
      };
    }

    case "find_items_by_criteria": {
      const { dietary_preference, max_price, exclude_allergens, category } = args as {
        dietary_preference?: string;
        max_price?: number;
        exclude_allergens?: string[];
        category?: string;
      };

      let filtered = [...MENU_ITEMS];

      if (dietary_preference) {
        const pref = dietary_preference.toLowerCase();
        if (pref === 'vegetarian') {
          filtered = filtered.filter(i => i.is_vegetarian);
        } else if (pref === 'vegan') {
          filtered = filtered.filter(i => i.is_vegan);
        } else if (pref === 'gluten_free') {
          filtered = filtered.filter(i => i.is_gluten_free);
        }
      }

      if (max_price !== undefined) {
        filtered = filtered.filter(i => i.price <= max_price);
      }

      if (exclude_allergens) {
        for (const allergen of exclude_allergens) {
          filtered = filtered.filter(i => 
            !i.allergens.some(a => a.toLowerCase() === allergen.toLowerCase())
          );
        }
      }

      if (category) {
        filtered = filtered.filter(i => i.category.toLowerCase() === category.toLowerCase());
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(filtered),
          },
        ],
      };
    }

    case "create_cart": {
      const session_id = uuidv4();
      const now = new Date().toISOString();
      ACTIVE_SESSIONS[session_id] = {
        cart: [],
        created_at: now,
        last_active: now,
      };
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ session_id, cart: [] }),
          },
        ],
      };
    }

    case "add_to_cart": {
      const { session_id, item_id, quantity = 1 } = args as {
        session_id: string;
        item_id: string;
        quantity?: number;
      };

      const session = ACTIVE_SESSIONS[session_id];
      if (!session) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: "Invalid session ID" }),
            },
          ],
        };
      }

      const item = MENU_ITEMS.find(i => i.id === item_id);
      if (!item) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: `Item '${item_id}' not found` }),
            },
          ],
        };
      }

      const cart = session.cart;
      const existingItem = cart.find(cart_item => cart_item.item_id === item_id);
      
      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        cart.push({
          item_id: item_id,
          name: item.name,
          price: item.price,
          quantity: quantity,
        });
      }

      session.last_active = new Date().toISOString();
      const total = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ cart, total }),
          },
        ],
      };
    }

    case "remove_from_cart": {
      const { session_id, item_id } = args as { session_id: string; item_id: string };

      const session = ACTIVE_SESSIONS[session_id];
      if (!session) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: "Invalid session ID" }),
            },
          ],
        };
      }

      session.cart = session.cart.filter(i => i.item_id !== item_id);
      session.last_active = new Date().toISOString();
      const total = session.cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ cart: session.cart, total }),
          },
        ],
      };
    }

    case "get_cart": {
      const { session_id } = args as { session_id: string };

      const session = ACTIVE_SESSIONS[session_id];
      if (!session) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: "Invalid session ID" }),
            },
          ],
        };
      }

      const total = session.cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ cart: session.cart, total }),
          },
        ],
      };
    }

    case "checkout": {
      const { session_id, customer_info, payment_info } = args as {
        session_id: string;
        customer_info?: Record<string, any>;
        payment_info?: Record<string, any>;
      };

      const session = ACTIVE_SESSIONS[session_id];
      if (!session) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: "Invalid session ID" }),
            },
          ],
        };
      }

      const cart = session.cart;
      if (cart.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: "Cannot checkout with empty cart" }),
            },
          ],
        };
      }

      const order_id = `ORD-${uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase()}`;
      const order_time = new Date().toISOString();
      const total = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);

      const order: Order = {
        order_id,
        items: cart,
        total,
        status: "confirmed",
        created_at: order_time,
        customer_info: customer_info || {},
        payment_info: {
          method: payment_info?.method || 'credit_card',
          status: "approved",
          transaction_id: `TXN-${uuidv4().replace(/-/g, '').substring(0, 10).toUpperCase()}`,
        },
      };

      ORDERS[order_id] = order;
      session.cart = [];
      session.last_active = new Date().toISOString();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              order,
              success: true,
              message: "Order placed successfully",
            }),
          },
        ],
      };
    }

    case "get_order_status": {
      const { order_id } = args as { order_id: string };

      const order = ORDERS[order_id];
      if (!order) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: `Order '${order_id}' not found` }),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ order }),
          },
        ],
      };
    }

    case "list_orders": {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(Object.values(ORDERS)),
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Restaurant MCP server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});