# stonks — Claude-style chat

A minimal Claude/ChatGPT-style chat UI built with **Next.js** (App Router).
The backend uses **LangChain** as the LLM client with **OpenAI** as the provider,
streaming responses token-by-token.

## Setup

1. Add your OpenAI key to `.env`:

   ```
   OPENAI_API_KEY="sk-..."
   ```

2. Install dependencies:

   ```bash
   bun install
   ```

3. Run the dev server:

   ```bash
   bun run dev
   ```

Open http://localhost:3000.

## How it works

- `app/page.tsx` — the chat UI (client component) that streams the reply into the bubble.
- `app/api/chat/route.ts` — a Next.js route handler that builds the message history
  with LangChain (`ChatOpenAI`) and streams tokens back to the browser.
- `app/globals.css` — Claude-inspired styling (light + dark).

Model defaults to `gpt-4o-mini`; change it in `app/api/chat/route.ts`.
