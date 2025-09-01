// src/Pages/BecomeOwner.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Navbar from "../Components/Navbar";
import "../Styling/BecomeOwner.css";

function getToken() {
  const raw = localStorage.getItem("token");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "string" ? parsed : parsed.token;
  } catch {
    return raw;
  }
}

function decodeJwt(token) {
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch {
    return null;
  }
}

function extractRoles(claims) {
  if (!claims) return [];
  const candidates = [
    claims.roles,
    claims.role,
    claims["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"],
    claims["roles"],
  ];
  const found = candidates.find((v) => v !== undefined) ?? [];
  return Array.isArray(found) ? found : [found];
}

export default function BecomeOwner() {
  const { t } = useTranslation("becomeOwner");
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const frontendBase =
    process.env.REACT_APP_CLIENT_BASE_URL || window.location.origin;
  const apiBase =
    process.env.REACT_APP_API_BASE_URL || "http://77.242.26.150:8000";

  useEffect(() => {
    const jwt = getToken();
    if (!jwt) return;
    const claims = decodeJwt(jwt);
    const roles = extractRoles(claims).map(String);
    const isAdmin = roles.some((r) => r.toLowerCase() === "admin");
    if (isAdmin) {
      navigate("/unauthorized", { replace: true });
    }
  }, [navigate]);

  async function handleSubscribe() {
    const jwt = getToken();
    if (!jwt) {
      alert(t("alerts.login_required", { defaultValue: "Please log in to continue." }));
      return;
    }

    setLoading(true);
    const successUrl = `${frontendBase}/create-shop`;
    const cancelUrl = `${frontendBase}/payment-cancel`;
    const endpoint =
      `${apiBase}/api/payment/create-session?` +
      `successUrl=${encodeURIComponent(successUrl)}` +
      `&cancelUrl=${encodeURIComponent(cancelUrl)}`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        console.error("Failed to create checkout session:", await res.text());
        setLoading(false);
        return;
      }

      const { url: checkoutUrl } = await res.json();
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error("Error:", error);
      setLoading(false);
    }
  }

  return (
    <div className="bo-page">
      <Navbar />
      <main className="bo-main" role="main">
        <section className="bo-container">
          <div className="bo-card">
            {/* Left: value proposition */}
            <div className="bo-copy">
              <h1 className="bo-title">
                {t("hero.title", { defaultValue: "Open your shop with confidence" })}
              </h1>
              <p className="bo-subtitle">
                {t("hero.subtitle", {
                  defaultValue:
                    "Create a verified presence, manage inventory and team members, and reach customers who are ready to buy in-store today.",
                })}
              </p>

              <ul className="bo-bullets" aria-label={t("aria.features", { defaultValue: "Included features" })}>
                <li>{t("features.profile", { defaultValue: "Dedicated shop profile with custom URL" })}</li>
                <li>{t("features.inventory", { defaultValue: "Inventory & category management" })}</li>
                <li>{t("features.roles", { defaultValue: "Employee roles & access controls" })}</li>
                <li>{t("features.analytics", { defaultValue: "Analytics and shop activity overview" })}</li>
                <li>{t("features.support", { defaultValue: "Priority support" })}</li>
              </ul>

              <div className="bo-note">
                {t("hero.note", {
                  defaultValue:
                    "Secure checkout is handled externally. You’ll be redirected to complete payment and then brought back to finish setting up your shop.",
                })}
              </div>
            </div>

            {/* Right: plan & CTA */}
            <aside className="bo-plan" aria-labelledby="plan-heading">
              <div className="bo-plan-head">
                <h2 id="plan-heading" className="bo-plan-title">
                  {t("plan.title", { defaultValue: "Owner Subscription" })}
                </h2>
                <p className="bo-price">
                  <span className="bo-price-amount">$20</span>
                  <span className="bo-price-term">
                    {t("plan.per_month", { defaultValue: "/month" })}
                  </span>
                </p>
              </div>

              <div className="bo-divider" role="separator" aria-hidden="true" />

              <ul className="bo-includes">
                <li>{t("plan.includes.core", { defaultValue: "All core owner features" })}</li>
                <li>{t("plan.includes.no_fees", { defaultValue: "No hidden fees" })}</li>
              </ul>

              <button
                type="button"
                className="bo-cta"
                onClick={handleSubscribe}
                disabled={loading}
                aria-busy={loading ? "true" : "false"}
              >
                {loading
                  ? t("cta.preparing", { defaultValue: "Preparing checkout…" })
                  : t("cta.start", { defaultValue: "Start subscription" })}
              </button>

              <p className="bo-terms">
                {t("legal.continue_agree", {
                  defaultValue: "By continuing you agree to our Terms and Privacy Policy.",
                })}
              </p>

              <div className="bo-processor" aria-label={t("aria.processor", { defaultValue: "Payment processor" })}>
                <a
                  href="https://stripe.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bo-stripe-badge"
                  aria-label={t("stripe.badge_aria", { defaultValue: "Payments powered by Stripe" })}
                >
                  <svg
                    className="bo-lock"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      d="M7 10V8a5 5 0 0 1 10 0v2h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1zm2 0h6V8a3 3 0 0 0-6 0v2z"
                      fill="currentColor"
                    />
                  </svg>
                  <span className="bo-stripe-text">
                    {t("stripe.badge_text", { defaultValue: "Payments powered by Stripe" })}
                  </span>
                </a>
              </div>
            </aside>
          </div>

          {/* Trust bar */}
          <div className="bo-trust">
            <span className="bo-dot" aria-hidden="true" />
            <span>{t("trust.encrypted", { defaultValue: "Encrypted payments via Stripe" })}</span>
            <span className="bo-sep" aria-hidden="true">•</span>
            <span>{t("trust.receipts", { defaultValue: "Email receipt & invoices" })}</span>
            <span className="bo-sep" aria-hidden="true">•</span>
            <span>{t("trust.roles", { defaultValue: "Role-based access for staff" })}</span>
          </div>
        </section>
      </main>
    </div>
  );
}
