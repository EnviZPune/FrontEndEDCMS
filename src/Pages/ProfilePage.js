// src/Pages/ProfilePage.jsx
import { useEffect, useState, useCallback } from "react"
import { useNavigate, useParams, Link } from "react-router-dom"
import { jwtDecode } from "jwt-decode"
import Footer from "../Components/Footer"
import Navbar from "../Components/Navbar"
import "../Styling/myprofile.css"

const API_BASE = "http://77.242.26.150:8000"

// Default shop logos for light/dark modes
const DEFAULT_LOGO_LIGHT = "/Assets/default-shop-logo-light.png"
const DEFAULT_LOGO_DARK  = "/Assets/default-shop-logo-dark.png"

/* ----------------------- Opening-hours utilities ----------------------- */
// Canonical day order/keys and labels
const DAY_KEYS    = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]
const DAY_LABELS  = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]
const DAY_SHORT   = ["Mo","Tu","We","Th","Fr","Sa","Su"] // for compact parsing

const getDefaultSchedule = () => ({
  monday:    { open: "09:00", close: "18:00", closed: false },
  tuesday:   { open: "09:00", close: "18:00", closed: false },
  wednesday: { open: "09:00", close: "18:00", closed: false },
  thursday:  { open: "09:00", close: "18:00", closed: false },
  friday:    { open: "09:00", close: "18:00", closed: false },
  saturday:  { open: "10:00", close: "14:00", closed: true },
  sunday:    { open: "10:00", close: "14:00", closed: true },
})

