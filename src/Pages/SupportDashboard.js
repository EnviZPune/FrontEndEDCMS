import React, { useEffect, useRef, useState } from "react";
import * as signalR from "@microsoft/signalr";
import { API_BASE, HUB_URL } from "../config";
import { authHeaders, getToken } from "../utils/auth";
import "../Styling/support-dashboard.css";
import "../Styling/support-dashboard2.css"

export default function SupportDashboard() {
  const [threads, setThreads] = useState([]);
  const [myThreads, setMyThreads] = useState([]);
  const [filterUnassigned, setFilterUnassigned] = useState(true);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [topic, setTopic] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [denied, setDenied] = useState(false);
  const connRef = useRef(null);

  const fetchJson = async (url, init = {}) => {
    const res = await fetch(url, { headers: authHeaders(), ...init });
    if (res.status === 401 || res.status === 403) { setDenied(true); return null; }
    setDenied(false);
    return res.ok ? res.json() : null;
  };

  const loadQueue = async () => {
    setLoading(true);
    const data = await fetchJson(`${API_BASE}/Support/queue?unassignedOnly=${filterUnassigned}`);
    if (data) setThreads(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  const loadMine = async () => {
    const data = await fetchJson(`${API_BASE}/Support/my-threads`);
    if (data) setMyThreads(Array.isArray(data) ? data : []);
  };

  const openThread = async (id) => {
    setActiveThreadId(id);
    const dto = await fetchJson(`${API_BASE}/Support/threads/${id}`);
    if (!dto) return;
    setTopic(dto.topic || `Thread #${id}`);
    setMessages(dto.messages || []);
    await connectToHub(id);
  };

  const connectToHub = async (threadId) => {
    if (connRef.current) { try { await connRef.current.stop(); } catch {} }
    const token = getToken();
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, { accessTokenFactory: () => token || "" })
      .withAutomaticReconnect([0,2000,10000,30000])
      .build();
    connRef.current = connection;

    connection.on("message", (msg) => {
      // Make sure we can render sides & dates consistently
      const normalized = {
        ...msg,
        senderIsAdmin: !!msg.senderIsAdmin,
        createdAt: msg.createdAt || new Date().toISOString(),
      };
      setMessages(prev => [...prev, normalized]);
    });

    try {
      await connection.start();
      await connection.invoke("JoinThread", threadId);
    } catch (e) {
      console.error("SupportHub connect error", e);
    }
  };

  const assignToMe = async (id) => {
    const res = await fetch(`${API_BASE}/Support/threads/${id}/assign`, { method:"PUT", headers: authHeaders(), body:"" });
    if (res.status === 401 || res.status === 403) { setDenied(true); return; }
    await loadQueue();
    await loadMine();
  };

  const send = async () => {
    const text = input.trim(); if (!text || !connRef.current || !activeThreadId) return;
    try {
      await connRef.current.invoke("SendMessage", activeThreadId, text);
      setInput("");
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadQueue(); loadMine(); }, [filterUnassigned]);

  if (denied) return <div style={{ padding: 24 }}>Unauthorized</div>;

  return (
    <div className="sd-root">
      <div className="sd-left">
        <div className="sd-header">
          <h2>Support Queue</h2>
          <label className="sd-toggle">
            <input type="checkbox" checked={filterUnassigned} onChange={e => setFilterUnassigned(e.target.checked)} />
            <span>Unassigned only</span>
          </label>
        </div>

        <div className="sd-list">
          {threads.map(t => {
            const last = t.lastMessageAt || t.updatedAt || t.createdAt;
            return (
              <div key={t.threadId} className="sd-item">
                <div className="sd-item-main" onClick={()=>openThread(t.threadId)}>
                  <div className="sd-item-title">{t.title || t.topic || `Thread #${t.threadId}`}</div>
                  <div className="sd-item-row">
                    <span>{t.status}</span>
                    <span>{last ? new Date(last).toLocaleString() : ""}</span>
                  </div>
                </div>
                <div className="sd-actions">
                  {!t.assigneeUserId && (
                    <button className="sd-assign" onClick={() => assignToMe(t.threadId)}>Assign to me</button>
                  )}
                </div>
              </div>
            );
          })}
          {threads.length === 0 && !loading && <div className="chat-empty">No conversations yet.</div>}
        </div>

        <div className="sd-my">
          <h3>My Threads</h3>
          {(myThreads || []).map(t => {
            const last = t.lastMessageAt || t.updatedAt || t.createdAt;
            return (
              <div key={t.threadId} className="sd-item" onClick={()=>openThread(t.threadId)}>
                <div className="sd-item-title">{t.title || t.topic || `Thread #${t.threadId}`}</div>
                <div className="sd-item-row">
                  <span>{t.status}</span>
                  <span>{last ? new Date(last).toLocaleString() : ""}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="sd-right">
        {activeThreadId ? (
          <div className="sd-chat">
            <div className="sd-chat-header"><div className="sd-topic">{topic}</div></div>
            <div className="sd-chat-body">
              {messages.map(m => (
                <div
                  key={m.messageId || Math.random()}
                  className={`sd-msg ${m.isSystem ? "sys" : (m.senderIsAdmin ? "agent" : "user")}`}
                >
                  <div className="sd-msg-body">{m.body}</div>
                  <div className="sd-msg-meta">{m.createdAt ? new Date(m.createdAt).toLocaleString() : ""}</div>
                </div>
              ))}
            </div>
            <div className="sd-input">
              <textarea value={input} onChange={e=>setInput(e.target.value)} placeholder="Reply…" />
              <button onClick={send} disabled={!input.trim()}>Send</button>
            </div>
          </div>
        ) : <div className="sd-placeholder">Select a thread to view</div>}
      </div>
    </div>
  );
}
