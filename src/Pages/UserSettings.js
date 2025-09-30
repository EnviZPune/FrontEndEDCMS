import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../Components/Navbar";
import Footer from "../Components/Footer";
import { useTranslation } from "react-i18next";
import "../Styling/usersettings.css";

const API_BASE = "https://api.triwears.com";

const LOADING_GIF_LIGHT = "/Assets/triwears-black-loading.gif";
const LOADING_GIF_DARK  = "/Assets/triwears-white-loading.gif";

/* ---------------- Password strength helpers ---------------- */
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

const getPasswordRequirements = (password) => [
  { key: "at_least", text: "At least 8 characters", met: password.length >= 8 },
  { key: "lowercase", text: "One lowercase letter", met: /[a-z]/.test(password) },
  { key: "uppercase", text: "One uppercase letter", met: /[A-Z]/.test(password) },
  { key: "number", text: "One number", met: /\d/.test(password) },
  { key: "special", text: "One special character", met: /[!@#$%^&*(),.?\":{}|<>]/.test(password) },
];

/* ---------------- Theme helper ---------------- */
function usePrefersDark() {
  const [isDark, setIsDark] = useState(() =>
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => setIsDark(e.matches);
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else mq.addListener?.(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handler);
      else mq.removeListener?.(handler);
    };
  }, []);
  return isDark;
}

