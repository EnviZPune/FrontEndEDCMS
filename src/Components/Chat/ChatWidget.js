"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { API_BASE } from "../../config"
import { getToken, authHeaders } from "../../utils/auth"
import SupportChatWindow from "../Chat/SupportChatWindow"
import "../../Styling/chat.css"

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [threads, setThreads] = useState([])
  const [activeThreadId, setActiveThreadId] = useState(null)
  const [loading, setLoading] = useState(false)

  // Refs to detect outside clicks
  const containerRef = useRef(null)
  const launcherRef = useRef(null)

  const isAuthed = useMemo(() => !!getToken(), [])

  const loadMyThreads = async () => {
    if (!isAuthed) return
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/Support/my-threads`, {
        headers: authHeaders(),
      })
      const data = await res.json()
      const list = Array.isArray(data) ? data : []
      setThreads(list)
      if (list.length && !activeThreadId) {
        setActiveThreadId(list[0].threadId)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) loadMyThreads()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Click outside to close
  useEffect(() => {
    if (!open) return

    const handlePointer = (e) => {
      const container = containerRef.current
      const launcher = launcherRef.current
      // If click is inside the chat container or the launcher button, ignore
      if (container && container.contains(e.target)) return
      if (launcher && launcher.contains(e.target)) return
      // Otherwise, close
      setOpen(false)
    }

    const handleKey = (e) => {
      if (e.key === "Escape") setOpen(false)
    }

    document.addEventListener("mousedown", handlePointer)
    document.addEventListener("touchstart", handlePointer, { passive: true })
    document.addEventListener("keydown", handleKey)

    return () => {
      document.removeEventListener("mousedown", handlePointer)
      document.removeEventListener("touchstart", handlePointer)
      document.removeEventListener("keydown", handleKey)
    }
  }, [open])

  const startNew = async (topic, message, businessId) => {
    const payload = {
      topic,
      initialMessage: message,
      businessId: businessId ?? null,
    }
    const res = await fetch(`${API_BASE}/Support/threads`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    })
    if (!res.ok) return
    const dto = await res.json()
    setThreads((prev) => [
      {
        threadId: dto.threadId,
        topic: dto.topic,
        status: dto.status,
        priority: dto.priority,
        lastMessageAt: dto.lastMessageAt,
      },
      ...prev,
    ])
    setActiveThreadId(dto.threadId)
  }

  // Helper function to format date properly
  const formatDate = (dateString) => {
    if (!dateString) return "Just now"
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return "Just now"

      const now = new Date()
      const diffInMinutes = Math.floor((now - date) / (1000 * 60))

      if (diffInMinutes < 1) return "Just now"
      if (diffInMinutes < 60) return `${diffInMinutes}m ago`
      if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`

      return date.toLocaleDateString()
    } catch {
      return "Just now"
    }
  }

  if (!isAuthed) return null

  return (
    <>
      <button
        ref={launcherRef}
        className="chat-launcher"
        onClick={(e) => {
          // prevent any parent handlers from seeing this as an "outside" click
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        aria-label="Open support chat"
      >
        {open ? "×" : "Support"}
      </button>

      {open && (
        <div ref={containerRef} className="chat-container">
          <div className="chat-sidebar">
            <div className="chat-sidebar-header">
              <strong>Help & Support</strong>
              <button className="chat-reload" onClick={loadMyThreads}>
                {loading ? "…" : "↻"}
              </button>
            </div>
            <button
              className="chat-new-btn-support"
              onClick={() =>
                startNew(
                  "General help",
                  // you can customize this default message if you also collect the user's name
                  "Hello, I need assistance.",
                  null
                )
              }
            >
              + New chat
            </button>
            <div className="chat-thread-list">
              {threads.map((t) => (
                <div
                  key={t.threadId}
                  className={`chat-thread-item ${activeThreadId === t.threadId ? "active" : ""}`}
                  onClick={() => setActiveThreadId(t.threadId)}
                >
                  <div className="chat-thread-topic">{t.topic || "Untitled"}</div>
                  <div className="chat-thread-meta">
                    <span data-status={t.status}>{t.status}</span>
                    <span>{formatDate(t.lastMessageAt)}</span>
                  </div>
                </div>
              ))}
              {threads.length === 0 && !loading && <div className="chat-empty">No conversations yet.</div>}
            </div>
          </div>

          {activeThreadId ? (
            <SupportChatWindow threadId={activeThreadId} />
          ) : (
            <div className="chat-window-placeholder">Select a conversation or create a new one.</div>
          )}
        </div>
      )}
    </>
  )
}
