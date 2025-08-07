"use client"

import { useState, useEffect, useCallback } from "react"
import { useApiClient } from "../hooks/useApiClient"
import Cropper from "react-easy-crop"
import "../../../Styling/Settings/settings.css"
import "../../../Styling/Settings/photopanel.css"

// Utility to create an HTMLImageElement from a data URL
const createImage = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.addEventListener("load", () => resolve(img))
    img.addEventListener("error", (err) => reject(err))
    img.src = url
  })

// Utility to crop the image in a canvas and return a Blob
async function getCroppedImg(imageSrc, pixelCrop) {
  const image = await createImage(imageSrc)
  const canvas = document.createElement("canvas")
  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height
  const ctx = canvas.getContext("2d")

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  )

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob)
    }, "image/jpeg")
  })
}

export default function PhotoPanel({ business }) {
  const { get, put } = useApiClient()
  const [detail, setDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(true)
  const [profileUrl, setProfileUrl] = useState("")
  const [coverUrl, setCoverUrl] = useState("")
  const [saving, setSaving] = useState(false)

  // cropping state
  const [cropModalOpen, setCropModalOpen] = useState(false)
  const [rawImage, setRawImage] = useState(null)              // dataURL of selected file
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [targetSetter, setTargetSetter] = useState(null)      // will be either setProfileUrl or setCoverUrl

  // Fetch business detail
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
      .catch((err) => console.error("Failed to load business detail:", err))
      .finally(() => { if (!cancelled) setLoadingDetail(false) })
    return () => { cancelled = true }
  }, [business?.businessId])

  // unchanged upload helper
  const uploadImageToGCS = async (file) => {
    if (!file) return null
    const ts = Date.now()
    const name = `${ts}-${file.name || "cropped"}.jpg`
    const imgUrl = `https://storage.googleapis.com/edcms_bucket/${name}`
    const txtUrl = `${imgUrl}.txt`

    const imgRes = await fetch(imgUrl, {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
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

  // When a file is selected: read as Data URL and open crop modal
  const handleFileSelect = (e, setter) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setRawImage(reader.result)
      setTargetSetter(() => setter)
      setCropModalOpen(true)
    }
    reader.readAsDataURL(file)
  }

  // Crop complete callback
  const onCropComplete = useCallback((_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels)
  }, [])

  // When user confirms the crop & upload
  const handleCropUpload = async () => {
    try {
      const blob = await getCroppedImg(rawImage, croppedAreaPixels)
      const url = await uploadImageToGCS(blob)
      targetSetter(url)
    } catch (err) {
      console.error("Crop & upload error:", err)
      alert("Failed to crop or upload image.")
    } finally {
      setCropModalOpen(false)
      setRawImage(null)
      setZoom(1)
      setCrop({ x: 0, y: 0 })
    }
  }

  // Save handler
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
      alert(`Save failed: ${err.data?.errors?.Name?.[0] || err.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (loadingDetail) {
    return (
      <div className="panel photo-panel">
        <div className="loading-spinner"></div>
        <p style={{ textAlign: "center", marginTop: 16 }}>Loading business data…</p>
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="panel photo-panel">
        <p style={{ textAlign: "center", color: "var(--error-500)" }}>
          Couldn't load business info.
        </p>
      </div>
    )
  }

  return (
    <div className="photo-panel">
      <h3>Edit Profile & Cover Photos</h3>
      <div className="photo-panel-grid">
        {/* Profile */}
        <div className="photo-input-group">
          <label>Profile Photo</label>
          <div className="photo-preview-container">
            {profileUrl ? (
              <img src={profileUrl} alt="Profile preview" className="photo-preview" />
            ) : (
              <div className="photo-placeholder">No profile photo</div>
            )}
            <button className="photo-upload-button" disabled={saving}>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileSelect(e, setProfileUrl)}
              />
              +
            </button>
          </div>
        </div>

        {/* Cover */}
        <div className="photo-input-group">
          <label>Cover Photo</label>
          <div className="photo-preview-container">
            {coverUrl ? (
              <img src={coverUrl} alt="Cover preview" className="photo-preview" />
            ) : (
              <div className="photo-placeholder">No cover photo</div>
            )}
            <button className="photo-upload-button" disabled={saving}>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileSelect(e, setCoverUrl)}
              />
              +
            </button>
          </div>
        </div>
      </div>

      <button
        className="save-button"
        type="button"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? "Saving…" : "Save Photos"}
      </button>

      {/* Crop Modal */}
      {cropModalOpen && (
        <div className="crop-modal-overlay">
          <div className="crop-modal">
            <Cropper
              image={rawImage}
              crop={crop}
              zoom={zoom}
              aspect={targetSetter === setProfileUrl ? 1 / 1 : 16 / 9}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
            <div className="crop-controls">
              <label>
                Zoom
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  onChange={(e) => setZoom(e.target.value)}
                />
              </label>
              <button onClick={handleCropUpload}>Crop & Upload</button>
              <button onClick={() => setCropModalOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
