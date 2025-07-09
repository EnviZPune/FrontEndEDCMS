// src/Components/Settings/panels/NotificationHistoryPanel.js
import React, { useState, useEffect } from 'react'
import { useApiClient } from '../hooks/useApiClient'
import { useAuth } from '../hooks/useAuth'
import '../../../Styling/Settings/settings.css'
import '../../../Styling/Settings/notificationhistorypanel.css'

export default function NotificationHistoryPanel({ business }) {
  const { get } = useApiClient()
  const { token } = useAuth()

  const [loading, setLoading] = useState(true)
  const [history, setHistory] = useState([])
  const [error, setError]     = useState(null)

  useEffect(() => {
    if (!business?.businessId || !token) return

    let cancelled = false
    setLoading(true)
    setError(null)

    get(`/api/Notification/business/${business.businessId}/history`)
      .then(data => {
        if (!cancelled) setHistory(data)
      })
      .catch(err => {
        console.error('Failed to load notification history:', err)
        if (!cancelled) setError(err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // only re-run when businessId or token changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business?.businessId, token])

  if (loading) {
    return (
      <div className="panel notification-history-panel">
        <p>Loading notifications…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="panel notification-history-panel">
        <p>Error loading notifications.</p>
      </div>
    )
  }

  return (
    <div className="panel notification-history-panel">
      <h3>Notification History</h3>
      {history.length === 0 ? (
        <p>No notifications ever sent.</p>
      ) : (
        <ul className="notification-list">
          {history.map((n) => (
            <li key={n.id ?? n.notificationId} className="notification-entry">
              <p>{n.message}</p>
              <small>{new Date(n.createdAt).toLocaleString()}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
