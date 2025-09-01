"use client"

import { useEffect, useRef, useState, forwardRef } from "react"
import * as signalR from "@microsoft/signalr"
import { jwtDecode } from "jwt-decode"
import { API_BASE, HUB_URL } from "../../config"
import { authHeaders, getToken } from "../../utils/auth"
import {
  MessageCircle,
  Image as ImageIcon,
  Send,
  Loader2,
  AlertCircle,
  Pencil,
  Check,
  X,
  Trash2
} from "lucide-react"
import "../../Styling/chat.css"

const DEFAULT_AVATAR = "Assets/default-avatar.jpg"

// Pick a user photo URL from common fields
const pickAvatarUrl = (u) =>
  u?.profileImage || u?.profilePictureUrl || u?.avatarUrl || u?.photoUrl || ""

// Pick a display name from common fields
const pickDisplayName = (u) => {
  const joined = [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim()
  return (
    u?.displayName ||
    u?.fullName ||
    (joined || null) ||
    u?.name ||
    u?.username ||
    u?.email ||
    ""
  )
}

// Try to read fields from the JWT for fallback when /User/me isn’t available
function resolveFromToken() {
  try {
    const token = getToken()
    if (!token) return { id: null, name: null }
    const d = jwtDecode(token)
    const idCandidates = [
      "nameid",
      "sub",
      "uid",
      "userId",
      "UserId",
      "user_id",
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
    ]
    const nameCandidates = [
      "name",
      "given_name",
      "family_name",
      "unique_name",
      "preferred_username",
      "email"
    ]
    let id = null
    for (const k of idCandidates) {
      const v = d?.[k]
      if (v != null && `${v}`.trim() !== "") { id = `${v}`.trim(); break }
    }
    let name =
      (d?.given_name && d?.family_name
        ? `${d.given_name} ${d.family_name}`.trim()
        : null) || null
    if (!name) {
      for (const k of nameCandidates) {
        const v = d?.[k]
        if (v != null && `${v}`.trim() !== "") { name = `${v}`.trim(); break }
      }
    }
    return { id, name }
  } catch {
    return { id: null, name: null }
  }
}

// Make a relative "/uploads/..." into absolute
const apiOrigin = API_BASE.replace(/\/api\/?$/, "")
const fileUrl = (u) => {
  if (!u) return ""
  if (/^https?:\/\//i.test(u)) return u
  return `${apiOrigin}${u.startsWith("/") ? u : `/${u}`}`
}

// Merge forwarded ref + local ref safely
function setRefs(node, forwardedRef, localRef) {
  localRef.current = node
  if (!forwardedRef) return
  if (typeof forwardedRef === "function") forwardedRef(node)
  else forwardedRef.current = node
}

const SupportChatWindow = forwardRef(function SupportChatWindow(
  { threadId, onDeleted, onToggleDrawer }, // onToggleDrawer is optional
  ref
) {
  const [topic, setTopic] = useState("")
  const [editingTopic, setEditingTopic] = useState(false)
  const [topicDraft, setTopicDraft] = useState("")
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [connected, setConnected] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Drawer state (for aria + morphing hamburger)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Current (end) user identity for avatar + name on their messages
  const [meAvatar, setMeAvatar] = useState(DEFAULT_AVATAR)
  const [meName, setMeName] = useState("You")

  const [isDragging, setIsDragging] = useState(false)

  const connRef = useRef(null)
  const endRef = useRef(null)
  const fileInputRef = useRef(null)
  const inputRef = useRef(null)
  const rootRef = useRef(null)
  const scrimRef = useRef(null)

  // Helpers to get the nearest .chat-container
  const getContainer = () => rootRef.current?.closest(".chat-container") || null
  const openDrawer = () => {
    const c = getContainer()
    if (!c) return
    c.classList.add("drawer-open")
    setDrawerOpen(true)
  }
  const closeDrawer = () => {
    const c = getContainer()
    if (!c) return
    c.classList.remove("drawer-open")
    setDrawerOpen(false)
  }
  const toggleDrawer = () => {
    if (typeof onToggleDrawer === "function") {
      onToggleDrawer()
      return
    }
    const c = getContainer()
    if (!c) return
    const willOpen = !c.classList.contains("drawer-open")
    c.classList.toggle("drawer-open", willOpen)
    setDrawerOpen(willOpen)
  }

  // Create scrim if not present; add Esc close
  useEffect(() => {
    const c = getContainer()
    if (!c) return

    // sync initial state
    setDrawerOpen(c.classList.contains("drawer-open"))

    let scrim = c.querySelector(".chat-drawer-scrim")
    let created = false
    if (!scrim) {
      scrim = document.createElement("div")
      scrim.className = "chat-drawer-scrim"
      c.appendChild(scrim)
      created = true
    }
    scrimRef.current = scrim
    const onScrimClick = () => closeDrawer()
    scrim.addEventListener("click", onScrimClick)

    const onKey = (e) => {
      if (e.key === "Escape") closeDrawer()
    }
    window.addEventListener("keydown", onKey)

    // Cleanup
    return () => {
      scrim?.removeEventListener("click", onScrimClick)
      window.removeEventListener("keydown", onKey)
      // If we created the scrim, remove on unmount
      if (created && scrim?.parentElement === c) c.removeChild(scrim)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const scrollToBottom = () => endRef.current?.scrollIntoView({ behavior: "smooth" })
  useEffect(() => { scrollToBottom() }, [messages])

  // Load current user's avatar & name once
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        let res = await fetch(`${API_BASE}/User/me`, { headers: authHeaders({ json: false }) })
        if (!res.ok) {
          const { id, name } = resolveFromToken()
          if (id) res = await fetch(`${API_BASE}/User/${id}`, { headers: authHeaders({ json: false }) })
          if (alive && name) setMeName(name)
        }
        if (!alive) return
        if (!res?.ok) {
          const { name } = resolveFromToken()
          setMeAvatar(DEFAULT_AVATAR)
          if (name) setMeName(name)
          return
        }
        const u = await res.json()
        const url = pickAvatarUrl(u)
        const display = pickDisplayName(u)
        setMeAvatar(url && typeof url === "string" ? url : DEFAULT_AVATAR)
        setMeName(display?.trim() ? display.trim() : (resolveFromToken().name || "You"))
      } catch {
        if (alive) {
          const { name } = resolveFromToken()
          setMeAvatar(DEFAULT_AVATAR)
          if (name) setMeName(name)
        }
      }
    })()
    return () => { alive = false }
  }, [])

  // Load thread + connect hub on mount / thread change
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!threadId) return
      const res = await fetch(`${API_BASE}/Support/threads/${threadId}`, { headers: authHeaders({ json: false }) })
      if (!res.ok) return
      const dto = await res.json()
      if (cancelled) return

      const t = dto.topic || dto.title || `Thread #${threadId}`
      setTopic(t)
      setTopicDraft(t)
      setMessages(Array.isArray(dto.messages) ? dto.messages : [])

      await connectToHub(threadId)
      requestAnimationFrame(() => inputRef.current?.focus())
    }

    load()

    return () => {
      cancelled = true
      if (connRef.current) {
        connRef.current.stop().catch(() => {})
        connRef.current = null
      }
    }
  }, [threadId])

  const connectToHub = async (tid) => {
    if (connRef.current) {
      try { await connRef.current.stop() } catch {}
    }
    const token = getToken()
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, { accessTokenFactory: () => token || "" })
      .withAutomaticReconnect([0, 2000, 10000, 30000])
      .build()

    connRef.current = connection

    connection.on("message", (msg) => {
      const normalized = {
        ...msg,
        createdAt: msg.createdAt || new Date().toISOString(),
        attachments: Array.isArray(msg.attachments) ? msg.attachments : []
      }
      setMessages((prev) => [...prev, normalized])
    })

    connection.onreconnected(() => setConnected(true))
    connection.onreconnecting(() => setConnected(false))
    connection.onclose(() => setConnected(false))

    try {
      await connection.start()
      setConnected(true)
      await connection.invoke("JoinThread", tid)
    } catch (e) {
      console.error("SupportHub connect error", e)
      setConnected(false)
    }
  }

  const formatTime = (dateString) => {
    if (!dateString) return ""
    const d = new Date(dateString)
    const now = new Date()
    const mins = Math.floor((now - d) / 60000)
    if (mins < 1) return "Just now"
    if (mins < 60) return `${mins}m ago`
    if (mins < 1440) return `${Math.floor(mins / 60)}h ago`
    return d.toLocaleDateString()
  }

  const keepFocus = () => requestAnimationFrame(() => inputRef.current?.focus())

  const sendText = async () => {
    const text = input.trim()
    if (!text || !connRef.current || !threadId || sending) return
    setSending(true)
    try {
      await connRef.current.invoke("SendMessage", threadId, text)
      setInput("")
      keepFocus()
    } catch (e) {
      console.error(e)
      keepFocus()
    } finally {
      setSending(false)
    }
  }

  // ---------- Image upload ----------
  const onPickImage = async (file) => {
    if (!file || uploading) return
    if (!file.type.startsWith("image/")) { alert("Please choose an image."); return }
    if (file.size > 10 * 1024 * 1024) { alert("Image is too large (max 10MB)."); return }

    setUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      if (input.trim()) form.append("caption", input.trim())

      const res = await fetch(`${API_BASE}/Support/threads/${threadId}/photos`, {
        method: "POST",
        headers: authHeaders({ json: false }),
        body: form
      })
      if (!res.ok) {
        const t = await res.text().catch(() => "")
        throw new Error(t || `Upload failed (${res.status})`)
      }

      const dto = await res.json()
      const normalized = {
        ...dto,
        createdAt: dto.createdAt || new Date().toISOString(),
        attachments: Array.isArray(dto.attachments) ? dto.attachments : []
      }
      setMessages((prev) => [...prev, normalized])
      if (input.trim()) setInput("")
      keepFocus()
    } catch (e) {
      console.error(e)
      alert("Failed to upload image.")
      keepFocus()
    } finally {
      setUploading(false)
    }
  }

  // Drag & drop handlers
  const onDragOver = (e) => { e.preventDefault(); setIsDragging(true) }
  const onDragLeave = () => setIsDragging(false)
  const onDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer?.files?.[0]
    if (file) onPickImage(file)
  }

  // ---------- Topic rename ----------
  const saveTopic = async () => {
    const newTopic = topicDraft.trim()
    if (!newTopic || newTopic === topic) { setEditingTopic(false); return }
    try {
      const res = await fetch(`${API_BASE}/Support/threads/${threadId}/topic`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ topic: newTopic })
      })
      if (!res.ok) {
        const txt = await res.text().catch(() => "")
        throw new Error(txt || `Failed (${res.status})`)
      }
      const dto = await res.json()
      setTopic(dto.topic || newTopic)
      setEditingTopic(false)
      keepFocus()
    } catch (e) {
      console.error(e)
      alert("Couldn't update the subject.")
      keepFocus()
    }
  }

  // ---------- Delete chat (thread) ----------
  const deleteThread = async () => {
    if (!threadId || deleting) return
    const ok = window.confirm("Delete this conversation permanently? This cannot be undone.")
    if (!ok) return
    setDeleting(true)
    try {
      const res = await fetch(`${API_BASE}/Support/threads/${threadId}`, {
        method: "DELETE",
        headers: authHeaders({ json: false })
      })
      if (!(res.ok || res.status === 204)) {
        const body = await res.text().catch(() => "")
        throw new Error(body || `Delete failed (${res.status})`)
      }

      if (connRef.current) {
        try { await connRef.current.stop() } catch {}
        connRef.current = null
      }
      setConnected(false)

      setMessages([])
      setTopic("(deleted)")
      setTopicDraft("(deleted)")

      if (typeof onDeleted === "function") onDeleted(threadId)
    } catch (e) {
      console.error(e)
      alert("Couldn't delete this conversation.")
    } finally {
      setDeleting(false)
      keepFocus()
    }
  }

  // Resolve author label for a message
  const authorNameFor = (m) => {
    if (m.isSystem) return "System"
    if (m.senderIsAdmin) return (m.senderName && m.senderName.trim()) || "Support"
    return (m.senderName && m.senderName.trim()) || (meName?.trim() || "You")
  }

  return (
    <div
      className="chat-window"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      ref={(node) => setRefs(node, ref, rootRef)}
    >
      <div className="chat-window-header">
        <button
          className="hamburger-btn"
          aria-label={drawerOpen ? "Close chat list" : "Open chat list"}
          aria-expanded={drawerOpen}
          onClick={toggleDrawer}
        >
          <span className="hamburger-bar" />
          <span className="hamburger-bar" />
          <span className="hamburger-bar" />
        </button>

        <div className="chat-window-title">
          {editingTopic ? (
            <div className="topic-edit">
              <input
                className="topic-input"
                value={topicDraft}
                onChange={(e) => setTopicDraft(e.target.value)}
                maxLength={300}
                autoFocus
                disabled={deleting}
              />
              <button
                className="topic-commit"
                onMouseDown={(e) => e.preventDefault()}
                onClick={saveTopic}
                title="Save"
                disabled={deleting}
              >
                <Check className="w-4 h-4" style={{color: "black"}}/>
              </button>
              <button
                className="topic-cancel"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setTopicDraft(topic)
                  setEditingTopic(false)
                  keepFocus()
                }}
                title="Cancel"
                disabled={deleting}
              >
                <X className="w-4 h-4" style={{color: "black"}}/>
              </button>
            </div>
          ) : (
            <>
              <strong>{topic || `Thread #${threadId}`}</strong>
              <button
                className="topic-edit-btn"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setEditingTopic(true)}
                title="Rename subject"
                disabled={deleting}
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                className="chat-delete-btn"
                onMouseDown={(e) => e.preventDefault()}
                onClick={deleteThread}
                title="Delete chat"
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            </>
          )}
        </div>

        <div className="chat-conn">
          <div className={`conn-dot ${connected ? "online" : "offline"}`} />
          <span>{connected ? "Connected" : "Disconnected"}</span>
        </div>
      </div>

      {isDragging && (
        <div className="chat-drop-overlay">
          <ImageIcon className="w-8 h-8" />
          <div>Drop image to upload</div>
        </div>
      )}

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-messages-empty">
            <MessageCircle className="w-10 h-10 opacity-30" />
            <div>No messages yet</div>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={
                m.messageId ||
                `${m.createdAt}-${m.senderUserId || (m.isSystem ? "sys" : "u")}`
              }
              className={`chat-msg ${m.isSystem ? "system" : m.senderIsAdmin ? "agent" : "user"}`}
            >
              <div className="chat-avatar">
                {m.isSystem ? (
                  <div className="sd-avatar system">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                ) : m.senderIsAdmin ? (
                  <div className="sd-avatar agent">A</div>
                ) : (
                  <div className="sd-avatar user">
                    <img
                      className="sd-avatar-img"
                      src={meAvatar || DEFAULT_AVATAR}
                      alt="Your avatar"
                      loading="lazy"
                      draggable={false}
                      onError={(e) => {
                        e.currentTarget.onerror = null
                        e.currentTarget.src = DEFAULT_AVATAR
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="chat-bubble">
                <div className="chat-author">{authorNameFor(m)}</div>
                {m.body && <div className="chat-text">{m.body}</div>}
                {Array.isArray(m.attachments) && m.attachments.length > 0 && (
                  <div className="chat-attachments-grid">
                    {m.attachments.map((a) =>
                      a.kind === "image" ? (
                        <a
                          key={a.attachmentId || a.url}
                          href={fileUrl(a.url)}
                          target="_blank"
                          rel="noreferrer"
                          className="chat-attachment"
                          title={a.fileName || "image"}
                        >
                          <img
                            src={fileUrl(a.url)}
                            alt={a.fileName || "attachment"}
                          />
                        </a>
                      ) : null
                    )}
                  </div>
                )}
                <div className="chat-time">{formatTime(m.createdAt)}</div>
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <div className="chat-input-row">
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onPickImage(f)
            e.currentTarget.value = ""
          }}
        />
        <button
          className="chat-img-btn"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || deleting}
          title="Send a photo"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
        </button>

        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              sendText()
            }
          }}
          className="chat-input"
          rows={1}
          placeholder={deleting ? "Deleting…" : uploading ? "Uploading…" : "Type a message…"}
          disabled={uploading || sending || deleting}
        />
        <button
          className="chat-send-btn"
          onMouseDown={(e) => e.preventDefault()}
          onClick={sendText}
          disabled={!input.trim() || sending || uploading || deleting}
          title="Send"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
})

export default SupportChatWindow
