import React, { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../config";
import { getToken, authHeaders } from "../../utils/auth";
import SupportChatWindow from "../Chat/SupportChatWindow";
import "../../Styling/chat.css";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [loading, setLoading] = useState(false);
  const isAuthed = useMemo(() => !!getToken(), []);

  const loadMyThreads = async () => {
    if (!isAuthed) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/Support/my-threads`, { headers: authHeaders() });
      const data = await res.json();
      setThreads(Array.isArray(data) ? data : []);
      if (data?.length && !activeThreadId) setActiveThreadId(data[0].threadId);
    } finally { setLoading(false); }
  };
  useEffect(() => { if (open) loadMyThreads(); /* eslint-disable-next-line */ }, [open]);

  const startNew = async (topic, message, businessId) => {
    const payload = { topic, initialMessage: message, businessId: businessId ?? null };
    const res = await fetch(`${API_BASE}/Support/threads`, {
      method: "POST", headers: authHeaders(), body: JSON.stringify(payload)
    });
    if (!res.ok) return;
    const dto = await res.json();
    setThreads(prev => [{ threadId: dto.threadId, topic: dto.topic, status: dto.status, priority: dto.priority, lastMessageAt: dto.lastMessageAt }, ...prev]);
    setActiveThreadId(dto.threadId);
  };

  if (!isAuthed) return null;

  return (
    <>
      <button className="chat-launcher" onClick={() => setOpen(o => !o)} aria-label="Open support chat">
        {open ? "×" : "Support"}
      </button>
      {open && (
        <div className="chat-container">
          <div className="chat-sidebar">
            <div className="chat-sidebar-header">
              <strong>Help & Support</strong>
              <button className="chat-reload" onClick={loadMyThreads}>{loading ? "…" : "↻"}</button>
            </div>
            <button className="chat-new-btn" onClick={() => startNew("General help", "Hello, I need assistance.", null)}>+ New chat</button>
            <div className="chat-thread-list">
              {threads.map(t => (
                <div key={t.threadId} className={`chat-thread-item ${activeThreadId === t.threadId ? "active" : ""}`} onClick={() => setActiveThreadId(t.threadId)}>
                  <div className="chat-thread-topic">{t.topic || "Untitled"}</div>
                  <div className="chat-thread-meta">
                    <span>{t.status}</span>
                    <span>{new Date(t.lastMessageAt).toLocaleString()}</span>
                  </div>
                </div>
              ))}
              {threads.length === 0 && !loading && <div className="chat-empty">No conversations yet.</div>}
            </div>
          </div>
          {activeThreadId ? <SupportChatWindow threadId={activeThreadId} /> : <div className="chat-window-placeholder">Select a conversation or create a new one.</div>}
        </div>
      )}
    </>
  );
}
