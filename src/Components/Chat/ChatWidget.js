"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { API_BASE } from "../../config"
import { getToken, authHeaders } from "../../utils/auth"
import SupportChatWindow from "../Chat/SupportChatWindow"
import "../../Styling/chat.css"

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [threads, setThreads] = useState([])               // <-- no <any[]>
  const [activeThreadId, setActiveThreadId] = useState(null) // <-- no <string | null>
  const [loading, setLoading] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const containerRef = useRef(null)
  const launcherRef = useRef(null)
  const scrollYRef = useRef(0) // for mobile body scroll-lock

  const isAuthed = useMemo(() => !!getToken(), [])

  const activeThread = useMemo(
    () => threads.find((t) => t.threadId === activeThreadId) || null,
    [threads, activeThreadId]
  )

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

  // Mobile body scroll lock while widget is open
  useEffect(() => {
    const isMobile = () => window.matchMedia("(max-width: 640px)").matches

    const lock = () => {
      if (!isMobile()) return
      scrollYRef.current = window.scrollY || window.pageYOffset || 0
      document.body.classList.add("chat-scroll-lock")
      document.body.style.top = `-${scrollYRef.current}px`
      document.body.style.left = "0"
      document.body.style.right = "0"
      document.body.style.width = "100%"
    }

    const unlock = () => {
      const y = scrollYRef.current || 0
      document.body.classList.remove("chat-scroll-lock")
      document.body.style.top = ""
      document.body.style.left = ""
      document.body.style.right = ""
      document.body.style.width = ""
      window.scrollTo(0, y)
    }

    if (open) lock()
    else unlock()

    const onResize = () => {
      if (!open) return
      if (isMobile()) {
        if (!document.body.classList.contains("chat-scroll-lock")) lock()
      } else {
        unlock()
      }
    }
    window.addEventListener("resize", onResize)
    window.addEventListener("orientationchange", onResize)
    return () => {
      window.removeEventListener("resize", onResize)
      window.removeEventListener("orientationchange", onResize)
      if (open) unlock()
    }
  }, [open])

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
      if (container && container.contains(e.target)) return
      if (launcher && launcher.contains(e.target)) return
      setOpen(false)
      setMobileNavOpen(false)
    }

    const handleKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false)
        setMobileNavOpen(false)
      }
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
    const payload = { topic, initialMessage: message, businessId: businessId ?? null }
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
    setMobileNavOpen(false)
  }

  const formatDate = (dateString) => {
    if (!dateString) return "Just now"
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return "Just now"
      const now = new Date()
      const mins = Math.floor((now - date) / 60000)
      if (mins < 1) return "Just now"
      if (mins < 60) return `${mins}m ago`
      if (mins < 1440) return `${Math.floor(mins / 60)}h ago`
      return date.toLocaleDateString()
    } catch {
      return "Just now"
    }
  }

  const handleClose = () => {
    setOpen(false)
    setMobileNavOpen(false)
  }

  if (!isAuthed) return null

  return (
    <>
      <button
        ref={launcherRef}
        className="chat-launcher"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
          setMobileNavOpen(false)
        }}
        aria-label="Open support chat"
        aria-expanded={open}
        aria-controls="chat-widget-container"
      >
        {open ? "×" : "Support"}
      </button>

      {open && (
        <div
          ref={containerRef}
          id="chat-widget-container"
          className={`chat-container ${mobileNavOpen ? "drawer-open" : ""}`}
          role="dialog"
          aria-modal="true"
        >
          {/* Mobile scrim (tap to close drawer) */}
          <div
            className="chat-drawer-scrim"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />

          {/* Sidebar / drawer */}
          <div className="chat-sidebar">
            <div className="chat-sidebar-header">
              <strong>Help & Support</strong>
              <div className="chat-actions">
                {/* visible only on mobile via CSS .mobile-only */}
                <button
                  className="chat-close mobile-only"
                  aria-label="Close support"
                  title="Close"
                  onClick={handleClose}
                >
                  Exit
                </button>
              </div>
            </div>

            <button
              className="chat-new-btn-support"
              onClick={() => startNew("General help", "Hello, I need assistance.", null)}
            >
              + New chat
            </button>

            <div className="chat-thread-list">
              {threads.map((t) => (
                <div
                  key={t.threadId}
                  className={`chat-thread-item ${activeThreadId === t.threadId ? "active" : ""}`}
                  onClick={() => {
                    setActiveThreadId(t.threadId)
                    setMobileNavOpen(false)
                  }}
                >
                  <div className="chat-thread-topic">{t.topic || "Untitled"}</div>
                  <div className="chat-thread-meta">
                    <span data-status={t.status}>{t.status}</span>
                    <span>{formatDate(t.lastMessageAt)}</span>
                  </div>
                </div>
              ))}
              {threads.length === 0 && !loading && (
                <div className="chat-empty">No conversations yet.</div>
              )}
            </div>
          </div>

          {/* Main chat panel */}
          {activeThreadId ? (
            <SupportChatWindow
              threadId={activeThreadId}
              threadStatus={activeThread && activeThread.status} // let window disable input if closed
              onToggleDrawer={() => setMobileNavOpen((v) => !v)}
              onDeleted={(tid) => {
                setThreads((prev) => {
                  const next = prev.filter((t) => t.threadId !== tid)
                  setActiveThreadId((id) => (id === tid ? (next[0]?.threadId || null) : id))
                  if (next.length === 0) {
                    setOpen(false)
                    setMobileNavOpen(false)
                  }
                  return next
                })
              }}
            />
          ) : (
            <div className="chat-window-placeholder">
              Select a conversation or create a new one.
            </div>
          )}
        </div>
      )}
    </>
  )
}
