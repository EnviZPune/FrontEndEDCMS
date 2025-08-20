import React, { useState, useEffect, useRef } from "react";
import { jwtDecode } from "jwt-decode";
import { FaUser, FaCaretDown } from "react-icons/fa";
import Notification from "../Components/Notifications";
import { isFounder, canAccessPanel } from "../utils/auth";
import { Link } from "react-router-dom";
import "../Styling/navbar.css";

const API_BASE = "http://77.242.26.150:8000";

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

const getHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

const Navbar = () => {
  const [loggedUser, setLoggedUser] = useState(null);
  const [myBusinesses, setMyBusinesses] = useState([]);
  const [isDropdownVisible, setDropdownVisible] = useState(false);
  const [isSubmenuVisible, setIsSubmenuVisible] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [serverCanPanel, setServerCanPanel] = useState(false); // <-- NEW
  const dropdownRef = useRef(null);

  // scroll styling
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // decode JWT and set user
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

  // ask server what roles it sees (includes Founder added at runtime)
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, { headers: getHeaders() });
        if (!res.ok) { setServerCanPanel(false); return; }
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

  // load user’s businesses
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

  // close dropdown on outside click
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

  // session expiry watchdog
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
        alert("Session expired. Please log in again.");
        handleLogout();
      }, timeoutMs);
      return () => clearTimeout(timerId);
    }
  }, [loggedUser]);

  // final gate: show Panel link if server says yes OR token roles say yes
  const canPanel = serverCanPanel || canAccessPanel();

  return (
    <div className={`navbar_container ${isScrolled ? "scrolled" : ""}`}>
      <nav className="navbar" role="navigation" aria-label="Main navigation">
        <div className="logo-container">
          <Link to="/" aria-label="Go to homepage">
            <img src={`${process.env.PUBLIC_URL}/Assets/edlogo.png`} alt="E & D Logo" />
          </Link>
          <h3>EDCMS</h3>
        </div>

        <button
          className={`hamburger ${isMenuOpen ? "is-active" : ""}`}
          onClick={() => setIsMenuOpen((o) => !o)}
          aria-label="Toggle navigation menu"
          aria-expanded={isMenuOpen}
        >
          <span />
          <span />
          <span />
        </button>

        <ul className={`nav-links ${isMenuOpen ? "open" : ""}`} role="menubar">
          <li role="none">
            <Link to="/map" role="menuitem">
              <span>🗺️</span> Map
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
                  aria-label="User account menu"
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
                        My Profile
                        <FaCaretDown className={`submenu-caret ${isSubmenuVisible ? "rotate" : ""}`} />
                      </button>

                      {isSubmenuVisible && (
                        <div className="dropdown-submenu-content open" role="menu">
                          <Link to="/my-profile" className="dropdown-item" role="menuitem">
                            – View Profile
                          </Link>
                          {isOwner && (
                            <Link to="/owner-guide" className="dropdown-item" role="menuitem">
                              – Owners Guide
                            </Link>
                          )}
                          {/* Founder-only (server-aware) link under Owner's Guide */}
                          {canPanel && (
                            <Link to="/panel" className="dropdown-item" role="menuitem">
                              – Control Panel
                            </Link>
                          )}
                        </div>
                      )}
                    </div>

                    {(!isOwner && !isAdmin) &&(
                      <Link to="/become-owner" className="dropdown-item" role="menuitem">
                        🏬 Create Your Shop
                      </Link>
                    )}
                    {isOwner && (
                      <Link to="/become-owner" className="dropdown-item" role="menuitem">
                        🏬 Create Another Shop
                      </Link>
                    )}
                    {(isOwner || myBusinesses.length > 0) && (
                      <Link to="/settings" className="dropdown-item" role="menuitem">
                        ⚙️ Business Settings
                      </Link>
                    )}
                    <button onClick={handleLogout} className="dropdown-item logout-button" role="menuitem">
                      🚪 Logout
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
                aria-label="Sign in to your account"
              >
                <span>👤</span> Login
              </button>
              <button
                onClick={() => (window.location.href = "/register")}
                className="register-button"
                aria-label="Create new account"
              >
                <span>✨</span> Register
              </button>
            </div>
          )}
        </ul>
      </nav>
    </div>
  );
};

export default Navbar;
