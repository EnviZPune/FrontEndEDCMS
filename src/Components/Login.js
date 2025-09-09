import { useState } from "react";
import "../Styling/log_user.css";
import { jwtDecode } from "jwt-decode";
import { useTranslation } from "react-i18next";

const API_BASE = "https://api.triwears.com/api";

// --- helpers ---------------------------------------------------------
const looksLikeJwt = (val) => typeof val === "string" && val.split(".").length === 3;

const extractTokenFromPayload = (payload) => {
  if (!payload) return null;
  if (typeof payload === "string" && looksLikeJwt(payload)) return payload;

  // common token field names
  const candidates = ["token", "accessToken", "jwt", "bearer", "value"];
  for (const key of candidates) {
    const v = payload?.[key];
    if (looksLikeJwt(v)) return v;
    if (typeof v === "string" && v.trim()) return v; // fallback
  }
  return null;
};

async function tryLogin(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "*/*",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* response wasn't JSON */ }

  return { ok: res.ok, status: res.status, data, text };
}
// --------------------------------------------------------------------

function LoginComponent() {
  const { t } = useTranslation("login");

  // Treat this as "Email or Username" so users can enter either.
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const cred = emailOrUsername.trim();

    try {
      // We’ll try the most likely combos in order:
      const attempts = [
        // Your original working path (very likely): lowercase /login with username
        { url: `${API_BASE}/login`, body: { username: cred, password } },
        // Some APIs accept email on same route
        { url: `${API_BASE}/login`, body: { email: cred, password } },
        // Fallback to capitalized route variants
        { url: `${API_BASE}/Login`, body: { username: cred, password } },
        { url: `${API_BASE}/Login`, body: { email: cred, password } },
      ];

      let lastErr = null;

      for (const attempt of attempts) {
        try {
          const { ok, status, data, text } = await tryLogin(attempt.url, attempt.body);
          if (!ok) {
            lastErr = text || (data && (data.message || data.error)) || `HTTP ${status}`;
            continue;
          }

          const token = extractTokenFromPayload(data) || (looksLikeJwt(text) ? text : null);
          if (!token) {
            lastErr = t("errors.no_token", { defaultValue: "No token returned from server." });
            continue;
          }

          // Optional decode for debugging; do not block on errors
          try { console.log("Decoded JWT payload:", jwtDecode(token)); } catch {}

          // Store exactly how Navbar expects it
          localStorage.setItem("token", token);
          if (rememberMe) localStorage.setItem("rememberMe", "1");
          else localStorage.removeItem("rememberMe");

          window.location.href = "/";
          return; // success, stop here
        } catch (inner) {
          lastErr = inner?.message || t("errors.login_failed", { defaultValue: "Login failed" });
          continue;
        }
      }

      // If we got here, all attempts failed
      throw new Error(lastErr || t("errors.login_failed", { defaultValue: "Login failed" }));
    } catch (err) {
      setError(err?.message || t("errors.unknown", { defaultValue: "Something went wrong." }));
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <a href="/" className="logo-link" aria-label={t("aria.go_home", { defaultValue: "Go to homepage" })}>
            <img
              src={`${process.env.PUBLIC_URL}/Assets/triwearslogo.png`}
              className="login-logo"
              alt={t("aria.logo_alt", { defaultValue: "Logo" })}
            />
          </a>
          <h1 className="login-title">{t("title", { defaultValue: "Welcome Back" })}</h1>
          <p className="login-subtitle">
            {t("subtitle", { defaultValue: "Log in to see our fullest extent!" })}
          </p>
        </div>

        {error && (
          <div className="status-message error" role="alert" aria-live="assertive">
            <span className="status-icon">⚠️</span>
            <span className="status-text">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form" noValidate>
          <div className="form-group">
            <label htmlFor="credential" className="form-label">
              {t("fields.email_or_username_label", { defaultValue: "Email or Username" })}
            </label>
            <input
              id="credential"
              type="text"
              className="form-input"
              placeholder={t("fields.email_or_username_placeholder", { defaultValue: "Enter email or username" })}
              required
              autoComplete="username email"
              value={emailOrUsername}
              onChange={(e) => setEmailOrUsername(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              {t("fields.password_label", { defaultValue: "Password" })}
            </label>
            <div className="password-input-container">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className="form-input"
                placeholder={t("fields.password_placeholder", { defaultValue: "Enter your password" })}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((s) => !s)}
                disabled={loading}
                aria-label={
                  showPassword
                    ? t("fields.hide_password", { defaultValue: "Hide password" })
                    : t("fields.show_password", { defaultValue: "Show password" })
                }
                title={
                  showPassword
                    ? t("fields.hide_password", { defaultValue: "Hide password" })
                    : t("fields.show_password", { defaultValue: "Show password" })
                }
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
                onChange={() => setRememberMe((v) => !v)}
                disabled={loading}
              />
              <label htmlFor="rememberMe">{t("options.remember_me", { defaultValue: "Remember Me" })}</label>
            </div>
            <a href="/forgot-password" className="forgot-password-link">
              {t("options.forgot_password", { defaultValue: "Forgot Password?" })}
            </a>
          </div>

          <button type="submit" className="submit-button" disabled={loading}>
            {loading && <div className="loading-spinner" aria-hidden="true"></div>}
            <span>{loading ? t("cta.logging_in", { defaultValue: "Logging in..." }) : t("cta.sign_in", { defaultValue: "Sign In" })}</span>
          </button>
        </form>

        <div className="divider"></div>

        <div className="login-footer">
          <p className="signup-prompt">
            {t("footer.no_account", { defaultValue: "Don't have an account?" })}{" "}
            <a href="/register" className="signup-link">
              {t("footer.sign_up", { defaultValue: "Sign up" })}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginComponent;
