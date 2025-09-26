import React, { useState } from "react";
import "../Styling/log_user.css";
import { jwtDecode } from "jwt-decode";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

// ===== CONFIG: set your API base here (env first, then hardcoded fallback) =====
const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
  process.env.REACT_APP_API_BASE_URL ||
  "https://api.triwears.com/"; // <-- adjust if different

// --- helpers ---------------------------------------------------------
const JWT_REGEX = /^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/;
const looksLikeJwt = (val) => typeof val === "string" && JWT_REGEX.test(val.trim());

const extractTokenFromPayload = (payload) => {
  if (!payload) return null;
  if (looksLikeJwt(payload)) return payload.trim();

  const pick = (obj, keys) => {
    for (const k of keys) {
      const v = obj?.[k];
      if (looksLikeJwt(v)) return String(v).trim();
    }
    return null;
  };

  const candidates = ["token", "accessToken", "jwt", "bearer"];
  const top = pick(payload, candidates);
  if (top) return top;

  const nestedRoots = ["data", "result", "payload"];
  for (const root of nestedRoots) {
    const via = pick(payload?.[root] ?? {}, candidates);
    if (via) return via;
  }
  return null;
};

function normalizeApiError(status, payloadLike) {
  let message = "Login failed";
  try {
    if (typeof payloadLike === "string" && payloadLike.trim()) message = payloadLike;
    else if (payloadLike && typeof payloadLike === "object") {
      message = payloadLike.message || payloadLike.error || JSON.stringify(payloadLike);
    }
  } catch {}
  return { status, message: String(message) };
}

function classifyAuthError(norm, cred, t) {
  const { status, message } = norm || {};
  const msg = String(message || "").toLowerCase();

  const mentionsUserMissing =
    /user\s*(not\s*found|unknown|does\s*not\s*exist)|username\s*(not\s*found|does\s*not\s*exist)|email\s*(not\s*found|does\s*not\s*exist)|account\s*(not\s*found|does\s*not\s*exist)/i;

  const mentionsPassword =
    /(password|passcode)\s*(invalid|incorrect|wrong|mismatch)/i;

  // 1) Clear "unknown user" cases first (404 or explicit text)
  if (status === 404 || mentionsUserMissing.test(msg)) {
    return t("errors.unknown_user", {
      defaultValue: `No account found for “${cred}”.`,
      cred,
    });
  }

  // 2) Only say "Incorrect password" if the server explicitly hints at password
  if (mentionsPassword.test(msg)) {
    return t("errors.bad_password", { defaultValue: "Incorrect password." });
  }

  // 3) For generic 401/403 (common anti-enumeration), avoid guessing password:
  if (status === 401 || status === 403) {
    return t("errors.invalid_credentials", {
      defaultValue: "Invalid email/username or password.",
    });
  }

  // 4) Fallback
  return message || t("errors.login_failed", { defaultValue: "Login failed." });
}


/** Build absolute URL with API_BASE, or fallback to relative when API_BASE is empty. */
function buildUrl(path) {
  const base = (API_BASE || "").replace(/\/+$/, "");
  const p = String(path || "").replace(/^\/+/, "");
  return base ? `${base}/${p}` : `/${p}`;
}

/** Raw POST that BYPASSES any interceptors. */
async function rawPostJSON(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-No-Redirect": "1",
    },
    body: JSON.stringify(body),
    mode: "cors",
    redirect: "follow",
    credentials: "include",
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text || null;
  }
  return { ok: res.ok, status: res.status, data, text, url };
}
// --------------------------------------------------------------------

function LoginComponent() {
  const { t } = useTranslation("login");
  const navigate = useNavigate();

  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (evt) => {
    evt?.preventDefault?.();
    evt?.stopPropagation?.();
    evt?.nativeEvent?.stopImmediatePropagation?.();

    if (loading) return;
    setLoading(true);
    setError(null);

    const cred = emailOrUsername.trim();
    if (!cred || !password) {
      setError(
        t("errors.missing_fields", {
          defaultValue: "Please enter your email/username and password.",
        }),
      );
      setLoading(false);
      return;
    }

    try {
      const isEmail = cred.includes("@");

      // Your backend map (from your project notes) says: Login.js → POST api/Login
      // We’ll try exact casing first, then a couple fallbacks, all with API_BASE.
      const endpoints = [
        buildUrl("Login"),
        buildUrl("login"),
        buildUrl("api/Login"),
        buildUrl("api/login"),
      ];

      let last = null;

      for (const url of endpoints) {
        const body = isEmail ? { email: cred, password } : { username: cred, password };
        const { ok, status, data, text, url: usedUrl } = await rawPostJSON(url, body);

        // Dev aid: quick console so you can verify the URL being called.
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.log("[login] POST", usedUrl, "status:", status, "payload:", data ?? text);
        }

        if (!ok) {
          last = normalizeApiError(status, data ?? text);
          continue;
        }

        const token =
          extractTokenFromPayload(data) ||
          (looksLikeJwt(typeof data === "string" ? data : text) ? String(data || text).trim() : null);

        if (!token) {
          last = normalizeApiError(status, data ?? text ?? "No token returned from server.");
          continue;
        }

        try {
          // eslint-disable-next-line no-console
          console.log("Decoded JWT payload:", jwtDecode(token));
        } catch {}

        localStorage.setItem("token", token);
        if (rememberMe) localStorage.setItem("rememberMe", "1");
        else localStorage.removeItem("rememberMe");

        // SPA navigate on success (NO RELOAD)
        navigate("/");
        return;
      }

      // All attempts failed -> show specific error
      const msg = classifyAuthError(last ?? { status: 400, message: "" }, cred, t);
      setError(msg);
    } catch (e) {
      setError(e?.message || t("errors.unknown", { defaultValue: "Something went wrong." }));
    } finally {
      setLoading(false);
    }
  };

  // Handle Enter key without native submit
  const onKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      handleSubmit(e);
    }
  };

  return (
    <div
      className="login-page"
      onKeyDownCapture={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      <div className="login-container">
        <div className="login-header">
          <a
            href="/"
            className="logo-link"
            aria-label={t("aria.go_home", { defaultValue: "Go to homepage" })}
          >
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

        {/* No real <form>; no native submit possible */}
        <div role="form" aria-label={t("aria.login_form", { defaultValue: "Login form" })} className="login-form">
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
              onKeyDown={onKeyDown}
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
                onKeyDown={onKeyDown}
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
              <label htmlFor="rememberMe">
                {t("options.remember_me", { defaultValue: "Remember Me" })}
              </label>
            </div>
            <a href="/forgot-password" className="forgot-password-link">
              {t("options.forgot_password", { defaultValue: "Forgot Password?" })}
            </a>
          </div>

          <button type="button" className="submit-button" disabled={loading} onClick={handleSubmit}>
            {loading && <div className="loading-spinner" aria-hidden="true"></div>}
            <span>
              {loading ? t("cta.logging_in", { defaultValue: "Logging in..." }) : t("cta.sign_in", { defaultValue: "Sign In" })}
            </span>
          </button>
        </div>

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
