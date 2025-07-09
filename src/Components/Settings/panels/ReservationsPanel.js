// src/Components/Settings/panels/ReservationsPanel.js
import React, { useState, useEffect } from 'react'
import { useApiClient } from '../hooks/useApiClient'
import { useAuth } from '../hooks/useAuth'
import '../../../Styling/Settings/settings.css'
import '../../../Styling/Settings/reservationspanel.css'

export default function ReservationsPanel({ business }) {
  const { get, put } = useApiClient()
  const { token }    = useAuth()

  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [reservations, setReservations] = useState([])

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
    // only re-run when businessId or token changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business?.businessId, token])

  const handleComplete = async (reservationId) => {
    try {
      await put(`/api/Reservation/${reservationId}/complete`)
      // refresh
      const updated = await get(`/api/Reservation/business/${business.businessId}`)
      setReservations(updated)
    } catch (err) {
      console.error('Error completing reservation:', err)
      alert('Failed to mark reservation completed.')
    }
  }

  const handleUpdateStatus = async (reservationId, status) => {
    try {
      await put(`/api/Reservation/${reservationId}/status`, { status })
      // refresh
      const updated = await get(`/api/Reservation/business/${business.businessId}`)
      setReservations(updated)
    } catch (err) {
      console.error('Error updating reservation status:', err)
      alert('Failed to update reservation status.')
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
    <div className="panel reservations-panel">
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
              {confirmed.map(r => (
                <tr key={r.reservationId}>
                  <td>{r.reservationId}</td>
                  <td>{r.productName}</td>
                  <td>{r.customerName}</td>
                  <td>{new Date(r.createdAt).toLocaleString()}</td>
                  <td>
                    <button onClick={() => handleComplete(r.reservationId)}>
                      Mark Completed
                    </button>
                  </td>
                </tr>
              ))}
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
              {pending.map(r => (
                <tr key={r.reservationId}>
                  <td>{r.reservationId}</td>
                  <td>{r.productName}</td>
                  <td>{r.customerName}</td>
                  <td>{new Date(r.createdAt).toLocaleString()}</td>
                  <td>
                    <button onClick={() => handleUpdateStatus(r.reservationId, 'Confirmed')}>
                      Approve
                    </button>{' '}
                    <button onClick={() => handleUpdateStatus(r.reservationId, 'Cancelled')}>
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
