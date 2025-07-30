// src/Components/Settings/panels/DeleteBusinessPanel.js
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useApiClient } from '../hooks/useApiClient'
import '../../../Styling/Settings/deletebusinesspanel.css'

export default function DeleteBusinessPanel({ business }) {
  const { del }  = useApiClient()
  const navigate = useNavigate()

  // Don’t show the panel unless a business is selected
  if (!business) {
    return (
      <div className="panel delete-business-panel">
        <p>Please select a business first.</p>
      </div>
    )
  }

  const handleDelete = async () => {
    if (
      !window.confirm(
        'This action cannot be undone. Are you sure you want to delete this business?'
      )
    ) {
      return
    }
    try {
      await del(`/api/Business/${business.businessId}`)
      alert('Business deleted successfully.')
      navigate('/')
    } catch (err) {
      console.error('Error deleting business:', err)
      alert('Failed to delete business. Please try again.')
    }
  }

  return (
    <div className="delete-business-panel">
      <h3>Delete Business</h3>
      <p className="warning-text">
        <strong>Warning:</strong> Deleting a business is permanent and cannot be undone.
      </p>
      <button className="delete-button" onClick={handleDelete}>
        Delete Business
      </button>
    </div>
  )
}
