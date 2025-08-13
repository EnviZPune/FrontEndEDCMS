// src/Components/Settings/panels/ReservationsPanel.js
import React, { useState, useEffect } from 'react'
import { useApiClient } from '../hooks/useApiClient'
import { useAuth } from '../hooks/useAuth'
import '../../../Styling/Settings/settings.css'
import '../../../Styling/Settings/reservationspanel.css'

export default function ReservationsPanel({ business }) {
  const { get, put } = useApiClient()
  const { token }    = useAuth()

  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)
  const [reservations, setReservations] = useState([])

  // track per-row action state: { id: number|null, type: 'complete'|'no-show'|null }
  const [actionState, setActionState] = useState({ id: null, type: null })

  // Fetch reservations once we have a businessId and a valid token
  useEffect(() => {
    if (!business?.businessId || !token) return

    let cancelled = false
    setLoading(true)
    setError(null)

    get(`/api/Reservation/business/${business.businessId}`)
      .then(data => {
        if (!cancelled) setReservations(data)
      })
      .catch(err => {
        console.error('Failed to load reservations:', err)
        if (!cancelled) setError(err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business?.businessId, token])

  const refresh = async () => {
    const updated = await get(`/api/Reservation/business/${business.businessId}`)
    setReservations(updated)
  }

  const handleComplete = async (reservationId) => {
    try {
      setActionState({ id: reservationId, type: 'complete' })
      await put(`/api/Reservation/${reservationId}/complete`)
      await refresh()
    } catch (err) {
      console.error('Error completing reservation:', err)
      alert('Failed to mark reservation completed.')
    } finally {
      setActionState({ id: null, type: null })
    }
  }

  const handleUpdateStatus = async (reservationId, status) => {
    try {
      setActionState({ id: reservationId, type: 'status' })
      await put(`/api/Reservation/${reservationId}/status`, { status })
      await refresh()
    } catch (err) {
      console.error('Error updating reservation status:', err)
      alert('Failed to update reservation status.')
    } finally {
      setActionState({ id: null, type: null })
    }
  }

  // NEW: No Show = restock +1 and mark reservation accordingly (server should do both)
  const handleNoShow = async (reservationId) => {
    const ok = window.confirm('Mark as No Show and return 1 item to stock?')
    if (!ok) return
    try {
      setActionState({ id: reservationId, type: 'no-show' })
      // Backend should: set reservation status to "NoShow" (or "Cancelled") AND increment product quantity by 1
      await put(`/api/Reservation/${reservationId}/no-show`)
      await refresh()
    } catch (err) {
      console.error('Error marking reservation as no-show:', err)
      alert('Failed to mark as No Show.')
    } finally {
      setActionState({ id: null, type: null })
    }
  }

  if (loading) {
    return (
      <div className="panel reservations-panel">
        <p>Loading reservations…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="panel reservations-panel">
        <p>Error loading reservations.</p>
      </div>
    )
  }

  const confirmed = reservations.filter(r => r.status === 'Confirmed')
  const pending   = reservations.filter(r => r.status === 'Pending')

  return (
    <div className="reservations-panel">
      <h3>Product Reservations</h3>

      <section>
        <h4>Confirmed Reservations</h4>
        {confirmed.length === 0 ? (
          <p>No approved reservations.</p>
        ) : (
          <table className="reservations-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Product</th>
                <th>Customer</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {confirmed.map(r => {
                const busy = actionState.id === r.reservationId
                return (
                  <tr key={r.reservationId}>
                    <td>{r.reservationId}</td>
                    <td>{r.productName}</td>
                    <td>{r.customerName}</td>
                    <td>{new Date(r.createdAt).toLocaleString()}</td>
                    <td>
                      <button
                        onClick={() => handleComplete(r.reservationId)}
                        disabled={busy}
                      >
                        Mark Completed
                      </button>{' '}
                      <button
                        className="btn-no-show"
                        onClick={() => handleNoShow(r.reservationId)}
                        disabled={busy}
                        title="Customer didn’t show; return item to stock (+1)"
                      >
                        No Show
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h4>Pending Reservations</h4>
        {pending.length === 0 ? (
          <p>No pending reservations.</p>
        ) : (
          <table className="reservations-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Product</th>
                <th>Customer</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pending.map(r => {
                const busy = actionState.id === r.reservationId
                return (
                  <tr key={r.reservationId}>
                    <td>{r.reservationId}</td>
                    <td>{r.productName}</td>
                    <td>{r.customerName}</td>
                    <td>{new Date(r.createdAt).toLocaleString()}</td>
                    <td>
                      <button
                        onClick={() => handleUpdateStatus(r.reservationId, 'Confirmed')}
                        disabled={busy}
                      >
                        Approve
                      </button>{' '}
                      <button
                        onClick={() => handleUpdateStatus(r.reservationId, 'Cancelled')}
                        disabled={busy}
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
