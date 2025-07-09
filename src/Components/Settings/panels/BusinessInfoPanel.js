// src/Components/Settings/panels/BusinessInfoPanel.js
import React, { useState, useEffect } from 'react'
import { useApiClient } from '../hooks/useApiClient'
import '../../../Styling/Settings/settings.css'
import '../../../Styling/Settings/businessinfopanel.css'

export default function BusinessInfoPanel({ business }) {
  const { get, put } = useApiClient()
  const [loading, setLoading] = useState(true)
  const [detail, setDetail]   = useState(null)
  const [form, setForm] = useState({
    name: '',
    description: '',
    nipt: '',
    address: '',
    location: '',
    openingHours: '',
    businessPhoneNumber: '',
  })

  // Fetch the full business details once, when the ID changes
  useEffect(() => {
    if (!business?.businessId) return

    let cancelled = false
    setLoading(true)

    get(`/api/Business/${business.businessId}`)
      .then(data => {
        if (cancelled) return
        setDetail(data)
        setForm({
          name:                data.name || '',
          description:         data.description || '',
          nipt:                data.nipt || '',
          address:             data.address || '',
          location:            data.location || '',
          openingHours:        data.openingHours || '',
          businessPhoneNumber: data.businessPhoneNumber || '',
        })
      })
      .catch(err => {
        console.error('Failed to load business details:', err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // we only want to re-run this when the ID changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business?.businessId])

  if (loading) {
    return (
      <div className="panel business-info-panel">
        <p>Loading business info…</p>
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="panel business-info-panel">
        <p>Error loading business info.</p>
      </div>
    )
  }

  const handleSave = async () => {
    try {
      await put(`/api/Business/${detail.businessId}`, {
        ...detail,
        ...form,
      })
      alert('Business info updated!')
    } catch (err) {
      console.error('Save failed:', err)
      alert('Failed to save business info.')
    }
  }

  return (
    <div className="panel business-info-panel">
      <h3>Edit Business Info</h3>

      <label><b>Business Name</b></label>
      <input
        type="text"
        value={form.name}
        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
      />

      <label><b>Description</b></label>
      <textarea
        value={form.description}
        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
      />

      <label><b>NIPT</b></label>
      <input
        type="text"
        value={form.nipt}
        onChange={e => setForm(f => ({ ...f, nipt: e.target.value }))}
      />

      <label><b>Address</b></label>
      <input
        type="text"
        value={form.address}
        onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
      />

      <label><b>Location</b></label>
      <input
        type="text"
        value={form.location}
        onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
      />

      <label><b>Opening Hours</b></label>
      <input
        type="text"
        value={form.openingHours}
        onChange={e => setForm(f => ({ ...f, openingHours: e.target.value }))}
      />

      <label><b>Business Phone Number</b></label>
      <input
        type="tel"
        value={form.businessPhoneNumber}
        onChange={e => setForm(f => ({ ...f, businessPhoneNumber: e.target.value }))}
      />

      <button type="button" onClick={handleSave}>
        Save Changes
      </button>
    </div>
  )
}
