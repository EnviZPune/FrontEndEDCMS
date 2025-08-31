import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../Components/Navbar";
import Footer from "../Components/Footer";
import { useTranslation } from "react-i18next";
import "../Styling/usersettings.css";

const API_BASE = "http://77.242.26.150:8000";

// Password strength calculation
const calculatePasswordStrength = (password) => {
  if (!password) return { score: 0, label: "", width: 0, color: "" };

  let score = 0;
  const checks = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    numbers: /\d/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };

  score = Object.values(checks).filter(Boolean).length;

  if (score <= 2) return { score, label: "Weak", width: 25, color: "weak", checks };
  if (score === 3) return { score, label: "Fair", width: 50, color: "fair", checks };
  if (score === 4) return { score, label: "Good", width: 75, color: "good", checks };
  return { score, label: "Strong", width: 100, color: "strong", checks };
};

// Password requirements checker
const getPasswordRequirements = (password) => [
  { key: "at_least", text: "At least 8 characters", met: password.length >= 8 },
  { key: "lowercase", text: "One lowercase letter", met: /[a-z]/.test(password) },
  { key: "uppercase", text: "One uppercase letter", met: /[A-Z]/.test(password) },
  { key: "number", text: "One number", met: /\d/.test(password) },
  { key: "special", text: "One special character", met: /[!@#$%^&*(),.?\":{}|<>]/.test(password) },
];

// GCS upload helper unchanged
const uploadImageToGCS = async (file) => {
  if (!file) return null;
  const timestamp = Date.now();
  const fileName = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
  const uploadUrl = `https://storage.googleapis.com/edcms_bucket/${fileName}`;
  const txtUrl = `${uploadUrl}.txt`;

  try {
    await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });

    await fetch(txtUrl, {
      method: "PUT",
      headers: { "Content-Type": "text/plain" },
      body: uploadUrl,
    });

    return uploadUrl;
  } catch (err) {
    console.error("Upload error:", err);
    return null;
  }
};

const getToken = () => {
  const raw = localStorage.getItem("token");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed.token || parsed;
  } catch {
    return raw;
  }
};

