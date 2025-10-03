// ...imports unchanged...
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
  X,
  Flag,
  Bell
} from "lucide-react"
import "../Styling/support-dashboard.css"

const USER_PROFILE_BASE = "/profile"
const profilePath = (id) => `${USER_PROFILE_BASE}/${id}`
const DEFAULT_AVATAR_PATH = "Assets/default-avatar.jpg"

// ---------- GCS config ----------
const GCS_BUCKET = "edcms_bucket"
const GCS_BASE = `https://storage.googleapis.com/${GCS_BUCKET}`

const apiOrigin = API_BASE.replace(/\/api\/?$/, "")
const fileUrl = (u) => {
  if (!u) return ""
  if (/^(https?:|data:|blob:)/i.test(u)) return u
  return `${apiOrigin}${u.startsWith("/") ? u : `/${u}`}`
}

const makeSafeName = (name = "") =>
  name.toString().replace(/[^a-zA-Z0-9.-]/g, "_").replace(/_+/g, "_").slice(0, 120)

const pickAvatarUrl = (u) => u?.profileImage || u?.profilePictureUrl || u?.avatarUrl || u?.photoUrl || ""
const pickDisplayName = (u) => {
  const joined = [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim()
  return u?.displayName || u?.fullName || (joined || null) || u?.name || u?.username || u?.email || ""
}

const URL_REGEX = /https?:\/\/[^\s<>")]+/gi
const extractUrls = (text = "") => (typeof text === "string" ? text.match(URL_REGEX) || [] : [])
const isImageUrl = (u = "") => /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test((u.split("?")[0] || ""))

export default function SupportDashboard() {
  const navigate = useNavigate()

  const [authChecked, setAuthChecked] = useState(false)
  const [authorized, setAuthorized] = useState(false)

  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef(null)

  // REPORTS: three-way segmented view
  const [assignView, setAssignView] = useState("awaiting") // "awaiting" | "assigned" | "reports"

  const [drawerOpen, setDrawerOpen] = useState(false)
  const scrollYRef = useRef(0)

  const [threads, setThreads] = useState([])
  const [myThreads, setMyThreads] = useState([])
  const [filterUnassigned, setFilterUnassigned] = useState(true)
  const [activeThreadId, setActiveThreadId] = useState(null)
  const [activeStatus, setActiveStatus] = useState(null)
  const [messages, setMessages] = useState([])
  const [topic, setTopic] = useState("")
  const [editingTopic, setEditingTopic] = useState(false)
  const [topicDraft, setTopicDraft] = useState("")
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [denied, setDenied] = useState(false)
  const [sending, setSending] = useState(false)
  const [closing, setClosing] = useState(false)

  // 🔔 notify email state
  const [notifying, setNotifying] = useState(false)
  const [notifyFlash, setNotifyFlash] = useState(null) // "ok" | "err" | null

  const inputRef = useRef(null)

  const [connected, setConnected] = useState(false)
  const [profiles, setProfiles] = useState({})
  const pendingProfileIdsRef = useRef(new Set())
  const seenMessageIdsRef = useRef(new Set())
  const connRef = useRef(null)
  const messagesEndRef = useRef(null)

  // ----- Auth guard -----
  useEffect(() => {
    const token = getToken()
    if (!token) { navigate("/unauthorized", { replace: true }); return }
    try {
      const decoded = jwtDecode(token)
      const rawRoles = decoded["roles"] ?? decoded["role"] ?? decoded["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"]
      const roleArray = Array.isArray(rawRoles)
        ? rawRoles
        : typeof rawRoles === "string"
        ? rawRoles.split(/[,\s]+/).filter(Boolean)
        : []
      const isAdmin = roleArray.some((r) => String(r).toLowerCase() === "admin")
      if (!isAdmin) { navigate("/unauthorized", { replace: true }); return }
      setAuthorized(true); setAuthChecked(true)
    } catch { navigate("/unauthorized", { replace: true }) }
  }, [navigate])

  // 🔔 Notify user by reusing the existing ASSIGN endpoint (no new route)
  const notifyUser = async () => {
    if (!activeThreadId || notifying) return
    setNotifying(true)
    setNotifyFlash(null)
    try {
      // This triggers the same email as pressing "Assign to me"
      const res = await fetch(`${API_BASE}/Support/threads/${activeThreadId}/assign`, {
        method: "PUT",
        headers: authHeaders(),
        body: ""
      })
      if (res.status === 401 || res.status === 403) { setDenied(true); return }
      if (!res.ok) throw new Error(`Failed (${res.status})`)
      setNotifyFlash("ok")
    } catch (e) {
      console.error(e)
      setNotifyFlash("err")
    } finally {
      setNotifying(false)
      setTimeout(() => setNotifyFlash(null), 2000)
    }
  }

  useEffect(() => () => { if (connRef.current) { connRef.current.stop().catch(() => {}) } }, [])

  const isImageAttachment = (a) =>
    (a?.kind && String(a.kind).toLowerCase() === "image") ||
    /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(a?.fileName || a?.url || "")

  // ---- Upload image to GCS ----
  const uploadImageToGCS = async (file) => {
    if (!file) return null
    if (!/^image\//i.test(file.type)) throw new Error("Only image files are allowed.")
    if (file.size > 10 * 1024 * 1024) throw new Error("Image is too large (max 10MB).")
    const safe = makeSafeName(file.name || "support")
    const hasExt = /\.[a-z0-9]+$/i.test(safe)
    const objectName = `${Date.now()}-${hasExt ? safe : `${safe}.jpg`}`
    const encoded = encodeURIComponent(objectName)
    const imgUrl = `${GCS_BASE}/${encoded}`
    const txtUrl = `${imgUrl}.txt`
    const contentType = file.type || "image/jpeg"

    const imgRes = await fetch(imgUrl, { method:"PUT", headers:{ "Content-Type": contentType }, body:file })
    if (!imgRes.ok) { let errText=""; try { errText = await imgRes.text() } catch {}; throw new Error(`GCS image PUT failed (${imgRes.status}) ${errText}`) }
    const txtRes = await fetch(txtUrl, { method:"PUT", headers:{ "Content-Type":"text/plain" }, body: imgUrl })
    if (!txtRes.ok) { let errText=""; try { errText = await txtRes.text() } catch {}; console.warn("Companion .txt PUT failed:", txtRes.status, errText) }
    return imgUrl
  }

  const onPickImages = async (e) => {
    if (!activeThreadId || uploading) return
    const files = Array.from(e.target.files || []).filter(Boolean)
    if (!files.length) return
    setUploading(true); setUploadProgress(0)
    try {
      const validFiles = files.filter(f => /^image\//i.test(f.type) && f.size <= 10 * 1024 * 1024)
      if (validFiles.length === 0) throw new Error("No valid images selected (only images up to 10MB).")
      const urls = []
      for (let i = 0; i < validFiles.length; i++) {
        const url = await uploadImageToGCS(validFiles[i])
        urls.push(url)
        setUploadProgress(Math.round(((i + 1) / validFiles.length) * 100))
      }
      if (connRef.current) {
        const body = urls.join("\n")
        await connRef.current.invoke("SendMessage", activeThreadId, body)
      }
    } catch (err) {
      console.error(err)
      alert(err?.message || "Image upload failed. Please check bucket billing/ACL and try again.")
    } finally {
      setUploading(false); setUploadProgress(0); if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  // REPORTS: keep “awaiting” driving unassigned flag, otherwise false
  useEffect(() => { setFilterUnassigned(assignView === "awaiting") }, [assignView])

  // drawer scroll lock, esc, etc.
  useEffect(() => {
    const isMobile = () => window.matchMedia("(max-width: 640px)").matches
    const lock = () => {
      if (!isMobile()) return
      scrollYRef.current = window.scrollY || window.pageYOffset || 0
      document.body.classList.add("sd-scroll-lock")
      document.body.style.top = `-${scrollYRef.current}px`
      document.body.style.left = "0"
      document.body.style.right = "0"
      document.body.style.width = "100%"
    }
    const unlock = () => {
      const y = scrollYRef.current || 0
      document.body.classList.remove("sd-scroll-lock")
      document.body.style.top = ""
      document.body.style.left = ""
      document.body.style.right = ""
      document.body.style.width = ""
      window.scrollTo(0, y)
    }
    if (drawerOpen) lock(); else unlock()
    const onResize = () => { if (drawerOpen && !isMobile()) unlock() }
    window.addEventListener("resize", onResize)
    window.addEventListener("orientationchange", onResize)
    return () => { window.removeEventListener("resize", onResize); window.removeEventListener("orientationchange", onResize); if (drawerOpen) unlock() }
  }, [drawerOpen])

  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e) => { if (e.key === "Escape") setDrawerOpen(false) }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [drawerOpen])

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  useEffect(() => { scrollToBottom() }, [messages])

  const fetchJson = async (url, init = {}) => {
    const res = await fetch(url, { headers: authHeaders(), ...init })
    if (res.status === 401 || res.status === 403) { setDenied(true); return null }
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

  // Profiles fetcher
  const fetchMissingProfiles = async (userIds) => {
    if (!userIds.length) return
    try {
      const results = await Promise.all(
        userIds.map(async (uid) => {
          try {
            const res = await fetch(`${API_BASE}/User/${uid}`, { headers: authHeaders() })
            if (!res.ok) return [uid, { avatar: DEFAULT_AVATAR_PATH, name: `User #${uid}` }]
            const u = await res.json()
            const url = pickAvatarUrl(u)
            const name = pickDisplayName(u)
            return [ uid, { avatar: url && typeof url === "string" ? fileUrl(url) : DEFAULT_AVATAR_PATH, name: name?.trim() ? name.trim() : `User #${uid}` } ]
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
            next[key] = val; changed = true
          }
        }
        return changed ? next : prev
      })
    } finally {
      userIds.forEach((id) => pendingProfileIdsRef.current.delete(String(id)))
    }
  }

  const missingProfileIds = useMemo(() => {
    if (!messages?.length) return []
    const ids = new Set()
    for (const m of messages) {
      if (m?.isSystem || m?.senderIsAdmin) continue
      const raw = m?.senderUserId
      const strId = String(raw ?? "")
      if (!strId) continue
      if (!profiles[strId] && !pendingProfileIdsRef.current.has(strId)) ids.add(strId)
    }
    return Array.from(ids)
  }, [messages, profiles])

  useEffect(() => {
    if (!missingProfileIds.length) return
    missingProfileIds.forEach((id) => pendingProfileIdsRef.current.add(String(id)))
    fetchMissingProfiles(missingProfileIds)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missingProfileIds])

  const openThread = async (id) => {
    setActiveThreadId(id)
    seenMessageIdsRef.current = new Set()
    const dto = await fetchJson(`${API_BASE}/Support/threads/${id}`)
    if (!dto) return
    const t = dto.topic || dto.title || `Thread #${id}`
    setTopic(t); setTopicDraft(t)
    const initialMessages = Array.isArray(dto.messages) ? dto.messages : []
    setMessages(initialMessages)
    for (const m of initialMessages) { if (m?.messageId != null) seenMessageIdsRef.current.add(String(m.messageId)) }
    setActiveStatus(dto.status || "Open")
    await connectToHub(id)
    setDrawerOpen(false)
  }

  const connectToHub = async (threadId) => {
    if (connRef.current) { try { await connRef.current.stop() } catch {} }
    const token = getToken()
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, { accessTokenFactory: () => token || "" })
      .withAutomaticReconnect([0, 2000, 10000, 30000])
      .build()
    connRef.current = connection

    connection.on("message", (msg) => {
      const id = msg?.messageId
      if (id != null) {
        const key = String(id); if (seenMessageIdsRef.current.has(key)) return; seenMessageIdsRef.current.add(key)
      } else {
        const fallbackKey = `${msg?.createdAt || ""}|${msg?.senderUserId || ""}|${msg?.body || ""}`
        if (seenMessageIdsRef.current.has(fallbackKey)) return; seenMessageIdsRef.current.add(fallbackKey)
      }
      const normalized = { ...msg, senderIsAdmin: !!msg.senderIsAdmin, createdAt: msg.createdAt || new Date().toISOString(), attachments: Array.isArray(msg.attachments) ? msg.attachments : [] }
      setMessages((prev) => [...prev, normalized])
    })

    connection.on("ThreadClosed", (dto) => {
      if (dto?.threadId === threadId) {
        setActiveStatus("Closed")
        setMessages((prev) => [...prev, { isSystem: true, body: "Thread was closed.", createdAt: dto.closedAt || new Date().toISOString() }])
        loadQueue(); loadMine()
      }
    })

    connection.onreconnected(async () => { setConnected(true); try { await connection.invoke("JoinThread", threadId) } catch {} })
    connection.onreconnecting(() => setConnected(false))
    connection.onclose(() => setConnected(false))

    try { await connection.start(); setConnected(true); await connection.invoke("JoinThread", threadId) }
    catch (e) { setConnected(false); console.error("SupportHub connect error", e) }
  }

  const assignToMe = async (id) => {
    const res = await fetch(`${API_BASE}/Support/threads/${id}/assign`, { method:"PUT", headers: authHeaders(), body:"" })
    if (res.status === 401 || res.status === 403) { setDenied(true); return }
    await loadQueue(); await loadMine()
  }

  const send = async () => {
    const text = input.trim()
    if (!text || !connRef.current || !activeThreadId || sending) return
    if ((activeStatus || "").toLowerCase() === "closed") return
    setSending(true)
    try { await connRef.current.invoke("SendMessage", activeThreadId, text); setInput(""); requestAnimationFrame(() => inputRef.current?.focus()) }
    catch (e) { console.error(e); requestAnimationFrame(() => inputRef.current?.focus()) }
    finally { setSending(false) }
  }
  const handleKeyPress = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }

  const closeThread = async () => {
    if (!activeThreadId || closing) return
    if ((activeStatus || "").toLowerCase() === "closed") return
    setClosing(true)
    try {
      const res = await fetch(`${API_BASE}/Support/threads/${activeThreadId}/close`, {
        method:"PUT", headers:{ ...authHeaders(), "Content-Type":"application/json" }, body: JSON.stringify("Resolved by support.")
      })
      if (res.status === 401 || res.status === 403) { setDenied(true); return }
      if (!res.ok && res.status !== 204) { const body = await res.text(); throw new Error(body || `Failed to close: ${res.status}`) }
      setActiveStatus("Closed")
      setMessages((prev) => [...prev, { isSystem:true, body:"Thread closed by support.", createdAt:new Date().toISOString() }])
      setThreads((prev) => prev.map((t) => (t.threadId === activeThreadId ? { ...t, status:"Closed" } : t)))
      setMyThreads((prev) => prev.map((t) => (t.threadId === activeThreadId ? { ...t, status:"Closed" } : t)))
    } catch (e) {
      console.error(e); alert("Failed to close the thread.")
    } finally { setClosing(false) }
  }

  const saveTopic = async () => {
    if (!activeThreadId) return
    const newTopic = topicDraft.trim()
    if (!newTopic || newTopic === topic) { setEditingTopic(false); return }
    try {
      const res = await fetch(`${API_BASE}/Support/threads/${activeThreadId}/topic`, {
        method:"PUT", headers:{ ...authHeaders(), "Content-Type":"application/json" }, body: JSON.stringify({ topic:newTopic })
      })
      if (!res.ok) { const txt = await res.text().catch(()=> ""); throw new Error(txt || `Failed (${res.status})`) }
      const dto = await res.json()
      const t = dto.topic || newTopic
      setTopic(t); setEditingTopic(false)
      setThreads((prev) => prev.map(x => x.threadId === activeThreadId ? { ...x, topic:t, title:t } : x))
      setMyThreads((prev) => prev.map(x => x.threadId === activeThreadId ? { ...x, topic:t, title:t } : x))
    } catch (e) {
      console.error(e); alert("Couldn't update the subject.")
    }
  }

  const getStatusIcon = (status) => {
    switch ((status || "").toLowerCase()) {
      case "open": return <CheckCircle className="w-3 h-3" />
      case "pending": return <Clock className="w-3 h-3" />
      case "closed": return <AlertCircle className="w-3 h-3" />
      default: return <MessageCircle className="w-3 h-3" />
    }
  }
  const getStatusColor = (status) => {
    switch ((status || "").toLowerCase()) {
      case "open": return "status-open"
      case "pending": return "status-pending"
      case "closed": return "status-closed"
      default: return "status-default"
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
  const authorNameFor = (m) => {
    if (m.isSystem) return "System"
    if (m.senderIsAdmin) return (m.senderName && m.senderName.trim()) || "Support"
    const key = String(m?.senderUserId ?? "")
    const profile = key ? profiles[key] : null
    return (m.senderName && m.senderName.trim()) || profile?.name || (key ? `User #${key}` : "User")
  }

  useEffect(() => {
    document.body.classList.add("hide-support-widget")
    return () => document.body.classList.remove("hide-support-widget")
  }, [])

  useEffect(() => {
    if (!authChecked || !authorized) return
    loadQueue()
    loadMine()
  }, [authChecked, authorized, filterUnassigned])

  // REPORTS: derived filtered list
  const reportThreads = useMemo(() => {
    const list = Array.isArray(threads) ? threads : []
    return list.filter(t => {
      const subj = String(t.topic || t.title || "").toLowerCase()
      return subj.startsWith("report shop")
    })
  }, [threads])

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

  return (
    <div className={`sd-root ${drawerOpen ? "drawer-open" : ""}`}>
      <div className="sd-drawer-scrim" onClick={() => setDrawerOpen(false)} aria-hidden="true" />

      <aside className="sd-sidebar" aria-label="Conversation lists">
        <div className="sd-sidebar-header mobile-only">
          <strong>Filters</strong>
          <button className="sd-close" onClick={() => setDrawerOpen(false)} aria-label="Close">Close</button>
        </div>

        {/* REPORTS: 3-way segmented control */}
        <div className="sd-segmented">
          <button className={assignView === "awaiting" ? "active" : ""} onClick={() => setAssignView("awaiting")}>
            Awaiting
          </button>
          <button className={assignView === "assigned" ? "active" : ""} onClick={() => setAssignView("assigned")}>
            Assigned
          </button>
          <button className={assignView === "reports" ? "active" : ""} onClick={() => setAssignView("reports")}>
            Reports
          </button>
        </div>

        {/* Awaiting */}
        {assignView === "awaiting" && (
          <div className="sd-section">
            <div className="sd-section-header">
              <div className="sd-section-title">
                <Users className="w-5 h-5" />
                <h2>Support Queue</h2>
                <span className="sd-count">{threads.length}</span>
              </div>
            </div>

            <div className="sd-list">
              {loading ? (
                <div className="sd-loading">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Loading threads...</span>
                </div>
              ) : threads.length === 0 ? (
                <div className="sd-empty">
                  <MessageCircle className="w-8 h-8 opacity-50" style={{ position:"relative", top:"6px" }} />
                  <span>   No conversations yet</span>
                </div>
              ) : (
                threads.map((t) => {
                  const last = t.lastMessageAt || t.updatedAt || t.createdAt
                  return (
                    <div key={t.threadId} className="sd-thread-card">
                      <div className={`sd-thread-main ${activeThreadId === t.threadId ? "active" : ""}`} onClick={() => openThread(t.threadId)}>
                        <div className="sd-thread-header">
                          <h3 className="sd-thread-title">{t.topic || t.title || `Thread #${t.threadId}`}</h3>
                          <span className="sd-thread-time">{formatTime(last)}</span>
                        </div>
                        <div className="sd-thread-meta">
                          <span className={`sd-status ${getStatusColor(t.status)}`}>{getStatusIcon(t.status)}{t.status}</span>
                          {t.priority && <span className={`sd-priority priority-${t.priority}`}>{t.priority}</span>}
                        </div>
                      </div>
                      {!t.assigneeUserId && (
                        <div className="sd-thread-actions">
                          <button className="sd-assign-btn" onClick={() => assignToMe(t.threadId)}>Assign to me</button>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* Assigned */}
        {assignView === "assigned" && (
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
                    <div key={t.threadId} className={`sd-my-thread ${activeThreadId === t.threadId ? "active" : ""}`} onClick={() => openThread(t.threadId)}>
                      <div className="sd-thread-header">
                        <h4 className="sd-thread-title">{t.topic || t.title || `Thread #${t.threadId}`}</h4>
                        <span className="sd-thread-time">{formatTime(last)}</span>
                      </div>
                      <span className={`sd-status ${getStatusColor(t.status)}`}>{getStatusIcon(t.status)}{t.status}</span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* REPORTS: Tab */}
        {assignView === "reports" && (
          <div className="sd-section">
            <div className="sd-section-header">
              <div className="sd-section-title">
                <Flag className="w-5 h-5" />
                <h3>Reports</h3>
                <span className="sd-count">{reportThreads.length}</span>
              </div>
            </div>

            <div className="sd-list">
              {loading ? (
                <div className="sd-loading">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Loading reports...</span>
                </div>
              ) : reportThreads.length === 0 ? (
                <div className="sd-empty">
                  <Flag className="w-6 h-6 opacity-50" />
                  <span>No reports yet</span>
                </div>
              ) : (
                reportThreads.map((t) => {
                  const last = t.lastMessageAt || t.updatedAt || t.createdAt
                  return (
                    <div key={t.threadId} className="sd-thread-card">
                      <div className={`sd-thread-main ${activeThreadId === t.threadId ? "active" : ""}`} onClick={() => openThread(t.threadId)}>
                        <div className="sd-thread-header">
                          <h3 className="sd-thread-title">{t.topic || t.title || `Thread #${t.threadId}`}</h3>
                          <span className="sd-thread-time">{formatTime(last)}</span>
                        </div>
                        <div className="sd-thread-meta">
                          <span className={`sd-status ${getStatusColor(t.status)}`}>{getStatusIcon(t.status)}{t.status}</span>
                          {t.priority && <span className={`sd-priority priority-${t.priority}`}>{t.priority}</span>}
                        </div>
                      </div>
                      {!t.assigneeUserId && (
                        <div className="sd-thread-actions">
                          <button className="sd-assign-btn" onClick={() => assignToMe(t.threadId)}>Assign to me</button>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </aside>

      {/* Main Chat Area */}
      <div className="sd-main">
        <div className="sd-chat-header">
          <button className={`sd-hamburger mobile-only ${drawerOpen ? "is-open" : ""}`} aria-label={drawerOpen ? "Close lists" : "Open lists"} aria-expanded={drawerOpen} onClick={() => setDrawerOpen(v => !v)}>
            <span className="hb" aria-hidden="true" />
          </button>

          {/* Title + edit + bell */}
          <div className="sd-chat-info">
            {!editingTopic ? (
              <div
                className="sd-chat-title-row"
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <h1 className="sd-chat-title" style={{ marginRight: 8 }}>
                  {topic || "Support"}
                </h1>

                {activeThreadId && (
                  <>
                    {/* rename subject */}
                    <button
                      className="topic-edit-btn"
                      onClick={() => setEditingTopic(true)}
                      title="Rename subject"
                      style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>

                    {/* 🔔 notify user via ASSIGN endpoint */}
                    <button
                      className="notify-btn"
                      onClick={notifyUser}
                      disabled={notifying}
                      title="Send an email notification to the user"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "4px 8px",
                        borderRadius: 6,
                        border: "1px solid #e5e7eb",
                        background: "#fff",
                        marginTop : "10px",
                        cursor: notifying ? "not-allowed" : "pointer"
                      }}
                    >
                      {notifying ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Bell className="w-4 h-4" />
                      )}
                      <span className="hide-on-mobile" style={{ fontSize: 12 }}>Notify</span>
                    </button>

                    {/* tiny status flash */}
                    {notifyFlash && (
                      <span
                        role="status"
                        style={{
                          marginLeft: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          color: notifyFlash === "ok" ? "#065f46" : "#991b1b"
                        }}
                      >
                        {notifyFlash === "ok" ? "Email sent" : "Failed to send"}
                      </span>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="topic-edit">
                <input
                  className="topic-input"
                  value={topicDraft}
                  onChange={(e) => setTopicDraft(e.value ?? e.target.value)}
                  maxLength={300}
                  autoFocus
                />
                <button className="topic-commit" onClick={saveTopic} title="Save">
                  <Check className="w-4 h-4" />
                </button>
                <button
                  className="topic-cancel"
                  onClick={() => {
                    setTopicDraft(topic)
                    setEditingTopic(false)
                  }}
                  title="Cancel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {activeThreadId && <span className="sd-chat-id">Thread #{activeThreadId}</span>}
          </div>

          <div className="sd-chat-actions">
            <button className="sd-close-btn" onClick={closeThread} disabled={!activeThreadId || (activeStatus || "").toLowerCase() === "closed" || closing} title={(activeStatus || "").toLowerCase() === "closed" ? "Already closed" : "Close this thread"}>
              {closing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <XCircle className="w-4 h-4" style={{ position:"relative", top:"2px", right:"3px" }}/>
                  <span style={{ position:"relative", bottom:"5px" }}>Close thread</span>
                </>
              )}
            </button>
            <div className="sd-chat-status hide-on-mobile">
              <div className={`sd-status-indicator ${connected ? "online" : "offline"}`} />
              <span>{connected ? "Connected" : "Disconnected"}</span>
            </div>
          </div>
        </div>

        {activeThreadId ? (
          <>
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
                  const avatar = m.isSystem ? null : m.senderIsAdmin ? null : profiles[key]?.avatar || DEFAULT_AVATAR_PATH
                  const urls = extractUrls(m.body || "")
                  const imageUrls = urls.filter(isImageUrl)
                  const linkUrls = urls.filter((u) => !isImageUrl(u))
                  const textOnly = (m.body || "").replace(URL_REGEX, "").trim()
                  return (
                    <div key={m.messageId ?? `${m.createdAt}-${m.senderUserId ?? m.senderIsAdmin ?? "sys"}`} className={`sd-message ${m.isSystem ? "system" : m.senderIsAdmin ? "agent" : "user"}`}>
                      <div className="sd-message-avatar">
                        {m.isSystem ? (
                          <div className="sd-avatar system"><AlertCircle className="w-4 h-4" /></div>
                        ) : m.senderIsAdmin ? (
                          <div className="sd-avatar agent"><Bot className="w-4 h-4" /></div>
                        ) : (
                          <div className="sd-avatar user">
                            <Link to={profilePath(m.senderUserId)} className="sd-avatar-link" title={`Open ${authorNameFor(m)}'s profile`} onClick={(e) => e.stopPropagation()}>
                              <img src={avatar} alt={`${authorNameFor(m)} avatar`} className="sd-avatar-img" loading="lazy" draggable={false} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_AVATAR_PATH }} />
                            </Link>
                          </div>
                        )}
                      </div>

                      <div className="sd-message-content">
                        <div className="sd-author">{authorNameFor(m)}</div>

                        {textOnly && (
                          <div className="sd-text">
                            {textOnly.split(/\n/g).map((line, i) => (<p key={i} style={{ margin: 0 }}>{line}</p>))}
                          </div>
                        )}

                        {Array.isArray(m.attachments) && m.attachments.length > 0 && (
                          <div className="sd-attachments-grid">
                            {m.attachments.map((a) =>
                              isImageAttachment(a) ? (
                                <a key={a.attachmentId || a.url} href={fileUrl(a.url)} target="_blank" rel="noreferrer" className="sd-attachment" title={a.fileName || "image"}>
                                  <img src={fileUrl(a.url)} alt={a.fileName || "attachment"} loading="lazy" draggable={false} />
                                </a>
                              ) : null
                            )}
                          </div>
                        )}

                        {(!m.attachments || m.attachments.length === 0) && imageUrls.length > 0 && (
                          <div className="sd-attachments-grid">
                            {Array.from(new Set(imageUrls)).map((u) => (
                              <a key={u} href={u} target="_blank" rel="noreferrer" className="sd-attachment" title="image">
                                <img src={u} alt="attachment" loading="lazy" draggable={false} />
                              </a>
                            ))}
                          </div>
                        )}

                        {linkUrls.length > 0 && (
                          <div className="sd-links">
                            {Array.from(new Set(linkUrls)).map((u) => (
                              <a key={u} href={u} target="_blank" rel="noreferrer" className="sd-link">
                                {u}
                              </a>
                            ))}
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

            <div className="sd-input-area">
              <div className="sd-input-container">
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={onPickImages} style={{ display:"none" }} />
                <button type="button" className="sd-attach-btn" onClick={() => fileInputRef.current?.click()} title="Attach images" disabled={!activeThreadId || uploading || (activeStatus || "").toLowerCase() === "closed"}>
                  {uploading ? (<span className="sd-uploading"><Loader2 className="w-4 h-4 animate-spin" /><span style={{ marginLeft: 6 }}>{uploadProgress}%</span></span>) : (<>Attach</>)}
                </button>

                <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={handleKeyPress} placeholder={(activeStatus || "").toLowerCase() === "closed" ? "Thread is closed." : "Type your reply..."} className="sd-input" rows={1} disabled={sending || (activeStatus || "").toLowerCase() === "closed"} />
                <button onClick={send} disabled={!input.trim() || sending || (activeStatus || "").toLowerCase() === "closed"} className="sd-send-btn" title={(activeStatus || "").toLowerCase() === "closed" ? "Thread is closed" : "Send"}>
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
          </>
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
