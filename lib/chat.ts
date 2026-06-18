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
import { getKiteTools } from "./mcp";

type ChatRole = "user" | "assistant";
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

const SYSTEM_PROMPT =
  "You are a helpful, friendly AI trading assistant. You can buy and sell " +
  "stocks and look up open positions using the available tools. Confirm the " +
  "action you took, including any order IDs. Answer clearly and concisely, " +
  "using Markdown when it improves readability.";

const MAX_TOOL_ITERATIONS = 8;

export async function chat(messages: ChatMessage[]): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set.");
  }

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

  let reply = "";

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
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
      if (text) reply += text;
    }
    if (!gathered) break;

    history.push(gathered);
    const toolCalls = gathered.tool_calls ?? [];
    if (toolCalls.length === 0) break;

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
            "Error: " + (err instanceof Error ? err.message : String(err));
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

  return reply.trim() || "Sorry, I couldn't generate a response.";
}
