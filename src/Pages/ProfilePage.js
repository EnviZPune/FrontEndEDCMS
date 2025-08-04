import { useEffect, useState } from "react"
import { useNavigate, useParams, Link } from "react-router-dom"
import {jwtDecode} from "jwt-decode"
import Footer from "../Components/Footer"
import Navbar from "../Components/Navbar"
import "../Styling/myprofile.css"

const API_BASE = "http://77.242.26.150:8000"

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

// Utility to parse opening hours and determine if shop is open
function parseAndCheckOpen(openingHours) {
  if (!openingHours || !openingHours.includes("-")) return false
  const [start, end] = openingHours.split("-")
  const now = new Date()
  const [sh, sm] = start.split(":").map(Number)
  const [eh, em] = end.split(":").map(Number)
  const s = new Date(now)
  s.setHours(sh, sm, 0, 0)
  const e = new Date(now)
  e.setHours(eh, em, 0, 0)
  return now >= s && now <= e
}

// Enhanced Activity Panel Component with guidance to reach 100%
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
    const hours = (Date.now() - Number.parseInt(first, 10)) / (1000 * 60 * 60)
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
    days: joinedDate ? Math.floor((Date.now() - joinedDate.getTime()) / (1000 * 60 * 60 * 24)) : 0,
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

  // Completion logic
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

  const completedProfileCount = profileTasks.filter((t) => t.done).length
  const profileCompletion = Math.round((completedProfileCount / profileTasks.length) * 100)
  const hasShop = Array.isArray(profile?.businesses) && profile.businesses.length > 0
  const shopCompletion = hasShop ? 100 : 0
  const overallCompletion = Math.round((profileCompletion + shopCompletion) / 2)
  const missingProfileTasks = profileTasks.filter((t) => !t.done)

  return (
    <div className="enhanced-card activity-card">
      <div className="card-header">
        <div className="card-icon">📊</div>
        <div>
          <h3 className="card-title">Activity Overview</h3>
          <p className="card-subtitle">
            Your current engagement score. Complete the suggested tasks below to reach 100% and increase visibility.
          </p>
        </div>
      </div>
      <div className="card-content">
        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-circle">
              <div className="stat-value">{animatedStats.shops}</div>
              <svg viewBox="0 0 36 36" className="circular-chart">
                <path
                  className="circle-bg"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="circle shops"
                  strokeDasharray={`${Math.min(animatedStats.shops * 25, 100)}, 100`}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
            </div>
            <div className="stat-label">Shops</div>
          </div>

          <div className="stat-item">
            <div className="stat-circle">
              <div className="stat-value">{animatedStats.hours}</div>
              <svg viewBox="0 0 36 36" className="circular-chart">
                <path
                  className="circle-bg"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="circle hours"
                  strokeDasharray={`${Math.min(animatedStats.hours / 2, 100)}, 100`}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
            </div>
            <div className="stat-label">Hours</div>
          </div>

          <div className="stat-item">
            <div className="stat-circle">
              <div className="stat-value">{animatedStats.days}</div>
              <svg viewBox="0 0 36 36" className="circular-chart">
                <path
                  className="circle-bg"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="circle days"
                  strokeDasharray={`${Math.min(animatedStats.days / 5, 100)}, 100`}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
            </div>
            <div className="stat-label">Days</div>
          </div>

          {age !== null && (
            <div className="stat-item">
              <div className="stat-circle">
                <div className="stat-value">{animatedStats.age}</div>
                <svg viewBox="0 0 36 36" className="circular-chart">
                  <path
                    className="circle-bg"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="circle age"
                    strokeDasharray={`${Math.min(animatedStats.age, 100)}, 100`}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
              </div>
              <div className="stat-label">Years Old</div>
            </div>
          )}
        </div>

        {/* Completion / Guidance Section */}
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
                {missingProfileTasks.map((t) => (
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
                Completing these tasks increases your activity score and unlocks more visibility
                and credibility on the platform.
              </p>
            </div>
          )}
          {overallCompletion === 100 && (
            <div className="congrats">
              🎉 You've reached 100% activity! Keep engaging to maintain momentum.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Enhanced Shops Panel Component
function ShopsCard({ businesses = [] }) {
  const navigate = useNavigate()

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
              const isOpen =
                typeof shop.isManuallyOpen === "boolean"
                  ? shop.isManuallyOpen
                  : parseAndCheckOpen(shop.openingHours)
              const slugPath = shop.slug ? `/shop/${encodeURIComponent(shop.slug)}` : "/"

              return (
                <Link
                  key={shop.slug || index}
                  to={slugPath}
                  className="shop-item"
                  style={{ animationDelay: `${index * 0.1}s` }}
                  onClick={() => {
                    console.log("Navigating to shop:", slugPath)
                  }}
                >
                  <div className="shop-avatar">
                    <img
                      src={shop.profilePictureUrl || "/default-shop-logo.png"}
                      alt={`${shop.name || shop.slug} logo`}
                      className="shop-logo"
                    />
                    <div className={`status-indicator ${isOpen ? "online" : "offline"}`}></div>
                  </div>

                  <div className="shop-info">
                    <h4 className="shop-name">{shop.name || shop.slug}</h4>
                    <div className="shop-meta">
                      <span className={`status-badge ${isOpen ? "open" : "closed"}`}>
                        {isOpen ? "🟢 Open" : "🔴 Closed"}
                      </span>
                      {shop.openingHours && <span className="hours">🕒 {shop.openingHours}</span>}
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

// Enhanced Bookings Panel Component
function BookingsCard({ bookings, loading, error }) {
  const navigate = useNavigate()

  const getStatusIcon = (status) => {
    if (!status || typeof status !== "string") return "📦"

    switch (status.toLowerCase()) {
      case "confirmed":
        return "✅"
      case "pending":
        return "⏳"
      case "cancelled":
        return "❌"
      default:
        return "📦"
    }
  }

  const getStatusClass = (status) => {
    if (!status || typeof status !== "string") return "default"

    switch (status.toLowerCase()) {
      case "confirmed":
        return "confirmed"
      case "pending":
        return "pending"
      case "cancelled":
        return "cancelled"
      default:
        return "default"
    }
  }

  return (
    <div className="enhanced-card bookings-card">
      <div className="card-header">
        <div className="card-icon">🛍️</div>
        <h3 className="card-title">My Bookings ({bookings?.length || 0})</h3>
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

        {!loading && !error && bookings && bookings.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🛍️</div>
            <h4>No bookings yet</h4>
            <p>Your booked products will appear here</p>
          </div>
        )}

        {!loading && bookings && bookings.length > 0 && (
          <div className="bookings-list">
            {bookings.map((booking) => (
              <div key={booking.reservationId} className="booking-item">
                <div className="booking-image">
                  {booking.clothingItem?.pictureUrls?.[0] ? (
                    <img
                      src={booking.clothingItem.pictureUrls[0] || "/placeholder.svg"}
                      alt={booking.clothingItem.name}
                      className="product-image"
                    />
                  ) : (
                    <div className="placeholder-image">📦</div>
                  )}
                </div>

                <div className="booking-details">
                  <h4 className="product-name">{booking.clothingItem?.name}</h4>
                  {booking.clothingItem?.brand && <p className="product-brand">{booking.clothingItem.brand}</p>}
                  <div className="booking-meta">
                    <span className={`status-badge ${getStatusClass(booking.status)}`}>
                      {getStatusIcon(booking.status)} {booking.status || "Unknown"}
                    </span>
                    <span className="booking-date">{new Date(booking.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <button
                  className="view-details-btn"
                  onClick={() => {
                    if (booking.clothingItem?.clothingItemId) {
                      navigate(`/product/${booking.clothingItem.clothingItemId}`)
                    }
                  }}
                >
                  View
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Main Enhanced Profile Page Component
export default function EnhancedProfilePage() {
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

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  // sync profile picture if updated elsewhere
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "latestProfilePicture" && profile) {
        setProfile((p) => ({ ...p, profilePictureUrl: e.newValue || p.profilePictureUrl }))
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [profile])

  // Load profile
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
        if (res.status === 404) throw new Error("User not found.")
        if (!res.ok) throw new Error(`Error ${res.status}`)
        const data = await res.json()

        const cachedPic = localStorage.getItem("latestProfilePicture")
        if (cachedPic) {
          data.profilePictureUrl = cachedPic
        }

        setProfile(data)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    })()
  }, [userId, navigate, token])

  // Load bookings
  useEffect(() => {
    if (!token) {
      setBookingsError("Not authenticated.")
      setLoadingBookings(false)
      return
    }

    let cancelled = false
    const loadBookings = async () => {
      setLoadingBookings(true)
      setBookingsError("")
      try {
        const res = await fetch(`${API_BASE}/api/Reservation/my-bookings`, {
          headers: getAuthHeaders(token),
        })
        if (!res.ok) {
          if (res.status === 401) throw new Error("Unauthorized; please log in again.")
          const text = await res.text()
          throw new Error(text || `Error fetching bookings: ${res.status}`)
        }
        const data = await res.json()
        if (!cancelled) setBookings(data)
      } catch (e) {
        console.error("Bookings load error:", e)
        if (!cancelled) setBookingsError(e.message)
      } finally {
        if (!cancelled) setLoadingBookings(false)
      }
    }

    loadBookings()
    return () => {
      cancelled = true
    }
  }, [token])

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
          <button className="btn-secondary" onClick={() => navigate("/")}>
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
            <span>📡</span>
            You're currently offline. Some features may be limited.
          </div>
        )}

        <div className="enhanced-hero">
          <div className="hero-background"></div>
          <div className="hero-content">
            <div className="avatar-section">
              <div className="avatar-container">
                <img
                  src={profile?.profilePictureUrl || "/default-avatar.png"}
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
              <button className="btn-primary" onClick={() => navigate("/settings/profile")}>
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
              <BookingsCard bookings={bookings} loading={loadingBookings} error={bookingsError} />
            </div>
          </div>
        </div>
        <Footer />
      </div>
    </>
  )
}
