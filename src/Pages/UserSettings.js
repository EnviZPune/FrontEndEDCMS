import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import Navbar from "../Components/Navbar"
import Footer from "../Components/Footer"
import "../Styling/usersettings.css"

const API_BASE = "http://77.242.26.150:8000"

// Password strength calculation
const calculatePasswordStrength = (password) => {
  if (!password) return { score: 0, label: "", width: 0 }

  let score = 0
  const checks = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    numbers: /\d/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  }

  score = Object.values(checks).filter(Boolean).length

  if (score <= 2) return { score, label: "Weak", width: 25, color: "weak" }
  if (score === 3) return { score, label: "Fair", width: 50, color: "fair" }
  if (score === 4) return { score, label: "Good", width: 75, color: "good" }
  return { score, label: "Strong", width: 100, color: "strong" }
}

// Password requirements checker
const getPasswordRequirements = (password) => [
  { text: "At least 8 characters", met: password.length >= 8 },
  { text: "One lowercase letter", met: /[a-z]/.test(password) },
  { text: "One uppercase letter", met: /[A-Z]/.test(password) },
  { text: "One number", met: /\d/.test(password) },
  { text: "One special character", met: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
]

// GCS upload helper unchanged
const uploadImageToGCS = async (file) => {
  if (!file) return null
  const timestamp = Date.now()
  const fileName = `${timestamp}-${file.name}`
  const uploadUrl = `https://storage.googleapis.com/edcms_bucket/${fileName}`
  const txtUrl = `${uploadUrl}.txt`

  try {
    await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    })

    await fetch(txtUrl, {
      method: "PUT",
      headers: { "Content-Type": "text/plain" },
      body: uploadUrl,
    })

    return uploadUrl
  } catch (err) {
    console.error("Upload error:", err)
    return null
  }
}

