"use client";

import { useEffect, useRef, useState } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keep the view pinned to the latest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  // Auto-grow the input.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || isStreaming) return;

    const nextMessages: Message[] = [
      ...messages,
      { role: "user", content: text },
    ];
    setMessages(nextMessages);
    setInput("");
    setIsStreaming(true);

    // Placeholder for the assistant reply we will stream into.
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => "");
        throw new Error(detail || `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === "assistant") {
            updated[updated.length - 1] = {
              ...last,
              content: last.content + chunk,
            };
          }
          return updated;
        });
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === "assistant") {
          updated[updated.length - 1] = {
            ...last,
            content: last.content || `⚠️ ${message}`,
          };
        }
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="app">
      <header className="header">
        <span className="logo">◆</span>
        <span className="title">
          Stonks <span>· assistant</span>
        </span>
      </header>

      <main className="chat" ref={scrollRef}>
        {isEmpty ? (
          <div className="welcome">
            <div className="orb">◆</div>
            <h1>What's on your mind?</h1>
            <p>Ask anything to get started.</p>
          </div>
        ) : (
          <div className="thread">
            {messages.map((m, i) => (
              <div key={i} className={`row ${m.role}`}>
                <div className="avatar">{m.role === "user" ? "Y" : "◆"}</div>
                <div className="bubble">
                  {m.content ? (
                    m.content
                  ) : (
                    <span className="cursor-dots">
                      <span />
                      <span />
                      <span />
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="composer">
        <div className="composer-inner">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Stonks…"
            rows={1}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isStreaming}
            aria-label="Send message"
          >
            {isStreaming ? "…" : "↑"}
          </button>
        </div>
        
      </footer>
    </div>
  );
}
