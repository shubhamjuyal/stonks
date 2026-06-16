import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { buyStock, sellStock } from "../kite/kiteconnect";

// create an MCP server
const server = new McpServer({
  name: "trade",
  version: "1.0.0",
});

// buy stock tool
server.registerTool(
  "buy-stock",
  {
    inputSchema: { tradingsymbol: z.string(), quantity: z.number().int().positive() },
  },
  async ({ tradingsymbol, quantity }) => {
    const orderId = await buyStock(tradingsymbol, quantity);
    return {
      content: [{ type: "text", text: `Buy order placed. Order ID: ${String(orderId)}` }],
    };
  },
);

// sell stock tool
server.registerTool(
  "sell-stock",
  {
    inputSchema: { tradingsymbol: z.string(), quantity: z.number().int().positive() },
  },
  async ({ tradingsymbol, quantity }) => {
    const orderId = await sellStock(tradingsymbol, quantity);
    return {
      content: [{ type: "text", text: `Sell order placed. Order ID: ${String(orderId)}` }],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
