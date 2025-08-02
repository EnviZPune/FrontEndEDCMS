import { useEffect } from "react"
import { Navigate } from "react-router-dom"
import Navbar from "../Navbar"
import "../../Styling/Settings/settings.css"

const PANEL_DEFS = [
  { key: "BusinessInfo", label: "Business Info", icon: "🏢" },
  { key: "Products", label: "Add/Edit Products", icon: "📦" },
  { key: "Categories", label: "Categories", icon: "📂" },
  { key: "Photos", label: "Photos", icon: "📸" },
  { key: "Employees", label: "Employees", icon: "👥" },
  { key: "PendingChanges", label: "Pending Changes", icon: "⏳" },
  { key: "Reservations", label: "Reservations", icon: "📅" },
  { key: "Notifications", label: "Notification History", icon: "🔔" },
  { key: "MyShops", label: "My Shops", icon: "🏪" },
  { key: "DeleteBusiness", label: "Delete Business", icon: "🗑️" },
]

const EMPLOYEE_ALLOWED = new Set(["Products", "Categories", "MyShops", "Reservations"])
const ALLOWED_ROLES = new Set(["owner", "employee"])

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
  const isOwner = userRole === "owner"

  const unauthorized = userRole != null && !ALLOWED_ROLES.has(userRole)
  const visiblePanels = PANEL_DEFS.filter((p) => isOwner || EMPLOYEE_ALLOWED.has(p.key))

  useEffect(() => {
    if (!visiblePanels.some((p) => p.key === selectedPanel)) {
      onSelectPanel(visiblePanels[0]?.key)
    }
  }, [visiblePanels, selectedPanel, onSelectPanel])

  if (unauthorized) {
    return <Navigate to="/unauthorized" replace />
  }

  const handleBusinessChange = (e) => {
    const id = Number.parseInt(e.target.value, 10)
    if (selectedBusiness?.businessId !== id) {
      const biz = businesses.find((b) => b.businessId === id) || null
      onSelectBusiness(biz)
    }
  }

  return (
    <div className="settings-component">
      <div className="settings-layout">
        <Navbar />
        <div className="settings-wrapper">
          <aside className="settings-sidebar">
            <select value={selectedBusiness?.businessId || ""} onChange={handleBusinessChange}>
              <option value="" disabled>
                -- Choose Business --
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
                >
                  <span className="panel-icon">{panel.icon}</span>
                  <span className="panel-label">{panel.label}</span>
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
                      fontWeight: "600",
                      marginBottom: "1rem",
                      color: "#333",
                    }}
                  >
                    Welcome, {selectedBusiness?.ownerName || ownerName}!
                  </div>
                )}
                {children}
              </div>
            ) : (
              <div className="panel">
                <div className="no-business-selected">
                  <h3>
                    <span>🏢</span>
                    No Business Selected
                  </h3>
                  <p>Please select a business from the dropdown above to manage its settings.</p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}