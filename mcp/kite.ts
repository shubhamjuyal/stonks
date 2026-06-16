import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { buyStock, sellStock, getPositions } from "../kite/kiteconnect";

// create an MCP server
const server = new McpServer({
  name: "trade",
  version: "1.0.0",
});

// buy stock tool
server.registerTool(
  "buy-stock",
  {
    description:
      "Place a market BUY order on the NSE for the given trading symbol and quantity.",
    inputSchema: { tradingsymbol: z.string(), quantity: z.number().int().positive() },
  },
  async ({ tradingsymbol, quantity }) => {
    try {
      const orderId = await buyStock(tradingsymbol, quantity);
      return {
        content: [{ type: "text", text: `Buy order placed. Order ID: ${String(orderId)}` }],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Buy order FAILED: ${msg}` }],
        isError: true,
      };
    }
  },
);

// sell stock tool
server.registerTool(
  "sell-stock",
  {
    description:
      "Place a market SELL order on the NSE for the given trading symbol and quantity.",
    inputSchema: { tradingsymbol: z.string(), quantity: z.number().int().positive() },
  },
  async ({ tradingsymbol, quantity }) => {
    try {
      const orderId = await sellStock(tradingsymbol, quantity);
      return {
        content: [{ type: "text", text: `Sell order placed. Order ID: ${String(orderId)}` }],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Sell order FAILED: ${msg}` }],
        isError: true,
      };
    }
  },
);

// positions tool
server.registerTool(
  "get-all-positions",
  {
    description:
      "Get all current open positions in the trading account (net and day positions).",
  },
  async () => {
    const response = await getPositions();
    return {
      content: [{ type: "text", text: JSON.stringify(response ?? null) }],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
