import { useState, useMemo, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { loadStripe } from "@stripe/stripe-js"
import "../Styling/BecomeOwner.css"
import Navbar from "../Components/Navbar"

function getToken() {
  const raw = localStorage.getItem("token")
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return typeof parsed === "string" ? parsed : parsed.token
  } catch {
    return raw
  }
}

function decodeJwt(token) {
  try {
    const payload = token.split(".")[1]
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    return JSON.parse(decodeURIComponent(escape(json)))
  } catch {
    return null
  }
}

function extractRoles(claims) {
  if (!claims) return []
  // Common role claim shapes
  const candidates = [
    claims.roles,
    claims.role,
    claims["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"],
    claims["roles"],
  ]
  const found =
    candidates?.find((v) => v !== undefined) ??
    []
  return Array.isArray(found) ? found : [found]
}

export default function BecomeOwner() {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [testResponse, setResponse] = useState(null)
  const [darkMode, setDarkMode] = useState(() => {
    return (
      localStorage.getItem("becomeOwnerDarkMode") === "true" ||
      window.matchMedia("(prefers-color-scheme: dark)").matches
    )
  })

  const publishableKey = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY
  const stripePromise = useMemo(
    () => (publishableKey ? loadStripe(publishableKey) : null),
    [publishableKey]
  )

  const frontendBase = process.env.REACT_APP_CLIENT_BASE_URL || window.location.origin
  const apiBase = process.env.REACT_APP_API_BASE_URL || "http://77.242.26.150:8000"

  // Redirect Admins away from this page
  useEffect(() => {
    const jwt = getToken()
    if (!jwt) return

    const claims = decodeJwt(jwt)
    const roles = extractRoles(claims).map(String)
    const isAdmin = roles.some((r) => r.toLowerCase() === "admin")

    if (isAdmin) {
      navigate("/unauthorized", { replace: true })
    }
  }, [navigate])

  useEffect(() => {
    localStorage.setItem("becomeOwnerDarkMode", darkMode)
  }, [darkMode])


  async function handleSubscribe() {
    const jwt = getToken()
    if (!jwt) {
      alert("Please log in to start your amazing journey!")
      return
    }

    setLoading(true)
    const successUrl = `${frontendBase}/create-shop`
    const cancelUrl = `${frontendBase}/payment-cancel`
    const endpoint =
      `${apiBase}/api/payment/create-session?` +
      `successUrl=${encodeURIComponent(successUrl)}` +
      `&cancelUrl=${encodeURIComponent(cancelUrl)}`

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
        },
      })

      if (!res.ok) {
        console.error("Failed to create checkout session:", await res.text())
        setLoading(false)
        return
      }

      const { url: checkoutUrl } = await res.json()
      window.location.href = checkoutUrl
    } catch (error) {
      console.error("Error:", error)
      setLoading(false)
    }
  }

  const toggleDarkMode = () => {
    setDarkMode(!darkMode)
  }

  return (
    <div>
      <Navbar />
      <div className={`become-owner-page ${darkMode ? "dark-theme" : "light-theme"}`}>

        {/* Animated background elements */}
        <div className="become-owner-background-elements">
          <div className="become-owner-bg-orb become-owner-bg-orb-1"></div>
          <div className="become-owner-bg-orb become-owner-bg-orb-2"></div>
          <div className="become-owner-bg-orb become-owner-bg-orb-3"></div>
        </div>

        <div className="become-owner-container">
          <div className="become-owner-card">
            <div className="become-owner-card-content">
              {/* Left side - Main content */}
              <div className="become-owner-main-content">
                <div className="become-owner-header-section">
                  <div className="become-owner-badge">
                    <span className="become-owner-badge-icon">✨</span>
                    Something Amazing Awaits
                  </div>

                  <h1 className="become-owner-title">
                    Welcome to Your
                    <span className="become-owner-title-highlight">Dream Business!</span>
                  </h1>

                  <p className="become-owner-subtitle">
                    🎉 <strong>Congratulations!</strong> You're about to embark on the most exciting entrepreneurial
                    journey of your life. We're absolutely <em>thrilled</em> to have you here!
                  </p>
                </div>

                <div className="become-owner-features-section">
                  <div className="become-owner-package-card">
                    <div className="become-owner-package-header">
                      <div className="become-owner-package-icon">
                        <span>👑</span>
                      </div>
                      <div className="become-owner-package-info">
                        <h3>Your VIP Business Package</h3>
                        <p className="become-owner-package-price">Just $20/month - Incredible Value!</p>
                      </div>
                    </div>

                    <div className="become-owner-features-grid">
                      <div className="become-owner-feature-item">
                        <span className="become-owner-check-icon">✅</span>
                        <span>Your Own Shop</span>
                      </div>
                      <div className="become-owner-feature-item">
                        <span className="become-owner-check-icon">✅</span>
                        <span>Inventory Management</span>
                      </div>
                      <div className="become-owner-feature-item">
                        <span className="become-owner-check-icon">✅</span>
                        <span>Team Management</span>
                      </div>
                      <div className="become-owner-feature-item">
                        <span className="become-owner-check-icon">✅</span>
                        <span>Customer Analytics</span>
                      </div>
                    </div>
                  </div>

                  <div className="become-owner-cta-section">
                    <p className="become-owner-thankyou">
                      💝 <strong>Thank you</strong> for choosing us to be part of your success story. Together, we're
                      going to build something absolutely <em>extraordinary</em>!
                    </p>

                    <button className="become-owner-subscribe-button" onClick={handleSubscribe} disabled={loading}>
                      {loading ? (
                        <>
                          <span className="become-owner-loading-spinner"></span>
                          Creating Your Empire...
                        </>
                      ) : (
                        <>
                          <span className="become-owner-button-icon">⚡</span>
                          Start My Business Journey
                          <span className="become-owner-button-arrow">→</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {testResponse && (
                  <div className="become-owner-status-card">
                    <strong>System Status:</strong> {testResponse}
                  </div>
                )}
              </div>

              {/* Right side - Visual elements */}
              <div className="become-owner-visual-section">
                <div className="become-owner-visual-content">
                  <div className="become-owner-visual-header">
                    <div className="become-owner-visual-icon">
                      <span>🛍️</span>
                    </div>
                    <h2>Your Success Story Starts Here</h2>
                    <p>Join thousands of successful entrepreneurs who trusted us with their dreams</p>
                  </div>

                  <div className="become-owner-stats-grid">
                    <div className="become-owner-stat-item">
                      <div className="become-owner-stat-icon">
                        <span>👥</span>
                      </div>
                      <p>10K+ Happy Owners</p>
                    </div>
                    <div className="become-owner-stat-item">
                      <div className="become-owner-stat-icon">
                        <span>📈</span>
                      </div>
                      <p>95% Success Rate</p>
                    </div>
                    <div className="become-owner-stat-item">
                      <div className="become-owner-stat-icon">
                        <span>⭐</span>
                      </div>
                      <p>5-Star Support</p>
                    </div>
                  </div>

                  <div className="become-owner-special-offer">
                    <p className="become-owner-offer-title">💫 Special Launch Offer</p>
                    <p className="become-owner-offer-description">
                      First month includes premium onboarding, personal success coach, and exclusive resources - all
                      FREE!
                    </p>
                  </div>
                </div>

                {/* Decorative elements */}
                <div className="become-owner-decorative-elements">
                  <div className="become-owner-deco-circle become-owner-deco-1"></div>
                  <div className="become-owner-deco-circle become-owner-deco-2"></div>
                  <div className="become-owner-deco-dot become-owner-dot-1"></div>
                  <div className="become-owner-deco-dot become-owner-dot-2"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Optional theme toggle control; keep if you have a switch in your design */}
          <button className="become-owner-theme-toggle" onClick={toggleDarkMode} type="button" aria-label="Toggle theme">
            Toggle theme
          </button>
        </div>
      </div>
    </div>
  )
}
