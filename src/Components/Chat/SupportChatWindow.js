"use client"

import { useEffect, useRef, useState } from "react"
import * as signalR from "@microsoft/signalr"
import { jwtDecode } from "jwt-decode"
import { API_BASE, HUB_URL } from "../../config"
import { authHeaders, getToken } from "../../utils/auth"
import {
  MessageCircle,
  Image as ImageIcon,
  Send,
  Loader2,
  AlertCircle
} from "lucide-react"
import "../../Styling/chat.css"

const DEFAULT_AVATAR = "Assets/default-avatar.jpg"

// Safely pick a user's photo url from typical fields
const pickAvatarUrl = (u) =>
  u?.profileImage ||
  u?.profilePictureUrl ||
  u?.avatarUrl ||
  u?.photoUrl ||
  ""

// Try to read userId from the JWT for fallback when /User/me is not available
function resolveUserIdFromToken() {
  try {
    const token = getToken()
    if (!token) return null
    const decoded = jwtDecode(token)
    const candidates = [
      "nameid",
      "sub",
      "uid",
      "userId",
      "UserId",
      "user_id",
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
    ]
    for (const k of candidates) {
      const v = decoded?.[k]
      if (v != null && `${v}`.trim() !== "") return `${v}`.trim()
    }
  } catch {}
  return null
}

export default function SupportChatWindow({ threadId }) {
  const [topic, setTopic] = useState("")
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [connected, setConnected] = useState(false)
  const [meAvatar, setMeAvatar] = useState(DEFAULT_AVATAR)

  const [isDragging, setIsDragging] = useState(false)

  const connRef = useRef(null)
  const endRef = useRef(null)
  const fileInputRef = useRef(null)

  const scrollToBottom = () => endRef.current?.scrollIntoView({ behavior: "smooth" })
  useEffect(() => { scrollToBottom() }, [messages])

  // Load current user's avatar once
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        // Prefer /User/me if your API supports it
        let res = await fetch(`${API_BASE}/User/me`, { headers: authHeaders() })
        if (!res.ok) {
          // Fallback: decode token and call /User/{id}
          const uid = resolveUserIdFromToken()
          if (uid) {
            res = await fetch(`${API_BASE}/User/${uid}`, { headers: authHeaders() })
          }
        }
        if (!alive) return
        if (!res?.ok) { setMeAvatar(DEFAULT_AVATAR); return }
        const u = await res.json()
        const url = pickAvatarUrl(u)
        setMeAvatar(url && typeof url === "string" ? url : DEFAULT_AVATAR)
      } catch {
        if (alive) setMeAvatar(DEFAULT_AVATAR)
      }
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load thread + connect hub on mount / thread change
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!threadId) return
      const res = await fetch(`${API_BASE}/Support/threads/${threadId}`, {
        headers: authHeaders()
      })
      if (!res.ok) return
      const dto = await res.json()
      if (cancelled) return

      setTopic(dto.topic || dto.title || `Thread #${threadId}`)
      setMessages(Array.isArray(dto.messages) ? dto.messages : [])

      await connectToHub(threadId)
    }

    load()

    return () => {
      cancelled = true
      if (connRef.current) {
        connRef.current.stop().catch(() => {})
        connRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const sendText = async () => {
    const text = input.trim()
    if (!text || !connRef.current || !threadId || sending) return
    setSending(true)
    try {
      await connRef.current.invoke("SendMessage", threadId, text)
      setInput("")
    } catch (e) {
      console.error(e)
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

      // IMPORTANT: matches your controller route: POST /api/Support/threads/{threadId}/photos
      const res = await fetch(`${API_BASE}/Support/threads/${threadId}/photos`, {
        method: "POST",
        headers: authHeaders(), // don't set content-type manually
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
    } catch (e) {
      console.error(e)
      alert("Failed to upload image.")
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

  return (
    <div className="chat-window" onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <div className="chat-window-header">
        <div className="chat-window-title">
          <strong>{topic || `Thread #${threadId}`}</strong>
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
              key={m.messageId || `${m.createdAt}-${m.senderUserId || (m.isSystem ? "sys" : "u")}`}
              className={`chat-msg ${m.isSystem ? "system" : m.senderIsAdmin ? "agent" : "user"}`}
            >
              <div className="chat-avatar">
                {m.isSystem ? (
                  <div className="sd-avatar system"><AlertCircle className="w-4 h-4" /></div>
                ) : m.senderIsAdmin ? (
                  <div className="sd-avatar agent">A</div>
                ) : (
                  // === USER AVATAR (real photo with dashboard styles) ===
                  <div className="sd-avatar user">
                    <img
                      className="sd-avatar-img"
                      src={meAvatar || DEFAULT_AVATAR}
                      alt="Your avatar"
                      loading="lazy"
                      draggable={false}
                      onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_AVATAR }}
                    />
                  </div>
                )}
              </div>

              <div className="chat-bubble">
                {m.body && <div className="chat-text">{m.body}</div>}

                {Array.isArray(m.attachments) && m.attachments.length > 0 && (
                  <div className="chat-attachments-grid">
                    {m.attachments.map((a) =>
                      a.kind === "image" ? (
                        <a
                          key={a.attachmentId || a.url}
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          className="chat-attachment"
                          title={a.fileName || "image"}
                        >
                          <img src={a.url} alt={a.fileName || "attachment"} />
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
            e.currentTarget.value = "" // allow re-upload same file
          }}
        />
        <button
          className="chat-img-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          title="Send a photo"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
        </button>

        <textarea
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
          placeholder={uploading ? "Uploading…" : "Type a message… (Enter to send)"}
          disabled={uploading || sending}
        />
        <button
          className="chat-send-btn"
          onClick={sendText}
          disabled={!input.trim() || sending || uploading}
          title="Send"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}
