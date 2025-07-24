"use client"

import { useState, useEffect } from "react"
import { useApiClient } from "../hooks/useApiClient"
import "../../../Styling/Settings/settings.css"
import "../../../Styling/Settings/photopanel.css"

export default function PhotoPanel({ business }) {
  const { get, put } = useApiClient()
  const [detail, setDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(true)
  const [profileUrl, setProfileUrl] = useState("")
  const [coverUrl, setCoverUrl] = useState("")
  const [saving, setSaving] = useState(false)

  // 1) Fetch full business record on mount or when business changes
  useEffect(() => {
    if (!business?.businessId) return
    let cancelled = false
    setLoadingDetail(true)
    get(`/api/Business/${business.businessId}`)
      .then((data) => {
        if (cancelled) return
        setDetail(data)
        setProfileUrl(data.profilePictureUrl || "")
        setCoverUrl(data.coverPictureUrl || "")
      })
      .catch((err) => {
        console.error("Failed to load business detail:", err)
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business?.businessId])

  // 2) Upload helper (unchanged)
  const uploadImageToGCS = async (file) => {
    if (!file) return null
    const ts = Date.now()
    const name = `${ts}-${file.name}`
    const imgUrl = `https://storage.googleapis.com/edcms_bucket/${name}`
    const txtUrl = `${imgUrl}.txt`
    const imgRes = await fetch(imgUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    })
    if (!imgRes.ok) throw new Error("Image upload failed")
    const txtRes = await fetch(txtUrl, {
      method: "PUT",
      headers: { "Content-Type": "text/plain" },
      body: imgUrl,
    })
    if (!txtRes.ok) throw new Error("Text upload failed")
    return imgUrl
  }

  // 3) Handlers for selecting new files
  const handleUpload = async (e, setter) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const url = await uploadImageToGCS(file)
      setter(url)
    } catch (err) {
      console.error("Upload error:", err)
      alert("Failed to upload image.")
    }
  }

  // 4) Save handler: send back the full object (to satisfy required Name)
  const handleSave = async () => {
    if (!detail) return
    setSaving(true)
    try {
      await put(`/api/Business/${detail.businessId}`, {
        ...detail,
        profilePictureUrl: profileUrl,
        coverPictureUrl: coverUrl,
      })
      alert("Photos updated successfully!")
    } catch (err) {
      console.error("Save error:", err)
      // show error details if available
      alert(`Save failed: ${err.data?.errors?.Name?.[0] || err.message}`)
    } finally {
      setSaving(false)
    }
  }

  // 5) Loading or error states
  if (loadingDetail) {
    return (
      <div className="panel photo-panel">
        <div className="loading-spinner"></div>
        <p style={{ textAlign: "center", marginTop: "16px" }}>Loading business data…</p>
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="panel photo-panel">
        <p style={{ textAlign: "center", color: "var(--error-500)" }}>Couldn't load business info.</p>
      </div>
    )
  }

  // 6) Render form
  return (
    <div className="panel photo-panel">
      <h3>Edit Profile & Cover Photos</h3>
      <div className="photo-panel-grid">
        <div className="photo-input-group">
          <label>Profile Photo</label>
          <div className="photo-preview-container">
            {profileUrl ? (
              <img src={profileUrl || "/placeholder.svg"} alt="Profile preview" className="photo-preview" />
            ) : (
              <div className="photo-placeholder">No profile photo</div>
            )}
            <button className="photo-upload-button" disabled={saving}>
              <input type="file" accept="image/*" onChange={(e) => handleUpload(e, setProfileUrl)} />
              Choose…
            </button>
          </div>
        </div>

        <div className="photo-input-group">
          <label>Cover Photo</label>
          <div className="photo-preview-container">
            {coverUrl ? (
              <img src={coverUrl || "/placeholder.svg"} alt="Cover preview" className="photo-preview" />
            ) : (
              <div className="photo-placeholder">No cover photo</div>
            )}
            <button className="photo-upload-button" disabled={saving}>
              <input type="file" accept="image/*" onChange={(e) => handleUpload(e, setCoverUrl)} />
              Choose…
            </button>
          </div>
        </div>
      </div>

      <button className="save-button" type="button" onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save Photos"}
      </button>
    </div>
  )
}
