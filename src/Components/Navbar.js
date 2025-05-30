import React, { useState, useEffect, useRef } from "react";
import { FaUser, FaCaretDown, FaBell, } from "react-icons/fa";
import "../Styling/navbar.css";
import { jwtDecode } from "jwt-decode";
import Notification from "../Components/Notifications";
import { Link } from "react-router-dom";

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
  const dropdownRef = useRef(null);

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
    const loadMyBusinesses = async () => {
      const token = getToken();
      if (!token) return;
      try {
        const res = await fetch(
          `${API_BASE}/api/Business/my/businesses`,
          { headers: getHeaders() }
        );
        if (!res.ok) return;
        const list = await res.json();
        setMyBusinesses(list);
      } catch (err) {
        console.error("Failed to load user businesses:", err);
      }
    };
    loadMyBusinesses();
  }, []);

  const isOwner =
    loggedUser &&
    (loggedUser.role?.toLowerCase?.() === "owner" ||
      loggedUser[
        "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"
      ]?.toLowerCase?.() === "owner");

  const toggleDropdown = (e) => {
    e.stopPropagation();
    setDropdownVisible(!isDropdownVisible);
    setIsSubmenuVisible(false);
  };

  const toggleSubmenu = (e) => {
    e.stopPropagation();
    setIsSubmenuVisible(!isSubmenuVisible);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/preview";
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownVisible(false);
        setIsSubmenuVisible(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  return (
    <div className="navbar_container">
      <nav className="navbar">
        <div className="logo-container">
          <Link to="/preview">
            <img src={`${process.env.PUBLIC_URL}/Assets/edlogo.png`} />
          </Link>
          <h3>E & D</h3>
        </div>

        <button
          className={`hamburger ${isMenuOpen ? "is-active" : ""}`}
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle navigation menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        <ul className={`nav-links ${isMenuOpen ? "open" : ""}`}>
          <li>
            <Link to="/preview">Preview</Link>
          </li>
          <li>
            <Link to="/shops">Shops</Link>
          </li>
          <li>
            <Link to="/map">Map</Link>
          </li>

          {loggedUser ? (
            <>
              <Notification />
              <li className="user-menu" ref={dropdownRef}>
                <button className="user-menu-button" onClick={toggleDropdown}>
                  <FaUser className="user-icon" />
                  <span>{loggedUser.sub}</span>
                  <FaCaretDown
                    className={`caret-icon ${
                      isDropdownVisible ? "rotate" : ""
                    }`}
                  />
                </button>

                {isDropdownVisible && (
                  <div className="dropdown-menu">
                    <div className="dropdown-submenu">
                      <button
                        className="dropdown-item-dropdown-toggle"
                        onClick={toggleSubmenu}
                      >
                        <span className="dropdown-icon-myprofile">👤</span>
                        My Profile
                        <FaCaretDown
                          className={`submenu-caret ${
                            isSubmenuVisible ? "rotate" : ""
                          }`}
                        />
                      </button>
                      {isSubmenuVisible && (
                        <div className="dropdown-submenu-content">
                          <Link to="/my-profile" className="dropdown-item">
                            - View Profile
                          </Link>
                          {isOwner && (
                            <Link to="/owner-guide" className="dropdown-item">
                              - Owners Guide
                            </Link>
                          )}
                        </div>
                      )}
                    </div>

                    {!isOwner && (
                      <Link to="/create-shop" className="dropdown-item">
                        🏬 Create Your Shop
                      </Link>
                    )}
                    {isOwner && (
                      <Link to="/create-shop" className="dropdown-item">
                        🏬 Create Another Shop
                      </Link>
                    )}
                    {(isOwner || myBusinesses.length > 0) && (
                      <Link to="/settings" className="dropdown-item">
                        ⚙️ Business Settings
                      </Link>
                    )}
                    <button
                      onClick={handleLogout}
                      className="dropdown-item logout-button"
                    >
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
              >
                Login
              </button>
              <button
                onClick={() => (window.location.href = "/register")}
                className="register-button"
              >
                Register
              </button>
            </div>
          )}
        </ul>
      </nav>
    </div>
  );
};

export default Navbar;
