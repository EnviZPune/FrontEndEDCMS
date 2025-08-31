
import { useState } from "react"
import '../Styling/forgot-password-page.css'
import Navbar from "../Components/Navbar"
import Footer from "../Components/Footer"

const API_BASE = "http://77.242.26.150:8000/api/PasswordReset"

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState("")
  const [statusType, setStatusType] = useState("") // 'success', 'error', or ''
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus("")
    setStatusType("")
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE}/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          ClientUrl: window.location.origin,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setStatus(
          data.Message ||
            "Reset link sent successfully! Please check your email to continue with the password restoration process.",
        )
        setStatusType("success")
        setEmail("")
      } else {
        setStatus(data.Message || "Something went wrong. Please try again or contact support if the problem persists.")
        setStatusType("error")
      }
    } catch (err) {
      console.error("Network error:", err)
      setStatus("Network error. Please check your internet connection and try again.")
      setStatusType("error")
    } finally {
      setLoading(false)
    }
  }

  const handleGoBack = () => {
    window.history.back()
  }

  return (
    <>
      <Navbar />
      <div className="forgot-password-page">
        <div className="forgot-password-container">
          <div className="forgot-password-header">
            <div className="forgot-password-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.89 1 3 1.89 3 3V21C3 22.11 3.89 23 5 23H11V21H5V3H13V9H21ZM23 15V13C23 11.9 22.1 11 21 11H15C13.9 11 13 11.9 13 13V15C12.4 15 12 15.4 12 16V20C12 20.6 12.4 21 13 21H23C23.6 21 24 20.6 24 20V16C24 15.4 23.6 15 23 15ZM21 15H15V13C15 12.4 15.4 12 16 12H20C20.6 12 21 12.4 21 13V15Z"
                  fill="currentColor"
                />
              </svg>
            </div>
            <h1>Forgot Password?</h1>
            <p className="forgot-password-subtitle">
              No worries! Enter your email address and we'll send you a link to reset your password.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="forgot-password-form">
            <div className="form-group">
              <label htmlFor="email" className="form-label">
                Email Address
              </label>
              <div className="input-wrapper">
                <div className="input-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <polyline
                      points="22,6 12,13 2,6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  placeholder="Enter your email address"
                  required
                  disabled={loading}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-input"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className={`submit-button ${loading ? "loading" : ""}`}
            >
              {loading ? (
                <>
                  <div className="loading-spinner"></div>
                  Sending Reset Link...
                </>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2 3L22 12L2 21V3Z" fill="currentColor" />
                  </svg>
                  Send Reset Link
                </>
              )}
            </button>
          </form>

          {status && (
            <div className={`status-message ${statusType}`}>
              <div className="status-icon">
                {statusType === "success" ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                    <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" strokeWidth="2" />
                    <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" strokeWidth="2" />
                  </svg>
                )}
              </div>
              <span>{status}</span>
            </div>
          )}

          <div className="forgot-password-footer">

            <div className="help-text">
              Remember your password?
              <a href="/login" className="help-link">
                Sign in here
              </a>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  )
}

export default ForgotPasswordPage
