import React from "react";
import { useTranslation, Trans } from "react-i18next";
import Navbar from "../Components/Navbar";
import Footer from "../Components/Footer";
import "../Styling/policy.css"; // shared styling

const PrivacyPolicy = () => {
  const { t } = useTranslation("privacy");

  return (
    <>
      <Navbar />
      <div className="policy-container">
        <h1>{t("title")}</h1>
        <p>
          <strong>{t("last_updated")}</strong>
        </p>

        <p>
          <Trans i18nKey="intro">
            At <strong>E &amp; D</strong>, your privacy is important to us. This
            Privacy Policy explains how we collect, use, and protect your
            personal information when you use our platform.
          </Trans>
        </p>

        <h2>{t("info_collect.title")}</h2>
        <ul>
          <li>
            <strong>{t("info_collect.items.account.label")}</strong>{" "}
            {t("info_collect.items.account.desc")}
          </li>
          <li>
            <strong>{t("info_collect.items.business.label")}</strong>{" "}
            {t("info_collect.items.business.desc")}
          </li>
          <li>
            <strong>{t("info_collect.items.usage.label")}</strong>{" "}
            {t("info_collect.items.usage.desc")}
          </li>
        </ul>

        <h2>{t("use_info.title")}</h2>
        <ul>
          <li>{t("use_info.items.display")}</li>
          <li>{t("use_info.items.improve")}</li>
          <li>{t("use_info.items.communicate")}</li>
        </ul>

        <h2>{t("data_protection.title")}</h2>
        <p>{t("data_protection.body")}</p>

        <h2>{t("rights.title")}</h2>
        <ul>
          <li>{t("rights.items.access")}</li>
          <li>{t("rights.items.optout")}</li>
        </ul>

        <h2>{t("contact.title")}</h2>
        <p>
          <Trans
            i18nKey="contact.body"
            values={{ email: "contact@edshopping.al" }}
          >
            If you have any questions about this policy or our practices, feel
            free to reach out at: <strong>contact@edshopping.al</strong>
          </Trans>
        </p>

        <p>{t("consent")}</p>
      </div>
      <Footer />
    </>
  );
};

export default PrivacyPolicy;
