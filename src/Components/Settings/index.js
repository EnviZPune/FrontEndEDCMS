import React, { useState, useEffect, useCallback } from 'react'
import SettingsLayout from './SettingsLayout'
import BusinessInfoPanel           from './panels/BusinessInfoPanel'
import ProductPanel                from './panels/ProductPanel'
import CategoryPanel               from './panels/CategoryPanel'
import PhotoPanel                  from './panels/PhotoPanel'
import EmployeePanel               from './panels/EmployeePanel'
import PendingChangesPanel         from './panels/PendingChangesPanel'
import ReservationsPanel           from './panels/ReservationsPanel'
import NotificationHistoryPanel    from './panels/NotificationHistoryPanel'
import MyShopsPanel                from './panels/MyShopsPanel'
import DeleteBusinessPanel         from './panels/DeleteBusinessPanel'
import { useBusinesses }           from './hooks/useBusinesses'
import { useAuth }                 from './hooks/useAuth'

export default function Settings() {
  const { businesses, loading, error } = useBusinesses()
  const { role } = useAuth()                  // ← get role from JWT
  const [selectedBusiness, setSelectedBusiness] = useState(null)
  const [selectedPanel, setSelectedPanel]       = useState('BusinessInfo')

  // initialize selectedBusiness once
  useEffect(() => {
    if (!loading && businesses.length > 0 && !selectedBusiness) {
      setSelectedBusiness(businesses[0])
    }
  }, [loading, businesses, selectedBusiness])

  const handleSelectBusiness = useCallback(biz => {
    setSelectedBusiness(biz)
  }, [])

  const handleSelectPanel = useCallback(panelKey => {
    setSelectedPanel(panelKey)
  }, [])

  if (loading) return <div className="loading-spinner"></div>
  if (error)   return <div>Error loading businesses.</div>

  // all panels
  const panels = {
    BusinessInfo:    <BusinessInfoPanel business={selectedBusiness} />,
    Products:        <ProductPanel       business={selectedBusiness} />,
    Categories:      <CategoryPanel      business={selectedBusiness} />,
    Photos:          <PhotoPanel         business={selectedBusiness} />,
    Employees:       <EmployeePanel      business={selectedBusiness} />,
    PendingChanges:  <PendingChangesPanel business={selectedBusiness} />,
    Reservations:    <ReservationsPanel  business={selectedBusiness} />,
    Notifications:   <NotificationHistoryPanel business={selectedBusiness} />,
    MyShops:         <MyShopsPanel       businesses={businesses} />,
    DeleteBusiness:  <DeleteBusinessPanel business={selectedBusiness} />,
  }

  return (
    <SettingsLayout
      businesses={businesses}
      selectedBusiness={selectedBusiness}
      onSelectBusiness={handleSelectBusiness}
      selectedPanel={selectedPanel}
      onSelectPanel={handleSelectPanel}
      userRole={role}                       // ← pass role down
    >
      {panels[selectedPanel]}
    </SettingsLayout>
  )
}
