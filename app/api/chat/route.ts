import { ChatOpenAI } from "@langchain/openai";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";

// LangChain's OpenAI client needs Node APIs, so run on the Node runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatRole = "user" | "assistant";
interface ChatMessage {
  role: ChatRole;
  content: string;
}

const SYSTEM_PROMPT =
  "You are a helpful, friendly AI assistant. Answer clearly and concisely, " +
  "using Markdown when it improves readability.";

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

  // LangChain is the LLM client here: build the message history and stream tokens.
  const model = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0.7,
    streaming: true,
    apiKey: process.env.OPENAI_API_KEY,
  });

  const history: BaseMessage[] = [new SystemMessage(SYSTEM_PROMPT)];
  for (const m of messages) {
    if (m.role === "assistant") history.push(new AIMessage(m.content));
    else history.push(new HumanMessage(m.content));
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const llmStream = await model.stream(history);
        for await (const chunk of llmStream) {
          const text =
            typeof chunk.content === "string"
              ? chunk.content
              : chunk.content
                  .map((c) => ("text" in c ? c.text : ""))
                  .join("");
          if (text) controller.enqueue(encoder.encode(text));
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
