import { useState, useEffect } from "react"
import "../Styling/regist.css"

function RegisterFormUser() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    username: "",
    phoneNumber: "",
    email: "",
    createPassword: "",
    confirmPassword: "",
    profilePictureUrl: "",
    role: "2",
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, text: "weak" })
  const [passwordsMatch, setPasswordsMatch] = useState(true)

  // Password strength calculation
  const calculatePasswordStrength = (password) => {
    let score = 0
    const checks = {
      length: password.length >= 8,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      numbers: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    }

    score = Object.values(checks).filter(Boolean).length

    if (score <= 2) return { score: score * 25, text: "weak", checks }
    if (score === 3) return { score: 50, text: "fair", checks }
    if (score === 4) return { score: 75, text: "good", checks }
    return { score: 100, text: "strong", checks }
  }

  // Update password strength when password changes
  useEffect(() => {
    if (formData.createPassword) {
      setPasswordStrength(calculatePasswordStrength(formData.createPassword))
    } else {
      setPasswordStrength({ score: 0, text: "weak", checks: {} })
    }
  }, [formData.createPassword])

  // Check if passwords match
  useEffect(() => {
    if (formData.confirmPassword) {
      setPasswordsMatch(formData.createPassword === formData.confirmPassword)
    } else {
      setPasswordsMatch(true)
    }
  }, [formData.createPassword, formData.confirmPassword])

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const togglePasswordVisibility = (field) => {
    if (field === "password") {
      setShowPassword(!showPassword)
    } else {
      setShowConfirmPassword(!showConfirmPassword)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    const requiredFields = [
      "firstName",
      "lastName",
      "dateOfBirth",
      "username",
      "phoneNumber",
      "email",
      "createPassword",
      "confirmPassword",
    ]

    for (const field of requiredFields) {
      if (!formData[field]) {
        setError(`Please fill in all fields. Missing: ${field}`)
        setLoading(false)
        return
      }
    }

    if (formData.createPassword !== formData.confirmPassword) {
      setError("Passwords do not match.")
      setLoading(false)
      return
    }

    if (passwordStrength.score < 50) {
      setError("Password is too weak. Please choose a stronger password.")
      setLoading(false)
      return
    }

    const roleMap = {
      0: 0, // BusinessOwner
      1: 1, // Employee
      2: 2, // User
    }

    const requestBody = {
      name: `${formData.firstName} ${formData.lastName}`,
      username: formData.username,
      email: formData.email,
      password: formData.createPassword,
      role: roleMap[formData.role],
      telephoneNumber: formData.phoneNumber,
      profilePictureUrl: formData.profilePictureUrl,
    }

    try {
      const response = await fetch("http://77.242.26.150:8000/api/Register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        let errorData
        try {
          errorData = await response.json()
        } catch {
          errorData = {}
        }
        throw new Error(errorData.message || "An error occurred while registering.")
      }

      // Send email confirmation
      const confirmRes = await fetch("http://77.242.26.150:8000/api/Auth/send-confirmation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: formData.email }),
      })

      if (!confirmRes.ok) {
        const errorText = await confirmRes.text()
        console.warn("Email confirmation request failed:", errorText)
      }

      setSuccess("Successfully Registered. Check your email to verify your account!")
      setFormData({
        firstName: "",
        lastName: "",
        dateOfBirth: "",
        username: "",
        phoneNumber: "",
        email: "",
        createPassword: "",
        confirmPassword: "",
        profilePictureUrl: "",
        role: "2",
      })

      setTimeout(() => {
        window.location.href = "http://localhost:3000/login"
      }, 2000)
    } catch (err) {
      setError(err.message || "An error occurred while registering.")
      setLoading(false)
    }
  }

  return (
    <div className="register-page">
      <div className="register-container">
        <div className="register-header">
          <a href="http://localhost:3000/" className="logo-link">
            <img src="Assets/edlogo.png" alt="Logo" className="register-logo" />
          </a>
          <h1 className="register-title">Create Your Account</h1>
          <p className="register-subtitle">Join our community and start your journey</p>
        </div>

        {error && (
          <div className="status-message error">
            <span className="status-icon">⚠️</span>
            <span className="status-text">{error}</span>
          </div>
        )}

        {success && (
          <div className="status-message success">
            <span className="status-icon">✅</span>
            <span className="status-text">{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="register-form">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">First Name</label>
              <input
                type="text"
                name="firstName"
                className="form-input"
                placeholder="Enter your first name"
                required
                value={formData.firstName}
                onChange={handleInputChange}
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Last Name</label>
              <input
                type="text"
                name="lastName"
                className="form-input"
                placeholder="Enter your last name"
                required
                value={formData.lastName}
                onChange={handleInputChange}
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Date of Birth</label>
              <input
                type="date"
                name="dateOfBirth"
                className="form-input"
                required
                value={formData.dateOfBirth}
                onChange={handleInputChange}
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                type="text"
                name="username"
                className="form-input"
                placeholder="Choose a username"
                required
                value={formData.username}
                onChange={handleInputChange}
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                type="tel"
                name="phoneNumber"
                className="form-input"
                placeholder="0691234567"
                pattern="^\d{10}$"
                required
                value={formData.phoneNumber}
                onChange={handleInputChange}
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                name="email"
                className="form-input"
                placeholder="your@email.com"
                required
                value={formData.email}
                onChange={handleInputChange}
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Create Password</label>
            <div className="password-input-container">
              <input
                type={showPassword ? "text" : "password"}
                name="createPassword"
                className="form-input"
                placeholder="Create a strong password"
                required
                value={formData.createPassword}
                onChange={handleInputChange}
                disabled={loading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => togglePasswordVisibility("password")}
                disabled={loading}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>

            {formData.createPassword && (
              <div className="password-strength">
                <div className="strength-bar">
                  <div
                    className={`strength-fill ${passwordStrength.text}`}
                    style={{ width: `${passwordStrength.score}%` }}
                  ></div>
                </div>
                <span className={`strength-text ${passwordStrength.text}`}>{passwordStrength.text}</span>
              </div>
            )}

            {formData.createPassword && passwordStrength.checks && (
              <div className="password-requirements">
                <div className={`requirement ${passwordStrength.checks.length ? "met" : ""}`}>
                  <span className="requirement-icon">{passwordStrength.checks.length ? "✓" : "○"}</span>
                  At least 8 characters
                </div>
                <div className={`requirement ${passwordStrength.checks.lowercase ? "met" : ""}`}>
                  <span className="requirement-icon">{passwordStrength.checks.lowercase ? "✓" : "○"}</span>
                  One lowercase letter
                </div>
                <div className={`requirement ${passwordStrength.checks.uppercase ? "met" : ""}`}>
                  <span className="requirement-icon">{passwordStrength.checks.uppercase ? "✓" : "○"}</span>
                  One uppercase letter
                </div>
                <div className={`requirement ${passwordStrength.checks.numbers ? "met" : ""}`}>
                  <span className="requirement-icon">{passwordStrength.checks.numbers ? "✓" : "○"}</span>
                  One number
                </div>
                <div className={`requirement ${passwordStrength.checks.special ? "met" : ""}`}>
                  <span className="requirement-icon">{passwordStrength.checks.special ? "✓" : "○"}</span>
                  One special character
                </div>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <div className="password-input-container">
              <input
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                className="form-input"
                placeholder="Confirm your password"
                required
                value={formData.confirmPassword}
                onChange={handleInputChange}
                disabled={loading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => togglePasswordVisibility("confirm")}
                disabled={loading}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? "🙈" : "👁️"}
              </button>
            </div>

            {formData.confirmPassword && !passwordsMatch && (
              <div className="password-mismatch">
                <span className="mismatch-icon">⚠️</span>
                Passwords do not match
              </div>
            )}

            {formData.confirmPassword && passwordsMatch && formData.createPassword && (
              <div className="password-match">
                <span className="match-icon">✓</span>
                Passwords match
              </div>
            )}
          </div>

          <button
            type="submit"
            className="submit-button"
            disabled={loading || !passwordsMatch || passwordStrength.score < 50}
          >
            {loading ? (
              <>
                <div className="loading-spinner"></div>
                Creating Account...
              </>
            ) : (
              <>
                <span>Create Account</span>
                <span className="button-icon">→</span>
              </>
            )}
          </button>
        </form>

        <div className="register-footer">
          <p className="login-link">
            Already have an account?
            <a href="http://localhost:3000/login" className="link">
              Sign in here
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default RegisterFormUser
