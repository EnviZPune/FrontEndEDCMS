import { useEffect, useMemo, useCallback } from "react";
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

const EMPLOYEE_ALLOWED = new Set(["Products", "Categories", "MyShops", "Reservations", "Sales"]);
const ALLOWED_ROLES = new Set(["owner", "employee"]);

export default function SettingsLayout({
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
  const isOwner = userRole === "owner";
  const unauthorized = userRole != null && !ALLOWED_ROLES.has(userRole);

  // Compute visible panels based on role
  const visiblePanels = useMemo(
    () => PANEL_DEFS.filter((p) => isOwner || EMPLOYEE_ALLOWED.has(p.key)),
    [isOwner]
  );

  // Ensure selectedPanel is always one the user can see
  useEffect(() => {
    if (!visiblePanels.length) return;
    if (!visiblePanels.some((p) => p.key === selectedPanel)) {
      onSelectPanel(visiblePanels[0].key);
    }
  }, [visiblePanels, selectedPanel, onSelectPanel]);

  // must be declared before any early return
  const handleBusinessChange = useCallback(
    (e) => {
      const id = Number.parseInt(e.target.value, 10);
      if (selectedBusiness?.businessId === id) return;
      const biz = businesses.find((b) => b.businessId === id) || null;
      onSelectBusiness(biz);
    },
    [businesses, onSelectBusiness, selectedBusiness?.businessId]
  );

  if (unauthorized) {
    return <Navigate to="/unauthorized" replace />;
  }

  return (
    <div className="settings-component">
      <div className="settings-layout">
        <Navbar />
        <div className="settings-wrapper">
          <aside className="settings-sidebar">
            <select
              value={selectedBusiness?.businessId || ""}
              onChange={handleBusinessChange}
              aria-label={t("aria.business_select", { defaultValue: "Select a business to manage" })}
            >
              <option value="" disabled>
                {t("choose_business", { defaultValue: "-- Choose Business --" })}
              </option>
              {businesses.map((b) => (
                <option key={b.businessId} value={b.businessId}>
                  {b.name}
                </option>
              ))}
            </select>

            <ul>
              {visiblePanels.map((panel) => (
                <li
                  key={panel.key}
                  className={selectedPanel === panel.key ? "active" : ""}
                  onClick={() => onSelectPanel(panel.key)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectPanel(panel.key);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <span className="panel-icon">{panel.icon}</span>
                  <span className="panel-label">
                    {t(`panels.${panel.key}`, { defaultValue: panel.label })}
                  </span>
                </li>
              ))}
            </ul>
          </aside>

          <section className="settings-content">
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