const toHHMM = (s) => {
  if (typeof s !== "string") return "00:00"
  const [hRaw, mRaw] = s.split(":")
  const h = Math.max(0, Math.min(23, parseInt(hRaw, 10) || 0))
  const m = Math.max(0, Math.min(59, parseInt(mRaw ?? "0", 10) || 0))
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`
}
const fmtTime = (t) => toHHMM(t)

const normalizeSchedule = (obj) => {
  const base = getDefaultSchedule()
  try {
    for (const k of DAY_KEYS) {
      const d = obj?.[k] ?? {}
      base[k] = {
        open:   toHHMM(d.open  ?? base[k].open),
        close:  toHHMM(d.close ?? base[k].close),
        closed: Boolean(d.closed),
      }
    }
  } catch {
    return getDefaultSchedule()
  }
  return base
}

// Parse compact strings like:
// "Daily 9-18", "Mo-Fr 9-18 Sa 10-14 Su Closed", "Monday-Friday 09:30-22:00"
const parseCompact = (raw) => {
  const base = getDefaultSchedule()
  for (const k of DAY_KEYS) base[k].closed = true

  const str = String(raw || "").trim()
  if (!str) return getDefaultSchedule()
  const lower = str.toLowerCase()
  if (lower === "closed") return base

  // Daily
  const mDaily = str.match(/^\s*Daily\s+(\d{1,2}(?::\d{2})?)\s*-\s*(\d{1,2}(?::\d{2})?)\s*$/i)
  if (mDaily) {
    const open  = toHHMM(mDaily[1])
    const close = toHHMM(mDaily[2])
    for (const k of DAY_KEYS) base[k] = { open, close, closed: false }
    return base
  }

  // Normalize day names to tokens we can match on
  const dayNameToIndex = (token) => {
    // Accept full names (Monday) and shorts (Mo)
    const idxFull = DAY_LABELS.findIndex(l => l.toLowerCase() === token.toLowerCase())
    if (idxFull !== -1) return idxFull
    const idxShort = DAY_SHORT.findIndex(s => s.toLowerCase() === token.toLowerCase())
    return idxShort
  }

  // Token pattern: "Mon" or "Monday" or "Mon-Fri" / "Monday-Friday" + time "9-18" or "09:00-18:00" or "Closed"
  // We scan through the string for repeating "day part + hours/Closed"
  const re = /((?:Mo|Tu|We|Th|Fr|Sa|Su|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(?:\s*-\s*(?:Mo|Tu|We|Th|Fr|Sa|Su|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday))?)\s+(Closed|closed|(\d{1,2}(?::\d{2})?)\s*-\s*(\d{1,2}(?::\d{2})?))/g
  let m
  let matched = false
  while ((m = re.exec(str)) !== null) {
    matched = true
    const dayPart = m[1]
    const isClosed = String(m[2]).toLowerCase() === "closed"
    let open = null, close = null
    if (!isClosed) {
      open  = toHHMM(m[3])
      close = toHHMM(m[4])
    }

    const applyRange = (startIdx, endIdx) => {
      for (let i = startIdx; i <= endIdx; i++) {
        base[DAY_KEYS[i]] = isClosed
          ? { ...base[DAY_KEYS[i]], closed: true }
          : { open, close, closed: false }
      }
    }

    if (dayPart.includes("-")) {
      const [a, b] = dayPart.split("-").map(s => s.trim())
      const sIdx = dayNameToIndex(a)
      const eIdx = dayNameToIndex(b)
      if (sIdx !== -1 && eIdx !== -1 && sIdx <= eIdx) {
        applyRange(sIdx, eIdx)
      }
    } else {
      const idx = dayNameToIndex(dayPart.trim())
      if (idx !== -1) applyRange(idx, idx)
    }
  }

  return matched ? base : getDefaultSchedule()
}

const parseIncomingOpeningHours = (incoming) => {
  if (!incoming) return getDefaultSchedule()
  if (typeof incoming === "object") return normalizeSchedule(incoming)
  if (typeof incoming === "string") {
    const trimmed = incoming.trim()
    if (!trimmed) return getDefaultSchedule()
    if (trimmed.startsWith("{")) {
      try {
        const obj = JSON.parse(trimmed)
        if (obj && typeof obj === "object") return normalizeSchedule(obj)
      } catch { /* fall through */ }
    }
    return parseCompact(trimmed)
  }
  return getDefaultSchedule()
}

const isOpenNow = (schedule, now = new Date()) => {
  // JS: 0=Sun..6=Sat  → our index: 0=Mon..6=Sun
  const idx = (now.getDay() + 6) % 7
  const d = schedule[DAY_KEYS[idx]]
  if (!d || d.closed) return false
  const [oh, om] = d.open.split(":").map(Number)
  const [ch, cm] = d.close.split(":").map(Number)
  const start = new Date(now); start.setHours(oh, om, 0, 0)
  const end   = new Date(now); end.setHours(ch, cm, 0, 0)
  return now >= start && now <= end
}

// Build a simple, human label like:
// "Monday - Friday 09:30 - 22:00 | Saturday 10:00 - 14:00 | Sunday Closed"
const buildSimpleWeeklyLabel = (schedule) => {
  const groups = []
  let i = 0
  while (i < 7) {
    const cur = schedule[DAY_KEYS[i]]
    const start = i
    let j = i
    // group consecutive identical (open/close/closed)
    while (j + 1 < 7) {
      const nxt = schedule[DAY_KEYS[j + 1]]
      const same = !!nxt &&
        nxt.closed === cur.closed &&
        (!nxt.closed && !cur.closed ? (nxt.open === cur.open && nxt.close === cur.close) : true)
      if (!same) break
      j++
    }
    groups.push({ start, end: j, data: cur })
    i = j + 1
  }

  const tokens = groups.map(g => {
    const dayLabel = g.start === g.end
      ? DAY_LABELS[g.start]
      : `${DAY_LABELS[g.start]} - ${DAY_LABELS[g.end]}`
    if (g.data.closed) return `${dayLabel} Closed`
    return `${dayLabel} ${fmtTime(g.data.open)} - ${fmtTime(g.data.close)}`
  })

  // Keep it readable; if it's too long, prefer a compact "Daily ..." when all open the same
  const allOpen = DAY_KEYS.every(k => !schedule[k].closed)
  const allSame = allOpen && DAY_KEYS.every(k =>
    schedule[k].open === schedule.monday.open && schedule[k].close === schedule.monday.close
  )
  if (allSame) return `Daily ${fmtTime(schedule.monday.open)} - ${fmtTime(schedule.monday.close)}`

  // Otherwise join groups with a separator
  return tokens.join(" | ")
}
/* --------------------------------------------------------------------- */

// Detect OS/browser color scheme (and react to changes)
function usePrefersDark() {
  const [isDark, setIsDark] = useState(() =>
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  )

  useEffect(() => {
    if (!window.matchMedia) return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = (e) => setIsDark(e.matches)
    if (mq.addEventListener) mq.addEventListener("change", handler)
    else mq.addListener?.(handler)
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handler)
      else mq.removeListener?.(handler)
    }
  }, [])

  return isDark
}

const getToken = () => {
  const raw = localStorage.getItem("token")
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return parsed.token || parsed
  } catch {
    return raw
  }
}

const getAuthHeaders = (token) => ({
  "Content-Type": "application/json",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
})

// Enhanced Activity Panel
function ActivityStatsCard({ profile, token }) {
  const navigate = useNavigate()
  const [hoursSpent, setHoursSpent] = useState(0)
  const [animatedStats, setAnimatedStats] = useState({
    shops: 0,
    hours: 0,
    days: 0,
    age: 0,
  })

  useEffect(() => {
    if (!profile?.userId) return
    const key = `firstVisit_${profile.userId}`
    let first = localStorage.getItem(key)
    if (!first) {
      first = Date.now().toString()
      localStorage.setItem(key, first)
    }
    const hours = (Date.now() - parseInt(first, 10)) / (1000 * 60 * 60)
    setHoursSpent(Math.floor(hours))
  }, [profile?.userId])

  let joinedDate = null
  if (token) {
    try {
      const decoded = jwtDecode(token)
      if (decoded?.iat) joinedDate = new Date(decoded.iat * 1000)
    } catch {}
  }

  let age = null
  if (profile?.dateOfBirth) {
    const dob = new Date(profile.dateOfBirth)
    const diff = Date.now() - dob.getTime()
    age = Math.floor(diff / (1000 * 60 * 60 * 24 * 365))
  }

  const targetStats = {
    shops: profile?.businesses?.length || 0,
    hours: hoursSpent,
    days: joinedDate
      ? Math.floor((Date.now() - joinedDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0,
    age: age || 0,
  }

  useEffect(() => {
    Object.entries(targetStats).forEach(([key, value]) => {
      if (value <= 0) return
      let current = 0
      const increment = value / 50
      const timer = setInterval(() => {
        current += increment
        if (current >= value) {
          current = value
          clearInterval(timer)
        }
        setAnimatedStats((prev) => ({ ...prev, [key]: Math.floor(current) }))
      }, 30)
      return () => clearInterval(timer)
    })
  }, [targetStats.shops, targetStats.hours, targetStats.days, targetStats.age])

  const profileTasks = [
    {
      key: "profilePictureUrl",
      label: "Upload profile picture",
      done: !!profile?.profilePictureUrl,
      action: () => navigate("/settings/profile"),
    },
    {
      key: "dateOfBirth",
      label: "Add date of birth",
      done: !!profile?.dateOfBirth,
      action: () => navigate("/settings/profile"),
    },
    {
      key: "telephoneNumber",
      label: "Add phone number",
      done: !!profile?.telephoneNumber,
      action: () => navigate("/settings/profile"),
    },
  ]

  const completedCount = profileTasks.filter((t) => t.done).length
  const profileCompletion = Math.round(
    (completedCount / profileTasks.length) * 100
  )
  const hasShop =
    Array.isArray(profile?.businesses) && profile.businesses.length > 0
  const shopCompletion = hasShop ? 100 : 0
  const overallCompletion = Math.round(
    (profileCompletion + shopCompletion) / 2
  )
  const missingTasks = profileTasks.filter((t) => !t.done)

  return (
    <div className="enhanced-card activity-card">
      <div className="card-header">
        <div className="card-icon">📊</div>
        <div>
          <h3 className="card-title">Activity Overview</h3>
          <p className="card-subtitle">
            Your current engagement score. Complete the suggested tasks below to
            reach 100% and increase visibility.
          </p>
        </div>
      </div>
      <div className="card-content">
        <div className="stats-grid">
          {["shops", "hours", "days", "age"]
            .filter((key) => key !== "age" || age !== null)
            .map((key) => (
              <div key={key} className="stat-item">
                <div className="stat-circle">
                  <div className="stat-value">{animatedStats[key]}</div>
                  <svg viewBox="0 0 36 36" className="circular-chart">
                    <path
                      className="circle-bg"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className={`circle ${key}`}
                      strokeDasharray={`${
                        Math.min(
                          key === "shops"
                            ? animatedStats.shops * 25
                            : key === "hours"
                            ? animatedStats.hours / 2
                            : key === "days"
                            ? animatedStats.days / 5
                            : animatedStats.age,
                          100
                        )
                      }, 100`}
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                </div>
                <div className="stat-label">
                  {key === "shops"
                    ? "Shops"
                    : key === "hours"
                    ? "Hours"
                    : key === "days"
                    ? "Days"
                    : "Years Old"}
                </div>
              </div>
            ))}
        </div>
        <div className="completion-guidance">
          <div className="completion-summary">
            <div className="completion-bar-wrapper">
              <div className="completion-label">
                <strong>Profile Completion:</strong> {profileCompletion}%
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${profileCompletion}%` }}
                  aria-label="Profile completion"
                />
              </div>
            </div>
            <div className="completion-bar-wrapper">
              <div className="completion-label">
                <strong>Shop Setup:</strong> {hasShop ? "Done" : "Incomplete"}
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${shopCompletion}%` }}
                  aria-label="Shop setup completion"
                />
              </div>
            </div>
            <div className="completion-bar-wrapper overall">
              <div className="completion-label">
                <strong>Overall Activity Score:</strong> {overallCompletion}%
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${overallCompletion}%` }}
                  aria-label="Overall completion"
                />
              </div>
            </div>
          </div>
          {overallCompletion < 100 && (
            <div className="next-steps">
              <h4>How to reach 100%</h4>
              <ul>
                {missingTasks.map((t) => (
                  <li key={t.key}>
                    <button
                      className="inline-action"
                      onClick={(e) => {
                        e.preventDefault()
                        t.action()
                      }}
                    >
                      ➕ {t.label}
                    </button>
                  </li>
                ))}
                {!hasShop && (
                  <li>
                    <button
                      className="inline-action"
                      onClick={(e) => {
                        e.preventDefault()
                        navigate("/become-owner")
                      }}
                    >
                      ➕ Create your first shop
                    </button>
                  </li>
                )}
              </ul>
              <p className="guidance-text">
                Completing these tasks increases your activity score and unlocks
                more visibility and credibility on the platform.
              </p>
            </div>
          )}
          {overallCompletion === 100 && (
            <div className="congrats">
              🎉 You've reached 100% activity! Keep engaging to maintain
              momentum.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ShopsCard({ businesses = [] }) {
  const navigate = useNavigate()
  const prefersDark = usePrefersDark()
  const defaultLogo = prefersDark ? DEFAULT_LOGO_DARK : DEFAULT_LOGO_LIGHT

  return (
    <div className="enhanced-card shops-card">
      <div className="card-header">
        <div className="card-icon">🏪</div>
        <h3 className="card-title">My Shops ({businesses.length})</h3>
        <Link to="/become-owner" className="add-shop-btn">
          <span>+</span> Add Shop
        </Link>
      </div>
      <div className="card-content">
        {businesses.length > 0 ? (
          <div className="shops-list">
            {businesses.map((shop, index) => {
              // Parse schedule robustly (JSON or compact string)
              const schedule = parseIncomingOpeningHours(shop.openingHours)
              const computedOpen = isOpenNow(schedule)
              // Respect manual override if provided
              const finalOpen =
                typeof shop.isManuallyOpen === "boolean"
                  ? shop.isManuallyOpen
                  : computedOpen

              const slugPath = shop.slug
                ? `/shop/${encodeURIComponent(shop.slug)}`
                : "/"

              const logoSrc = shop.profilePictureUrl || defaultLogo
              const weeklyText = buildSimpleWeeklyLabel(schedule)

              return (
                <Link
                  key={shop.slug || index}
                  to={slugPath}
                  className="shop-item"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="shop-avatar">
                    <img
                      src={logoSrc}
                      alt={`${shop.name || shop.slug} logo`}
                      className="shop-logo"
                    />
                    <div
                      className={`status-indicator ${finalOpen ? "online" : "offline"}`}
                    ></div>
                  </div>
                  <div className="shop-info">
                    <h4 className="shop-name">{shop.name || shop.slug}</h4>
                    <div className="shop-meta">
                      <span className={`status-badge ${finalOpen ? "open" : "closed"}`}>
                        {finalOpen ? "🟢 Open" : "🔴 Closed"}
                      </span>
                      <span className="hours">🕒 {weeklyText}</span>
                    </div>
                  </div>
                  <div className="shop-actions">
                    <button
                      className="action-btn edit-btn"
                      title="Edit Shop"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        navigate("/settings")
                      }}
                    >
                      ✏️
                    </button>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">🏪</div>
            <h4>No shops yet</h4>
            <p>Start your entrepreneurial journey by creating your first shop</p>
            <Link to="/become-owner" className="create-shop-btn">
              ✨ Create Your First Shop
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

function BookingsCard({ bookings = [], loading, error }) {
  const navigate = useNavigate()
  const activeBookings = bookings.filter((b) =>
    ["confirmed", "pending"].includes(String(b.status || "").toLowerCase())
  )
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 6
  const totalPages = Math.max(1, Math.ceil(activeBookings.length / itemsPerPage))
  const paginated = activeBookings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const getStatusIcon = (status) => {
    const s = String(status || "").toLowerCase()
    if (s === "confirmed") return "✅"
    if (s === "pending") return "⏳"
    return "📦"
  }

  const getStatusClass = (status) => {
    const s = String(status || "").toLowerCase()
    if (s === "confirmed") return "confirmed"
    if (s === "pending") return "pending"
    return "default"
  }

  return (
    <div className="enhanced-card bookings-card">
      <div className="card-header">
        <div className="card-icon">🛍️</div>
        <h3 className="card-title">
          My Bookings ({activeBookings.length})
        </h3>
      </div>
      <div className="card-content">
        {loading && (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading your bookings...</p>
          </div>
        )}
        {error && (
          <div className="error-state">
            <span>⚠️ {error}</span>
          </div>
        )}
        {!loading && paginated.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🛍️</div>
            <h4>No bookings yet</h4>
            <p>Your booked products will appear here</p>
          </div>
        )}
        {!loading && paginated.length > 0 && (
          <>
            <div className="bookings-list">
              {paginated.map((booking) => (
                <div key={booking.reservationId} className="booking-item">
                  <div className="booking-image">
                    {booking.clothingItem?.pictureUrls?.[0] ? (
                      <img
                        src={booking.clothingItem.pictureUrls[0]}
                        alt={booking.clothingItem.name}
                        className="product-image"
                      />
                    ) : (
                      <div className="placeholder-image">📦</div>
                    )}
                  </div>
                  <div className="booking-details">
                    <h4 className="product-name">
                      {booking.clothingItem?.name} – {booking.shopName}
                    </h4>
                    <div className="booking-meta">
                      <span
                        className={`status-badge ${getStatusClass(
                          booking.status
                        )}`}
                      >
                        {getStatusIcon(booking.status)} {booking.status}
                      </span>
                      <span className="booking-date">
                        {new Date(
                          booking.createdAt
                        ).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <button
                    className="view-details-btn"
                    onClick={() => {
                      if (booking.clothingItemId) {
                        navigate(`/product/${booking.clothingItemId}`)
                      }
                    }}
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
            <div className="pagination-controls">
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.max(1, p - 1))
                }
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const { userId: paramId } = useParams()
  const navigate = useNavigate()
  const token = getToken()
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [bookings, setBookings] = useState([])
  const [loadingBookings, setLoadingBookings] = useState(true)
  const [bookingsError, setBookingsError] = useState("")

  let tokenId = null
  if (token) {
    try {
      const d = jwtDecode(token)
      tokenId = d.UserId || d.sub || d.id
    } catch {}
  }
  const userId = paramId || tokenId

  const fetchBookings = useCallback(async () => {
    if (!token) {
      setBookingsError("Not authenticated.")
      setLoadingBookings(false)
      return
    }
    setLoadingBookings(true)
    setBookingsError("")

    try {
      const res = await fetch(
        `${API_BASE}/api/Reservation/my-bookings`,
        { headers: getAuthHeaders(token) }
      )
      if (!res.ok) throw new Error(`Error ${res.status}`)
      const raw = await res.json()

      const enriched = await Promise.all(
        raw.map(async (booking) => {
          try {
            const itemRes = await fetch(
              `${API_BASE}/api/ClothingItem/${booking.clothingItemId}`,
              { headers: getAuthHeaders(token) }
            )
            if (itemRes.ok) {
              const itemData = await itemRes.json()
              booking.shopName =
                itemData.shop?.name ||
                itemData.business?.name ||
                "Unknown Shop"
            } else {
              booking.shopName = "Unknown Shop"
            }
          } catch {
            booking.shopName = "Unknown Shop"
          }
          return booking
        })
      )

      setBookings(enriched)
    } catch (e) {
      setBookingsError(e.message)
    } finally {
      setLoadingBookings(false)
    }
  }, [token])

  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener("online", goOnline)
    window.addEventListener("offline", goOffline)
    return () => {
      window.removeEventListener("online", goOnline)
      window.removeEventListener("offline", goOffline)
    }
  }, [])

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "reservationUpdated") fetchBookings()
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [fetchBookings])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

  useEffect(() => {
    if (!userId) {
      setError("Invalid user ID.")
      setLoading(false)
      return
    }
    ;(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/User/${userId}`, {
          headers: getAuthHeaders(token),
        })
        if (res.status === 401) {
          navigate("/login")
          return
        }
        if (!res.ok) throw new Error(`Error ${res.status}`)
        const data = await res.json()
        const pic = localStorage.getItem("latestProfilePicture")
        if (pic) data.profilePictureUrl = pic
        setProfile(data)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    })()
  }, [userId, navigate, token])

  if (loading) {
    return (
      <div className="enhanced-profile-container">
        <div className="loading-container">
          <div className="loading-spinner large"></div>
          <p>Loading your amazing profile...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="enhanced-profile-container">
        <div className="error-container">
          <div className="error-icon">😔</div>
          <p className="error-text">{error}</p>
          <button
            className="btn-secondary"
            onClick={() => navigate("/")}
          >
            🏠 Go Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <Navbar />
      <div className="enhanced-profile-container">
        {!isOnline && (
          <div className="offline-banner">
            <span>📡</span> You're currently offline. Some features may be
            limited.
          </div>
        )}

        <div className="enhanced-hero">
          <div className="hero-background"></div>
          <div className="hero-content">
            <div className="avatar-section">
              <div className="avatar-container">
                <img
                  src={
                    profile?.profilePictureUrl ||
                    "/Assets/default-avatar.jpg"
                  }
                  alt={profile?.name}
                  className="profile-avatar"
                />
                <div className="online-indicator"></div>
              </div>
            </div>

            <div className="profile-info">
              <h1 className="profile-name">{profile?.name}</h1>
              <div className="contact-info">
                <div className="contact-item">
                  <span className="icon">✉️</span>
                  <span>{profile?.email}</span>
                </div>
                {profile?.telephoneNumber && (
                  <div className="contact-item">
                    <span className="icon">📱</span>
                    <span>{profile.telephoneNumber}</span>
                  </div>
                )}
              </div>
              <div className="profile-badges">
                <span className="badge verified">✓ Verified</span>
                <span className="badge member">👑 Member</span>
              </div>
            </div>

            <div className="profile-actions">
              <button
                className="btn-primary"
                onClick={() => navigate("/settings/profile")}
              >
                ✏️ Edit Profile
              </button>
            </div>
          </div>
        </div>

        <div className="enhanced-dashboard">
          <div className="dashboard-grid">
            <div className="grid-item activity">
              <ActivityStatsCard profile={profile} token={token} />
            </div>
            <div className="grid-item shops">
              <ShopsCard businesses={profile?.businesses || []} />
            </div>
            <div className="grid-item bookings">
              <BookingsCard
                bookings={bookings}
                loading={loadingBookings}
                error={bookingsError}
              />
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </>
  )
}
