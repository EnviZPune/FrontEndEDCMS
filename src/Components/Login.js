import { useState } from "react"
import '../Styling/log_user.css'
import { GoogleLogin } from "@react-oauth/google"
import { jwtDecode } from "jwt-decode"

function LoginComponent() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("http://77.242.26.150:8000/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ username, password }),
      })

      if (!response.ok) {
        const errorMessage = await response.text()
        throw new Error(errorMessage || "Login failed")
      }

      const data = await response.json()
      const token = typeof data === "string" ? data : data.token
      const payload = jwtDecode(token)
      console.log("Decoded JWT payload:", payload)

      localStorage.setItem("token", token)
      window.location.href = "/"
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword)
  }

  const handleGoogleSuccess = (credentialResponse) => {
    console.log("Google login success:", credentialResponse)
    // Handle Google login logic here
  }

  const handleGoogleError = () => {
    setError("Google login failed. Please try again.")
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <a href="/" className="logo-link">
            <img src={`${process.env.PUBLIC_URL}/Assets/edlogo.png`} className="login-logo" alt="Logo" />
          </a>
          <h1 className="login-title">Welcome Back</h1>
          <p className="login-subtitle">Log in to see our fullest extent!</p>
        </div>

        {error && (
          <div className="status-message error">
            <span className="status-icon">⚠️</span>
            <span className="status-text">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username" className="form-label">
              Username or Email
            </label>
            <input
              id="username"
              type="text"
              className="form-input"
              placeholder="Enter your username or email"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <div className="password-input-container">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className="form-input"
                placeholder="Enter your password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={togglePasswordVisibility}
                disabled={loading}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
          </div>

          <div className="form-options">
            <div className="remember-me">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={() => setRememberMe(!rememberMe)}
                disabled={loading}
              />
              <label htmlFor="rememberMe">Remember Me</label>
            </div>
            <a href="/forgot-password" className="forgot-password-link">
              Forgot Password?
            </a>
          </div>

          <button type="submit" className="submit-button" disabled={loading}>
            {loading && <div className="loading-spinner"></div>}
            <span>{loading ? "Logging in..." : "Sign In"}</span>
          </button>
        </form>

        <div className="divider">
        </div>
<br></br>
        <div className="login-footer">
          <p className="signup-prompt">
            Don't have an account?
            <a href="/register" className="signup-link">
              Sign up
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default LoginComponent