export default function UserSettings() {
  const { t } = useTranslation("usersettings");
  const navigate = useNavigate();

  const [profile, setProfile] = useState({
    userId: null,
    name: "",
    email: "",
    telephoneNumber: "",
    profilePictureUrl: "",
    dateOfBirth: "",
  });

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  // Calculate password strength
  const passwordStrength = calculatePasswordStrength(newPassword);
  const passwordRequirements = getPasswordRequirements(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;
  const passwordsDontMatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  // Load user
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/User/me`, { headers });
        if (res.status === 401) {
          navigate("/login");
          return;
        }
        if (!res.ok) throw new Error("Failed to fetch profile");
        const dto = await res.json();

        let dob = "";
        if (dto.dateOfBirth) {
          try {
            const d = new Date(dto.dateOfBirth);
            if (!isNaN(d)) dob = d.toISOString().slice(0, 10);
          } catch {}
        }

        setProfile({
          userId: dto.userId,
          name: dto.name || "",
          email: dto.email || "",
          telephoneNumber: dto.telephoneNumber || "",
          profilePictureUrl: dto.profilePictureUrl || "",
          dateOfBirth: dob,
        });
      } catch (err) {
        console.error("Failed to load profile:", err);
        setError(t("errors.load_profile", { defaultValue: "Could not load profile." }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handlers
  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = await uploadImageToGCS(file);
    if (url) setProfile((p) => ({ ...p, profilePictureUrl: url }));
    else setError(t("errors.image_upload", { defaultValue: "Image upload failed." }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (newPassword && newPassword !== confirmPassword) {
      setError(t("errors.passwords_mismatch", { defaultValue: "Passwords do not match." }));
      setLoading(false);
      return;
    }

    if (newPassword && passwordStrength.score < 3) {
      setError(t("errors.password_too_weak", { defaultValue: "Password is too weak. Please choose a stronger password." }));
      setLoading(false);
      return;
    }

    const payload = {
      userId: profile.userId,
      name: profile.name,
      email: profile.email,
      telephoneNumber: profile.telephoneNumber,
      profilePictureUrl: profile.profilePictureUrl,
      dateOfBirth: profile.dateOfBirth || null,
      ...(newPassword ? { password: newPassword } : {}),
    };

    try {
      const res = await fetch(`${API_BASE}/api/User/${profile.userId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        navigate("/login");
        return;
      }
      if (!res.ok) throw new Error("Update failed");

      // Cache latest profile picture so profile page reflects immediately
      if (profile.profilePictureUrl) {
        localStorage.setItem("latestProfilePicture", profile.profilePictureUrl);
        try {
          // best-effort notify same-tab listeners
          window.dispatchEvent(new Event("latestProfilePicture"));
        } catch {}
      }

      setSuccess(t("success.updated", { defaultValue: "Profile updated successfully!" }));
      setNewPassword("");
      setConfirmPassword("");

      // Redirect to "My Profile" page on success
      setTimeout(() => navigate("/my-profile"), 1500);
    } catch (err) {
      console.error(err);
      setError(t("errors.update_failed", { defaultValue: "Update failed. Please try again." }));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    // eslint-disable-next-line no-restricted-globals
    if (!window.confirm(t("danger.confirm", {
      defaultValue: "Are you sure you want to delete your account? This action cannot be undone."
    }))) return;

    try {
      const res = await fetch(`${API_BASE}/api/User/${profile.userId}`, {
        method: "DELETE",
        headers,
      });

      if (res.status === 401) {
        navigate("/login");
        return;
      }
      if (!res.ok) throw new Error("Delete failed");
      window.location.href = "/login";
    } catch (err) {
      console.error(err);
      alert(t("errors.delete_failed", { defaultValue: "Delete failed. Please try again." }));
    }
  };

  return (
    <>
      <Navbar />
      <div className="user-settings-page">
        <div className="user-settings-container">
          <div className="settings-header">
            <div className="settings-icon">⚙️</div>
            <h1 className="settings-title">{t("title", { defaultValue: "Account Settings" })}</h1>
            <p className="settings-subtitle">
              {t("subtitle", { defaultValue: "Manage your profile and account preferences" })}
            </p>
          </div>

          {error && (
            <div className="status-message error" role="alert" aria-live="assertive">
              <span className="status-icon">⚠️</span>
              <span className="status-text">{error}</span>
            </div>
          )}

          {success && (
            <div className="status-message success" role="status" aria-live="polite">
              <span className="status-icon">✅</span>
              <span className="status-text">{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="settings-form" noValidate>
            <div className="form-section">
              <h3 className="section-title">
                <span className="section-icon">👤</span>
                {t("sections.profile_info", { defaultValue: "Profile Information" })}
              </h3>

              <div className="form-group">
                <label className="form-label">{t("fields.profile_picture", { defaultValue: "Profile Picture" })}</label>
                <div className="image-upload-container">
                  <div className="current-image">
                    {profile.profilePictureUrl ? (
                      <img
                        className="profile-preview"
                        src={profile.profilePictureUrl || "/placeholder.svg"}
                        alt={t("aria.profile_preview", { defaultValue: "Profile preview" })}
                      />
                    ) : (
                      <div className="profile-placeholder" aria-label={t("aria.no_picture", { defaultValue: "No picture" })}>
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
                    {t("actions.choose_image", { defaultValue: "Choose Image" })}
                  </label>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">{t("fields.full_name", { defaultValue: "Full Name" })}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    required
                    placeholder={t("placeholders.full_name", { defaultValue: "Enter your full name" })}
                    autoComplete="name"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">{t("fields.email", { defaultValue: "Email Address" })}</label>
                  <input
                    type="email"
                    className="form-input"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    required
                    placeholder={t("placeholders.email", { defaultValue: "Enter your email" })}
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">{t("fields.phone", { defaultValue: "Phone Number" })}</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={profile.telephoneNumber}
                    onChange={(e) => setProfile({ ...profile, telephoneNumber: e.target.value })}
                    placeholder={t("placeholders.phone", { defaultValue: "Enter your phone number" })}
                    autoComplete="tel"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t("fields.dob", { defaultValue: "Date of Birth" })}</label>
                  <input
                    type="date"
                    className="form-input"
                    value={profile.dateOfBirth}
                    onChange={(e) => setProfile({ ...profile, dateOfBirth: e.target.value })}
                    placeholder="YYYY-MM-DD"
                    autoComplete="bday"
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3 className="section-title">
                <span className="section-icon">🔒</span>
                {t("sections.change_password", { defaultValue: "Change Password" })}
              </h3>

              <div className="form-group">
                <label className="form-label">{t("fields.new_password", { defaultValue: "New Password" })}</label>
                <div className="password-input-container">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    className="form-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t("placeholders.new_password", { defaultValue: "Enter new password" })}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    disabled={!newPassword}
                    aria-label={
                      showNewPassword
                        ? t("aria.hide_password", { defaultValue: "Hide password" })
                        : t("aria.show_password", { defaultValue: "Show password" })
                    }
                  >
                    {showNewPassword ? "🙈" : "👁️"}
                  </button>
                </div>

                {newPassword && (
                  <div className="password-strength" aria-live="polite">
                    <div className="strength-bar">
                      <div
                        className={`strength-fill ${passwordStrength.color}`}
                        style={{ width: `${passwordStrength.width}%` }}
                      />
                    </div>
                    <span className={`strength-text ${passwordStrength.color}`}>
                      {t(`strength.${passwordStrength.label.toLowerCase()}`, { defaultValue: passwordStrength.label })}
                    </span>
                  </div>
                )}

                {newPassword && (
                  <div className="password-requirements">
                    {passwordRequirements.map((req) => (
                      <div key={req.key} className={`requirement ${req.met ? "met" : "unmet"}`}>
                        <span className="requirement-icon">{req.met ? "✅" : "❌"}</span>
                        <span className="requirement-text">
                          {t(`requirements.${req.key}`, { defaultValue: req.text })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">{t("fields.confirm_new_password", { defaultValue: "Confirm New Password" })}</label>
                <div className="password-input-container">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    className={`form-input ${passwordsDontMatch ? "error" : ""} ${passwordsMatch ? "success" : ""}`}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t("placeholders.confirm_new_password", { defaultValue: "Confirm new password" })}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={!confirmPassword}
                    aria-label={
                      showConfirmPassword
                        ? t("aria.hide_password", { defaultValue: "Hide password" })
                        : t("aria.show_password", { defaultValue: "Show password" })
                    }
                  >
                    {showConfirmPassword ? "🙈" : "👁️"}
                  </button>
                </div>

                {passwordsDontMatch && (
                  <div className="password-mismatch">
                    <span className="mismatch-icon">⚠️</span>
                    <span>{t("errors.passwords_mismatch", { defaultValue: "Passwords do not match" })}</span>
                  </div>
                )}

                {passwordsMatch && (
                  <div className="password-match">
                    <span className="match-icon">✅</span>
                    <span>{t("info.passwords_match", { defaultValue: "Passwords match" })}</span>
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
                    <div className="loading-spinner" aria-hidden="true"></div>
                    <span>{t("cta.saving", { defaultValue: "Saving Changes..." })}</span>
                  </>
                ) : (
                  <>
                    <span>💾</span>
                    <span>{t("cta.save", { defaultValue: "Save Changes" })}</span>
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="danger-zone">
            <div className="danger-zone-header">
              <h3 className="danger-zone-title">
                <span className="danger-icon">⚠️</span>
                {t("danger.title", { defaultValue: "Danger Zone" })}
              </h3>
              <p className="danger-zone-subtitle">
                {t("danger.subtitle", {
                  defaultValue:
                    "Once you delete your account, all shops that you might have will be deleted as well and there is no going back. Please be certain."
                })}
              </p>
            </div>
            <button className="delete-account-button" onClick={handleDeleteAccount}>
              <span>🗑️</span>
              <span>{t("danger.delete_btn", { defaultValue: "Delete My Account" })}</span>
            </button>
          </div>

          <div className="settings-footer">
            <button type="button" className="back-button" onClick={() => navigate("/my-profile")}>
              ← {t("footer.back_to_profile", { defaultValue: "Back to Profile" })}
            </button>
            <div className="help-links">
              <a href="/help" className="help-link">
                {t("footer.need_help", { defaultValue: "Need Help?" })}
              </a>
              <span className="separator">•</span>
              <a href="/privacy" className="help-link">
                {t("footer.privacy", { defaultValue: "Privacy Policy" })}
              </a>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
