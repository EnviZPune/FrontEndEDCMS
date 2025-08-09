import React, { useEffect, useRef, useState } from "react";
import * as signalR from "@microsoft/signalr";
import { API_BASE, HUB_URL } from "../../config";
import { authHeaders, getToken } from "../../utils/auth";
import "../../Styling/chatwindow.css"

export default function SupportChatWindow({ threadId }) {
  const [messages, setMessages] = useState([]);
  const [topic, setTopic] = useState("");
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const connRef = useRef(null);
  const bottomRef = useRef(null);

  const loadThread = async () => {
    const res = await fetch(`${API_BASE}/Support/threads/${threadId}`, { headers: authHeaders() });
    if (!res.ok) return;
    const dto = await res.json();
    setTopic(dto.topic || `Thread #${threadId}`);
    const msgs = Array.isArray(dto.messages) ? dto.messages : [];
    setMessages(msgs.map(m => ({
      ...m,
      senderIsAdmin: !!m.senderIsAdmin,
      createdAt: m.createdAt || new Date().toISOString(),
    })));
  };

  useEffect(() => { loadThread(); }, [threadId]);

  useEffect(() => {
    const token = getToken();
    const c = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, { accessTokenFactory: () => token || "" })
      .withAutomaticReconnect([0, 2000, 10000, 30000])
      .build();
    connRef.current = c;

    c.on("message", (m) => {
      setMessages(prev => [...prev, {
        ...m,
        senderIsAdmin: !!m.senderIsAdmin,
        createdAt: m.createdAt || new Date().toISOString(),
      }]);
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });

    (async () => {
      try { await c.start(); await c.invoke("JoinThread", threadId); setConnected(true); }
      catch (err) { console.error("SignalR error", err); setConnected(false); }
    })();

    return () => { c.stop(); };
  }, [threadId]);

  const send = async () => {
    const text = input.trim(); if (!text || !connRef.current) return;
    try { await connRef.current.invoke("SendMessage", threadId, text); setInput(""); }
    catch (e) { console.error(e); }
  };
  const onKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };

  return (
    <div className="chat-window">
      <div className="chat-window-header">
        <div className="chat-title">{topic || `Thread #${threadId}`}</div>
      </div>
      <div className="chat-body">
        {messages.map(m => (
          <div key={m.messageId || Math.random()} className={`chat-msg ${m.isSystem ? "sys" : (m.senderIsAdmin ? "agent" : "user")}`}>
            <div className="chat-msg-body">{m.body}</div>
            <div className="chat-msg-meta">{m.createdAt ? new Date(m.createdAt).toLocaleString() : ""}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="chat-input">
        <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={onKey} placeholder="Type your message…" />
        <button onClick={send} disabled={!connected || !input.trim()}>Send</button>
      </div>
    </div>
  );
}
