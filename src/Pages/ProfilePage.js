import { useEffect, useState } from "react"
import { useNavigate, useParams, Link } from "react-router-dom"
import { jwtDecode } from "jwt-decode"
import Navbar from "../Components/Navbar"
import Footer from "../Components/Footer"
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

// ─── Enhanced Activity Panel with Animations ──────────────────────────────────────────────────
function ActivityPanel({ profile, token }) {
  const [hoursSpent, setHoursSpent] = useState(0)
  const [animatedStats, setAnimatedStats] = useState({
    shops: 0,
    hours: 0,
    days: 0,
    age: 0,
  })

  useEffect(() => {
    const key = `firstVisit_${profile.userId}`
    let first = localStorage.getItem(key)
    if (!first) {
      first = Date.now().toString()
      localStorage.setItem(key, first)
    }
    const hours = (Date.now() - Number.parseInt(first, 10)) / (1000 * 60 * 60)
    setHoursSpent(Math.floor(hours))
  }, [profile.userId])

  let joinedDate = null
  if (token) {
    try {
      const decoded = jwtDecode(token)
      if (decoded.iat) joinedDate = new Date(decoded.iat * 1000)
    } catch {}
  }

  let age = null
  if (profile.dateOfBirth) {
    const dob = new Date(profile.dateOfBirth)
    const diff = Date.now() - dob.getTime()
    age = Math.floor(diff / (1000 * 60 * 60 * 24 * 365))
  }

  const targetStats = {
    shops: profile.businesses?.length || 0,
    hours: hoursSpent,
    days: joinedDate ? Math.floor((Date.now() - joinedDate.getTime()) / (1000 * 60 * 60 * 24)) : 0,
    age: age || 0,
  }

  // Animate numbers on mount
  useEffect(() => {
    const animateValue = (key, target) => {
      let current = 0
      const increment = target / 50
      const timer = setInterval(() => {
        current += increment
        if (current >= target) {
          current = target
          clearInterval(timer)
        }
        setAnimatedStats((prev) => ({ ...prev, [key]: Math.floor(current) }))
      }, 30)
    }

    Object.entries(targetStats).forEach(([key, value]) => {
      if (value > 0) animateValue(key, value)
    })
  }, [profile])

  return (
    <div className="dashboard-card activity-panel">
      <div className="card-header">
        <div className="card-icon gradient-icon">📊</div>
        <h3 className="card-title">Activity Overview</h3>
        <div className="card-decoration"></div>
      </div>

      <div className="activity-stats">
        <div className="stat-item" data-stat="shops">
          <div className="stat-circle">
            <div className="stat-value">{animatedStats.shops}</div>
            <div className="stat-progress">
              <svg viewBox="0 0 36 36" className="circular-chart">
                <path
                  className="circle-bg"
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="circle shops"
                  strokeDasharray={`${Math.min(animatedStats.shops * 10, 100)}, 100`}
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
            </div>
          </div>
          <div className="stat-label">Shops</div>
        </div>

        <div className="stat-item" data-stat="hours">
          <div className="stat-circle">
            <div className="stat-value">{animatedStats.hours}</div>
            <div className="stat-progress">
              <svg viewBox="0 0 36 36" className="circular-chart">
                <path
                  className="circle-bg"
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="circle hours"
                  strokeDasharray={`${Math.min(animatedStats.hours / 10, 100)}, 100`}
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
            </div>
          </div>
          <div className="stat-label">Hours</div>
        </div>

        <div className="stat-item" data-stat="days">
          <div className="stat-circle">
            <div className="stat-value">{animatedStats.days}</div>
            <div className="stat-progress">
              <svg viewBox="0 0 36 36" className="circular-chart">
                <path
                  className="circle-bg"
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="circle days"
                  strokeDasharray={`${Math.min(animatedStats.days / 5, 100)}, 100`}
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
            </div>
          </div>
          <div className="stat-label">Days</div>
        </div>

        {age !== null && (
          <div className="stat-item" data-stat="age">
            <div className="stat-circle">
              <div className="stat-value">{animatedStats.age}</div>
              <div className="stat-progress">
                <svg viewBox="0 0 36 36" className="circular-chart">
                  <path
                    className="circle-bg"
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="circle age"
                    strokeDasharray={`${Math.min(animatedStats.age, 100)}, 100`}
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
              </div>
            </div>
            <div className="stat-label">Years Old</div>
          </div>
        )}
      </div>

      <div className="bio-section">
      </div>
    </div>
  )
}

