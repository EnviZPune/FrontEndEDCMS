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

const DEFAULT_AVATAR_PUBLIC = "Assets/default-avatar.jpg"
const GCS_BUCKET = "edcms_bucket"
const GCS_BASE = `https://storage.googleapis.com/${GCS_BUCKET}`

const makeSafeName = (name = "") =>
  name.toString().replace(/[^a-zA-Z0-9.-]/g, "_").replace(/_+/g, "_").slice(0, 120)

const URL_REGEX = /https?:\/\/[^\s<>")]+/gi
const extractUrls = (text = "") => (typeof text === "string" ? text.match(URL_REGEX) || [] : [])
const isImageUrl = (u = "") => /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test((u.split("?")[0] || ""))

const pickAvatarUrl = (u) =>
  u?.profileImage || u?.profilePictureUrl || u?.avatarUrl || u?.photoUrl || ""

const pickDisplayName = (u) => {
  const joined = [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim()
  return u?.displayName || u?.fullName || (joined || null) || u?.name || u?.username || u?.email || ""
}

// Fallbacks from token
function resolveFromToken() {
  try {
    const token = getToken()
    if (!token) return { id: null, name: null }
    const d = jwtDecode(token)
    const idCandidates = [
      "nameid","sub","uid","userId","UserId","user_id",
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
    ]
    const nameCandidates = ["name","given_name","family_name","unique_name","preferred_username","email"]
    let id = null
    for (const k of idCandidates) {
      const v = d?.[k]
      if (v != null && `${v}`.trim() !== "") { id = `${v}`.trim(); break }
    }
    let name =
      (d?.given_name && d?.family_name ? `${d.given_name} ${d.family_name}`.trim() : null) || null
    if (!name) {
      for (const k of nameCandidates) {
        const v = d?.[k]
        if (v != null && `${v}`.trim() !== "") { name = `${v}`.trim(); break }
      }
    }
    return { id, name }
  } catch { return { id: null, name: null } }
}

// Make relative URLs absolute (and let data:/blob: through)
const apiOrigin = API_BASE.replace(/\/api\/?$/, "")
const fileUrl = (u) => {
  if (!u) return ""
  if (/^(https?:|data:|blob:)/i.test(u)) return u
  return `${apiOrigin}${u.startsWith("/") ? u : `/${u}`}`
}

// ---------- Dedupe helpers ----------
const attachmentsSig = (atts) => {
  if (!Array.isArray(atts) || atts.length === 0) return ""
  try {
    return atts
      .map((a) => (a?.url || a?.fileName || a?.attachmentId || "").toString())
      .filter(Boolean)
      .join("|")
  } catch { return "" }
}
const makeMsgSig = (m) => {
  if (!m) return ""
  if (m.messageId != null) return `id:${String(m.messageId)}`
  const sender = m.senderUserId != null ? String(m.senderUserId) : (m.senderIsAdmin ? "admin" : "user")
  const body = (m.body || "").trim()
  const att = attachmentsSig(m.attachments)
  return `sig:${sender}|${body}|${att}`
}
function useSeenLRU(cap = 600) {
  const setRef = useRef(new Set())
  const queueRef = useRef([])
  const has = (k) => setRef.current.has(k)
  const add = (k) => {
    if (setRef.current.has(k)) return
    setRef.current.add(k); queueRef.current.push(k)
    if (queueRef.current.length > cap) {
      const old = queueRef.current.shift()
      setRef.current.delete(old)
    }
  }
  const clear = () => { setRef.current = new Set(); queueRef.current = [] }
  return { has, add, clear }
}

const SupportChatWindow = forwardRef(function SupportChatWindow(
  { threadId, threadStatus, onDeleted, onToggleDrawer, onHamburger },
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

  const closedKeywords = ["closed", "resolved", "archived", "locked"]
  const canPost = !closedKeywords.includes((threadStatus || "").toLowerCase())

  // Preloaded default avatar (as blob: URL to stop revalidation/304s)
  const [defaultAvatarUrl, setDefaultAvatarUrl] = useState(DEFAULT_AVATAR_PUBLIC)
  const [meAvatar, setMeAvatar] = useState(DEFAULT_AVATAR_PUBLIC)
  const [meName, setMeName] = useState("You")

  const [isDragging, setIsDragging] = useState(false)
  const connRef = useRef(null)
  const endRef = useRef(null)
  const fileInputRef = useRef(null)
  const inputRef = useRef(null)

  const seenLRU = useSeenLRU(600)
  const pushIfNew = (m) => {
    const sig = makeMsgSig(m)
    if (seenLRU.has(sig)) return
    seenLRU.add(sig)
    setMessages((p) => [...p, m])
  }
  const rememberAll = (arr = []) => { for (const m of arr) seenLRU.add(makeMsgSig(m)) }

  const scrollToBottom = () => endRef.current?.scrollIntoView({ behavior: "smooth" })
  useEffect(() => { scrollToBottom() }, [messages])

  // PRELOAD default avatar once → blob: URL
  useEffect(() => {
    let objectUrl = null
    ;(async () => {
      try {
        const res = await fetch(DEFAULT_AVATAR_PUBLIC)
        if (!res.ok) return
        const blob = await res.blob()
        objectUrl = URL.createObjectURL(blob)
        setDefaultAvatarUrl(objectUrl)
        // if we were using the public path, swap to blob so it won't revalidate again
        setMeAvatar((prev) => (prev === DEFAULT_AVATAR_PUBLIC ? objectUrl : prev))
      } catch { /* ignore */ }
    })()
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [])

  // Load current user display + avatar (normalize URL!)
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
          setMeAvatar((prev) => prev || defaultAvatarUrl)
          if (name) setMeName(name)
          return
        }
        const u = await res.json()
        const url = pickAvatarUrl(u)
        const normalized = url ? fileUrl(url) : ""
        const display = pickDisplayName(u)
        setMeAvatar(normalized || defaultAvatarUrl)
        setMeName(display?.trim() ? display.trim() : (resolveFromToken().name || "You"))
      } catch {
        if (alive) {
          const { name } = resolveFromToken()
          setMeAvatar((prev) => prev || defaultAvatarUrl)
          if (name) setMeName(name)
        }
      }
    })()
    return () => { alive = false }
  }, [defaultAvatarUrl])

  // Load thread + connect hub
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!threadId) return
      const res = await fetch(`${API_BASE}/Support/threads/${threadId}`, {
        headers: authHeaders({ json: false })
      })
      if (!res.ok) return
      const dto = await res.json()
      if (cancelled) return

      const t = dto.topic || dto.title || `Thread #${threadId}`
      setTopic(t); setTopicDraft(t)
      const initial = Array.isArray(dto.messages) ? dto.messages : []
      setMessages(initial)
      rememberAll(initial)

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
      seenLRU.clear()
    }
  }, [threadId])

  const connectToHub = async (tid) => {
    if (connRef.current) { try { await connRef.current.stop() } catch {} }
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
      pushIfNew(normalized)
    })

    connection.onreconnected(async () => {
      setConnected(true)
      try { await connection.invoke("JoinThread", tid) } catch {}
    })
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
    if (!canPost) {
      alert("This conversation is closed. Start a new chat to continue.")
      keepFocus()
      return
    }
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

  // ---------- Image upload DIRECT to GCS ----------
  const uploadImageToGCS = async (file) => {
    const safe = makeSafeName(file.name || "chat")
    const hasExt = /\.[a-z0-9]+$/i.test(safe)
    const objectName = `${Date.now()}-${hasExt ? safe : `${safe}.jpg`}`
    const encoded = encodeURIComponent(objectName)
    const imgUrl = `${GCS_BASE}/${encoded}`
    const txtUrl = `${imgUrl}.txt`
    const contentType = file.type || "image/jpeg"

    const imgRes = await fetch(imgUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: file
    })
    if (!imgRes.ok) {
      let t = ""
      try { t = await imgRes.text() } catch {}
      throw new Error(`GCS PUT failed (${imgRes.status}) ${t}`)
    }

    const txtRes = await fetch(txtUrl, {
      method: "PUT",
      headers: { "Content-Type": "text/plain" },
      body: imgUrl
    })
    if (!txtRes.ok) {
      let t = ""
      try { t = await txtRes.text() } catch {}
      console.warn("Companion .txt PUT failed:", txtRes.status, t)
    }

    return imgUrl
  }

  const onPickImage = async (file) => {
    if (!file || uploading) return
    if (!file.type.startsWith("image/")) { alert("Please choose an image."); return }
    if (file.size > 10 * 1024 * 1024) { alert("Image is too large (max 10MB)."); return }
    if (!canPost) { alert("This conversation is closed. Uploads are disabled."); keepFocus(); return }

    setUploading(true)
    try {
      const url = await uploadImageToGCS(file)
      if (connRef.current) {
        const body = input.trim() ? `${input.trim()}\n${url}` : url
        await connRef.current.invoke("SendMessage", threadId, body)
      }
      if (input.trim()) setInput("")
      keepFocus()
    } catch (e) {
      console.error(e)
      alert("Failed to upload image. Please check bucket billing/ACL and try again.")
      keepFocus()
    } finally { setUploading(false) }
  }

  // Drag & drop (throttled)
  const dragRAF = useRef(null)
  const onDragOver = (e) => {
    if (!canPost) return
    e.preventDefault()
    if (dragRAF.current) return
    dragRAF.current = requestAnimationFrame(() => {
      dragRAF.current = null
      setIsDragging((d) => (d ? d : true))
    })
  }
  const onDragLeave = () => setIsDragging((d) => (d ? false : d))
  const onDrop = (e) => {
    if (!canPost) return
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer?.files?.[0]
    if (file) onPickImage(file)
  }

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
      ref={ref}
    >
      <div className="chat-window-header">
        <button
          className="hamburger-btn"
          aria-label="Open chat list"
          onClick={() => {
            if (typeof onToggleDrawer === "function") { onToggleDrawer(); return }
            if (typeof onHamburger === "function") { onHamburger(); return }
            document.querySelector(".chat-container")?.classList.toggle("drawer-open")
          }}
        >
          <span className="hamburger-bar" />
          <span className="hamburger-bar" />
          <span className="hamburger-bar" />
        </button>

        <div className="chat-window-title" style={{ gap: 8 }}>
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
                <Check className="w-4 h-4" />
              </button>
              <button
                className="topic-cancel"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { setTopicDraft(topic); setEditingTopic(false) }}
                title="Cancel"
                disabled={deleting}
              >
                <X className="w-4 h-4" />
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
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            </>
          )}
        </div>

        <div className="chat-conn">
          <div className={`conn-dot ${connected ? "online" : "offline"}`} />
          <span>{connected ? "Connected" : "Disconnected"}</span>
        </div>
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-messages-empty">
            <MessageCircle className="w-10 h-10 opacity-30" />
            <div>No messages yet</div>
          </div>
        ) : (
          messages.map((m) => {
            const urls = extractUrls(m.body)
            const imageUrls = urls.filter(isImageUrl)
            const linkUrls = urls.filter((u) => !isImageUrl(u))
            const textOnly = (m.body || "").replace(URL_REGEX, "").trim()

            return (
              <div
                key={m.messageId || makeMsgSig(m)}
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
                        src={meAvatar || defaultAvatarUrl}
                        alt="Your avatar"
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                        onError={(e) => {
                          e.currentTarget.onerror = null
                          e.currentTarget.src = defaultAvatarUrl
                        }}
                      />
                    </div>
                  )}
                </div>

                <div className="chat-bubble">
                  <div className="chat-author">{authorNameFor(m)}</div>

                  {/* Text body */}
                  {textOnly && (
                    <div className="chat-text">
                      {textOnly.split(/\n/g).map((line, i) => (
                        <p key={i} style={{ margin: 0 }}>{line}</p>
                      ))}
                    </div>
                  )}

                  {/* Attachments (images) */}
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
                            <img src={fileUrl(a.url)} alt={a.fileName || "attachment"} />
                          </a>
                        ) : null
                      )}
                    </div>
                  )}

                  {/* Inline image URLs */}
                  {(!m.attachments || m.attachments.length === 0) && imageUrls.length > 0 && (
                    <div className="chat-attachments-grid">
                      {Array.from(new Set(imageUrls)).map((u) => (
                        <a
                          key={u}
                          href={u}
                          target="_blank"
                          rel="noreferrer"
                          className="chat-attachment"
                          title="image"
                        >
                          <img src={u} alt="attachment" />
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Other links */}
                  {linkUrls.length > 0 && (
                    <div className="chat-links">
                      {Array.from(new Set(linkUrls)).map((u) => (
                        <a key={u} href={u} target="_blank" rel="noreferrer">{u}</a>
                      ))}
                    </div>
                  )}

                  <div className="chat-time">{formatTime(m.createdAt)}</div>
                </div>
              </div>
            )
          })
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
          disabled={uploading || deleting || !canPost}
          title={canPost ? "Send a photo" : "This conversation is closed"}
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
          placeholder={
            deleting
              ? "Deleting…"
              : uploading
              ? "Uploading…"
              : canPost
              ? "Type a message…"
              : "This conversation is closed"
          }
          disabled={uploading || sending || deleting || !canPost}
        />
        <button
          className="chat-send-btn"
          onMouseDown={(e) => e.preventDefault()}
          onClick={sendText}
          disabled={!input.trim() || sending || uploading || deleting || !canPost}
          title={canPost ? "Send" : "This conversation is closed"}
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
})

export default SupportChatWindow
