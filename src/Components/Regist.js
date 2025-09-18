import { useState, useEffect } from "react";
import "../Styling/regist.css";
import { useTranslation } from "react-i18next";

const API_BASE = "https://api.triwears.com/api";

function RegisterFormUser() {
  const { t } = useTranslation("register");

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
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, text: "weak", checks: {} });
  const [passwordsMatch, setPasswordsMatch] = useState(true);
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

  useEffect(() => {
    const u = (formData.username || "").trim();

    if (!u) {
      setUsernameValid(false);
      setUsernameAvailable(null);
      setUsernameMsg("");
      return;
    }

    if (!USERNAME_REGEX.test(u)) {
      setUsernameValid(false);
      setUsernameAvailable(null);
      setUsernameMsg(
        t("username.rules", {
          defaultValue: "3–20 chars. Letters, numbers, dot or underscore.",
        })
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

    // Debounced availability check
    let isCancelled = false;
    const timer = setTimeout(async () => {
      setCheckingUsername(true);
      try {
        const res = await fetch(`${API_BASE}/User/check-username?username=${encodeURIComponent(u)}`);
        if (res.ok) {
          const data = await res.json(); // expect { available: boolean } or similar
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
            setUsernameAvailable(null);
            setUsernameMsg("");
          }
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

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.username]);

  // ── Password strength ────────────────────────────────────────────────
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

  useEffect(() => {
    if (formData.createPassword) {
      setPasswordStrength(calculatePasswordStrength(formData.createPassword));
    } else {
      setPasswordStrength({ score: 0, text: "weak", checks: {} });
    }
  }, [formData.createPassword]);

  useEffect(() => {
    if (formData.confirmPassword) {
      setPasswordsMatch(formData.createPassword === formData.confirmPassword);
    } else {
      setPasswordsMatch(true);
    }
  }, [formData.createPassword, formData.confirmPassword]);

  // ── Derived UI state for the username hint (must be outside handleSubmit) ──
  const hintState =
    checkingUsername
      ? "is-checking"
      : usernameMsg
        ? usernameAvailable === false
          ? "is-err"
          : usernameAvailable === true
            ? "is-ok"
            : "is-neutral"
        : "is-neutral";

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleInputChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const togglePasswordVisibility = (field) => {
    if (field === "password") setShowPassword((v) => !v);
    else setShowConfirmPassword((v) => !v);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const requiredFields = [
      "firstName",
      "lastName",
      "dateOfBirth",
      "username",
      "phoneNumber",
      "email",
      "createPassword",
      "confirmPassword",
    ];

    for (const field of requiredFields) {
      if (!formData[field]) {
        setError(
          t("errors.missing_field", {
            field,
            defaultValue: "Please fill in all fields. Missing: {{field}}",
          })
        );
        setLoading(false);
        return;
      }
    }

    // Username checks
    if (!USERNAME_REGEX.test(formData.username || "")) {
      setError(
        t("username.rules", {
          defaultValue: "3–20 chars. Letters, numbers, dot or underscore.",
        })
      );
      setLoading(false);
      return;
    }
    if (RESERVED_USERNAMES.has((formData.username || "").toLowerCase())) {
      setError(t("username.reserved", { defaultValue: "This username is reserved." }));
      setLoading(false);
      return;
    }
    if (usernameAvailable === false) {
      setError(t("username.taken", { defaultValue: "Username is taken" }));
      setLoading(false);
      return;
    }

    if (formData.createPassword !== formData.confirmPassword) {
      setError(t("errors.passwords_mismatch", { defaultValue: "Passwords do not match." }));
      setLoading(false);
      return;
    }

    if (passwordStrength.score < 50) {
      setError(
        t("errors.password_too_weak", {
          defaultValue: "Password is too weak. Please choose a stronger password.",
        })
      );
      setLoading(false);
      return;
    }

    const roleMap = { 0: 0, 1: 1, 2: 2 };

    const requestBody = {
      name: `${formData.firstName} ${formData.lastName}`,
      username: formData.username,
      email: formData.email,
      password: formData.createPassword,
      role: roleMap[formData.role],
      telephoneNumber: formData.phoneNumber,
      profilePictureUrl: formData.profilePictureUrl,
      dateOfBirth: formData.dateOfBirth,
    };

    try {
      const response = await fetch(`${API_BASE}/Register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = {};
        }
        throw new Error(
          errorData.message ||
            t("errors.register_failed", { defaultValue: "An error occurred while registering." })
        );
      }

      // Ask backend to send email confirmation
      try {
        const confirmRes = await fetch(`${API_BASE}/Auth/send-confirmation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: formData.email, clientUrl: window.location.origin }),
        });
        if (!confirmRes.ok) {
          const errorText = await confirmRes.text();
          console.warn("Email confirmation request failed:", errorText);
        }
      } catch (e) {
        console.warn("Email confirmation call error:", e);
      }

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

      setTimeout(() => {
        window.location.href = "/login";
      }, 2000);
    } catch (err) {
      setError(
        err.message ||
          t("errors.register_failed", { defaultValue: "An error occurred while registering." })
      );
      setLoading(false);
    }
  };

  const strengthTextKey = `strength.${passwordStrength.text}`;

  return (
    <div className="register-page">
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

        <form onSubmit={handleSubmit} className="register-form" noValidate>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="firstName">
                {t("fields.first_name", { defaultValue: "First Name" })}
              </label>
              <input
                id="firstName"
                type="text"
                name="firstName"
                className="form-input"
                placeholder={t("placeholders.first_name", { defaultValue: "Enter your first name" })}
                required
                value={formData.firstName}
                onChange={handleInputChange}
                disabled={loading}
                autoComplete="given-name"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="lastName">
                {t("fields.last_name", { defaultValue: "Last Name" })}
              </label>
              <input
                id="lastName"
                type="text"
                name="lastName"
                className="form-input"
                placeholder={t("placeholders.last_name", { defaultValue: "Enter your last name" })}
                required
                value={formData.lastName}
                onChange={handleInputChange}
                disabled={loading}
                autoComplete="family-name"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="dateOfBirth">
                {t("fields.dob", { defaultValue: "Date of Birth" })}
              </label>
              <input
                id="dateOfBirth"
                type="date"
                name="dateOfBirth"
                className="form-input"
                required
                value={formData.dateOfBirth}
                onChange={handleInputChange}
                disabled={loading}
                autoComplete="bday"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="username">
                {t("fields.username", { defaultValue: "Username" })}
              </label>

              <div className={`input-with-status ${usernameState}`}>
                <input
                  id="username"
                  type="text"
                  name="username"
                  className={`form-input ${
                    formData.username && (usernameAvailable === false || !usernameValid) ? "input-error" : ""
                  }`}
                  placeholder={t("placeholders.username", { defaultValue: "Choose a username" })}
                  required
                  value={formData.username}
                  onChange={handleInputChange}
                  disabled={loading}
                  autoComplete="username"
                  inputMode="email"
                  pattern="[A-Za-z0-9._]{3,20}"
                  aria-describedby={showHint ? "usernameHelp" : undefined}
                />

                {showHint && (
                  <div
                    id="usernameHelp"
                    className={`input-hint ${usernameState}`}
                    aria-live="polite"
                  >
                    <span
                      className={`hint-icon ${
                        checkingUsername
                          ? "spinner"
                          : usernameAvailable === true
                            ? "icon-ok"
                            : "icon-err"
                      }`}
                      aria-hidden="true"
                    />
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
              <label className="form-label" htmlFor="phoneNumber">
                {t("fields.phone", { defaultValue: "Phone Number" })}
              </label>
              <input
                id="phoneNumber"
                type="tel"
                name="phoneNumber"
                className="form-input"
                placeholder={t("placeholders.phone", { defaultValue: "0691234567" })}
                required
                value={formData.phoneNumber}        // ← bind value
                onChange={handleInputChange}        // ← update state
                disabled={loading}
                autoComplete="tel"
                inputMode="tel"
                pattern="^\\d{10}$"                 // ← escape backslash in JSX
                title={t("fields.phone_help", { defaultValue: "Enter 10 digits (e.g., 0691234567)" })}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="email">
                {t("fields.email", { defaultValue: "Email Address" })}
              </label>
              <input
                id="email"
                type="email"
                name="email"
                className="form-input"
                placeholder={t("placeholders.email", { defaultValue: "your@email.com" })}
                required
                value={formData.email}
                onChange={handleInputChange}
                disabled={loading}
                autoComplete="email"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="createPassword">
              {t("fields.create_password", { defaultValue: "Create Password" })}
            </label>
            <div className="password-input-container">
              <input
                id="createPassword"
                type={showPassword ? "text" : "password"}
                name="createPassword"
                className="form-input"
                placeholder={t("placeholders.create_password", { defaultValue: "Create a strong password" })}
                required
                value={formData.createPassword}
                onChange={handleInputChange}
                disabled={loading}
                autoComplete="new-password"
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

            {formData.createPassword && passwordStrength.checks && (
              <div className="password-requirements">
                <div className={`requirement ${passwordStrength.checks.length ? "met" : ""}`}>
                  <span className="requirement-icon">{passwordStrength.checks.length ? "✓" : "○"}</span>
                  {t("requirements.at_least", { defaultValue: "At least 8 characters" })}
                </div>
                <div className={`requirement ${passwordStrength.checks.lowercase ? "met" : ""}`}>
                  <span className="requirement-icon">{passwordStrength.checks.lowercase ? "✓" : "○"}</span>
                  {t("requirements.lowercase", { defaultValue: "One lowercase letter" })}
                </div>
                <div className={`requirement ${passwordStrength.checks.uppercase ? "met" : ""}`}>
                  <span className="requirement-icon">{passwordStrength.checks.uppercase ? "✓" : "○"}</span>
                  {t("requirements.uppercase", { defaultValue: "One uppercase letter" })}
                </div>
                <div className={`requirement ${passwordStrength.checks.numbers ? "met" : ""}`}>
                  <span className="requirement-icon">{passwordStrength.checks.numbers ? "✓" : "○"}</span>
                  {t("requirements.number", { defaultValue: "One number" })}
                </div>
                <div className={`requirement ${passwordStrength.checks.special ? "met" : ""}`}>
                  <span className="requirement-icon">{passwordStrength.checks.special ? "✓" : "○"}</span>
                  {t("requirements.special", { defaultValue: "One special character" })}
                </div>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="confirmPassword">
              {t("fields.confirm_password", { defaultValue: "Confirm Password" })}
            </label>
            <div className="password-input-container">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                className="form-input"
                placeholder={t("placeholders.confirm_password", { defaultValue: "Confirm your password" })}
                required
                value={formData.confirmPassword}
                onChange={handleInputChange}
                disabled={loading}
                autoComplete="new-password"
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

          <button
            type="submit"
            className="submit-button"
            disabled={loading || !passwordsMatch || passwordStrength.score < 50 || !usernameValid || usernameAvailable === false}
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