// ─── Enhanced Shops Panel with Interactive Cards ─────────────────────────────────────────────────
function ShopsPanel({ businesses }) {
  const [hoveredShop, setHoveredShop] = useState(null)

  return (
    <div className="dashboard-card shops-section">
      <div className="card-header">
        <div className="card-icon gradient-icon">🏪</div>
        <h3 className="card-title">My Shops ({businesses?.length || 0})</h3>
        <div className="card-decoration"></div>
      </div>

      {businesses && businesses.length > 0 ? (
        <div className="shops-grid">
          {businesses.map((shop, index) => {
            const isOpen =
              typeof shop.isManuallyOpen === "boolean" ? shop.isManuallyOpen : parseAndCheckOpen(shop.openingHours)

            return (
              <Link
              key={shop.slug}
              to={`/shop/${shop.slug}`}
              className="shop-card enhanced"
              onMouseEnter={() => setHoveredShop(shop.slug)}
              onMouseLeave={() => setHoveredShop(null)}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="shop-card-background" />
              <div className="shop-card-content">
                {/* Show the name up top */}
                <div className="shop-name-section">
                  <h4 className="shop-card-name">
                    {shop.name ?? shop.slug}
                  </h4>
                </div>

                {/* Logo + status */}
                <div className="shop-logo-section">
                  <div className="logo-container">
                    <img
                      src={shop.profilePictureUrl || "/default-shop-logo.png"}
                      alt={`${shop.name || shop.slug} logo`}
                      className="shop-card-logo"
                    />
                    <div className="logo-overlay" />
                  </div>
                  <div className={`shop-status-badge ${isOpen ? "open" : "closed"}`}>
                    <div className={`status-dot ${isOpen ? "open" : "closed"}`}/>
                    <span>{isOpen ? "Open" : "Closed"}</span>
                  </div>
                </div>

                {/* Details */}
                <div className="shop-info-section">
                  <div className="shop-details-enhanced">
                    <div className="shop-detail-item">
                      <span className="detail-icon">🏷️</span>
                      <p className="detail-text">{shop.name ?? shop.slug}</p>
                    </div>

                    {shop.businessPhoneNumber && (
                      <div className="shop-detail-item">
                        <span className="detail-icon">📞</span>
                        <p className="detail-text">{shop.businessPhoneNumber}</p>
                      </div>
                    )}

                    {shop.openingHours && (
                      <div className="shop-detail-item">
                        <span className="detail-icon">🕒</span>
                        <p className="detail-text">{shop.openingHours}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Link>

            )
          })}
        </div>
      ) : (
        <div className="empty-state enhanced">
          <div className="empty-state-animation">
            <div className="floating-icon">🏪</div>
            <div className="floating-icon">✨</div>
            <div className="floating-icon">🚀</div>
          </div>
          <h4 className="empty-state-title">No shops yet</h4>
          <p className="empty-state-text">
            Start your entrepreneurial journey by creating your first shop and showcase your products to the world!
          </p>
          <Link to="/become-owner" className="btn-primary enhanced">
            <span className="btn-icon">✨</span>
            <span className="btn-text">Create Your First Shop</span>
            <div className="btn-shimmer"></div>
          </Link>
        </div>
      )}
    </div>
  )
}

// ─── Main Profile Dashboard with Enhanced Features ────────────────────────────────────────────
export default function ProfilePage() {
  const { userId: paramId } = useParams()
  const navigate = useNavigate()
  const token = getToken()
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [isOnline, setIsOnline] = useState(navigator.onLine)

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

  useEffect(() => {
    if (!userId) {
      setError("Invalid user ID.")
      setLoading(false)
      return
    }
    ;(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/User/${userId}`, {
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        })

        if (res.status === 401) {
          navigate("/login")
          return
        }

        if (res.status === 404) throw new Error("User not found.")
        if (!res.ok) throw new Error(`Error ${res.status}`)

        setProfile(await res.json())
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    })()
  }, [userId, navigate, token])

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="profile-page-container">
          <div className="loading-container enhanced">
            <div className="loading-animation">
              <div className="loading-spinner enhanced"></div>
              <div className="loading-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
            <p className="loading-text">Loading your amazing profile...</p>
          </div>
        </div>
        <Footer />
      </>
    )
  }

  if (error) {
    return (
      <>
        <Navbar />
        <div className="profile-page-container">
          <div className="error-container enhanced">
            <div className="error-animation">
              <div className="error-icon">😔</div>
              <div className="error-waves"></div>
            </div>
            <p className="error-text">{error}</p>
            <button className="btn-secondary enhanced" onClick={() => navigate("/")}>
              <span>🏠</span>
              Go Home
            </button>
          </div>
        </div>
        <Footer />
      </>
    )
  }

  return (
    <>
      <Navbar />
      <div className="profile-page-container enhanced">
        {/* Connection Status */}
        {!isOnline && (
          <div className="offline-banner">
            <span>📡</span>
            You're currently offline. Some features may be limited.
          </div>
        )}

        {/* Enhanced Hero Section */}
        <div className="profile-hero enhanced">
          <div className="hero-background">
            <div className="hero-gradient"></div>
            <div className="hero-pattern"></div>
          </div>
          <div className="profile-hero-content">
            <div className="avatar-section">
              <div className="avatar-container">
                <img
                  src={profile.profilePictureUrl || "/default-avatar.png"}
                  alt={profile.name}
                  className="profile-avatar enhanced"
                />
                <div className="avatar-ring"></div>
                <div className="online-indicator"></div>
              </div>
            </div>
            <div className="profile-hero-info">
              <h1 className="profile-hero-name">{profile.name}</h1>
              <p className="profile-hero-email">
                <span className="email-icon">✉️</span>
                {profile.email}
              </p>
              {profile.telephoneNumber && (
                <p className="profile-hero-phone">
                  <span className="phone-icon">📱</span>
                  {profile.telephoneNumber}
                </p>
              )}
              <div className="profile-badges">
                <span className="badge verified">✓ Verified</span>
                <span className="badge member">👑 Member</span>
              </div>
            </div>
            <div className="profile-hero-actions">
              <button className="btn-hero enhanced" onClick={() => navigate("/settings/profile")}>
                <span className="btn-icon">✏️</span>
                <span className="btn-text">Edit Profile</span>
                <div className="btn-ripple"></div>
              </button>
            </div>
          </div>
        </div>

        {/* Enhanced Dashboard */}
        <div className="profile-dashboard enhanced">
          <ActivityPanel profile={profile} token={token} />
          <ShopsPanel businesses={profile.businesses} />
        </div>
      </div>
      <Footer />
    </>
  )
}
