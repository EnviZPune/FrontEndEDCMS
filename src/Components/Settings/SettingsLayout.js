import { useEffect, useMemo, useCallback, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Navbar from "../Navbar";
import "../../Styling/Settings/settings.css";

const PANEL_DEFS = [
  { key: "BusinessInfo", label: "Business Info", icon: "🏢" },
  { key: "Products", label: "Add/Edit Products", icon: "📦" },
  { key: "Sales", label: "Sales", icon: "📅" },
  { key: "Categories", label: "Categories", icon: "📂" },
  { key: "Photos", label: "Photos", icon: "📸" },
  { key: "Employees", label: "Employees", icon: "👥" },
  { key: "PendingChanges", label: "Pending Changes", icon: "⏳" },
  { key: "Reservations", label: "Reservations", icon: "📅" },
  { key: "Notifications", label: "Notification History", icon: "🔔" },
  { key: "MyShops", label: "My Shops", icon: "🏪" },
  { key: "DeleteBusiness", label: "Delete Business", icon: "🗑️" },
];

/** Panels employees are allowed to see (hide sensitive/owner-only ones) */
const EMPLOYEE_ALLOWED_PANELS = new Set([
  "BusinessInfo",
  "Products",
  "Categories",
  "Photos",
  "PendingChanges",
  "Reservations",
  "Notifications",
  "MyShops",
]);

/** Hash ↔ Panel mapping for deep-links like /settings#business-info */
const HASH_TO_KEY = {
  "business-info": "BusinessInfo",
  "products": "Products",
  "sales": "Sales",
  "categories": "Categories",
  "photos": "Photos",
  "employees": "Employees",
  "pending-changes": "PendingChanges",
  "reservations": "Reservations",
  "notifications": "Notifications",
  "my-shops": "MyShops",
  "delete-business": "DeleteBusiness",
};
const KEY_TO_HASH = Object.fromEntries(Object.entries(HASH_TO_KEY).map(([h, k]) => [k, h]));
const keyToHash = (key) => (KEY_TO_HASH[key] ? KEY_TO_HASH[key] : key.toLowerCase());
const readHashKey = () => {
  const h = (typeof window !== "undefined" ? window.location.hash : "").replace(/^#/, "").toLowerCase();
  return HASH_TO_KEY[h] || null;
};

/** ---- Role gate (owner or employee) ---- */
export default function SettingsLayout(props) {
  const userRole = (props.userRole || "").toLowerCase();
  const allowed = props.userRole == null || ["owner", "employee"].includes(userRole);
  if (!allowed) return <Navigate to="/unauthorized" replace />;
  return <SettingsLayoutInner {...props} />;
}

/** ---- All hooks live here, so order is stable ---- */
function SettingsLayoutInner({
  businesses,
  selectedBusiness,
  onSelectBusiness,
  selectedPanel,
  onSelectPanel,
  userRole,
  ownerName,
  children,
}) {
  const { t } = useTranslation("settings");
  const roleLc = (userRole || "").toLowerCase();
  const isOwner = roleLc === "owner";
  const isEmployee = roleLc === "employee";

  // Mobile detection (unconditional hook call)
  const [isMobile, setIsMobile] = useState(
    () => (typeof window !== "undefined" ? window.innerWidth <= 768 : false)
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Drawer open/close
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Initial restore (URL hash > sessionStorage)
  useEffect(() => {
    const st = sessionStorage.getItem("settings:drawerOpen");
    if (st != null) setDrawerOpen(st === "true");

    const fromHash = readHashKey();
    if (fromHash) {
      onSelectPanel(fromHash);
    } else {
      const sp = sessionStorage.getItem("settings:lastPanel");
      if (sp) onSelectPanel(sp);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist drawer + last panel
  useEffect(() => {
    sessionStorage.setItem("settings:drawerOpen", String(drawerOpen));
  }, [drawerOpen]);
  useEffect(() => {
    if (selectedPanel) sessionStorage.setItem("settings:lastPanel", selectedPanel);
  }, [selectedPanel]);

  // Sync selectedPanel → URL hash
  useEffect(() => {
    if (!selectedPanel || typeof window === "undefined") return;
    const newHash = "#" + keyToHash(selectedPanel);
    if (window.location.hash !== newHash) {
      window.history.replaceState(null, "", newHash);
    }
  }, [selectedPanel]);

  // Sync URL hash → selectedPanel (back/forward, manual edits)
  useEffect(() => {
    const onHash = () => {
      const k = readHashKey();
      if (k && k !== selectedPanel) onSelectPanel(k);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [selectedPanel, onSelectPanel]);

  // Lock body scroll when drawer is open (mobile only)
  useEffect(() => {
    if (!isMobile) return;
    if (drawerOpen) document.body.classList.add("no-scroll");
    else document.body.classList.remove("no-scroll");
    return () => document.body.classList.remove("no-scroll");
  }, [drawerOpen, isMobile]);

  // Hide global support toggle on mobile while here
  useEffect(() => {
    if (isMobile) document.body.classList.add("hide-support-toggle");
    else document.body.classList.remove("hide-support-toggle");
    if (!isMobile) return;

    const selectors = [
      ".support-toggle", ".support-button", ".support", ".chat-support-toggle",
      "#support-toggle", "[data-support-toggle]", '[aria-label="Support"]',
      'button[aria-label="Support"]', 'button[title="Support"]', 'a[aria-label="Support"]',
      ".crisp-client .crisp-wwrap .crisp-toggle", ".intercom-lightweight-app-launcher",
    ];
    const hideEl = (el) => {
      try { if (!el) return; el.dataset._prevDisplay = el.style.display || ""; el.style.setProperty("display","none","important"); } catch {}
    };
    const tryHide = () => {
      selectors.forEach((sel) => document.querySelectorAll(sel).forEach(hideEl));
      document.querySelectorAll("button, a, div").forEach((el) => {
        const cs = getComputedStyle(el);
        if (cs.position === "fixed" && /support/i.test(el.textContent || "")) hideEl(el);
      });
    };
    tryHide();
    const mo = new MutationObserver(tryHide);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      document.querySelectorAll("[data-_prev-display]").forEach((el) => {
        try { el.style.display = el.dataset._prevDisplay || ""; delete el.dataset._prevDisplay; } catch {}
      });
      document.body.classList.remove("hide-support-toggle");
    };
  }, [isMobile]);

  // ----- Panels by role -----
  const visiblePanels = useMemo(() => {
    if (isOwner) return PANEL_DEFS;
    if (isEmployee) return PANEL_DEFS.filter(p => EMPLOYEE_ALLOWED_PANELS.has(p.key));
    return [];
  }, [isOwner, isEmployee]);

  // Ensure selected panel is valid
  useEffect(() => {
    if (!visiblePanels.length) return;
    if (!visiblePanels.some((p) => p.key === selectedPanel)) {
      onSelectPanel(visiblePanels[0].key);
    }
  }, [visiblePanels, selectedPanel, onSelectPanel]);

  // Business dropdown change
  const handleBusinessChange = useCallback(
    (e) => {
      const id = Number.parseInt(e.target.value, 10);
      if ((selectedBusiness?.businessId ?? selectedBusiness?.id) === id) return;
      const biz = businesses.find((b) => (b.businessId ?? b.id) === id) || null;
      onSelectBusiness(biz);
    },
    [businesses, onSelectBusiness, selectedBusiness?.businessId, selectedBusiness?.id]
  );

  // Close the drawer when switching to desktop
  useEffect(() => {
    if (!isMobile) setDrawerOpen(false);
  }, [isMobile]);

  const disableBusinessSelect = isEmployee && businesses.length <= 1;

  return (
    <div className="settings-component">
      <div className="settings-layout">
        <Navbar />

        {isMobile && (
          <button
            className="settings-mobile-toggle"
            aria-label={drawerOpen ? "Close menu" : "Open menu"}
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen((v) => !v)}
          >
            <span className="settings-mobile-toggle__bar" />
            <span className="settings-mobile-toggle__bar" />
            <span className="settings-mobile-toggle__bar" />
          </button>
        )}

        {isMobile && <div className="settings-edge-hint" aria-hidden="true" />}

        {isMobile && (
          <div
            className={`settings-drawer-overlay ${drawerOpen ? "visible" : ""}`}
            onClick={() => setDrawerOpen(false)}
            aria-hidden={!drawerOpen}
          />
        )}

        <div className="settings-wrapper">
          <aside
            className="settings-sidebar"
            data-open={isMobile ? String(drawerOpen) : "true"}
            aria-hidden={isMobile ? !drawerOpen : false}
          >
            <select
              value={selectedBusiness?.businessId ?? selectedBusiness?.id ?? ""}
              onChange={handleBusinessChange}
              aria-label={t("aria.business_select", { defaultValue: "Select a business to manage" })}
              disabled={disableBusinessSelect}
              title={
                disableBusinessSelect
                  ? t("aria.business_locked", { defaultValue: "Your access is limited to this shop." })
                  : undefined
              }
            >
              <option value="" disabled>
                {t("choose_business", { defaultValue: "-- Choose Business --" })}
              </option>
              {businesses.map((b) => {
                const id = b?.businessId ?? b?.id;
                return (
                  <option key={id} value={id}>
                    {b.name}
                  </option>
                );
              })}
            </select>

            <ul>
              {visiblePanels.map((panel) => (
                <li
                  key={panel.key}
                  className={selectedPanel === panel.key ? "active" : ""}
                  onClick={() => {
                    onSelectPanel(panel.key);
                    if (isMobile) setDrawerOpen(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectPanel(panel.key);
                      if (isMobile) setDrawerOpen(false);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  title={panel.label}
                  aria-current={selectedPanel === panel.key ? "page" : undefined}
                >
                  <span className="panel-icon">{panel.icon}</span>
                  <span className="panel-label">
                    {t(`panels.${panel.key}`, { defaultValue: panel.label })}
                  </span>
                </li>
              ))}
            </ul>
          </aside>

          <section
            className="settings-content"
            {...(isMobile && drawerOpen ? { inert: "", "aria-hidden": true, "data-inert": "true" } : {})}
          >
            {selectedBusiness ? (
              <div className="panel">
                {isOwner && (selectedBusiness?.ownerName || ownerName) && (
                  <div
                    className="welcome-message"
                    style={{
                      fontSize: "1.5rem",
                      fontWeight: 600,
                      marginBottom: "1rem",
                      color: "#333",
                    }}
                  >
                    {t("welcome", {
                      name: selectedBusiness?.ownerName || ownerName,
                      defaultValue: "Welcome, {{name}}!",
                    })}
                  </div>
                )}
                {children}
              </div>
            ) : (
              <div className="panel">
                <div className="no-business-selected">
                  <h3>
                    <span>🏢</span>
                    {t("no_business.title", { defaultValue: "No Business Selected" })}
                  </h3>
                  <p>
                    {t("no_business.body", {
                      defaultValue:
                        "Please select a business from the dropdown above to manage its settings.",
                    })}
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
