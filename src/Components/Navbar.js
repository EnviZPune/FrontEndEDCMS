import React, { useState, useEffect, useRef } from "react";
import { jwtDecode } from "jwt-decode";
import { FaUser, FaCaretDown } from "react-icons/fa";
import Notification from "../Components/Notifications";
import { isFounder, canAccessPanel } from "../utils/auth";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "../Styling/navbar.css";
import { useAudio } from "./AudioProvider.tsx";

const API_BASE = "https://api.triwears.com";

const LOGO_LIGHT = `Assets/triwears-icon-black.png`; // light mode
const LOGO_DARK  = `Assets/triwears-icon-white.png`; // dark mode

const getToken = () => {
  const raw = localStorage.getItem("token") || localStorage.getItem("authToken");
  if (!raw || raw.trim() === "") return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed.token || parsed;
  } catch {
    return raw;
  }
};

const getHeaders = () => {
  const token = getToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const Navbar = () => {
  const { t, i18n } = useTranslation("navbar");
  const { toggle: toggleMusic } = useAudio();

  const [loggedUser, setLoggedUser] = useState(null);
  const [myBusinesses, setMyBusinesses] = useState([]);
  const [isDropdownVisible, setDropdownVisible] = useState(false);
  const [isSubmenuVisible, setIsSubmenuVisible] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [serverCanPanel, setServerCanPanel] = useState(false);
  const dropdownRef = useRef(null);

  // Detect system dark mode for logo swap
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  useEffect(() => {
    if (!window.matchMedia) return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => setIsDarkMode(e.matches);
    try { mql.addEventListener("change", onChange); } catch { mql.addListener(onChange); }
    return () => {
      try { mql.removeEventListener("change", onChange); } catch { mql.removeListener(onChange); }
    };
  }, []);

  // Safe language switch
  const changeLang = (lng) => {
    const apply = async () => {
      try {
        await i18n.changeLanguage(lng);
        localStorage.setItem("i18nextLng", lng);
        document.documentElement.lang = lng;
      } catch (e) {
        console.error("changeLanguage failed:", e);
      }
    };
    if (i18n.isInitialized) apply();
    else {
      const onInit = () => {
        apply();
        i18n.off("initialized", onInit);
      };
      i18n.on("initialized", onInit);
    }
  };

  // Honor saved language after i18n is ready
  useEffect(() => {
    const saved = (localStorage.getItem("i18nextLng") || "").toLowerCase();
    const kick = () => {
      const current = (i18n.language || "en").toLowerCase();
      if (saved && saved !== current) changeLang(saved);
      document.documentElement.lang = (i18n.language || saved || "en").toLowerCase();
    };
    if (i18n.isInitialized) kick();
    else {
      i18n.on("initialized", kick);
      return () => i18n.off("initialized", kick);
    }
  }, [i18n]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const token = getToken();
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setLoggedUser(decoded);
      } catch {
        localStorage.removeItem("token");
      }
    }
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, { headers: getHeaders() });
        if (!res.ok) {
          setServerCanPanel(false);
          return;
        }
        const data = await res.json();
        const roles = (data?.roles || []).map((r) => String(r).toLowerCase());
        const can =
          data?.founder === true ||
          roles.includes("founder") ||
          roles.includes("support") ||
          roles.includes("admin");
        setServerCanPanel(can);
      } catch {
        setServerCanPanel(false);
      }
    })();
  }, [loggedUser]);

  useEffect(() => {
    const loadMyBusinesses = async () => {
      const token = getToken();
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE}/api/Business/my/businesses`, { headers: getHeaders() });
        if (!res.ok) return;
        setMyBusinesses(await res.json());
      } catch (err) {
        console.error("Failed to load user businesses:", err);
      }
    };
    loadMyBusinesses();
  }, []);

  const isOwner =
    loggedUser &&
    (
      loggedUser.role?.toLowerCase() === "owner" ||
      loggedUser["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"]?.toLowerCase() === "owner"
    );

  const isAdmin =
    loggedUser &&
    (
      loggedUser.role?.toLowerCase() === "admin" ||
      loggedUser["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"]?.toLowerCase() === "admin"
    );

  const toggleDropdown = (e) => {
    e.stopPropagation();
    setDropdownVisible((v) => !v);
    setIsSubmenuVisible(false);
  };

  const toggleSubmenu = (e) => {
    e.stopPropagation();
    setIsSubmenuVisible((v) => !v);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/";
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownVisible(false);
        setIsSubmenuVisible(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    let timeoutMs = 60 * 60 * 1000;
    try {
      const { exp } = jwtDecode(token);
      if (exp) timeoutMs = exp * 1000 - Date.now();
    } catch {}

    if (timeoutMs <= 0) {
      handleLogout();
    } else {
      const timerId = setTimeout(() => {
        alert(t("session_expired", { defaultValue: "Session expired. Please log in again." }));
        handleLogout();
      }, timeoutMs);
      return () => clearTimeout(timerId);
    }
  }, [loggedUser, t]);

  const canPanel = serverCanPanel || canAccessPanel();

  const currentLangCode = (i18n.language || "en").toLowerCase();
  const normalized = currentLangCode.startsWith("sq") ? "sq" : "en";
  const nextLang = normalized === "sq" ? "en" : "sq";
  const switchLabel =
    normalized === "sq"
      ? t("switchToEnglish", { defaultValue: "ENG" })
      : t("switchToAlbanian", { defaultValue: "ALB" });

  const toggleLanguage = () => changeLang(nextLang);

  // Only the name toggles music
  const handleBrandNameClick = () => {
    try {
      toggleMusic();
    } catch (e) {
      console.warn("AudioProvider not mounted?", e);
    }
  };

  return (
    <div className={`navbar_container ${isScrolled ? "scrolled" : ""}`}>
      <nav className="navbar" role="navigation" aria-label={t("aria_main_nav", { defaultValue: "Main navigation" })}>
        <div className="logo-container">
          {/* Logo navigates home (no music) */}
          <Link to="/" aria-label={t("aria_go_home", { defaultValue: "Go to homepage" })}>
            <img
              src={isDarkMode ? LOGO_DARK : LOGO_LIGHT}
              alt={t("alt_logo", { defaultValue: "Triwears Logo" })}
            />
          </Link>

          {/* Brand name: toggles music ONLY, does not navigate */}
          <button
            type="button"
            onClick={handleBrandNameClick}
            className="brand-link"
            aria-label={t("brand_name", { defaultValue: "Triwears" })}
            title={t("brand_name", { defaultValue: "Triwears" })}
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              margin: 0,
              color: "inherit",
              cursor: "default",
              textDecoration: "none"
            }}
          >
            <h3 style={{ cursor: "default", margin: 0 }}>{t("brand_name")}</h3>
          </button>
        </div>

        <button
          className={`hamburger ${isMenuOpen ? "is-active" : ""}`}
          onClick={() => setIsMenuOpen((o) => !o)}
          aria-label={t("aria_toggle_menu", { defaultValue: "Toggle navigation menu" })}
          aria-expanded={isMenuOpen}
        >
          <span />
          <span />
          <span />
        </button>

        <ul className={`nav-links ${isMenuOpen ? "open" : ""}`} role="menubar">
          <li role="none">
            <Link to="/map" role="menuitem">
              <span>🗺️</span> {t("map", { defaultValue: "Map" })}
            </Link>
          </li>

          {loggedUser ? (
            <>
              <li className="notification-container" role="none">
                <Notification />
              </li>

              <li className="user-menu-container" ref={dropdownRef} role="none">
                <button
                  className="user-menu-button"
                  onClick={toggleDropdown}
                  aria-expanded={isDropdownVisible}
                  aria-haspopup="true"
                  aria-label={t("aria_user_menu", { defaultValue: "User account menu" })}
                  role="menuitem"
                >
                  <FaUser className="user-icon" />
                  <span>{loggedUser.sub}</span>
                  <FaCaretDown className={`caret-icon ${isDropdownVisible ? "rotate" : ""}`} />
                </button>

                {isDropdownVisible && (
                  <div className="dropdown-menu open" role="menu">
                    <div className="dropdown-submenu">
                      <button
                        className="dropdown-item-dropdown-toggle"
                        onClick={toggleSubmenu}
                        aria-expanded={isSubmenuVisible}
                        aria-haspopup="true"
                        role="menuitem"
                      >
                        <span className="dropdown-icon-myprofile">👤</span>
                        {t("my_profile", { defaultValue: "My Profile" })}
                        <FaCaretDown className={`submenu-caret ${isSubmenuVisible ? "rotate" : ""}`} />
                      </button>

                      {isSubmenuVisible && (
                        <div className="dropdown-submenu-content open" role="menu">
                          <Link to="/my-profile" className="dropdown-item" role="menuitem">
                            {t("view_profile", { defaultValue: "– View Profile" })}
                          </Link>
                          {isOwner && (
                            <Link to="/owner-guide" className="dropdown-item" role="menuitem">
                              {t("owners_guide", { defaultValue: "– Owners Guide" })}
                            </Link>
                          )}
                          {canPanel && (
                            <Link to="/panel" className="dropdown-item" role="menuitem">
                              {t("control_panel", { defaultValue: "– Control Panel" })}
                            </Link>
                          )}
                        </div>
                      )}
                    </div>

                    {!isOwner && !isAdmin && (
                      <Link to="/become-owner" className="dropdown-item" role="menuitem">
                        {t("create_your_shop", { defaultValue: "🏬 Create Your Shop" })}
                      </Link>
                    )}
                    {isOwner && (
                      <Link to="/become-owner" className="dropdown-item" role="menuitem">
                        {t("create_another_shop", { defaultValue: "🏬 Create Another Shop" })}
                      </Link>
                    )}
                    {(isOwner || myBusinesses.length > 0) && (
                      <Link to="/settings" className="dropdown-item" role="menuitem">
                        {t("business_settings", { defaultValue: "⚙️ Business Settings" })}
                      </Link>
                    )}
                    <button onClick={handleLogout} className="dropdown-item logout-button" role="menuitem">
                      {t("logout", { defaultValue: "🚪 Logout" })}
                    </button>
                  </div>
                )}
              </li>
            </>
          ) : (
            <div className="auth-buttons">
              <button
                onClick={() => (window.location.href = "/login")}
                className="login-button"
                aria-label={t("aria_sign_in", { defaultValue: "Sign in to your account" })}
              >
                <span>👤</span> {t("login", { defaultValue: "Login" })}
              </button>
              <button
                onClick={() => (window.location.href = "/register")}
                className="register-button"
                aria-label={t("aria_register", { defaultValue: "Create new account" })}
              >
                <span>✨</span> {t("register", { defaultValue: "Register" })}
              </button>
            </div>
          )}
          <li role="none">
            <button
              className="lang-toggle-button"
              onClick={toggleLanguage}
              aria-label={t("toggle_language", { defaultValue: "Change language" })}
              role="menuitem"
              title="Choose your language"
            >
              {switchLabel}
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
};

export default Navbar;
