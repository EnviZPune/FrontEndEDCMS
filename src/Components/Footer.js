import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "../Styling/footer.css";

const Footer = () => {
  const { t } = useTranslation("footer"); // footer keys live under common.footer

  return (
    <footer className="custom-footer">
      <div className="footer-content">
        <div className="footer-logo-section">
          <img
            src={`/Assets/triwears-icon-white.png`}
            alt={t("footer.logo_alt", { defaultValue: "Triwears Logo" })}
            className="footer-logo"
          />
          <p className="footer-slogan">
            {t("footer.slogan", {
              defaultValue:
                "Triwears — Albania’s First Real-Time Online Shopping Mall. Connecting real shops with real people.",
            })}
          </p>
        </div>

        <div className="footer-links">
          <div className="footer-column">
            <h4>{t("footer.company", { defaultValue: "Company" })}</h4>
            <Link to="/about">{t("footer.links.about", { defaultValue: "About Us" })}</Link>
            <Link to="/terms">{t("footer.links.terms", { defaultValue: "Terms & Conditions" })}</Link>
            <Link to="/privacy">{t("footer.links.privacy", { defaultValue: "Privacy Policy" })}</Link>
          </div>

          <div className="footer-column">
            <h4>{t("footer.explore", { defaultValue: "Explore" })}</h4>
            <Link to="/allshops">{t("footer.links.find_shops", { defaultValue: "Find Shops" })}</Link>
            <Link to="/user-search">{t("footer.links.find_users", { defaultValue: "Find Users" })}</Link>
            <Link to="/map">{t("footer.links.map", { defaultValue: "Map" })}</Link>
          </div>

          <div className="footer-column">
            <h4>{t("footer.contact", { defaultValue: "Contact" })}</h4>
            <p>
              <strong>{t("footer.contact_labels.email", { defaultValue: "Email" })}:</strong>{" "}
              edjcms2025@gmail.com
            </p>
            <p>
              <strong>{t("footer.contact_labels.phone", { defaultValue: "Phone" })}:</strong>{" "}
              +355 69 480 6600
            </p>
            <p>
              <strong>{t("footer.contact_labels.location", { defaultValue: "Location" })}:</strong>{" "}
              Tirana, Albania
            </p>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <p>
          {t("footer.copyright", {
            year: new Date().getFullYear(),
            defaultValue: `© ${new Date().getFullYear()} Triwears. All rights reserved.`,
          })}
        </p>
      </div>
    </footer>
  );
};

export default Footer;