export default function UserSettings() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState({
    userId: null,
    name: "",
    email: "",
    telephoneNumber: "",
    profilePictureUrl: "",
  })

  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)

  const token = localStorage.getItem("token")
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }

  // Calculate password strength
  const passwordStrength = calculatePasswordStrength(newPassword)
  const passwordRequirements = getPasswordRequirements(newPassword)
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0
  const passwordsDontMatch = confirmPassword.length > 0 && newPassword !== confirmPassword

  // Load user
  useEffect(() => {
    fetch(`${API_BASE}/api/User/me`, { headers })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch profile")
        return res.json()
      })
      .then((dto) => {
        setProfile({
          userId: dto.userId,
          name: dto.name,
          email: dto.email,
          telephoneNumber: dto.telephoneNumber || "",
          profilePictureUrl: dto.profilePictureUrl || "",
        })
      })
      .catch((err) => {
        console.error("Failed to load profile:", err)
        setError("Could not load profile.")
      })
  }, [])

  // Handlers
  const handleImageChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const url = await uploadImageToGCS(file)
    if (url) setProfile((p) => ({ ...p, profilePictureUrl: url }))
    else setError("Image upload failed.")
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    setLoading(true)

    if (newPassword && newPassword !== confirmPassword) {
      setError("Passwords do not match.")
      setLoading(false)
      return
    }

    if (newPassword && passwordStrength.score < 3) {
      setError("Password is too weak. Please choose a stronger password.")
      setLoading(false)
      return
    }

    const payload = {
      userId: profile.userId,
      name: profile.name,
      email: profile.email,
      telephoneNumber: profile.telephoneNumber,
      profilePictureUrl: profile.profilePictureUrl,
      ...(newPassword ? { password: newPassword } : {}),
    }

    try {
      const res = await fetch(`${API_BASE}/api/User/${profile.userId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error("Update failed")

      setSuccess("Profile updated successfully!")
      setNewPassword("")
      setConfirmPassword("")

      // Redirect to "My Profile" page on success
      setTimeout(() => navigate("/my-profile"), 2000)
    } catch (err) {
      console.error(err)
      setError("Update failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!window.confirm("Are you sure you want to delete your account? This action cannot be undone.")) return

    try {
      const res = await fetch(`${API_BASE}/api/User/${profile.userId}`, {
        method: "DELETE",
        headers,
      })

      if (!res.ok) throw new Error("Delete failed")
      window.location.href = "/login"
    } catch (err) {
      console.error(err)
      alert("Delete failed. Please try again.")
    }
  }

  return (
    <>
      <Navbar />
      <div className="user-settings-page">
        <div className="user-settings-container">
          <div className="settings-header">
            <div className="settings-icon">⚙️</div>
            <h1 className="settings-title">Account Settings</h1>
            <p className="settings-subtitle">Manage your profile and account preferences</p>
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

          <form onSubmit={handleSubmit} className="settings-form">
            <div className="form-section">
              <h3 className="section-title">
                <span className="section-icon">👤</span>
                Profile Information
              </h3>

              <div className="form-group">
                <label className="form-label">Profile Picture</label>
                <div className="image-upload-container">
                  <div className="current-image">
                    {profile.profilePictureUrl ? (
                      <img
                        className="profile-preview"
                        src={profile.profilePictureUrl || "/placeholder.svg"}
                        alt="Profile preview"
                      />
                    ) : (
                      <div className="profile-placeholder">
                        <span>📷</span>
                      </div>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="file-input"
                    id="profile-image"
                  />
                  <label htmlFor="profile-image" className="file-input-label">
                    Choose Image
                  </label>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    required
                    placeholder="Enter your full name"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    className="form-input"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    required
                    placeholder="Enter your email"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  type="tel"
                  className="form-input"
                  value={profile.telephoneNumber}
                  onChange={(e) => setProfile({ ...profile, telephoneNumber: e.target.value })}
                  placeholder="Enter your phone number"
                />
              </div>
            </div>

            <div className="form-section">
              <h3 className="section-title">
                <span className="section-icon">🔒</span>
                Change Password
              </h3>

              <div className="form-group">
                <label className="form-label">New Password</label>
                <div className="password-input-container">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    className="form-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    disabled={!newPassword}
                  >
                    {showNewPassword ? "🙈" : "👁️"}
                  </button>
                </div>

                {newPassword && (
                  <div className="password-strength">
                    <div className="strength-bar">
                      <div
                        className={`strength-fill ${passwordStrength.color}`}
                        style={{ width: `${passwordStrength.width}%` }}
                      ></div>
                    </div>
                    <span className={`strength-text ${passwordStrength.color}`}>{passwordStrength.label}</span>
                  </div>
                )}

                {newPassword && (
                  <div className="password-requirements">
                    {passwordRequirements.map((req, index) => (
                      <div key={index} className={`requirement ${req.met ? "met" : "unmet"}`}>
                        <span className="requirement-icon">{req.met ? "✅" : "❌"}</span>
                        <span className="requirement-text">{req.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <div className="password-input-container">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    className={`form-input ${passwordsDontMatch ? "error" : ""} ${passwordsMatch ? "success" : ""}`}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={!confirmPassword}
                  >
                    {showConfirmPassword ? "🙈" : "👁️"}
                  </button>
                </div>

                {passwordsDontMatch && (
                  <div className="password-mismatch">
                    <span className="mismatch-icon">⚠️</span>
                    <span>Passwords do not match</span>
                  </div>
                )}

                {passwordsMatch && (
                  <div className="password-match">
                    <span className="match-icon">✅</span>
                    <span>Passwords match</span>
                  </div>
                )}
              </div>
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className={`submit-button ${loading ? "loading" : ""}`}
                disabled={loading || (newPassword && passwordStrength.score < 3)}
              >
                {loading ? (
                  <>
                    <div className="loading-spinner"></div>
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <span>💾</span>
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="danger-zone">
            <div className="danger-zone-header">
              <h3 className="danger-zone-title">
                <span className="danger-icon">⚠️</span>
                Danger Zone
              </h3>
              <p className="danger-zone-subtitle">
                Once you delete your account, there is no going back. Please be certain.
              </p>
            </div>
            <button className="delete-account-button" onClick={handleDeleteAccount}>
              <span>🗑️</span>
              <span>Delete My Account</span>
            </button>
          </div>

          <div className="settings-footer">
            <button type="button" className="back-button" onClick={() => navigate("/my-profile")}>
              ← Back to Profile
            </button>
            <div className="help-links">
              <a href="/help" className="help-link">
                Need Help?
              </a>
              <span className="separator">•</span>
              <a href="/privacy" className="help-link">
                Privacy Policy
              </a>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  )
}
