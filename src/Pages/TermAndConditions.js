import React from "react";
import { Link } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import Navbar from "../Components/Navbar";
import Footer from "../Components/Footer";
import "../Styling/termsandconditions.css";

const TermsAndConditions = () => {
  const { t } = useTranslation("terms");

  return (
    <>
      <Navbar />
      <div className="policy-container">
        <h1>{t("title")}</h1>

        <p>
          <Trans i18nKey="intro">
            Welcome to <strong>E &amp; D</strong> ("we", "us", "our"). By
            accessing or using our website at <em>edshopping.al</em> and related
            services, you agree to be bound by these Terms &amp; Conditions.
          </Trans>
        </p>

        <h2>{t("acceptance.title")}</h2>
        <p>{t("acceptance.body")}</p>

        <h2>{t("service_overview.title")}</h2>
        <p>{t("service_overview.body")}</p>

        <h2>{t("user_accounts.title")}</h2>
        <ul>
          <li>{t("user_accounts.items.age")}</li>
          <li>{t("user_accounts.items.security")}</li>
          <li>{t("user_accounts.items.notify")}</li>
        </ul>

        <h2>{t("payments.title")}</h2>
        <p>
          <Trans
            i18nKey="payments.body"
            components={{
              OwnerLink: <Link to="/become-owner" />,
              SettingsLink: <Link to="/settings" />,
              em: <em />
            }}
          >
            Shop owners subscribe via our sandbox payment system at 
             <Link to="/become-owner"> Become Owner</Link> for a recurring fee of $20/month.
            Payments are handled through Stripe. Subscriptions renew automatically
            until canceled. You may cancel anytime via the <Link to="/settings">Settings </Link>
            dashboard under <em>Delete Business</em>. No refunds for partial periods.
          </Trans>
        </p>

        <h2>{t("owner_dashboard.title")}</h2>
        <p>{t("owner_dashboard.intro")}</p>
        <ul>
          <li>
            <strong>{t("owner_dashboard.items.business_info.label")}</strong>{" "}
            {t("owner_dashboard.items.business_info.desc")}
          </li>
          <li>
            <strong>{t("owner_dashboard.items.products.label")}</strong>{" "}
            {t("owner_dashboard.items.products.desc")}
          </li>
          <li>
            <strong>{t("owner_dashboard.items.categories.label")}</strong>{" "}
            {t("owner_dashboard.items.categories.desc")}
          </li>
          <li>
            <strong>{t("owner_dashboard.items.photos.label")}</strong>{" "}
            {t("owner_dashboard.items.photos.desc")}
          </li>
          <li>
            <strong>{t("owner_dashboard.items.employees.label")}</strong>{" "}
            {t("owner_dashboard.items.employees.desc")}
          </li>
          <li>
            <strong>{t("owner_dashboard.items.pending.label")}</strong>{" "}
            {t("owner_dashboard.items.pending.desc")}
          </li>
          <li>
            <strong>{t("owner_dashboard.items.reservations.label")}</strong>{" "}
            {t("owner_dashboard.items.reservations.desc")}
          </li>
          <li>
            <strong>{t("owner_dashboard.items.notifications.label")}</strong>{" "}
            {t("owner_dashboard.items.notifications.desc")}
          </li>
          <li>
            <strong>{t("owner_dashboard.items.myshops.label")}</strong>{" "}
            {t("owner_dashboard.items.myshops.desc")}
          </li>
          <li>
            <strong>{t("owner_dashboard.items.delete.label")}</strong>{" "}
            {t("owner_dashboard.items.delete.desc")}
          </li>
        </ul>

        <h2>{t("responsibilities.title")}</h2>
        <ul>
          <li>{t("responsibilities.items.lawful")}</li>
          <li>{t("responsibilities.items.accuracy")}</li>
          <li>{t("responsibilities.items.impersonation")}</li>
        </ul>

        <h2>{t("ip.title")}</h2>
        <p>{t("ip.body")}</p>

        <h2>{t("disclaimers.title")}</h2>
        <p>{t("disclaimers.body")}</p>

        <h2>{t("termination.title")}</h2>
        <p>{t("termination.body")}</p>

        <h2>{t("changes.title")}</h2>
        <p>{t("changes.body")}</p>

        <h2>{t("law.title")}</h2>
        <p>{t("law.body")}</p>

        <h2>{t("contact.title")}</h2>
        <p>
          <Trans i18nKey="contact.body" values={{ email: "edjcms2025@gmail.com" }}>
            For questions about these terms, please contact us at{" "}
            <strong>edjcms2025@gmail.com</strong>.
          </Trans>
        </p>
      </div>
      <Footer />
    </>
  );
};

export default TermsAndConditions;
