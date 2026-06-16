import path from "node:path";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import type { StructuredToolInterface } from "@langchain/core/tools";

// Spawn the kite MCP server (mcp/kite.ts) over stdio and expose its tools as
// LangChain tools. The client is created once and reused across requests.
let clientPromise: Promise<MultiServerMCPClient> | null = null;
let toolsPromise: Promise<StructuredToolInterface[]> | null = null;

function getClient(): Promise<MultiServerMCPClient> {
  if (!clientPromise) {
    const serverPath = path.join(process.cwd(), "mcp", "kite.ts");
    const client = new MultiServerMCPClient({
      // Prefix tool names with the server name -> "trade__buy-stock", etc.
      prefixToolNameWithServerName: true,
      mcpServers: {
        trade: {
          transport: "stdio",
          command: "bun",
          args: [serverPath],
          // Pass through the parent env so the server sees the Zerodha keys.
          env: process.env as Record<string, string>,
        },
      },
    });
    clientPromise = Promise.resolve(client);
  }
  return clientPromise;
}

export function getKiteTools(): Promise<StructuredToolInterface[]> {
  if (!toolsPromise) {
    toolsPromise = getClient().then((client) => client.getTools());
  }
  return toolsPromise;
}
