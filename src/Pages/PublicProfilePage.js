import { useEffect, useState } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import Navbar from "../Components/Navbar"
import Footer from "../Components/Footer"
import "../Styling/publicprofile.css"

const API_BASE = "https://api.triwears.com"

// Slugify helper (fallback only if actual slug is missing)
const slugify = (str) =>
  String(str || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")

// Build a /shop/:slug URL using the real slug; if absent, use slugified name (still a slug, not an ID)
const businessUrl = (b) => {
  const slug = b?.slug && String(b.slug).trim()
  const finalSlug = slug || slugify(b?.slug)
  return `/shop/${finalSlug}`
}

const isAdminUser = (profile) => {
  const role = profile?.role ?? profile?.roleName ?? profile?.Role ?? null
  return (
    role === "Admin" ||
    role === "admin" ||
    role === 1 ||
    role === "1" ||
    role === "Administrator"
  )
}

const PublicProfilePage = () => {
  const { userId } = useParams()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [status, setStatus] = useState({ loading: true, error: "" })

  useEffect(() => {
    async function loadProfile() {
      const token = localStorage.getItem("token")
      try {
        const res = await fetch(`${API_BASE}/api/User/${userId}`, {
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        })

        if (res.status === 401) {
          return navigate("/login")
        }

        if (res.status === 404) {
          setStatus({ loading: false, error: "User not found." })
          return
        }

        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`)
        }

        const data = await res.json()
        setProfile(data)
        setStatus({ loading: false, error: "" })
      } catch (err) {
        setStatus({ loading: false, error: err.message || "Failed to load." })
      }
    }

    loadProfile()
  }, [userId, navigate])

  if (status.loading) {
    return (
      <>
        <Navbar />
        <div className="public-profile-container">
          <div className="public-profile-loading">
            <div className="loading-spinner-public"></div>
            <div className="loading-dots-public">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <p className="loading-text-public">Loading profile…</p>
          </div>
        </div>
        <Footer />
      </>
    )
  }

  if (status.error) {
    return (
      <>
        <Navbar />
        <div className="public-profile-container">
          <div className="public-profile-error">
            <div className="error-animation-public">
              <div className="error-icon-public">😔</div>
              <div className="error-waves-public"></div>
            </div>
            <h2 className="error-title-public">Oops! Something went wrong</h2>
            <p className="error-message-public">{status.error}</p>
            <button className="btn-retry-public" onClick={() => window.location.reload()}>
              <span>🔄</span>
              Try Again
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
      <div className="public-profile-container">
        {/* Animated Background */}
        <div className="public-profile-background">
          <div className="gradient-orb orb-1"></div>
          <div className="gradient-orb orb-2"></div>
          <div className="gradient-orb orb-3"></div>
          <div className="floating-particles">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="particle"
                style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 3}s`,
                  animationDuration: `${3 + Math.random() * 4}s`,
                }}
              ></div>
            ))}
          </div>
        </div>

        {/* Hero Section */}
        <div className="public-profile-hero">
          <div className="hero-content-public">
            <div className="avatar-section-public">
              <div className="avatar-container-public">
                <img
                  src={profile.profilePictureUrl || "/Assets/default-avatar.jpg"}
                  alt={profile.name}
                  className="profile-picture-public"
                />
                <div className="avatar-ring-public"></div>
                <div className="online-indicator-public"></div>
              </div>
            </div>

            <div className="profile-info-public">
              <h1 className="profile-name-public">{profile.name}</h1>
              <div className="profile-details-public">
                <div className="detail-item-public">
                  <span className="detail-icon-public">✉️</span>
                  <span className="detail-text-public">{profile.email}</span>
                </div>
                {profile.telephoneNumber && (
                  <div className="detail-item-public">
                    <span className="detail-icon-public">📞</span>
                    <span className="detail-text-public">{profile.telephoneNumber}</span>
                  </div>
                )}
              </div>

              <div className="profile-badges-public">
                <div className="badge-public verified-badge">
                  <span className="badge-icon-public">✓</span>
                  Verified User
                </div>
                {profile.businesses && profile.businesses.length > 0 && (
                  <div className="badge-public business-badge">
                    <span className="badge-icon-public">🏪</span>
                    Business Owner
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="public-profile-content">
          <div className="stats-section-public">
            <div className="stat-card-public">
              <div className="stat-icon-public">👤</div>
              <div className="stat-info-public">
                <div className="stat-value-public">
               {profile.role === "Admin" ? "Support Agent" : "Member"}
                      </div>
                <div className="stat-label-public">Status</div>
              </div>
            </div>

           {!isAdminUser(profile) && (
              <div className="stat-card-public">
                <div className="stat-icon-public">🏪</div>
                <div className="stat-info-public">
                  <div className="stat-value-public">
                    {Array.isArray(profile.businesses) ? profile.businesses.length : 0}
                  </div>
                  <div className="stat-label-public">Businesses</div>
                </div>
              </div>
            )}
          </div>

          {/* Businesses Section — hide if Admin */}
          {!isAdminUser(profile) &&
            Array.isArray(profile.businesses) &&
            profile.businesses.length > 0 && (
              <div className="businesses-section-public">
                <div className="section-header-public">
                  <h3 className="section-title-public">
                    <span className="title-icon-public">🏪</span>
                    Businesses Owned
                  </h3>
                  <div className="section-decoration-public"></div>
                </div>

                <div className="businesses-grid-public">
                  {profile.businesses.map((business, index) => (
                    <div
                      key={business.businessId ?? index}
                      className="business-card-public"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <div className="business-card-background-public"></div>
                      <div className="business-card-content-public">
                        <div className="business-header-public">
                          <div className="business-logo-public">
                            <img
                              src={business.profilePictureUrl || "/default-shop-logo.png"}
                              alt={`${business.name || "Business"} logo`}
                              className="business-logo-img-public"
                            />
                          </div>
                          <div className="business-status-public">
                            <div className="status-dot-public open"></div>
                            <span>Active</span>
                          </div>
                        </div>

                        <div className="business-info-public">
                          <h4 className="business-name-public">{business.name || "Business"}</h4>
                          {business.address && (
                            <div className="business-detail-public">
                              <span className="business-detail-icon-public">📍</span>
                              <span className="business-detail-text-public">{business.address}</span>
                            </div>
                          )}
                          {business.category && (
                            <div className="business-detail-public">
                              <span className="business-detail-icon-public">🏷️</span>
                              <span className="business-detail-text-public">{business.category}</span>
                            </div>
                          )}
                        </div>

                        <div className="business-actions-public">
                          <Link to={businessUrl(business)} className="btn-view-business-public">
                            <span>👁️</span>
                            View Business
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>
      </div>
      <Footer />
    </>
  )
}

export default PublicProfilePage
