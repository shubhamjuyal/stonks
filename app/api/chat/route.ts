import { ChatOpenAI } from "@langchain/openai";
import {
  AIMessage,
  AIMessageChunk,
  HumanMessage,
  SystemMessage,
  ToolMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import { concat } from "@langchain/core/utils/stream";
import { getKiteTools } from "../../../lib/mcp";

// LangChain's OpenAI client needs Node APIs, so run on the Node runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatRole = "user" | "assistant";
interface ChatMessage {
  role: ChatRole;
  content: string;
}

const SYSTEM_PROMPT =
  "You are a helpful, friendly AI trading assistant. You can buy and sell " +
  "stocks and look up open positions using the available tools. Confirm the " +
  "action you took, including any order IDs. Answer clearly and concisely, " +
  "using Markdown when it improves readability.";

// Cap tool-calling iterations so a misbehaving model can't loop forever.
const MAX_TOOL_ITERATIONS = 8;

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({ error: "OPENAI_API_KEY is not set on the server." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  let messages: ChatMessage[] = [];
  try {
    const body = await req.json();
    messages = Array.isArray(body?.messages) ? body.messages : [];
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // LangChain is the LLM client here. Load the kite MCP tools and bind them so
  // the model can place trades / read positions during the conversation.
  const tools = await getKiteTools();
  const toolsByName = new Map(tools.map((t) => [t.name, t]));

  const model = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0.7,
    streaming: true,
    apiKey: process.env.OPENAI_API_KEY,
  });
  const modelWithTools = model.bindTools(tools);

  const history: BaseMessage[] = [new SystemMessage(SYSTEM_PROMPT)];
  for (const m of messages) {
    if (m.role === "assistant") history.push(new AIMessage(m.content));
    else history.push(new HumanMessage(m.content));
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
          // Stream the model turn, surfacing text to the client while we
          // accumulate the full chunk (which carries any tool calls).
          const llmStream = await modelWithTools.stream(history);
          let gathered: AIMessageChunk | undefined;
          for await (const chunk of llmStream) {
            gathered = gathered ? concat(gathered, chunk) : chunk;
            const text =
              typeof chunk.content === "string"
                ? chunk.content
                : chunk.content
                    .map((c) => ("text" in c ? c.text : ""))
                    .join("");
            if (text) controller.enqueue(encoder.encode(text));
          }
          if (!gathered) break;

          history.push(gathered);
          const toolCalls = gathered.tool_calls ?? [];
          if (toolCalls.length === 0) break; // final answer, done.

          // Run each requested tool and feed the results back to the model.
          for (const call of toolCalls) {
            const tool = toolsByName.get(call.name);
            let result: string;
            if (!tool) {
              result = `Error: unknown tool "${call.name}".`;
            } else {
              try {
                const out = await tool.invoke(call.args);
                result = typeof out === "string" ? out : JSON.stringify(out);
              } catch (err) {
                result =
                  "Error: " +
                  (err instanceof Error ? err.message : String(err));
              }
            }
            history.push(
              new ToolMessage({
                content: result,
                tool_call_id: call.id ?? call.name,
              }),
            );
          }
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unexpected server error.";
        controller.enqueue(encoder.encode(`\n\n[error] ${message}`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