/* ---------------- GCS upload helper ---------------- */
const uploadImageToGCS = async (file) => {
  if (!file) return null;
  const timestamp = Date.now();
  const originalName = file.name || "upload";
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = `${timestamp}-${safeName}`;
  const uploadUrl = `https://storage.googleapis.com/edcms_bucket/${fileName}`;
  const txtUrl = `${uploadUrl}.txt`;
  try {
    await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
    await fetch(txtUrl, { method: "PUT", headers: { "Content-Type": "text/plain" }, body: uploadUrl });
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

const decodeJwt = (jwt) => {
  try {
    const base64 = jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => `%${("00" + c.charCodeAt(0).toString(16)).slice(-2)}`)
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
};

export default function UserSettings() {
  const { t } = useTranslation("usersettings");
  const navigate = useNavigate();
  const prefersDark = usePrefersDark();

  /* ---------------- Profile state ---------------- */
  const [profile, setProfile] = useState({
    userId: null,
    username: "",
    name: "",
    email: "",
    telephoneNumber: "",
    profilePictureUrl: "",
    dateOfBirth: "",
  });

  const [initialUsername, setInitialUsername] = useState("");

  /* ---------------- Password change state ---------------- */
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  /* ---------------- Status state ---------------- */
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  /* NEW: image upload in-flight state */
  const [uploadingImage, setUploadingImage] = useState(false);

  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  /* ---------------- Username validation & availability ---------------- */
  const USERNAME_REGEX = /^[A-Za-z0-9._]{3,20}$/;
  const RESERVED_USERNAMES = new Set(["admin", "support", "help", "contact", "triwears", "root"]);

  const [usernameValid, setUsernameValid] = useState(true);
  const [usernameAvailable, setUsernameAvailable] = useState(true); // assume ok unless changed + check fails
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameMsg, setUsernameMsg] = useState("");

  useEffect(() => {
    const u = (profile.username || "").trim();

    if (initialUsername && u.toLowerCase() === initialUsername.toLowerCase()) {
      setUsernameValid(true);
      setUsernameAvailable(true);
      setUsernameMsg("");
      return;
    }

    if (!u && !initialUsername) {
      setUsernameValid(true);
      setUsernameAvailable(true);
      setUsernameMsg("");
      return;
    }

    if (!u && initialUsername) {
      setProfile((p) => ({ ...p, username: initialUsername }));
      setUsernameValid(true);
      setUsernameAvailable(true);
      setUsernameMsg("");
      return;
    }

    if (!USERNAME_REGEX.test(u)) {
      setUsernameValid(false);
      setUsernameAvailable(false);
      setUsernameMsg(
        t("username.rules", { defaultValue: "3–20 chars. Letters, numbers, dot or underscore." })
      );
      return;
    }
    if (RESERVED_USERNAMES.has(u.toLowerCase())) {
      setUsernameValid(false);
      setUsernameAvailable(false);
      setUsernameMsg(t("username.reserved", { defaultValue: "This username is reserved." }));
      return;
    }

    setUsernameValid(true);
    setUsernameMsg("");

    let isCancelled = false;
    const timer = setTimeout(async () => {
      setCheckingUsername(true);
      try {
        const res = await fetch(
          `${API_BASE}/api/User/check-username?username=${encodeURIComponent(u)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (!isCancelled) {
            const available = !!(data.available ?? data.isAvailable ?? data.Available);
            setUsernameAvailable(available);
            setUsernameMsg(
              available
                ? t("username.available", { defaultValue: "Username is available" })
                : t("username.taken", { defaultValue: "Username is taken" })
            );
          }
        } else {
          if (!isCancelled) {
            setUsernameAvailable(true);
            setUsernameMsg("");
          }
        }
      } catch {
        if (!isCancelled) {
          setUsernameAvailable(true);
          setUsernameMsg("");
        }
      } finally {
        if (!isCancelled) setCheckingUsername(false);
      }
    }, 400);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.username, initialUsername]);

  /* ---------------- Derived helpers ---------------- */
  const passwordStrength = calculatePasswordStrength(newPassword);
  const passwordRequirements = getPasswordRequirements(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;
  const passwordsDontMatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  const isCurrentUsername =
    !!profile.username &&
    !!initialUsername &&
    profile.username.toLowerCase() === initialUsername.toLowerCase();

  /* ---------------- Load profile (DB authoritative) ---------------- */
  useEffect(() => {
    (async () => {
      try {
        const meRes = await fetch(`${API_BASE}/api/User/me`, { headers });
        if (meRes.status === 401) {
          navigate("/login");
          return;
        }
        if (!meRes.ok) throw new Error("Failed to fetch /me");
        const me = await meRes.json();

        const userId = me.userId ?? me.id ?? me.UserId ?? null;

        let db = null;
        if (userId != null) {
          const dbRes = await fetch(
            `${API_BASE}/api/User/${userId}?_=${Date.now()}`,
            { headers }
          );
          if (dbRes.ok) db = await dbRes.json();
        }

        const dobRaw = db?.dateOfBirth ?? db?.birthday ?? me?.dateOfBirth ?? me?.birthday ?? "";
        let dob = "";
        if (dobRaw) {
          try {
            const d = new Date(dobRaw);
            if (!isNaN(d)) dob = d.toISOString().slice(0, 10);
          } catch {}
        }

        const usernameFromDb =
          db?.username ?? db?.userName ?? db?.Username ?? db?.user?.username ?? "";

        let usernameResolved = usernameFromDb;
        if (!usernameResolved) {
          const usernameFromApi =
            me?.username ?? me?.userName ?? me?.Username ?? me?.user?.username ?? "";
          if (usernameFromApi) {
            usernameResolved = usernameFromApi;
          } else {
            let usernameFromJwt = "";
            if (token) {
              const payload = decodeJwt(token);
              usernameFromJwt =
                payload?.preferred_username ??
                payload?.username ??
                payload?.unique_name ??
                payload?.name ??
                "";
            }
            if (usernameFromJwt) {
              usernameResolved = usernameFromJwt;
            } else {
              const emailLocalPart =
                (me?.email && typeof me.email === "string" && me.email.includes("@"))
                  ? me.email.split("@")[0]
                  : "";
              usernameResolved = emailLocalPart || "";
            }
          }
        }

        setProfile({
          userId: userId,
          username: usernameResolved,
          name: db?.name ?? me?.name ?? "",
          email: db?.email ?? me?.email ?? "",
          telephoneNumber: db?.telephoneNumber ?? me?.telephoneNumber ?? "",
          profilePictureUrl: db?.profilePictureUrl ?? me?.profilePictureUrl ?? "",
          dateOfBirth: dob,
        });
        setInitialUsername(usernameResolved);
      } catch (err) {
        console.error("Failed to load profile:", err);
        setError(t("errors.load_profile", { defaultValue: "Could not load profile." }));
      } finally {
        setInitialLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- Handlers ---------------- */
  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);                  // <<< start uploading
    setError("");
    try {
      const url = await uploadImageToGCS(file);
      if (url) {
        setProfile((p) => ({ ...p, profilePictureUrl: url }));
      } else {
        setError(t("errors.image_upload", { defaultValue: "Image upload failed." }));
      }
    } catch {
      setError(t("errors.image_upload", { defaultValue: "Image upload failed." }));
    } finally {
      setUploadingImage(false);               // <<< done uploading
      // reset the file input so selecting the same file again re-triggers onChange
      try { e.target.value = ""; } catch {}
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const currentEqualsInitial =
      !!initialUsername &&
      !!profile.username &&
      profile.username.toLowerCase() === initialUsername.toLowerCase();

    if (!currentEqualsInitial && profile.username?.trim()) {
      const u = profile.username.trim();
      if (!USERNAME_REGEX.test(u)) {
        setError(t("username.rules", { defaultValue: "3–20 chars. Letters, numbers, dot or underscore." }));
        setLoading(false);
        return;
      }
      if (RESERVED_USERNAMES.has(u.toLowerCase())) {
        setError(t("username.reserved", { defaultValue: "This username is reserved." }));
        setLoading(false);
        return;
      }
      if (usernameAvailable === false) {
        setError(t("username.taken", { defaultValue: "Username is taken" }));
        setLoading(false);
        return;
      }
    }

    if (newPassword && newPassword !== confirmPassword) {
      setError(t("errors.passwords_mismatch", { defaultValue: "Passwords do not match." }));
      setLoading(false);
      return;
    }
    if (newPassword && calculatePasswordStrength(newPassword).score < 3) {
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

    if (profile.username?.trim() && !currentEqualsInitial) {
      payload.username = profile.username.trim();
    }

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

      if (profile.profilePictureUrl) {
        localStorage.setItem("latestProfilePicture", profile.profilePictureUrl);
        try { window.dispatchEvent(new Event("latestProfilePicture")); } catch {}
      }

      setSuccess(t("success.updated", { defaultValue: "Profile updated successfully!" }));
      setNewPassword("");
      setConfirmPassword("");

      if (payload.username) {
        setInitialUsername(payload.username);
      }

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

  /* ---------------- Initial loading ---------------- */
  if (initialLoading) {
    return (
      <>
        <div className="user-settings-page" style={{ minHeight: "40vh" }}>
          <div
            className="loading-container"
            aria-live="polite"
            aria-busy="true"
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "40px 0" }}
          >
            <img
              className="loading-gif"
              src={prefersDark ? LOADING_GIF_DARK : LOADING_GIF_LIGHT}
              alt="Loading"
              width={140}
              height={140}
              style={{ objectFit: "contain" }}
            />
            <p className="loading-text">Loading ...</p>
          </div>
        </div>
      </>
    );
  }

  /* ---------------- Render ---------------- */
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

              {/* Picture */}
              <div className="form-group" aria-busy={uploadingImage ? "true" : "false"}>
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

                  {/* File input disabled while uploading */}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="file-input"
                    id="profile-image"
                    disabled={uploadingImage}
                  />

                  {/* Label shows "Uploading ..." while in-flight */}
                  <label
                    htmlFor="profile-image"
                    className={`file-input-label${uploadingImage ? " is-uploading" : ""}`}
                    role="status"
                    aria-live="polite"
                  >
                    {uploadingImage ? t("actions.uploading", { defaultValue: "Uploading ..." }) : t("actions.choose_image", { defaultValue: "Choose Image" })}
                  </label>

                  {/* Optional tiny spinner next to the label */}
                  {uploadingImage && (
                    <div className="uploading-status" role="status" aria-live="polite" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                      <img
                        src={prefersDark ? LOADING_GIF_DARK : LOADING_GIF_LIGHT}
                        alt=""
                        width={22}
                        height={22}
                        style={{ objectFit: "contain" }}
                      />
                      <span>{t("actions.uploading", { defaultValue: "Uploading ..." })}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Name & Email */}
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

              {/* Username & Phone */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">{t("fields.username", { defaultValue: "Username" })}</label>
                  <div className="input-with-status">
                    <input
                      type="text"
                      className={`form-input ${
                        profile.username && (!usernameValid || usernameAvailable === false) ? "input-error" : ""
                      }`}
                      value={profile.username}
                      onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                      placeholder={t("placeholders.username", { defaultValue: "Choose a username (e.g., ardit.k)" })}
                      autoComplete="username"
                      inputMode="email"
                      pattern="[A-Za-z0-9._]{3,20}"
                      aria-describedby={(checkingUsername || usernameMsg || isCurrentUsername) ? "usernameHelp" : undefined}
                    />
                    {(checkingUsername || usernameMsg || isCurrentUsername) && (
                      <div
                        id="usernameHelp"
                        className={`input-hint ${isCurrentUsername && !checkingUsername && !usernameMsg ? "current" : ""}`}
                        aria-live="polite"
                      >
                        {checkingUsername ? (
                          <span>{t("username.checking", { defaultValue: "Checking availability..." })}</span>
                        ) : usernameMsg ? (
                          <span>{usernameMsg}</span>
                        ) : (
                          <span>{t("username.current", { defaultValue: "This is your current username." })}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

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
              </div>

              {/* DOB */}
              <div className="form-row">
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

            {/* Change Password */}
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
                      <div className={`strength-fill ${passwordStrength.color}`} style={{ width: `${passwordStrength.width}%` }} />
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

                {passwordsMatch && confirmPassword && (
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
                disabled={
                  loading ||
                  uploadingImage || /* prevent save during image upload */
                  (newPassword && passwordStrength.score < 3) ||
                  ((!initialUsername || profile.username.toLowerCase() !== initialUsername.toLowerCase()) &&
                    (!usernameValid || usernameAvailable === false))
                }
              >
                {loading ? (
                  <>
                    <img
                      src={prefersDark ? LOADING_GIF_DARK : LOADING_GIF_LIGHT}
                      alt=""
                      width={22}
                      height={22}
                      style={{ objectFit: "contain", marginRight: 8 }}
                    />
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
              {t("footer.need_help", { defaultValue: "Need Help? Contact Our Support" })}
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
