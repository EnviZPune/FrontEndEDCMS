// src/pages/ResetPasswordPage.jsx
import { useEffect, useState } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import "../Styling/auth-forms.css"
import Navbar from "../Components/Navbar"
import Footer from "../Components/Footer"

// Base API root (env override > fallback)
const API_ROOT =
  import.meta?.env?.VITE_API_BASE ||
  process.env.REACT_APP_API_BASE ||
  "https://api.triwears.com/api"

// We’ll try these common endpoints in order, first with PUT then POST.
const CANDIDATE_PATHS = [
  "/PasswordReset",
  "/Auth/PasswordReset",
  "/Auth/reset-password",
  "/Account/reset-password",
  "/Users/reset-password",
]

export default function ResetPasswordPage() {
  const { t } = useTranslation("resetpassword")
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [token, setToken] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirm] = useState("")
  const [status, setStatus] = useState("")
  const [statusType, setStatusType] = useState("") // 'success' | 'error'
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState(0)
  const [redirectCountdown, setRedirectCountdown] = useState(0)

  // Robust token extraction (handles wrongly encoded ? as %3F)
  useEffect(() => {
    let tkn = searchParams.get("token")
    if (!tkn) {
      const href = window.location.href
      const m = href.match(/reset-password(?:%3F|\?)token=([^&#]+)/i)
      if (m && m[1]) {
        tkn = decodeURIComponent(m[1])
        const clean = `/reset-password?token=${encodeURIComponent(tkn)}`
        window.history.replaceState(null, "", clean)
      }
    }
    if (tkn) {
      setToken(tkn)
      setStatus("")
      setStatusType("")
    } else {
      setStatus(
        t("errors.invalidOrMissingToken", {
          defaultValue:
            "Invalid or missing reset token. Please request a new password reset.",
        })
      )
      setStatusType("error")
    }
  }, [searchParams, t])

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

  // Countdown then redirect
  useEffect(() => {
    if (redirectCountdown > 0) {
      const timer = setTimeout(() => setRedirectCountdown((s) => s - 1), 1000)
      return () => clearTimeout(timer)
    } else if (redirectCountdown === 0 && statusType === "success") {
      navigate("/login")
    }
  }, [redirectCountdown, statusType, navigate])

  const strengthKey = () => {
    if (passwordStrength === 0) return ""
    if (passwordStrength <= 25) return "weak"
    if (passwordStrength <= 50) return "fair"
    if (passwordStrength <= 75) return "good"
    return "strong"
  }
  const strengthClass = () => strengthKey() || "weak"

  // Safe JSON parse helper
  const parseJson = async (res) => {
    try {
      return await res.json()
    } catch {
      return {}
    }
  }

  async function tryResetOnce(path, method, payload) {
    const url = `${API_ROOT}${path}`
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    })
    return res
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus("")
    setStatusType("")

    if (!token) {
      setStatus(t("errors.missingToken", { defaultValue: "Missing reset token." }))
      setStatusType("error")
      return
    }
    if (password.length < 8) {
      setStatus(
        t("errors.shortPassword", {
          defaultValue: "Password must be at least 8 characters long.",
        })
      )
      setStatusType("error")
      return
    }
    if (password !== confirmPassword) {
      setStatus(t("errors.mismatch", { defaultValue: "Passwords do not match." }))
      setStatusType("error")
      return
    }

    setLoading(true)
    try {
      // Some backends expect { token, newPassword }, others { Token, NewPassword }
      const payloads = [
        { token, newPassword: password },
        { Token: token, NewPassword: password },
      ]
      const methods = ["PUT", "POST"]

      let lastResponse = null

      outer: for (const path of CANDIDATE_PATHS) {
        for (const method of methods) {
          for (const payload of payloads) {
            const res = await tryResetOnce(path, method, payload)
            lastResponse = res

            // 404 Not Found -> try next path
            if (res.status === 404) continue

            // 405 Method Not Allowed -> try next method
            if (res.status === 405) continue

            // Treat 200/201/204 as success
            if (res.ok || res.status === 204) {
              setStatus(
                t("status.success", {
                  defaultValue:
                    "Password has been reset successfully! Redirecting to login...",
                })
              )
              setStatusType("success")
              setRedirectCountdown(3)
              break outer
            }

            // For 400/401/403/500, surface message and stop trying further
            const data = await parseJson(res)
            const msg =
              data.Message ||
              data.message ||
              data.error ||
              `Error ${res.status}`
            setStatus(
              t("status.genericError", {
                defaultValue:
                  "Failed to reset password. Please try again or request a new reset link.",
              }) + (msg ? ` (${msg})` : "")
            )
            setStatusType("error")
            break outer
          }
        }
      }

      // If we never hit anything except 404/405, show a helpful hint
      if (lastResponse && [404, 405].includes(lastResponse.status) && !statusType) {
        setStatus(
          t("status.noEndpoint", {
            defaultValue:
              "Reset endpoint not found on the server. Please try again later or request a new link.",
          })
        )
        setStatusType("error")
      }
    } catch (err) {
      console.error("Network error:", err)
      setStatus(
        t("status.networkError", {
          defaultValue: "Network error. Please check your connection and try again.",
        })
      )
      setStatusType("error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Navbar />
      <div className="reset-password-page">
        <div className="reset-password-container">
          <div className="reset-password-header">
            <div className="reset-password-icon" aria-hidden="true">🔐</div>
            <h1 className="reset-password-title">
              {t("title", { defaultValue: "Reset Your Password" })}
            </h1>
            <p className="reset-password-subtitle">
              {t("subtitle", {
                defaultValue:
                  "Enter your new password below to complete the reset process",
              })}
            </p>
          </div>

          {status && (
            <div className={`status-message ${statusType}`} role="status" aria-live="polite">
              <span className="status-icon" aria-hidden="true">
                {statusType === "success" ? "✅" : "❌"}
              </span>
              <span className="status-text">{status}</span>
              {redirectCountdown > 0 && (
                <span className="countdown">({redirectCountdown}s)</span>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="reset-password-form" noValidate>
            <div className="form-group">
              <label htmlFor="password" className="form-label">
                {t("form.passwordLabel", { defaultValue: "New Password" })}
              </label>
              <div className="password-input-container">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={t("form.passwordPlaceholder", { defaultValue: "Enter your new password" })}
                  required
                  disabled={loading || !token}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input"
                  minLength={8}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((s) => !s)}
                  disabled={loading}
                  aria-label={
                    showPassword
                      ? t("a11y.hidePassword", { defaultValue: "Hide password" })
                      : t("a11y.showPassword", { defaultValue: "Show password" })
                  }
                >
                  {showPassword ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>

              {password && (
                <div className="password-strength">
                  <div className="strength-bar">
                    <div
                      className={`strength-fill ${strengthClass()}`}
                      style={{ width: `${passwordStrength}%` }}
                    />
                  </div>
                  <span className={`strength-text ${strengthClass()}`}>
                    {strengthKey()
                      ? t(`strength.labels.${strengthKey()}`, { defaultValue: "Strength" })
                      : ""}
                  </span>
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword" className="form-label">
                {t("form.confirmLabel", { defaultValue: "Confirm New Password" })}
              </label>
              <div className="password-input-container">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder={t("form.confirmPlaceholder", { defaultValue: "Confirm your new password" })}
                  required
                  disabled={loading || !token}
                  value={confirmPassword}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="form-input"
                  minLength={8}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword((s) => !s)}
                  disabled={loading}
                  aria-label={
                    showConfirmPassword
                      ? t("a11y.hidePassword", { defaultValue: "Hide password" })
                      : t("a11y.showPassword", { defaultValue: "Show password" })
                  }
                >
                  {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>

              {confirmPassword && password !== confirmPassword && (
                <div className="password-mismatch">
                  ❌ {t("errors.mismatch", { defaultValue: "Passwords do not match." })}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !token || password !== confirmPassword || password.length < 8}
              className="submit-button"
              aria-busy={loading ? "true" : "false"}
            >
              {loading && <div className="loading-spinner" aria-hidden="true"></div>}
              {loading
                ? t("cta.resetting", { defaultValue: "Resetting Password..." })
                : t("cta.reset", { defaultValue: "Reset Password" })}
            </button>
          </form>

          <div className="reset-password-footer">
            <div className="help-links">
              {t("footer.help", {
                email: "edjcms20205@gmail.com",
                defaultValue: "Need help? Contact us - edjcms20205@gmail.com",
              })}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  )
}
