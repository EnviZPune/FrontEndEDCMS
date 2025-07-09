// src/Components/Settings/panels/PendingChangesPanel.js
import React, { useState, useEffect } from 'react'
import { useApiClient } from '../hooks/useApiClient'
import { useAuth } from '../hooks/useAuth'
import '../../../Styling/Settings/settings.css'
import '../../../Styling/Settings/pendingchangespanel.css'

export default function PendingChangesPanel({ business }) {
  const { get, put } = useApiClient()
  const { token }    = useAuth()

  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState(null)
  const [pendingChanges, setPendingChanges] = useState([])

  const [employees, setEmployees] = useState([])
  const [products, setProducts]   = useState([])

  // 1) Fetch employees & products once per business
  useEffect(() => {
    if (!business?.businessId || !token) return
    let cancelled = false

    get(`/api/Business/${business.businessId}/employees`)
      .then(data => { if (!cancelled) setEmployees(data) })
      .catch(console.error)

    get(`/api/ClothingItem/business/${business.businessId}`)
      .then(data => { if (!cancelled) setProducts(data) })
      .catch(console.error)

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business?.businessId, token])

  // 2) Fetch pending changes once per business
  useEffect(() => {
    if (!business?.businessId || !token) return
    let cancelled = false
    setLoading(true)
    setError(null)

    get(`/api/ProposedChanges/pending/${business.businessId}`)
      .then(data => { if (!cancelled) setPendingChanges(data) })
      .catch(err => {
        console.error('Failed to load pending changes:', err)
        if (!cancelled) setError(err)
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => {
      cancelled = true
    }
    // only re-run when businessId or token changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business?.businessId, token])

  const approveChange = async (changeId) => {
    await put(`/api/ProposedChanges/${changeId}?approve=true`)
    const updated = await get(`/api/ProposedChanges/pending/${business.businessId}`)
    setPendingChanges(updated)
  }

  const rejectChange = async (changeId) => {
    await put(`/api/ProposedChanges/${changeId}?approve=false`)
    const updated = await get(`/api/ProposedChanges/pending/${business.businessId}`)
    setPendingChanges(updated)
  }

  if (loading) {
    return (
      <div className="panel pending-changes-panel">
        <p>Loading pending changes…</p>
      </div>
    )
  }
  if (error) {
    return (
      <div className="panel pending-changes-panel">
        <p>Error loading changes.</p>
      </div>
    )
  }
  if (pendingChanges.length === 0) {
    return (
      <div className="panel pending-changes-panel">
        <h3>Pending Changes</h3>
        <p>No pending changes.</p>
      </div>
    )
  }

  // diff-rendering helper (as before)
  const renderDiffs = (changeDetails, clothingItemId) => {
    let parsed = {}
    try { parsed = JSON.parse(changeDetails) } catch { return <p>Invalid details</p> }
    const norm = {}
    Object.entries(parsed).forEach(([k, v]) => {
      norm[k.charAt(0).toLowerCase() + k.slice(1)] = v
    })
    const data = norm.itemDto || norm
    const original = products.find(p => p.clothingItemId === clothingItemId) || {}
    const fields = [
      { key:'name', label:'Name' },
      { key:'description', label:'Description' },
      { key:'price', label:'Price' },
      { key:'quantity', label:'Quantity' },
      { key:'clothingCategoryId', label:'Category' },
      { key:'brand', label:'Brand' },
      { key:'model', label:'Model' },
      { key:'material', label:'Material' },
    ]
    const diffs = fields
      .map(({ key, label }) => {
        const oldVal = original[key], newVal = data[key]
        if (newVal != null && String(oldVal)!==String(newVal)) return { label, oldVal, newVal }
        return null
      })
      .filter(Boolean)

    if (!diffs.length) return <p>No field changes.</p>
    return (
      <table className="diff-table">
        <thead>
          <tr><th>Field</th><th>Current</th><th>Requested</th></tr>
        </thead>
        <tbody>
          {diffs.map(d => (
            <tr key={d.label}>
              <td>{d.label}</td>
              <td>{String(d.oldVal)}</td>
              <td>{String(d.newVal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  return (
    <div className="panel pending-changes-panel">
      <h3>Pending Changes</h3>
      <ul className="pending-list">
        {pendingChanges.map(change => {
          let parsed = {}
          try { parsed = JSON.parse(change.changeDetails) } catch {}
          const photos = parsed.itemDto || parsed
          const employee = employees.find(e => e.userId===change.employeeId)

          return (
            <li key={change.proposedChangeId} className="pending-item">
              <div className="pending-item-header">
                <strong>{change.operationType}</strong>
              </div>
              <div className="pending-item-meta">
                <small><strong>Employee :</strong> {employee?.name||change.employeeId}</small><br/>
                <small><strong>Date and Time of the request :</strong> {new Date(change.createdAt).toLocaleString()}</small>
              </div>
              <div className="change-details-container">
                {change.operationType==='UpdatePhotos'
                  ? (
                    <div className="photo-update-grid">
                      {photos.profilePhotoUrl && (
                        <div className="photo-item">
                          <span>Profile:</span>
                          <img src={photos.profilePhotoUrl} className="photo-preview" />
                        </div>
                      )}
                      {photos.coverPhotoUrl && (
                        <div className="photo-item">
                          <span>Cover:</span>
                          <img src={photos.coverPhotoUrl} className="photo-preview" />
                        </div>
                      )}
                    </div>
                  )
                  : renderDiffs(change.changeDetails, change.clothingItemId)
                }
              </div>
              <div className="pending-item-actions">
                <button onClick={()=>approveChange(change.proposedChangeId)}>Approve</button>
                <button onClick={()=>rejectChange(change.proposedChangeId)}>Reject</button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
