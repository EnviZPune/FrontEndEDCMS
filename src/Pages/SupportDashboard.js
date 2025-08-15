import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { jwtDecode } from "jwt-decode"
import * as signalR from "@microsoft/signalr"
import { API_BASE, HUB_URL } from "../config"
import { authHeaders, getToken } from "../utils/auth"
import {
  MessageCircle,
  Users,
  Clock,
  CheckCircle,
  AlertCircle,
  Send,
  User as UserIcon,
  Bot,
  Loader2,
  ShieldCheck,
  XCircle,
  Pencil,
  Check,
  X
} from "lucide-react"
import "../Styling/support-dashboard.css"

 const USER_PROFILE_BASE = "/profile";
 const profilePath = (id) => `${USER_PROFILE_BASE}/${id}`;
 const DEFAULT_AVATAR_PATH = "Assets/default-avatar.jpg"

// Safely pick common avatar fields
const pickAvatarUrl = (u) =>
  u?.profileImage ||
  u?.profilePictureUrl ||
  u?.avatarUrl ||
  u?.photoUrl ||
  ""

// Safely pick a display name
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

export default function SupportDashboard() {
  const navigate = useNavigate()

  // Auth gate
  const [authChecked, setAuthChecked] = useState(false)
  const [authorized, setAuthorized] = useState(false)

  // Data/UI state
  const [threads, setThreads] = useState([])
  const [myThreads, setMyThreads] = useState([])
  const [filterUnassigned, setFilterUnassigned] = useState(true)
  const [activeThreadId, setActiveThreadId] = useState(null)
  const [activeStatus, setActiveStatus] = useState(null) // "Open" | "Pending" | "Closed"
  const [messages, setMessages] = useState([])
  const [topic, setTopic] = useState("")
  const [editingTopic, setEditingTopic] = useState(false)
  const [topicDraft, setTopicDraft] = useState("")
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [denied, setDenied] = useState(false)
  const [sending, setSending] = useState(false)
  const [closing, setClosing] = useState(false)
  const inputRef = useRef(null)

  // Connection state
  const [connected, setConnected] = useState(false)

  // Profiles cache: { [userId: string]: { avatar: string, name: string } }
  const [profiles, setProfiles] = useState({})
  const pendingProfileIdsRef = useRef(new Set())

  // Track message IDs we've already rendered (prevents duplicate renders/remounts)
  const seenMessageIdsRef = useRef(new Set())

  // Refs
  const connRef = useRef(null)
  const messagesEndRef = useRef(null)

  // ----- Auth guard: Admin only -----
  useEffect(() => {
    const token = getToken()
    if (!token) {
      navigate("/unauthorized", { replace: true })
      return
    }
    try {
      const decoded = jwtDecode(token)
      const rawRoles =
        decoded["roles"] ??
        decoded["role"] ??
        decoded["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"]

      const roleArray = Array.isArray(rawRoles)
        ? rawRoles
        : typeof rawRoles === "string"
        ? rawRoles.split(/[,\s]+/).filter(Boolean)
        : []

      const isAdmin = roleArray.some((r) => String(r).toLowerCase() === "admin")
      if (!isAdmin) {
        navigate("/unauthorized", { replace: true })
        return
      }

      setAuthorized(true)
      setAuthChecked(true)
    } catch {
      navigate("/unauthorized", { replace: true })
    }
  }, [navigate])

  // Cleanup SignalR on unmount
  useEffect(() => {
    return () => {
      if (connRef.current) {
        connRef.current.stop().catch(() => {})
      }
    }
  }, [])

  // ----- Helpers -----
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const fetchJson = async (url, init = {}) => {
    const res = await fetch(url, { headers: authHeaders(), ...init })
    if (res.status === 401 || res.status === 403) {
      setDenied(true)
      return null
    }
    setDenied(false)
    if (res.status === 204) return {}
    return res.ok ? res.json() : null
  }

  const loadQueue = async () => {
    setLoading(true)
    const data = await fetchJson(`${API_BASE}/Support/queue?unassignedOnly=${filterUnassigned}`)
    if (data) setThreads(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  const loadMine = async () => {
    const data = await fetchJson(`${API_BASE}/Support/my-threads`)
    if (data) setMyThreads(Array.isArray(data) ? data : [])
  }

  // ----- Profiles (avatar + name) fetcher for end-users in the thread -----
  const fetchMissingProfiles = async (userIds /* array<string> */) => {
    if (!userIds.length) return
    try {
      const results = await Promise.all(
        userIds.map(async (uid) => {
          try {
            const res = await fetch(`${API_BASE}/User/${uid}`, { headers: authHeaders() })
            if (!res.ok) {
              return [uid, { avatar: DEFAULT_AVATAR_PATH, name: `User #${uid}` }]
            }
            const u = await res.json()
            const url = pickAvatarUrl(u)
            const name = pickDisplayName(u)
            return [
              uid,
              {
                avatar: url && typeof url === "string" ? url : DEFAULT_AVATAR_PATH,
                name: name?.trim() ? name.trim() : `User #${uid}`
              }
            ]
          } catch {
            return [uid, { avatar: DEFAULT_AVATAR_PATH, name: `User #${uid}` }]
          }
        })
      )
      setProfiles((prev) => {
        let changed = false
        const next = { ...prev }
        for (const [uid, data] of results) {
          const key = String(uid)
          const val = data || { avatar: DEFAULT_AVATAR_PATH, name: `User #${uid}` }
          const prevVal = next[key]
          if (!prevVal || prevVal.avatar !== val.avatar || prevVal.name !== val.name) {
            next[key] = val
            changed = true
          }
        }
        return changed ? next : prev
      })
    } finally {
      userIds.forEach((id) => pendingProfileIdsRef.current.delete(String(id)))
    }
  }

  // Determine which user IDs we still need profiles for (only end-users)
  const missingProfileIds = useMemo(() => {
    if (!messages?.length) return []
    const ids = new Set()
    for (const m of messages) {
      if (m?.isSystem || m?.senderIsAdmin) continue
      const raw = m?.senderUserId
      const strId = String(raw ?? "")
      if (!strId) continue
      if (!Number.isFinite(Number(strId))) continue
      if (!profiles[strId] && !pendingProfileIdsRef.current.has(strId)) {
        ids.add(strId)
      }
    }
    return Array.from(ids)
  }, [messages, profiles])

  // Fetch missing profiles as they appear
  useEffect(() => {
    if (!missingProfileIds.length) return
    missingProfileIds.forEach((id) => pendingProfileIdsRef.current.add(String(id)))
    fetchMissingProfiles(missingProfileIds)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missingProfileIds])

  // ----- Thread open + hub connection -----
  const openThread = async (id) => {
    setActiveThreadId(id)
    seenMessageIdsRef.current = new Set()

    const dto = await fetchJson(`${API_BASE}/Support/threads/${id}`)
    if (!dto) return

    const t = dto.topic || dto.title || `Thread #${id}`
    setTopic(t)
    setTopicDraft(t)

    const initialMessages = Array.isArray(dto.messages) ? dto.messages : []
    setMessages(initialMessages)
    for (const m of initialMessages) {
      if (m?.messageId != null) {
        seenMessageIdsRef.current.add(String(m.messageId))
      }
    }

    setActiveStatus(dto.status || "Open")
    await connectToHub(id)
  }

  const connectToHub = async (threadId) => {
    if (connRef.current) {
      try {
        await connRef.current.stop()
      } catch {}
    }
    const token = getToken()
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, { accessTokenFactory: () => token || "" })
      .withAutomaticReconnect([0, 2000, 10000, 30000])
      .build()

    connRef.current = connection

    connection.on("message", (msg) => {
      // Dedupe
      const id = msg?.messageId
      if (id != null) {
        const key = String(id)
        if (seenMessageIdsRef.current.has(key)) return
        seenMessageIdsRef.current.add(key)
      } else {
        const fallbackKey = `${msg?.createdAt || ""}|${msg?.senderUserId || ""}|${msg?.body || ""}`
        if (seenMessageIdsRef.current.has(fallbackKey)) return
        seenMessageIdsRef.current.add(fallbackKey)
      }

      const normalized = {
        ...msg,
        senderIsAdmin: !!msg.senderIsAdmin,
        createdAt: msg.createdAt || new Date().toISOString(),
        attachments: Array.isArray(msg.attachments) ? msg.attachments : []
      }
      setMessages((prev) => [...prev, normalized])
    })

    connection.on("ThreadClosed", (dto) => {
      if (dto?.threadId === threadId) {
        setActiveStatus("Closed")
        setMessages((prev) => [
          ...prev,
          {
            isSystem: true,
            body: "Thread was closed.",
            createdAt: dto.closedAt || new Date().toISOString()
          }
        ])
        loadQueue()
        loadMine()
      }
    })

    connection.onreconnected(() => setConnected(true))
    connection.onreconnecting(() => setConnected(false))
    connection.onclose(() => setConnected(false))

    try {
      await connection.start()
      setConnected(true)
      await connection.invoke("JoinThread", threadId)
    } catch (e) {
      setConnected(false)
      console.error("SupportHub connect error", e)
    }
  }

  // ----- Actions -----
  const assignToMe = async (id) => {
    const res = await fetch(`${API_BASE}/Support/threads/${id}/assign`, {
      method: "PUT",
      headers: authHeaders(),
      body: ""
    })
    if (res.status === 401 || res.status === 403) {
      setDenied(true)
      return
    }
    await loadQueue()
    await loadMine()
  }

 const send = async () => {
  const text = input.trim()
  if (!text || !connRef.current || !activeThreadId || sending) return
  if ((activeStatus || "").toLowerCase() === "closed") return

  setSending(true)
  try {
    await connRef.current.invoke("SendMessage", activeThreadId, text)
    setInput("")
    requestAnimationFrame(() => inputRef.current?.focus()) // ← keep focus after send
  } catch (e) {
    console.error(e)
    requestAnimationFrame(() => inputRef.current?.focus()) // still refocus on error
  } finally {
    setSending(false)
  }
}


  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const closeThread = async () => {
    if (!activeThreadId || closing) return
    if ((activeStatus || "").toLowerCase() === "closed") return

    setClosing(true)
    try {
      const res = await fetch(`${API_BASE}/Support/threads/${activeThreadId}/close`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify("Resolved by support.")
      })
      if (res.status === 401 || res.status === 403) {
        setDenied(true)
        return
      }
      if (!res.ok && res.status !== 204) {
        const body = await res.text()
        throw new Error(body || `Failed to close: ${res.status}`)
      }

      setActiveStatus("Closed")
      setMessages((prev) => [
        ...prev,
        { isSystem: true, body: "Thread closed by support.", createdAt: new Date().toISOString() }
      ])

      setThreads((prev) => prev.map((t) => (t.threadId === activeThreadId ? { ...t, status: "Closed" } : t)))
      setMyThreads((prev) => prev.map((t) => (t.threadId === activeThreadId ? { ...t, status: "Closed" } : t)))
    } catch (e) {
      console.error(e)
      alert("Failed to close the thread.")
    } finally {
      setClosing(false)
    }
  }

  // Rename topic (admin)
  const saveTopic = async () => {
    if (!activeThreadId) return
    const newTopic = topicDraft.trim()
    if (!newTopic || newTopic === topic) { setEditingTopic(false); return }
    try {
      const res = await fetch(`${API_BASE}/Support/threads/${activeThreadId}/topic`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ topic: newTopic })
      })
      if (!res.ok) {
        const txt = await res.text().catch(()=> "")
        throw new Error(txt || `Failed (${res.status})`)
      }
      const dto = await res.json()
      const t = dto.topic || newTopic
      setTopic(t)
      setEditingTopic(false)

      // Update lists
      setThreads((prev) => prev.map(x => x.threadId === activeThreadId ? { ...x, topic: t, title: t } : x))
      setMyThreads((prev) => prev.map(x => x.threadId === activeThreadId ? { ...x, topic: t, title: t } : x))
    } catch (e) {
      console.error(e)
      alert("Couldn't update the subject.")
    }
  }

  // ----- UI helpers -----
  const getStatusIcon = (status) => {
    switch ((status || "").toLowerCase()) {
      case "open":
        return <CheckCircle className="w-3 h-3" />
      case "pending":
        return <Clock className="w-3 h-3" />
      case "closed":
        return <AlertCircle className="w-3 h-3" />
      default:
        return <MessageCircle className="w-3 h-3" />
    }
  }

  const getStatusColor = (status) => {
    switch ((status || "").toLowerCase()) {
      case "open":
        return "status-open"
      case "pending":
        return "status-pending"
      case "closed":
        return "status-closed"
      default:
        return "status-default"
    }
  }

  const formatTime = (dateString) => {
    if (!dateString) return ""
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now - date) / (1000 * 60))
    if (diffInMinutes < 1) return "Just now"
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
    return date.toLocaleDateString()
  }

  // Resolve author label for a message (admin’s view)
  const authorNameFor = (m) => {
    if (m.isSystem) return "System"
    if (m.senderIsAdmin) return (m.senderName && m.senderName.trim()) || "Support"
    const key = String(m?.senderUserId ?? "")
    const profile = key ? profiles[key] : null
    return (m.senderName && m.senderName.trim()) || profile?.name || (key ? `User #${key}` : "User")
  }

  // ----- Initial loads (after auth) -----
  useEffect(() => {
    if (!authChecked || !authorized) return
    loadQueue()
    loadMine()
  }, [authChecked, authorized, filterUnassigned])

  // ----- Early returns -----
  if (!authChecked) {
    return (
      <div className="sd-loading">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span>Checking access…</span>
      </div>
    )
  }

  if (!authorized) return null

  if (denied) {
    return (
      <div className="sd-denied">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2>Access Denied</h2>
        <p>You don't have permission to access the support dashboard.</p>
      </div>
    )
  }

  // ----- Render -----
  return (
    <div className="sd-root">
      {/* Left Sidebar */}
      <div className="sd-sidebar">
        {/* Queue Section */}
        <div className="sd-section">
          <div className="sd-section-header">
            <div className="sd-section-title">
              <Users className="w-5 h-5" />
              <h2>Support Queue</h2>
              <span className="sd-count">{threads.length}</span>
            </div>
            <label className="sd-toggle">
              <input
                type="checkbox"
                checked={filterUnassigned}
                onChange={(e) => setFilterUnassigned(e.target.checked)}
              />
              <span className="sd-toggle-slider"></span>
              <span className="sd-toggle-label">Unassigned only</span>
            </label>
          </div>

          <div className="sd-list">
            {loading ? (
              <div className="sd-loading">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Loading threads...</span>
              </div>
            ) : threads.length === 0 ? (
              <div className="sd-empty">
                <MessageCircle className="w-8 h-8 opacity-50" />
                <span>No conversations yet</span>
              </div>
            ) : (
              threads.map((t) => {
                const last = t.lastMessageAt || t.updatedAt || t.createdAt
                return (
                  <div key={t.threadId} className="sd-thread-card">
                    <div
                      className={`sd-thread-main ${activeThreadId === t.threadId ? "active" : ""}`}
                      onClick={() => openThread(t.threadId)}
                    >
                      <div className="sd-thread-header">
                        <h3 className="sd-thread-title">{t.topic || t.title || `Thread #${t.threadId}`}</h3>
                        <span className="sd-thread-time">{formatTime(last)}</span>
                      </div>
                      <div className="sd-thread-meta">
                        <span className={`sd-status ${getStatusColor(t.status)}`}>
                          {getStatusIcon(t.status)}
                          {t.status}
                        </span>
                        {t.priority && <span className={`sd-priority priority-${t.priority}`}>{t.priority}</span>}
                      </div>
                    </div>
                    {!t.assigneeUserId && (
                      <div className="sd-thread-actions">
                        <button className="sd-assign-btn" onClick={() => assignToMe(t.threadId)}>
                          Assign to me
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* My Threads Section */}
        <div className="sd-section">
          <div className="sd-section-header">
            <div className="sd-section-title">
              <UserIcon className="w-5 h-5" />
              <h3>My Threads</h3>
              <span className="sd-count">{myThreads.length}</span>
            </div>
          </div>

          <div className="sd-list">
            {myThreads.length === 0 ? (
              <div className="sd-empty">
                <UserIcon className="w-6 h-6 opacity-50" />
                <span>No assigned threads</span>
              </div>
            ) : (
              myThreads.map((t) => {
                const last = t.lastMessageAt || t.updatedAt || t.createdAt
                return (
                  <div
                    key={t.threadId}
                    className={`sd-my-thread ${activeThreadId === t.threadId ? "active" : ""}`}
                    onClick={() => openThread(t.threadId)}
                  >
                    <div className="sd-thread-header">
                      <h4 className="sd-thread-title">{t.topic || t.title || `Thread #${t.threadId}`}</h4>
                      <span className="sd-thread-time">{formatTime(last)}</span>
                    </div>
                    <span className={`sd-status ${getStatusColor(t.status)}`}>
                      {getStatusIcon(t.status)}
                      {t.status}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="sd-main">
        {activeThreadId ? (
          <div className="sd-chat">
            {/* Chat Header */}
            <div className="sd-chat-header">
              <div className="sd-chat-info">
                {!editingTopic ? (
                  <div className="sd-chat-title-row">
                    <h1 className="sd-chat-title">{topic}</h1>
                    <button className="topic-edit-btn" onClick={() => setEditingTopic(true)} title="Rename subject">
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="topic-edit">
                    <input
                      className="topic-input"
                      value={topicDraft}
                      onChange={(e) => setTopicDraft(e.target.value)}
                      maxLength={300}
                      autoFocus
                    />
                    <button className="topic-commit" onClick={saveTopic} title="Save">
                      <Check className="w-4 h-4" />
                    </button>
                    <button className="topic-cancel" onClick={() => { setTopicDraft(topic); setEditingTopic(false) }} title="Cancel">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <span className="sd-chat-id">Thread #{activeThreadId}</span>
                <span className={`sd-status ml-2 ${getStatusColor(activeStatus)}`}>
                  {getStatusIcon(activeStatus)}
                  {activeStatus || "—"}
                </span>
              </div>
              <div className="sd-chat-actions">
                <button
                  className="sd-close-btn"
                  onClick={closeThread}
                  disabled={(activeStatus || "").toLowerCase() === "closed" || closing}
                  title={(activeStatus || "").toLowerCase() === "closed" ? "Already closed" : "Close this thread"}
                >
                  {closing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      <span>Close thread</span>
                    </>
                  )}
                </button>
                <div className="sd-chat-status">
                  <div className={`sd-status-indicator ${connected ? "online" : "offline"}`}></div>
                  <span>{connected ? "Connected" : "Disconnected"}</span>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="sd-messages">
              {messages.length === 0 ? (
                <div className="sd-messages-empty">
                  <MessageCircle className="w-12 h-12 opacity-30" />
                  <h3>Start the conversation</h3>
                  <p>This thread is ready for your first message.</p>
                </div>
              ) : (
                messages.map((m) => {
                  const key = String(m?.senderUserId ?? "")
                  const avatar = m.isSystem
                    ? null
                    : m.senderIsAdmin
                    ? null
                    : profiles[key]?.avatar || DEFAULT_AVATAR_PATH

                  return (
                    <div
                      key={m.messageId ?? `${m.createdAt}-${m.senderUserId ?? m.senderIsAdmin ?? "sys"}`}
                      className={`sd-message ${m.isSystem ? "system" : m.senderIsAdmin ? "agent" : "user"}`}
                    >
                      <div className="sd-message-avatar">
                        {m.isSystem ? (
                          <div className="sd-avatar system">
                            <AlertCircle className="w-4 h-4" />
                          </div>
                        ) : m.senderIsAdmin ? (
                          <div className="sd-avatar agent">
                            <Bot className="w-4 h-4" />
                          </div>
                        ) : (
                     <div className="sd-avatar user">
                            <Link
                              to={profilePath(m.senderUserId)}
                              className="sd-avatar-link"
                              title={`Open ${authorNameFor(m)}'s profile`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <img
                                src={avatar}
                                alt={`${authorNameFor(m)} avatar`}
                                className="sd-avatar-img"
                                loading="lazy"
                                draggable={false}
                                onError={(e) => {
                                  e.currentTarget.onerror = null
                                  e.currentTarget.src = DEFAULT_AVATAR_PATH
                                }}
                              />
                            </Link>
                          </div>
                        )}
                      </div>

                      <div className="sd-message-content">
                        {/* Author name line */}
                        <div className="sd-author">{authorNameFor(m)}</div>

                        {/* Body */}
                        {m.body && <div className="sd-message-body">{m.body}</div>}

                        {/* Attachments */}
                        {Array.isArray(m.attachments) && m.attachments.length > 0 && (
                          <div className="sd-attachments-grid">
                            {m.attachments.map((a) =>
                              a.kind === "image" ? (
                                <a
                                  key={a.attachmentId || a.url}
                                  href={a.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="sd-attachment"
                                  title={a.fileName || "image"}
                                >
                                  <img src={a.url} alt={a.fileName || "attachment"} loading="lazy" draggable={false} />
                                </a>
                              ) : null
                            )}
                          </div>
                        )}

                        <div className="sd-message-time">{formatTime(m.createdAt)}</div>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="sd-input-area">
              <div className="sd-input-container">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={
                    (activeStatus || "").toLowerCase() === "closed"
                      ? "Thread is closed."
                      : "Type your reply..."
                  }
                  className="sd-input"
                  rows={1}
                  disabled={sending || (activeStatus || "").toLowerCase() === "closed"}
                />
                <button
                  onClick={send}
                  disabled={!input.trim() || sending || (activeStatus || "").toLowerCase() === "closed"}
                  className="sd-send-btn"
                  title={(activeStatus || "").toLowerCase() === "closed" ? "Thread is closed" : "Send"}
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
              {(activeStatus || "").toLowerCase() === "closed" && (
                <div className="sd-closed-hint">
                  <ShieldCheck className="w-4 h-4" />
                  This conversation is closed. You can still review messages.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="sd-placeholder">
            <MessageCircle className="w-16 h-16 opacity-30" />
            <h2>Select a thread to view</h2>
            <p>Choose a conversation from the sidebar to start helping customers.</p>
          </div>
        )}
      </div>
    </div>
  )
}
