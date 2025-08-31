// src/Components/Settings/panels/NotificationHistoryPanel.js
import React, { useState, useEffect } from 'react'
import { useApiClient } from '../hooks/useApiClient'
import { useAuth } from '../hooks/useAuth'
import Pagination from '../../Pagination.tsx'
import '../../../Styling/Settings/settings.css'
import '../../../Styling/Settings/notificationhistorypanel.css'

export default function NotificationHistoryPanel({ business }) {
  const { get } = useApiClient()
  const { token } = useAuth()

  const [loading, setLoading] = useState(true)
  const [history, setHistory] = useState([])
  const [error, setError]     = useState(null)

  // Pagination state
  const [page, setPage]       = useState(1)
  const pageSize              = 20

  // Fetch notification history when business or token changes
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
  }, [business?.businessId, token])

  // Reset to first page whenever the data source changes
  useEffect(() => {
    setPage(1)
  }, [business?.businessId, token])

  if (loading) {
    return (
      <div className="notification-history-panel">
        <p>Loading notifications…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="notification-history-panel">
        <p>Error loading notifications.</p>
      </div>
    )
  }

  // Client‑side pagination
  const totalCount      = history.length
  const startIdx        = (page - 1) * pageSize
  const paginatedHistory = history.slice(startIdx, startIdx + pageSize)

  return (
    <div className="notification-history-panel">
      <h3>Notification History</h3>

      {totalCount === 0 ? (
        <p>No notifications ever sent.</p>
      ) : (
        <>
          <ul className="notification-list">
            {paginatedHistory.map(n => (
              <li
                key={n.id ?? n.notificationId}
                className="notification-entry"
              >
                <p>{n.message}</p>
                <small>{new Date(n.createdAt).toLocaleString()}</small>
              </li>
            ))}
          </ul>

          <Pagination
            page={page}
            pageSize={pageSize}
            totalCount={totalCount}
            onPageChange={setPage}
            maxButtons={5}
          />
        </>
      )}
    </div>
  )
}
