"use client"

import { useEffect } from "react"
import Navbar from "../Navbar"
import "../../Styling/Settings/settings.css"

const PANEL_DEFS = [
  { key: "BusinessInfo", label: "Business Info" },
  { key: "Products", label: "Add/Edit Products" },
  { key: "Categories", label: "Categories" },
  { key: "Photos", label: "Photos" },
  { key: "Employees", label: "Employees" },
  { key: "PendingChanges", label: "Pending Changes" },
  { key: "Reservations", label: "Reservations" },
  { key: "Notifications", label: "Notification History" },
  { key: "MyShops", label: "My Shops" },
  { key: "DeleteBusiness", label: "Delete Business" },
]

// panels employees are allowed to see
const EMPLOYEE_ALLOWED = new Set(["Products", "Categories", "MyShops", "Reservations"])

export default function SettingsLayout({
  businesses,
  selectedBusiness,
  onSelectBusiness,
  selectedPanel,
  onSelectPanel,
  userRole,
  children,
}) {
  const isOwner = userRole === "owner"

  // Filter which panels to show in the sidebar
  const visiblePanels = PANEL_DEFS.filter((p) => isOwner || EMPLOYEE_ALLOWED.has(p.key))

  // If the currently selected panel is not allowed, reset to first
  useEffect(() => {
    if (!visiblePanels.some((p) => p.key === selectedPanel)) {
      onSelectPanel(visiblePanels[0]?.key)
    }
  }, [visiblePanels, selectedPanel, onSelectPanel])

  const handleBusinessChange = (e) => {
    const id = Number.parseInt(e.target.value, 10)
    if (selectedBusiness?.businessId !== id) {
      const biz = businesses.find((b) => b.businessId === id) || null
      onSelectBusiness(biz)
    }
  }

  return (
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
                {panel.label}
              </li>
            ))}
          </ul>
        </aside>
        <section className="settings-content">
          {selectedBusiness ? children : <p>Please select a business to manage.</p>}
        </section>
      </div>
    </div>
  )
}
