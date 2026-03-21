"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Bot } from "lucide-react";
import styles from "./Chat.module.css";

type Message = {
  role: "user" | "model";
  text: string;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "model", text: "こんにちは！料理に関する質問は何でも聞いてくださいね。レシピの提案や調理方法のコツなど、お手伝いします。" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: "user", text: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const apiMessages = newMessages.map(msg => ({
        role: msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: msg.text }]
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages })
      });

      if (!res.ok) {
        throw new Error("チャットの取得に失敗しました");
      }

      const data = await res.json();
      setMessages([...newMessages, { role: "model", text: data.text }]);
    } catch (e: any) {
      console.error(e);
      setMessages([...newMessages, { role: "model", text: "エラーが発生しました。もう一度お試しください。" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>AI 料理アシスタント</h1>

      <div className={styles.chatBox}>
        {messages.map((msg, idx) => (
          <div key={idx} className={`${styles.messageWrapper} ${msg.role === "user" ? styles.userWrapper : styles.modelWrapper}`}>
            {msg.role === "model" && (
              <div className={styles.avatar}>
                <Bot size={20} />
              </div>
            )}
            <div className={`${styles.bubble} ${msg.role === "user" ? styles.userBubble : styles.modelBubble}`}>
              {msg.text.split("\n").map((line, i) => (
                <span key={i}>
                  {line}
                  <br />
                </span>
              ))}
            </div>
          </div>
        ))}
        {loading && (
          <div className={`${styles.messageWrapper} ${styles.modelWrapper}`}>
            <div className={styles.avatar}>
              <Bot size={20} />
            </div>
            <div className={`${styles.bubble} ${styles.modelBubble}`}>
              <Loader2 className="spinner" size={16} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className={styles.inputArea}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="料理の質問を入力..."
          disabled={loading}
          className={styles.input}
        />
        <button type="submit" disabled={loading || !input.trim()} className={styles.sendBtn}>
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}
