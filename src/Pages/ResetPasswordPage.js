
import { useEffect, useState } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import "../Styling/auth-forms.css"
import Navbar from "../Components/Navbar"
import Footer from "../Components/Footer"

const API_BASE = "http://77.242.26.150:8000/api/PasswordReset"

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [token, setToken] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirm] = useState("")
  const [status, setStatus] = useState("")
  const [statusType, setStatusType] = useState("") // 'success' or 'error'
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState(0)
  const [redirectCountdown, setRedirectCountdown] = useState(0)

  // Extract token from ?token=... on mount
  useEffect(() => {
    const t = searchParams.get("token")
    if (t) {
      setToken(t)
    } else {
      setStatus("Invalid or missing reset token. Please request a new password reset.")
      setStatusType("error")
    }
  }, [searchParams])

  // Password strength checker
  useEffect(() => {
    if (!password) {
      setPasswordStrength(0)
      return
    }

    let strength = 0
    if (password.length >= 8) strength += 25
    if (/[A-Z]/.test(password)) strength += 25
    if (/[0-9]/.test(password)) strength += 25
    if (/[^A-Za-z0-9]/.test(password)) strength += 25

    setPasswordStrength(strength)
  }, [password])

  // Countdown for redirect
  useEffect(() => {
    if (redirectCountdown > 0) {
      const timer = setTimeout(() => {
        setRedirectCountdown(redirectCountdown - 1)
      }, 1000)
      return () => clearTimeout(timer)
    } else if (redirectCountdown === 0 && statusType === "success") {
      navigate("/login")
    }
  }, [redirectCountdown, statusType, navigate])

  const getPasswordStrengthText = () => {
    if (passwordStrength === 0) return ""
    if (passwordStrength <= 25) return "Weak"
    if (passwordStrength <= 50) return "Fair"
    if (passwordStrength <= 75) return "Good"
    return "Strong"
  }

  const getPasswordStrengthClass = () => {
    if (passwordStrength <= 25) return "weak"
    if (passwordStrength <= 50) return "fair"
    if (passwordStrength <= 75) return "good"
    return "strong"
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus("")
    setStatusType("")

    if (!token) {
      setStatus("Missing reset token.")
      setStatusType("error")
      return
    }

    if (password.length < 8) {
      setStatus("Password must be at least 8 characters long.")
      setStatusType("error")
      return
    }

    if (password !== confirmPassword) {
      setStatus("Passwords do not match.")
      setStatusType("error")
      return
    }

    setLoading(true)

    try {
      const res = await fetch(`${API_BASE}/reset-password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          newPassword: password,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setStatus(data.Message || "Password has been reset successfully! Redirecting to login...")
        setStatusType("success")
        setRedirectCountdown(3)
      } else {
        setStatus(data.Message || "Failed to reset password. Please try again or request a new reset link.")
        setStatusType("error")
      }
    } catch (err) {
      console.error("Network error:", err)
      setStatus("Network error. Please check your connection and try again.")
      setStatusType("error")
    } finally {
      setLoading(false)
    }
  }

  const handleGoBack = () => {
    navigate("/forgot-password")
  }

  return (
    <>
      <Navbar />
      <div className="reset-password-page">
        <div className="reset-password-container">
          <div className="reset-password-header">
            <div className="reset-password-icon">🔐</div>
            <h1 className="reset-password-title">Reset Your Password</h1>
            <p className="reset-password-subtitle">Enter your new password below to complete the reset process</p>
          </div>

          {status && (
            <div className={`status-message ${statusType}`}>
              <span className="status-icon">{statusType === "success" ? "✅" : "❌"}</span>
              <span className="status-text">{status}</span>
              {redirectCountdown > 0 && <span className="countdown">({redirectCountdown}s)</span>}
            </div>
          )}

          <form onSubmit={handleSubmit} className="reset-password-form">
            <div className="form-group">
              <label htmlFor="password" className="form-label">
                New Password
              </label>
              <div className="password-input-container">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your new password"
                  required
                  disabled={loading || !token}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input"
                  minLength="8"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
              {password && (
                <div className="password-strength">
                  <div className="strength-bar">
                    <div
                      className={`strength-fill ${getPasswordStrengthClass()}`}
                      style={{ width: `${passwordStrength}%` }}
                    ></div>
                  </div>
                  <span className={`strength-text ${getPasswordStrengthClass()}`}>{getPasswordStrengthText()}</span>
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword" className="form-label">
                Confirm New Password
              </label>
              <div className="password-input-container">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your new password"
                  required
                  disabled={loading || !token}
                  value={confirmPassword}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="form-input"
                  minLength="8"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={loading}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <div className="password-mismatch">❌ Passwords do not match</div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !token || password !== confirmPassword || password.length < 8}
              className="submit-button"
            >
              {loading && <div className="loading-spinner"></div>}
              {loading ? "Resetting Password..." : "Reset Password"}
            </button>
          </form>

          <div className="reset-password-footer">
            <div className="help-links">
              <a href="/contact" className="help-link">
                Need help?
              </a>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  )
}
