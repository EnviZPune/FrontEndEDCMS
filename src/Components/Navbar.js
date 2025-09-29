import React, { useState, useEffect, useRef } from "react";
import { jwtDecode } from "jwt-decode";
import { FaCaretDown, FaCrown , FaUser} from "react-icons/fa";
import Notification from "../Components/Notifications";
import { canAccessPanel } from "../utils/auth";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "../Styling/navbar.css";
import { useAudio } from "./AudioProvider.tsx";

const LOGO_LIGHT = `Assets/triwears-icon-black.png`;
const LOGO_DARK  = `Assets/triwears-icon-white.png`;

// NOTE: keep base without /api, we append /api in endpoints below
const API_BASE = "https://api.triwears.com";
const DEFAULT_AVATAR = "/Assets/default-avatar.jpg";

/* ---------------- helpers ---------------- */
const nameFromJwt = (claims) => {
  const c = claims || {};
  return c.username || c.name || c.given_name || c.unique_name || c.sub || c.email || "User";
};

const getToken = () => {
  const raw = localStorage.getItem("token") || localStorage.getItem("authToken");
  if (!raw || raw.trim() === "") return null;
  try { const parsed = JSON.parse(raw); return parsed.token || parsed; } catch { return raw; }
};

const getHeaders = () => {
  const token = getToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const resolveUrl = (url) => {
  if (!url) return null;
  if (/^(https?:)?\/\//i.test(url) || url.startsWith("data:") || url.startsWith("blob:")) return url;
  // If backend returns a relative path (e.g. /images/x.jpg), host it on api base
  return `${API_BASE.replace(/\/$/, "")}/${String(url).replace(/^\//, "")}`;
};

/* ---------------- component ---------------- */
const Navbar = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation("navbar");
  const { toggle: toggleMusic } = useAudio();

  // auth / user
  const [jwtUser, setJwtUser] = useState(null);
  const [serverUser, setServerUser] = useState(null);
  const [myBusinesses, setMyBusinesses] = useState([]);
  const [serverCanPanel, setServerCanPanel] = useState(false);

  // UI
  const [isScrolled, setIsScrolled] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [openDesktopMenu, setOpenDesktopMenu] = useState(false);
  const [openMobileSheet, setOpenMobileSheet] = useState(false);

  // 🔹 avatar exactly like UsersPage
  const [navAvatarUrl, setNavAvatarUrl] = useState(DEFAULT_AVATAR);

  const popoverRef = useRef(null);

  /* env detection */
  useEffect(() => {
    if (!window.matchMedia) return;
    const mqlDark = window.matchMedia("(prefers-color-scheme: dark)");
    const mqlMob  = window.matchMedia("(max-width: 768px)");
    setIsDarkMode(mqlDark.matches);
    setIsMobile(mqlMob.matches);
    const onDark = e => setIsDarkMode(e.matches);
    const onMob  = e => setIsMobile(e.matches);
    try { mqlDark.addEventListener("change", onDark); } catch { mqlDark.addListener(onDark); }
    try { mqlMob.addEventListener("change", onMob); }  catch { mqlMob.addListener(onMob); }
    return () => {
      try { mqlDark.removeEventListener("change", onDark); } catch { mqlDark.removeListener(onDark); }
      try { mqlMob.removeEventListener("change", onMob); }  catch { mqlMob.removeListener(onMob); }
    };
  }, []);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* i18n */
  const changeLang = (lng) => {
    const apply = async () => {
      try {
        await i18n.changeLanguage(lng);
        localStorage.setItem("i18nextLng", lng);
        document.documentElement.lang = lng;
      } catch (e) { console.error(e); }
    };
    if (i18n.isInitialized) apply();
    else {
      const onInit = () => { apply(); i18n.off("initialized", onInit); };
      i18n.on("initialized", onInit);
    }
  };
  useEffect(() => {
    const saved = (localStorage.getItem("i18nextLng") || "").toLowerCase();
    const kick = () => {
      const current = (i18n.language || "en").toLowerCase();
      if (saved && saved !== current) changeLang(saved);
      document.documentElement.lang = (i18n.language || saved || "en").toLowerCase();
    };
    if (i18n.isInitialized) kick();
    else { i18n.on("initialized", kick); return () => i18n.off("initialized", kick); }
  }, [i18n]);

  /* auth: jwt + /auth/me */
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    try { setJwtUser(jwtDecode(token)); }
    catch {
      localStorage.removeItem("token");
      localStorage.removeItem("authToken");
      setJwtUser(null);
    }
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, { headers: getHeaders() });
        if (!res.ok) { setServerUser(null); setServerCanPanel(false); return; }
        const data = await res.json();
        setServerUser(data);
        const roles = (data?.roles || []).map(r => String(r).toLowerCase());
        const can = data?.founder === true || roles.includes("founder") || roles.includes("support") || roles.includes("admin");
        setServerCanPanel(can);
      } catch {
        setServerUser(null);
        setServerCanPanel(false);
      }
    })();
  }, [jwtUser]);

  // 🔹 Fetch avatar the same way as UsersPage (from /api/User/all)
  useEffect(() => {
    const token = getToken();
    if (!token) { setNavAvatarUrl(DEFAULT_AVATAR); return; }

    // decode id like UsersPage
    let currentUserId = null;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      currentUserId = String(
        payload.UserId ?? payload.userId ?? payload.nameid ?? payload.sub ?? ""
      );
    } catch {}

    if (!currentUserId) { setNavAvatarUrl(DEFAULT_AVATAR); return; }

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/User/all`, {
          headers: getHeaders(),
        });
        if (!res.ok) { setNavAvatarUrl(DEFAULT_AVATAR); return; }
        const data = await res.json();
        const me = Array.isArray(data)
          ? data.find(u => String(u.userId) === currentUserId)
          : null;
        const src = me?.profilePictureUrl ? resolveUrl(me.profilePictureUrl) : DEFAULT_AVATAR;
        setNavAvatarUrl(src);
      } catch {
        setNavAvatarUrl(DEFAULT_AVATAR);
      }
    })();
  }, [jwtUser]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/Business/my/businesses`, { headers: getHeaders() });
        if (!res.ok) return;
        setMyBusinesses(await res.json());
      } catch {}
    })();
  }, []);

  // auto logout on expiry
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let timeoutMs = 60 * 60 * 1000;
    try { const { exp } = jwtDecode(token); if (exp) timeoutMs = exp * 1000 - Date.now(); } catch {}
    if (timeoutMs <= 0) hardLogout();
    else {
      const id = setTimeout(() => {
        alert(t("session_expired", { defaultValue: "Session expired. Please log in again." }));
        hardLogout();
      }, timeoutMs);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jwtUser]);

  const isOwner =
    !!jwtUser &&
    (jwtUser.role?.toLowerCase() === "owner" ||
      jwtUser["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"]?.toLowerCase() === "owner");
  const isAdmin =
    !!jwtUser &&
    (jwtUser.role?.toLowerCase() === "admin" ||
      jwtUser["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"]?.toLowerCase() === "admin");
  const canPanel = serverCanPanel || canAccessPanel();

  const displayName  = serverUser?.username || nameFromJwt(jwtUser);
  const displayEmail = serverUser?.email || "";
  const showBusinessSettings = isOwner || myBusinesses.length > 0;
  const showBecomeOwner      = !isOwner && !isAdmin;
  const showPanel            = canPanel;

  /* actions */
  const closeAll = () => { setOpenDesktopMenu(false); setOpenMobileSheet(false); };
  const toggleHamburger = () => { setOpenMobileSheet(v => !v); setOpenDesktopMenu(false); };
  const hardLogout = () => {
    try { localStorage.removeItem("token"); localStorage.removeItem("authToken"); } catch {}
    window.location.replace("/");
  };
  const toggleLanguage = () => {
    const current = (i18n.language || "en").toLowerCase();
    changeLang(current.startsWith("sq") ? "en" : "sq");
  };

  /* outside click (desktop) */
  useEffect(() => {
    const onDocClick = (e) => {
      if (!openDesktopMenu) return;
      if (popoverRef.current && !popoverRef.current.contains(e.target)) setOpenDesktopMenu(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [openDesktopMenu]);

  const handleAvatarError = (e) => {
    if (e?.currentTarget?.src !== window.location.origin + DEFAULT_AVATAR) {
      e.currentTarget.src = DEFAULT_AVATAR;
    }
  };

  /* shared list */
  const SheetList = () => (
    <>
      <div className="dd-list">
        <Link to="/my-profile" className="dropdown-item" role="menuitem" onClick={closeAll}>
          {t("my_profile", { defaultValue: "My Profile" })}
        </Link>

        {showBusinessSettings && (
          <Link to="/settings" className="dropdown-item" role="menuitem" onClick={closeAll}>
            {t("business_settings", { defaultValue: "Business Settings" })}
          </Link>
        )}

        {showBecomeOwner && (
          <Link to="/become-owner" className="dropdown-item" role="menuitem" onClick={closeAll}>
            {t("create_your_shop", { defaultValue: "Create Your Shop" })}
          </Link>
        )}

        {isOwner && (
          <Link to="/become-owner" className="dropdown-item" role="menuitem" onClick={closeAll}>
            {t("create_another_shop", { defaultValue: "Create Another Shop" })}
          </Link>
        )}

        {showPanel ? (
          <Link to="/panel" className="dropdown-item" role="menuitem" onClick={closeAll}>
            {t("control_panel", { defaultValue: "Control Panel" })}
          </Link>
        ) : (
          isOwner && (
            <Link to="/owner-guide" className="dropdown-item" role="menuitem" onClick={closeAll}>
              {t("owners_guide", { defaultValue: "Owners Guide" })}
            </Link>
          )
        )}
      </div>

      <div className="dd-lang">
        <span>{t("language", { defaultValue: "Language" })}</span>
        <button type="button" className="lang-toggle-button" onClick={toggleLanguage} role="menuitem" title="Choose your language">
          {(i18n.language || "en").toLowerCase().startsWith("sq") ? "ENG" : "ALB"}
        </button>
      </div>

      <div className="dd-logout">
        <button type="button" onClick={hardLogout} className="dropdown-item logout-button" role="menuitem">
          {t("logout", { defaultValue: "Logout" })}
        </button>
      </div>
    </>
  );

  /* UI */
  return (
    <div className={`navbar_container ${isScrolled ? "scrolled" : ""}`}>
      <nav className="navbar" role="navigation" aria-label={t("aria_main_nav", { defaultValue: "Main navigation" })}>
        {/* Logo + brand */}
        <div className="logo-container">
          <Link to="/" aria-label={t("aria_go_home", { defaultValue: "Go to homepage" })} onClick={closeAll}>
            <img src={isDarkMode ? LOGO_DARK : LOGO_LIGHT} alt={t("alt_logo", { defaultValue: "Triwears Logo" })} />
          </Link>
          <button
            type="button"
            onClick={() => { try { toggleMusic(); } catch {} }}
            className="brand-link"
            aria-label={t("Triwears", { defaultValue: "Triwears" })}
            title={t("Triwears", { defaultValue: "Triwears" })}
            style={{ background: "transparent", border: "none", padding: 0, margin: 0, color: "inherit", cursor: "default" }}
          >
            <h3 style={{ cursor: "default", margin: 0 }}>{t("Triwears")}</h3>
          </button>
        </div>

        {/* Hamburger (phones) */}
        <button
          type="button"
          className={`hamburger ${openMobileSheet ? "is-active" : ""}`}
          onClick={toggleHamburger}
          aria-label={openMobileSheet ? t("aria_close_menu", { defaultValue: "Close menu" }) : t("aria_toggle_menu", { defaultValue: "Open menu" })}
          aria-expanded={openMobileSheet}
        >
          <span /><span /><span />
        </button>

        {/* Desktop cluster */}
        <ul className="nav-links" role="menubar">
          <li role="none">
            <Link to="/map" role="menuitem" onClick={closeAll}>
              <span role="img" aria-hidden="true">🗺️</span> {t("map", { defaultValue: "Map" })}
            </Link>
          </li>

          {jwtUser ? (
            <>
              <li className="notification-container" role="none"><Notification /></li>

              <li className="user-menu-container" role="none">
                <button
                  type="button"
                  className="user-menu-button"
                  onClick={(e) => { e.stopPropagation(); setOpenDesktopMenu(v => !v); }}
                  aria-expanded={openDesktopMenu}
                  aria-haspopup="true"
                  aria-label={t("aria_user_menu", { defaultValue: "User account menu" })}
                  role="menuitem"
                >
                  <FaUser className="user-icon" />
                  <span className="user-name">{displayName}</span>
                  <FaCaretDown className={`caret-icon ${openDesktopMenu ? "rotate" : ""}`} />
                </button>

                {openDesktopMenu && (
                  <div className="dropdown-menu open" role="menu" ref={popoverRef}>
                    <div className="dd-header">
                      <div className="dd-avatar" aria-hidden="true">
                        <img
                          src={navAvatarUrl}
                          alt={`${displayName}'s avatar`}
                          className="dd-avatar-img"
                          width={44}
                          height={44}
                          style={{ objectFit: "cover", borderRadius: "50%" }}
                          onError={handleAvatarError}
                        />
                      </div>
                      <div className="dd-meta">
                        <div className="dd-row">
                          <div className="dd-name">{displayName}</div>
                          {isOwner && <FaCrown className="crown-icon crown-right" title={t("owner_badge", { defaultValue: "Owner" })} aria-label="Owner" />}
                        </div>
                        {displayEmail ? <div className="dd-email">{displayEmail}</div> : null}
                      </div>
                    </div>
                    <SheetList />
                  </div>
                )}
              </li>
            </>
          ) : (
            <div className="auth-buttons">
              <button type="button" onClick={() => { closeAll(); navigate("/login"); }} className="login-button">
                <span role="img" aria-hidden="true">👤</span> {t("login", { defaultValue: "Login" })}
              </button>
              <button type="button" onClick={() => { closeAll(); navigate("/register"); }} className="register-button">
                <span role="img" aria-hidden="true">✨</span> {t("register", { defaultValue: "Register" })}
              </button>
            </div>
          )}
        </ul>

        {/* MOBILE SHEET (logged in) */}
        {isMobile && jwtUser && openMobileSheet && (
          <>
            <div className="sheet-backdrop" onClick={closeAll} />
            <div className="mobile-sheet open" role="menu" aria-label="Account">
              <div className="dd-header">
                <div className="dd-avatar" aria-hidden="true">
                  <img
                    src={navAvatarUrl}
                    alt={`${displayName}'s avatar`}
                    className="dd-avatar-img"
                    width={44}
                    height={44}
                    style={{ objectFit: "cover", borderRadius: "50%" }}
                    onError={handleAvatarError}
                  />
                </div>
                <div className="dd-meta">
                  <div className="dd-row">
                    <div className="dd-name">{displayName}</div>
                    {isOwner && <FaCrown className="crown-icon crown-right" title={t("owner_badge", { defaultValue: "Owner" })} aria-label="Owner" />}
                  </div>
                  {displayEmail ? <div className="dd-email">{displayEmail}</div> : null}
                </div>
              </div>

              <div className="dd-tools">
                <Link to="/map" className="dd-tool" onClick={closeAll}>🗺️ {t("map", { defaultValue: "Map" })}</Link>
                <div className="dd-tool dd-notify"><Notification /></div>
              </div>

              <SheetList />
            </div>
          </>
        )}

        {/* MOBILE SHEET (logged out) */}
        {isMobile && !jwtUser && openMobileSheet && (
          <>
            <div className="sheet-backdrop" onClick={closeAll} />
            <div className="mobile-sheet open" role="menu" aria-label="Menu">
              <div className="dd-quick">
                <button className="dd-tile" type="button" onClick={() => { closeAll(); navigate("/login"); }}>
                  {t("login", { defaultValue: "Login" })}
                </button>
                <button className="dd-tile" type="button" onClick={() => { closeAll(); navigate("/register"); }}>
                  {t("register", { defaultValue: "Register" })}
                </button>
              </div>
            </div>
          </>
        )}
      </nav>
    </div>
  );
};

export default Navbar;
