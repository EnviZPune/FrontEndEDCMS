import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import SettingsLayout from "./SettingsLayout"
import BusinessInfoPanel from "./panels/BusinessInfoPanel"
import ProductPanel from "./panels/ProductPanel"
import SalesPanel from "./panels/SalesPanel"
import CategoryPanel from "./panels/CategoryPanel"
import PhotoPanel from "./panels/PhotoPanel"
import EmployeePanel from "./panels/EmployeePanel"
import PendingChangesPanel from "./panels/PendingChangesPanel"
import ReservationsPanel from "./panels/ReservationsPanel"
import NotificationHistoryPanel from "./panels/NotificationHistoryPanel"
import MyShopsPanel from "./panels/MyShopsPanel"
import DeleteBusinessPanel from "./panels/DeleteBusinessPanel"
import { useBusinesses } from "./hooks/useBusinesses"
import { useAuth } from "./hooks/useAuth"

const ALLOWED_ROLES = new Set(["owner", "employee"])

export default function Settings() {
  const navigate = useNavigate()
  const { businesses, loading, error } = useBusinesses()
  const { role, userInfo } = useAuth()
  const [selectedBusiness, setSelectedBusiness] = useState(null)
  const [selectedPanel, setSelectedPanel] = useState("BusinessInfo")

  useEffect(() => {
    if (role != null && !ALLOWED_ROLES.has(role)) {
      navigate("/unauthorized", { replace: true })
    }
  }, [role, navigate])

  useEffect(() => {
    if (!loading && businesses.length > 0 && !selectedBusiness) {
      setSelectedBusiness(businesses[0])
    }
  }, [loading, businesses, selectedBusiness])

  const handleSelectBusiness = useCallback((biz) => {
    setSelectedBusiness(biz)
  }, [])

  const handleSelectPanel = useCallback((panelKey) => {
    setSelectedPanel(panelKey)
  }, [])

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="dots">
          <div className="dot"></div>
          <div className="dot"></div>
          <div className="dot"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="settings-component">
        <div className="settings-layout">
          <div className="settings-content">
            <div className="panel">
              <div className="error-state">
                <h3>
                  <span>⚠️</span>
                  Error Loading Businesses
                </h3>
                <p>There was an error loading your businesses. Please try refreshing the page.</p>
                <button onClick={() => window.location.reload()}>Refresh Page</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

const panels = {
  BusinessInfo: <BusinessInfoPanel business={selectedBusiness} />,
  Products: <ProductPanel business={selectedBusiness} />,
  Sales: <SalesPanel business={selectedBusiness} />, 
  Categories: <CategoryPanel business={selectedBusiness} />,
  Photos: <PhotoPanel business={selectedBusiness} />,
  Employees: <EmployeePanel business={selectedBusiness} />,
  PendingChanges: <PendingChangesPanel business={selectedBusiness} />,
  Reservations: <ReservationsPanel business={selectedBusiness} />,
  Notifications: <NotificationHistoryPanel business={selectedBusiness} />,
  MyShops: <MyShopsPanel businesses={businesses} />,
  DeleteBusiness: <DeleteBusinessPanel business={selectedBusiness} />,
}

  return (
    <SettingsLayout
      businesses={businesses}
      selectedBusiness={selectedBusiness}
      onSelectBusiness={handleSelectBusiness}
      selectedPanel={selectedPanel}
      onSelectPanel={handleSelectPanel}
      userRole={role}
      ownerName={userInfo?.firstName}
    >
      {panels[selectedPanel]}
    </SettingsLayout>
  )
}
