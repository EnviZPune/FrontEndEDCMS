import { useState, useEffect } from "react";
import "../Styling/regist.css";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

// ===== CONFIG =====
const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
  process.env.REACT_APP_API_BASE_URL ||
  "https://api.triwears.com/api"; // adjust if different

function RegisterFormUser() {
  const { t } = useTranslation("register");
  const navigate = useNavigate();

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
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);          // headline
  const [errorList, setErrorList] = useState(null);  // bullet points
  const [success, setSuccess] = useState(null);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, text: "weak", checks: {} });
  const [passwordsMatch, setPasswordsMatch] = useState(true);

  // ---------- Username rules ----------
  const USERNAME_REGEX = /^[A-Za-z0-9._]{3,20}$/;
  const RESERVED_USERNAMES = new Set(["admin", "support", "help", "contact", "triwears", "root"]);
  const [usernameValid, setUsernameValid] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameMsg, setUsernameMsg] = useState("");
  const usernameState =
    checkingUsername ? "is-checking" :
    usernameAvailable === true ? "is-ok" :
    usernameAvailable === false ? "is-err" : "";
  const showHint = checkingUsername || !!usernameMsg;

  // ---------- Validators ----------
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PHONE_REGEX = /^\d{10}$/;

  const calculatePasswordStrength = (password) => {
    let score = 0;
    const checks = {
      length: password.length >= 8,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      numbers: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };
    score = Object.values(checks).filter(Boolean).length;
    if (score <= 2) return { score: score * 25, text: "weak", checks };
    if (score === 3) return { score: 50, text: "fair", checks };
    if (score === 4) return { score: 75, text: "good", checks };
    return { score: 100, text: "strong", checks };
  };

  function isDobValid(d) {
    if (!d) return false;
    const dob = new Date(d);
    if (Number.isNaN(dob.getTime())) return false;
    const today = new Date();
    if (dob > today) return false;
    const age = today.getFullYear() - dob.getFullYear() -
      ((today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) ? 1 : 0);
    return age >= 13 && dob.getFullYear() >= 1900;
  }

  const trimmed = (s) => (s || "").trim();

  // Derived validity flags (recompute each render)
  const requiredFields = [
    "firstName", "lastName", "dateOfBirth", "username",
    "phoneNumber", "email", "createPassword", "confirmPassword",
  ];
  const requiredComplete = requiredFields.every((k) => !!trimmed(formData[k]));
  const emailValid = EMAIL_REGEX.test(trimmed(formData.email));
  const phoneValid = PHONE_REGEX.test(trimmed(formData.phoneNumber));
  const dobValid = isDobValid(formData.dateOfBirth);
  const usernameSyntaxOk =
    USERNAME_REGEX.test(trimmed(formData.username)) &&
    !RESERVED_USERNAMES.has(trimmed(formData.username).toLowerCase());
  // Require availability check to have returned TRUE (not pending/unknown)
  const usernameReady = usernameSyntaxOk && usernameAvailable === true && !checkingUsername;
  const passStrengthOk = passwordStrength.score >= 50;
  const passValid = passStrengthOk && passwordsMatch;

  const formValid =
    requiredComplete &&
    emailValid &&
    phoneValid &&
    dobValid &&
    usernameReady &&
    passValid;

  // ---------- Effects ----------
  useEffect(() => {
    if (formData.createPassword) setPasswordStrength(calculatePasswordStrength(formData.createPassword));
    else setPasswordStrength({ score: 0, text: "weak", checks: {} });
  }, [formData.createPassword]);

  useEffect(() => {
    if (formData.confirmPassword) setPasswordsMatch(formData.createPassword === formData.confirmPassword);
    else setPasswordsMatch(true);
  }, [formData.createPassword, formData.confirmPassword]);

  // Debounced username availability
  useEffect(() => {
    const u = trimmed(formData.username);

    if (!u) {
      setUsernameValid(false);
      setUsernameAvailable(null);
      setUsernameMsg("");
      return;
    }
    if (!USERNAME_REGEX.test(u)) {
      setUsernameValid(false);
      setUsernameAvailable(null);
      setUsernameMsg(t("username.rules", { defaultValue: "3–20 chars. Letters, numbers, dot or underscore." }));
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
        const url = `${API_BASE.replace(/\/+$/, "")}/User/check-username?username=${encodeURIComponent(u)}`;
        const res = await fetch(url, { headers: { Accept: "application/json" }, credentials: "include" });
        if (res.ok) {
          let data = null;
          try { data = await res.json(); } catch { data = null; }
          if (!isCancelled) {
            const available = !!(data?.available ?? data?.isAvailable ?? data?.Available);
            setUsernameAvailable(available);
            setUsernameMsg(
              available
                ? t("username.available", { defaultValue: "Username is available" })
                : t("username.taken", { defaultValue: "Username is taken" })
            );
          }
        } else if (!isCancelled) {
          setUsernameAvailable(null);
          setUsernameMsg("");
        }
      } catch {
        if (!isCancelled) {
          setUsernameAvailable(null);
          setUsernameMsg("");
        }
      } finally {
        if (!isCancelled) setCheckingUsername(false);
      }
    }, 400);

    return () => { isCancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.username]);

  // ---------- UI handlers ----------
  const handleInputChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };
  const togglePasswordVisibility = (field) => {
    if (field === "password") setShowPassword((v) => !v);
    else setShowConfirmPassword((v) => !v);
  };

  // ---------- Server error parsing ----------
  function toArray(val) { if (!val) return []; return Array.isArray(val) ? val.map(String) : [String(val)]; }
  function normalizeServerErrors(status, dataOrText) {
    let details = [];
    let headline = null;
    let data = dataOrText;

    if (typeof dataOrText === "string") {
      const s = dataOrText.trim();
      if (s.startsWith("{") || s.startsWith("[")) { try { data = JSON.parse(s); } catch { data = s; } }
    }

    if (typeof data === "object" && data) {
      const fieldMaps = data.errors || data.errorDetails || data.validationErrors || data.Violations || data.violations;
      if (fieldMaps && !Array.isArray(fieldMaps)) {
        for (const [field, msgs] of Object.entries(fieldMaps)) {
          toArray(msgs).forEach((m) => details.push(`${field}: ${m}`));
        }
      }
      if (Array.isArray(fieldMaps)) {
        fieldMaps.forEach((vi) => {
          const f = vi.field || vi.name || vi.PropertyName || "field";
          const m = vi.message || vi.Message || vi.error || "is invalid";
          details.push(`${f}: ${m}`);
        });
      }
      details.push(...toArray(data.message));
      details.push(...toArray(data.error));
      details.push(...toArray(data.detail || data.Detail));
      details = Array.from(new Set(details.map((s) => s.trim()).filter(Boolean)));
    } else if (typeof data === "string" && data.trim()) {
      details.push(data.trim());
    }

    if (status === 404) headline = "Register endpoint not found. Check API_BASE and route casing.";
    else if (status === 409) headline = "Conflict: one or more fields already exist.";
    else if (status === 422 || status === 400) headline = "Validation error. Please review the highlighted issues.";
    else if (status === 413) headline = "Payload too large. Try a smaller image or shorter inputs.";
    else if (status === 429) headline = "Too many attempts. Please wait a moment and try again.";
    else if (status >= 500) headline = "Server error. Please try again shortly.";
    if (!headline) headline = "Registration failed.";
    if (details.length === 0) details = [`Status: ${status}`];
    return { headline, details };
  }

  // ---------- Submit (NO native submit, NO reload) ----------
  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (loading) return;

    setLoading(true);
    setError(null);
    setErrorList(null);
    setSuccess(null);

    // Rebuild detailed client-side errors
    const errs = [];

    // Required
    requiredFields.forEach((f) => {
      if (!trimmed(formData[f])) errs.push(`${f}: ${t("errors.required", { defaultValue: "This field is required." })}`);
    });

    if (!emailValid) errs.push(t("errors.email_invalid", { defaultValue: "Email format is invalid." }));
    if (!phoneValid) errs.push(t("errors.phone_invalid", { defaultValue: "Phone must be exactly 10 digits." }));
    if (!dobValid) errs.push(t("errors.dob_invalid", { defaultValue: "Enter a valid birth date (13+ years, not in the future)." }));

    if (!usernameSyntaxOk) {
      errs.push(
        t("username.rules", { defaultValue: "Username must be 3–20 chars: letters, numbers, dot or underscore." })
      );
    } else if (checkingUsername || usernameAvailable !== true) {
      errs.push(t("username.must_be_available", { defaultValue: "Please choose an available username." }));
    }

    if (!passStrengthOk) errs.push(t("errors.password_too_weak", { defaultValue: "Password is too weak." }));
    if (!passwordsMatch) errs.push(t("errors.passwords_mismatch", { defaultValue: "Passwords do not match." }));

    if (errs.length > 0 || !formValid) {
      setError(t("errors.fix_and_retry", { defaultValue: "Please fix the following and try again:" }));
      setErrorList(errs);
      setLoading(false);
      return; // DO NOT create account
    }

    const roleMap = { 0: 0, 1: 1, 2: 2 };
    const requestBody = {
      name: `${trimmed(formData.firstName)} ${trimmed(formData.lastName)}`,
      username: trimmed(formData.username),
      email: trimmed(formData.email),
      password: formData.createPassword,
      role: roleMap[formData.role],
      telephoneNumber: trimmed(formData.phoneNumber),
      profilePictureUrl: trimmed(formData.profilePictureUrl),
      dateOfBirth: formData.dateOfBirth,
    };

    try {
      const url = `${API_BASE.replace(/\/+$/, "")}/Register`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(requestBody),
        credentials: "include",
      });

      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = text || null; }

      if (!res.ok) {
        const normalized = normalizeServerErrors(res.status, data);
        setError(normalized.headline);
        setErrorList(normalized.details);
        setLoading(false);
        return;
      }

      // Fire-and-forget: email confirmation
      try {
        const confirmUrl = `${API_BASE.replace(/\/+$/, "")}/Auth/send-confirmation`;
        await fetch(confirmUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: formData.email, clientUrl: window.location.origin }),
          credentials: "include",
        });
      } catch {}

      setSuccess(
        t("success.registered", {
          defaultValue: "Successfully Registered. Check your email to verify your account!",
        })
      );

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
      });

      // SPA navigate
      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      const offline =
        err?.message?.toLowerCase?.().includes("failed to fetch") ||
        err?.message?.toLowerCase?.().includes("network");
      setError(
        offline
          ? t("errors.network", { defaultValue: "Network error. Please check your internet connection." })
          : (err?.message || t("errors.unknown", { defaultValue: "An unexpected error occurred." }))
      );
    } finally {
      setLoading(false);
    }
  };

  // Prevent native submit via Enter; route to our handler
  const onKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      handleSubmit(e);
    }
  };

  const strengthTextKey = `strength.${passwordStrength.text}`;

  return (
    <div
      className="register-page"
      onKeyDownCapture={(e) => {
        if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); }
      }}
    >
      <div className="register-container">
        <div className="register-header">
          <a href="/" className="logo-link" aria-label={t("aria.go_home", { defaultValue: "Go to homepage" })}>
            <img
              src={`${process.env.PUBLIC_URL}/Assets/triwearslogo.png`}
              alt={t("aria.logo_alt", { defaultValue: "Logo" })}
              className="register-logo"
            />
          </a>
          <h1 className="register-title">{t("title", { defaultValue: "Create Your Account" })}</h1>
          <p className="register-subtitle">
            {t("subtitle", { defaultValue: "Join our community and start your journey" })}
          </p>
        </div>

        {(error || (errorList && errorList.length)) && (
          <div className="status-message error" role="alert" aria-live="assertive">
            <span className="status-icon">⚠️</span>
            <div className="status-text">
              {error}
              {errorList && errorList.length > 0 && (
                <ul className="error-list">
                  {errorList.map((msg, i) => (<li key={i}>{msg}</li>))}
                </ul>
              )}
            </div>
          </div>
        )}

        {success && (
          <div className="status-message success" role="status" aria-live="polite">
            <span className="status-icon">✅</span>
            <span className="status-text">{success}</span>
          </div>
        )}

        {/* Keep <form> for semantics; button is type="button" to block native submit */}
        <form
          onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onSubmitCapture={(e) => { e.preventDefault(); e.stopPropagation(); }}
          className="register-form"
          noValidate
          action="#"
        >
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="firstName">{t("fields.first_name", { defaultValue: "First Name" })}</label>
              <input
                id="firstName"
                type="text"
                name="firstName"
                className={`form-input ${!trimmed(formData.firstName) ? "input-error" : ""}`}
                placeholder={t("placeholders.first_name", { defaultValue: "Enter your first name" })}
                required
                value={formData.firstName}
                onChange={handleInputChange}
                disabled={loading}
                autoComplete="given-name"
                onKeyDown={onKeyDown}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="lastName">{t("fields.last_name", { defaultValue: "Last Name" })}</label>
              <input
                id="lastName"
                type="text"
                name="lastName"
                className={`form-input ${!trimmed(formData.lastName) ? "input-error" : ""}`}
                placeholder={t("placeholders.last_name", { defaultValue: "Enter your last name" })}
                required
                value={formData.lastName}
                onChange={handleInputChange}
                disabled={loading}
                autoComplete="family-name"
                onKeyDown={onKeyDown}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="dateOfBirth">{t("fields.dob", { defaultValue: "Date of Birth" })}</label>
              <input
                id="dateOfBirth"
                type="date"
                name="dateOfBirth"
                className={`form-input ${!dobValid ? "input-error" : ""}`}
                required
                value={formData.dateOfBirth}
                onChange={handleInputChange}
                disabled={loading}
                autoComplete="bday"
                onKeyDown={onKeyDown}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="username">{t("fields.username", { defaultValue: "Username" })}</label>
              <div className={`input-with-status ${usernameState}`}>
                <input
                  id="username"
                  type="text"
                  name="username"
                  className={`form-input ${(!usernameSyntaxOk || usernameAvailable === false) ? "input-error" : ""}`}
                  placeholder={t("placeholders.username", { defaultValue: "Choose a username" })}
                  required
                  value={formData.username}
                  onChange={handleInputChange}
                  disabled={loading}
                  autoComplete="username"
                  inputMode="email"
                  pattern="[A-Za-z0-9._]{3,20}"
                  aria-describedby={showHint ? "usernameHelp" : undefined}
                  onKeyDown={onKeyDown}
                />
                {showHint && (
                  <div id="usernameHelp" className={`input-hint ${usernameState}`} aria-live="polite">
                    <span className={`hint-icon ${checkingUsername ? "spinner" : usernameAvailable === true ? "icon-ok" : "icon-err"}`} aria-hidden="true" />
                    <span className="hint-text">
                      {checkingUsername
                        ? t("username.checking", { defaultValue: "Checking availability..." })
                        : usernameMsg}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="phoneNumber">{t("fields.phone", { defaultValue: "Phone Number" })}</label>
              <input
                id="phoneNumber"
                type="tel"
                name="phoneNumber"
                className={`form-input ${!phoneValid ? "input-error" : ""}`}
                placeholder={t("placeholders.phone", { defaultValue: "0691234567" })}
                required
                value={formData.phoneNumber}
                onChange={handleInputChange}
                disabled={loading}
                autoComplete="tel"
                inputMode="tel"
                pattern="^\d{10}$"
                title={t("fields.phone_help", { defaultValue: "Enter 10 digits (e.g., 0691234567)" })}
                onKeyDown={onKeyDown}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="email">{t("fields.email", { defaultValue: "Email Address" })}</label>
              <input
                id="email"
                type="email"
                name="email"
                className={`form-input ${!emailValid ? "input-error" : ""}`}
                placeholder={t("placeholders.email", { defaultValue: "your@email.com" })}
                required
                value={formData.email}
                onChange={handleInputChange}
                disabled={loading}
                autoComplete="email"
                onKeyDown={onKeyDown}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="createPassword">{t("fields.create_password", { defaultValue: "Create Password" })}</label>
            <div className="password-input-container">
              <input
                id="createPassword"
                type={showPassword ? "text" : "password"}
                name="createPassword"
                className={`form-input ${!passStrengthOk ? "input-error" : ""}`}
                placeholder={t("placeholders.create_password", { defaultValue: "Create a strong password" })}
                required
                value={formData.createPassword}
                onChange={handleInputChange}
                disabled={loading}
                autoComplete="new-password"
                onKeyDown={onKeyDown}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => togglePasswordVisibility("password")}
                disabled={loading}
                aria-label={showPassword ? t("aria.hide_password", { defaultValue: "Hide password" }) : t("aria.show_password", { defaultValue: "Show password" })}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>

            {formData.createPassword && (
              <div className="password-strength" aria-live="polite">
                <div className="strength-bar">
                  <div className={`strength-fill ${passwordStrength.text}`} style={{ width: `${passwordStrength.score}%` }} />
                </div>
                <span className={`strength-text ${passwordStrength.text}`}>
                  {t(strengthTextKey, { defaultValue: passwordStrength.text })}
                </span>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="confirmPassword">{t("fields.confirm_password", { defaultValue: "Confirm Password" })}</label>
            <div className="password-input-container">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                className={`form-input ${(!passwordsMatch || !trimmed(formData.confirmPassword)) ? "input-error" : ""}`}
                placeholder={t("placeholders.confirm_password", { defaultValue: "Confirm your password" })}
                required
                value={formData.confirmPassword}
                onChange={handleInputChange}
                disabled={loading}
                autoComplete="new-password"
                onKeyDown={onKeyDown}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => togglePasswordVisibility("confirm")}
                disabled={loading}
                aria-label={showConfirmPassword ? t("aria.hide_password", { defaultValue: "Hide password" }) : t("aria.show_password", { defaultValue: "Show password" })}
              >
                {showConfirmPassword ? "🙈" : "👁️"}
              </button>
            </div>

            {formData.confirmPassword && !passwordsMatch && (
              <div className="password-mismatch">
                <span className="mismatch-icon">⚠️</span>
                {t("errors.passwords_mismatch", { defaultValue: "Passwords do not match" })}
              </div>
            )}
            {formData.confirmPassword && passwordsMatch && formData.createPassword && (
              <div className="password-match">
                <span className="match-icon">✓</span>
                {t("info.passwords_match", { defaultValue: "Passwords match" })}
              </div>
            )}
          </div>

          {/* IMPORTANT: disable unless fully valid */}
          <button
            type="button"
            className="submit-button"
            disabled={loading || !formValid}
            onClick={handleSubmit}
          >
            {loading ? (
              <>
                <div className="loading-spinner" aria-hidden="true"></div>
                {t("cta.creating_account", { defaultValue: "Creating Account..." })}
              </>
            ) : (
              <>
                <span>{t("cta.create_account", { defaultValue: "Create Account" })}</span>
                <span className="button-icon">→</span>
              </>
            )}
          </button>
        </form>

        <div className="register-footer">
          <p className="login-link">
            {t("footer.have_account", { defaultValue: "Already have an account?" })}{" "}
            <a href="/login" className="link">
              {t("footer.sign_in_here", { defaultValue: "Sign in here" })}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default RegisterFormUser;
