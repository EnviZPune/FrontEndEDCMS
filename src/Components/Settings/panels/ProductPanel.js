"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useApiClient } from "../hooks/useApiClient"
import { useAuth } from "../hooks/useAuth"
import Pagination from "../../Pagination.tsx"
import "../../../Styling/Settings/productpanel.css"

// Base for the ClothingItem controller (useApiClient should prefix /api)
const CLOTHING_ITEM_API = "/ClothingItem"

export default function ProductPanel({ business }) {
  const { t } = useTranslation("productpanel")
  const { get, post, put, del } = useApiClient()
  const { role, userInfo } = useAuth()
  const fileInputRef = useRef(null)

  // keep a stable reference to get to avoid effect loops
  const getRef = useRef(get)
  useEffect(() => { getRef.current = get }, [get])

  // ─── State ───────────────────────────────────────────────────────────────
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [saleLoadingId, setSaleLoadingId] = useState(null)
  const pageSize = 10

  // NEW: pin state
  const [pinnedIds, setPinnedIds] = useState(() => new Set())
  const [pinLoadingId, setPinLoadingId] = useState(null)

  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    quantity: "",
    categoryId: "",
    brand: "",
    model: "",
    photos: [],
    colors: "",
    size: "",
    material: "",
  })

  const [mainPhotoIndex, setMainPhotoIndex] = useState(0)
  const [dragOver, setDragOver] = useState(false)

  const businessId = business?.businessId

  // ─── Helpers ─────────────────────────────────────────────────────────────
  const validateForm = useCallback(() => {
    const errors = []
    if (!form.name.trim()) errors.push(t("products.errors.name_required", { defaultValue: "Product name is required" }))
    if (!form.price || Number.parseFloat(form.price) <= 0) errors.push(t("products.errors.price_required", { defaultValue: "Valid price is required" }))
    if (!form.quantity || Number.parseInt(form.quantity, 10) < 0) errors.push(t("products.errors.quantity_required", { defaultValue: "Valid quantity is required" }))
    return errors
  }, [form.name, form.price, form.quantity, t])

  function myDisplayName(ui) {
    const full = `${ui?.firstName ?? ""} ${ui?.lastName ?? ""}`.trim()
    if (full) return full
    if (ui?.name) return ui.name
    if (ui?.email) return ui.email.split("@")[0]
    return undefined
  }

  // Normalize pinned payload (supports PaginatedResult or arrays)
  const normalizePinned = useCallback((payload) => {
    if (!payload) return new Set()
    // Accept common shapes: { items: [...] } | { data: [...] } | { results: [...] } | [...]
    const arr =
      Array.isArray(payload) ? payload :
      Array.isArray(payload.items) ? payload.items :
      Array.isArray(payload.data) ? payload.data :
      Array.isArray(payload.results) ? payload.results :
      []
    const ids = arr
      .map(x => (typeof x === "number" ? x : x?.clothingItemId))
      .filter(Boolean)
    return new Set(ids)
  }, [])

  // ─── Load Data ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!businessId) return
    let cancelled = false

    const loadData = async () => {
      setLoading(true)
      setError(null)
      try {
        const [prods, cats, pins] = await Promise.all([
          getRef.current(`/ClothingItem/business/${businessId}`),
          getRef.current(`/ClothingCategory/business/${businessId}`),
          // fetch pinned items (big page so we get all ids)
          getRef.current(`${CLOTHING_ITEM_API}/clothingItems/${businessId}/pinned?pageNumber=1&pageSize=1000`),
        ])
        if (!cancelled) {
          setProducts(prods || [])
          setCategories(cats || [])
          setPinnedIds(normalizePinned(pins))
        }
      } catch (err) {
        console.error("Load error:", err)
        if (!cancelled) {
          setError(t("products.errors.load_failed", { defaultValue: "Failed to load data. Please try again." }))
          setProducts([]); setCategories([])
          setPinnedIds(new Set())
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadData()
    return () => { cancelled = true }
  }, [businessId, t, normalizePinned])

  // Reset page when search or products change
  useEffect(() => { setPage(1) }, [searchQuery, products.length])

  // ─── Upload helpers ──────────────────────────────────────────────────────
  const uploadImageToGCS = useCallback(async (file) => {
    if (!file) return null
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) throw new Error(t("products.errors.file_too_large", { defaultValue: "File size must be less than 5MB" }))

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if (!allowedTypes.includes(file.type)) throw new Error(t("products.errors.bad_filetype", { defaultValue: "Only JPEG, PNG, WebP, and GIF images are allowed" }))

    const ts = Date.now()
    const name = `${ts}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`
    const imgUrl = `https://storage.googleapis.com/edcms_bucket/${name}`
    const txtUrl = `${imgUrl}.txt`

    await fetch(imgUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file })
    await fetch(txtUrl, { method: "PUT", headers: { "Content-Type": "text/plain" }, body: imgUrl })
    return imgUrl
  }, [t])

  const handleFileUpload = useCallback(async (files) => {
    if (!files || files.length === 0) return
    setUploading(true); setError(null)
    try {
      const filesToUpload = Array.from(files).slice(0, 10 - form.photos.length)
      const uploadedUrls = await Promise.all(filesToUpload.map(uploadImageToGCS))
      const validUrls = uploadedUrls.filter(Boolean)
      if (validUrls.length > 0) {
        setForm((prev) => ({ ...prev, photos: [...prev.photos, ...validUrls] }))
        setMainPhotoIndex((prevIndex) => (form.photos.length === 0 ? 0 : prevIndex))
      }
    } catch (err) {
      console.error("Upload error:", err)
      setError(err?.message || t("products.errors.upload_failed", { defaultValue: "Failed to upload images" }))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }, [form.photos.length, uploadImageToGCS, t])

  // Drag & drop
  const handleDragOver = useCallback((e) => { e.preventDefault(); setDragOver(true) }, [])
  const handleDragLeave = useCallback((e) => { e.preventDefault(); setDragOver(false) }, [])
  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false)
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"))
    if (files.length > 0) handleFileUpload(files)
  }, [handleFileUpload])

  // ─── CRUD ────────────────────────────────────────────────────────────────
  const resetForm = useCallback(() => {
    setEditingId(null)
    setForm({
      name: "", description: "", price: "", quantity: "",
      categoryId: "", brand: "", model: "", photos: [],
      colors: "", size: "", material: "",
    })
    setMainPhotoIndex(0); setError(null)
  }, [])

  const saveProduct = useCallback(async () => {
    if (!businessId) return
    const validationErrors = validateForm()
    if (validationErrors.length > 0) { setError(validationErrors.join(", ")); return }

    setLoading(true); setError(null)
    try {
      const orderedPhotos = form.photos.length > 0
        ? [form.photos[mainPhotoIndex], ...form.photos.filter((_, idx) => idx !== mainPhotoIndex)]
        : []

      const dto = {
        name: form.name.trim(),
        businessIds: [businessId],
        description: form.description.trim(),
        price: Number.parseFloat(form.price) || 0,
        quantity: Number.parseInt(form.quantity, 10) || 0,
        clothingCategoryId: form.categoryId ? +form.categoryId : null,
        brand: form.brand.trim(),
        model: form.model.trim(),
        pictureUrls: orderedPhotos,
        colors: form.colors.split(",").map((s) => s.trim()).filter(Boolean),
        sizes: (form.size || "").trim(),
        material: form.material.trim(),
      }

      if (role === "employee") {
        await post("/ProposedChanges/submit", {
          businessId, type: editingId ? "Update" : "Create",
          itemDto: { ...dto, clothingItemId: editingId || 0 },
        })
        alert(t("products.alerts.change_proposed", { defaultValue: "Your change has been proposed and is pending approval." }))
      } else {
        if (editingId) await put(`/ClothingItem/${editingId}`, dto)
        else await post("/ClothingItem", dto)

        const updated = await getRef.current(`/ClothingItem/business/${businessId}`)
        setProducts(updated || [])
        alert(t("products.alerts.saved", { defaultValue: "Product saved successfully!" }))
      }

      resetForm()
    } catch (err) {
      console.error("Save error detail:", err)
      setError(
        err?.message
          ? t("products.errors.save_failed_with_reason", { defaultValue: "Failed to save product: {{reason}}", reason: err.message })
          : t("products.errors.save_failed", { defaultValue: "Failed to save product. Please check console/network for details." })
      )
    } finally { setLoading(false) }
  }, [businessId, validateForm, form, mainPhotoIndex, editingId, role, post, put, resetForm, t])

  const handleDelete = useCallback(async (id) => {
    if (!businessId) return
    const confirmMessage =
      role === "employee"
        ? t("products.confirms.delete_request", { defaultValue: "Submit delete request for approval?" })
        : t("products.confirms.delete_permanent", { defaultValue: "Permanently delete this product?" })

    if (!window.confirm(confirmMessage)) return

    setLoading(true); setError(null)
    try {
      if (role === "employee") {
        await post("/ProposedChanges/submit", {
          businessId, type: "Delete",
          itemDto: { clothingItemId: id, businessIds: [businessId] },
        })
        alert(t("products.alerts.delete_proposed", { defaultValue: "Delete request submitted for approval." }))
      } else {
        await del(`/ClothingItem/${id}`)
        const updated = await getRef.current(`/ClothingItem/business/${businessId}`)
        setProducts(updated || [])
        // keep pinnedIds in sync
        setPinnedIds(prev => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        alert(t("products.alerts.deleted", { defaultValue: "Product deleted successfully." }))
      }
    } catch (err) {
      console.error("Delete error detail:", err)
      setError(
        err?.message
          ? t("products.errors.delete_failed_with_reason", { defaultValue: "Failed to delete product: {{reason}}", reason: err.message })
          : t("products.errors.delete_failed", { defaultValue: "Failed to delete product. Please check console/network for details." })
      )
    } finally { setLoading(false) }
  }, [businessId, role, post, del, t])

  const startEdit = useCallback((product) => {
    setEditingId(product.clothingItemId)
    setForm({
      name: product.name || "",
      description: product.description || "",
      price: product.price?.toString() || "",
      quantity: product.quantity?.toString() || "",
      categoryId: product.clothingCategoryId?.toString() || "",
      brand: product.brand || "",
      model: product.model || "",
      photos: product.pictureUrls || [],
      colors: Array.isArray(product.colors) ? product.colors.join(", ") : product.colors || "",
      size: Array.isArray(product.sizes) ? product.sizes.join(", ") : product.sizes?.toString() || "",
      material: product.material || "",
    })
    setMainPhotoIndex(0); setError(null)
  }, [])

  const removePhoto = useCallback((indexToRemove) => {
    setForm((prev) => ({ ...prev, photos: prev.photos.filter((_, idx) => idx !== indexToRemove) }))
    setMainPhotoIndex((prevIndex) => (indexToRemove === prevIndex ? 0 : indexToRemove < prevIndex ? prevIndex - 1 : prevIndex))
  }, [])

  // ✅ Record Sale: send soldByName so Sales shows the real employee name
  const handleSale = useCallback(async (product) => {
    if (!businessId) { setError(t("products.errors.select_business_first", { defaultValue: "Select a business first." })); return; }

    const seller = myDisplayName(userInfo) || undefined

    try {
      setSaleLoadingId(product.clothingItemId)
      await post(`/Sales/ClothingItem/${product.clothingItemId}/sale`, {
        quantity: 1,
        businessId: Number(businessId),
        soldByName: seller,
      })

      // Optimistic qty update
      setProducts(prev =>
        prev.map(p =>
          p.clothingItemId === product.clothingItemId
            ? { ...p, quantity: Math.max((p.quantity ?? 0) - 1, 0) }
            : p
        )
      )

      // Notify SalesPanel to refresh
      window.dispatchEvent(new CustomEvent("sale-recorded", { detail: { businessId } }))
    } catch (err) {
      console.error("Sale error:", err)
      setError(err?.message || t("products.errors.sale_failed", { defaultValue: "Failed to record sale." }))
    } finally {
      setSaleLoadingId(null)
    }
  }, [businessId, post, userInfo, t])

  // NEW: Pin helpers
  const isPinned = useCallback((id) => pinnedIds.has(id), [pinnedIds])

  const togglePin = useCallback(async (product) => {
    if (!businessId) return
    const id = product.clothingItemId
    const currentlyPinned = isPinned(id)

    try {
      setPinLoadingId(id)
      if (currentlyPinned) {
        // Unpin (PUT)
        await put(`${CLOTHING_ITEM_API}/business/${businessId}/items/${id}/unpin`)
        setPinnedIds(prev => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      } else {
        // Pin (PUT) - add ?order= if you support ordering
        await put(`${CLOTHING_ITEM_API}/business/${businessId}/items/${id}/pin`)
        setPinnedIds(prev => {
          const next = new Set(prev)
          next.add(id)
          return next
        })
      }
    } catch (err) {
      console.error("Pin toggle error:", err)
      setError(err?.message || t("products.errors.pin_failed", { defaultValue: "Failed to toggle pin." }))
    } finally {
      setPinLoadingId(null)
    }
  }, [businessId, isPinned, put, t])

  // ─── Filter & Pagination ─────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    return products.filter((product) =>
      [product.name, product.brand, product.model, product.description]
        .join(" ")
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
    )
  }, [products, searchQuery])

  const totalCount = filteredProducts.length
  const paginatedProducts = useMemo(() => {
    return filteredProducts.slice((page - 1) * pageSize, page * pageSize)
  }, [filteredProducts, page, pageSize])

  // ─── Render ──────────────────────────────────────────────────────────────
  if (!business) {
    return (
      <div className="panel">
        <div className="no-business-selected">
          <h3>{t("products.empty.no_business_title", { defaultValue: "No Business Selected" })}</h3>
          <p>{t("products.empty.no_business_desc", { defaultValue: "Please select a business to manage products." })}</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Error Display */}
      {error && (
        <div className="panel error">
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            <div>
              <h4>{t("common.error", { defaultValue: "Error" })}</h4>
              <p>{error}</p>
            </div>
            <button onClick={() => setError(null)} className="error-close" aria-label={t("common.close", { defaultValue: "Close" })}>×</button>
          </div>
        </div>
      )}

      {/* Product Form */}
      <div className="panel product-form">
        <h3>
          <span className="panel-icon">📦</span>
          {editingId
            ? t("products.titles.edit", { defaultValue: "Edit Product" })
            : t("products.titles.add", { defaultValue: "Add New Product" })}
        </h3>

        <div className="form-group">
          <div className="grid two-cols">
            <div className="form-group">
              <label htmlFor="product-name">{t("products.fields.name_req", { defaultValue: "Product Name *" })}</label>
              <input
                id="product-name"
                placeholder={t("products.placeholders.name", { defaultValue: "Enter product name" })}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="product-brand">{t("products.fields.brand", { defaultValue: "Brand" })}</label>
              <input
                id="product-brand"
                placeholder={t("products.placeholders.brand", { defaultValue: "Enter brand name" })}
                value={form.brand}
                onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                disabled={loading}
              />
            </div>
          </div>
        </div>

        <div className="form-group">
          <div className="grid two-cols">
            <div className="form-group">
              <label htmlFor="product-model">{t("products.fields.model", { defaultValue: "Model" })}</label>
              <input
                id="product-model"
                placeholder={t("products.placeholders.model", { defaultValue: "Enter model" })}
                value={form.model}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="product-price">{t("products.fields.price_req", { defaultValue: "Price in LEK *" })}</label>
              <input
                id="product-price"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                disabled={loading}
              />
            </div>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="product-description">{t("products.fields.description", { defaultValue: "Description" })}</label>
          <textarea
            id="product-description"
            placeholder={t("products.placeholders.description", { defaultValue: "Enter product description" })}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <div className="grid three-cols">
            <div className="form-group">
              <label htmlFor="product-quantity">{t("products.fields.quantity_req", { defaultValue: "Quantity *" })}</label>
              <input
                id="product-quantity"
                type="number"
                min="0"
                placeholder="0"
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="product-category">{t("products.fields.category", { defaultValue: "Category" })}</label>
              <select
                id="product-category"
                value={form.categoryId}
                onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                disabled={loading}
              >
                <option value="">{t("products.placeholders.category", { defaultValue: "Select category..." })}</option>
                {categories.map((c) => (
                  <option key={c.clothingCategoryId} value={c.clothingCategoryId}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="product-size">{t("products.fields.size", { defaultValue: "Size" })}</label>
              <input
                id="product-size"
                placeholder={t("products.placeholders.size", { defaultValue: "e.g. M, 32W, One-Size" })}
                value={form.size}
                onChange={(e) => setForm((f) => ({ ...f, size: e.target.value }))}
                disabled={loading}
              />
            </div>
          </div>
        </div>

        <div className="form-group">
          <div className="grid two-cols">
            <div className="form-group">
              <label htmlFor="product-colors">{t("products.fields.colors", { defaultValue: "Colors" })}</label>
              <input
                id="product-colors"
                placeholder={t("products.placeholders.colors", { defaultValue: "Red, Blue, Green (comma separated)" })}
                value={form.colors}
                onChange={(e) => setForm((f) => ({ ...f, colors: e.target.value }))}
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="product-material">{t("products.fields.material", { defaultValue: "Material" })}</label>
              <input
                id="product-material"
                placeholder={t("products.placeholders.material", { defaultValue: "Cotton, Polyester, etc." })}
                value={form.material}
                onChange={(e) => setForm((f) => ({ ...f, material: e.target.value }))}
                disabled={loading}
              />
            </div>
          </div>
        </div>

        {/* Photos */}
        <div className="form-group">
          <label>{t("products.fields.photos", { defaultValue: "Product Photos" })}</label>
          <label className="file-btn" disabled={uploading || loading}>
            {uploading ? t("products.upload.uploading", { defaultValue: "⏳ Uploading..." }) : t("products.upload.button", { defaultValue: "📁 Upload Photos" })}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleFileUpload(e.target.files)}
              disabled={uploading || loading}
            />
          </label>

          <div
            className={`photo-row ${dragOver ? "drag-over" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {form.photos.length === 0 && !uploading && (
              <div className="empty-photos">
                {t("products.upload.drop_hint", { defaultValue: "📸 Drop photos here or click upload button" })}
              </div>
            )}

            {form.photos.map((url, index) => (
              <div
                key={`${url}-${index}`}
                className={`thumb ${index === mainPhotoIndex ? "selected" : ""}`}
                onClick={() => setMainPhotoIndex(index)}
                title={
                  index === mainPhotoIndex
                    ? t("products.upload.main_photo_title", { defaultValue: "Main photo" })
                    : t("products.upload.set_main_title", { defaultValue: "Click to set as main photo" })
                }
              >
                <img src={url || "/placeholder.svg"} alt={t("products.upload.photo_alt", { defaultValue: "Product photo {{n}}", n: index + 1 })} />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removePhoto(index) }}
                  disabled={loading}
                  title={t("products.upload.remove", { defaultValue: "Remove photo" })}
                >
                  ×
                </button>
                {index === mainPhotoIndex && <div className="main-photo-badge">{t("products.upload.main_badge", { defaultValue: "Main" })}</div>}
              </div>
            ))}

            {uploading && (
              <div className="upload-progress"><div className="loading-spinner"></div></div>
            )}
          </div>

          {form.photos.length > 0 && (
            <p className="photo-help">
              {t("products.upload.help", { defaultValue: "Click a photo to set it as the main image. Max 10 photos." })}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="actions">
          <button onClick={saveProduct} disabled={loading || uploading} className="primary">
            {loading
              ? t("common.saving", { defaultValue: "⏳ Saving..." })
              : editingId
                ? t("products.actions.update", { defaultValue: "Update Product" })
                : t("products.actions.add", { defaultValue: "Add Product" })}
          </button>
          {editingId && (
            <button onClick={resetForm} disabled={loading} className="secondary">
              {t("common.cancel", { defaultValue: "Cancel" })}
            </button>
          )}
        </div>
      </div>

      {/* Products List */}
      <div className="panel product-list">
        <h3>
          <span className="panel-icon">📋</span>
          {t("products.list.title_with_count", { defaultValue: "Products ({{count}})", count: totalCount })}
        </h3>

        <div className="product-list-content">
          <div className="form-group">
            <input
              className="search"
              type="text"
              placeholder={t("products.search.placeholder", { defaultValue: "Search products..." })}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={loading}
            />
          </div>

          {loading && products.length === 0 ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>{t("products.list.loading", { defaultValue: "Loading products..." })}</p>
            </div>
          ) : (
            <ul>
              {paginatedProducts.length > 0 ? (
                paginatedProducts.map((p) => {
                  const pinned = isPinned(p.clothingItemId)
                  return (
                    <li key={p.clothingItemId}>
                      <div className="product-name">
                        {p.name}{p.brand && <span className="product-brand"> - {p.brand}</span>}
                        {pinned && (
                          <span
                            title={t("products.pin.pinned_badge", { defaultValue: "Pinned" })}
                            style={{ marginLeft: 8, fontSize: "0.95em", verticalAlign: "middle" }}
                          >
                            📌
                          </span>
                        )}
                      </div>
                      <div className="product-details">
                        {p.model && <span>{t("products.badges.model", { defaultValue: "Model" })}: {p.model}</span>}
                        <span className="price">{t("products.badges.price", { defaultValue: "Price" })}: LEK {p.price}</span>
                        {p.sizes && <span>{t("products.badges.size", { defaultValue: "Size" })}: {p.sizes}</span>}
                        <span className="quantity">{t("products.badges.qty", { defaultValue: "Qty" })}: {p.quantity}</span>
                      </div>
                      <div className="btns">
                        <button onClick={() => startEdit(p)} disabled={loading} className="edit">✏️ {t("common.edit", { defaultValue: "Edit" })}</button>
                        <button onClick={() => handleDelete(p.clothingItemId)} disabled={loading} className="delete">🗑️ {t("common.delete", { defaultValue: "Delete" })}</button>

                        {/* NEW: Pin / Unpin */}
                        <button
                          onClick={() => togglePin(p)}
                          disabled={loading || pinLoadingId === p.clothingItemId}
                          className={`pin ${pinLoadingId === p.clothingItemId ? "loading" : ""}`}
                          title={
                            pinned
                              ? t("products.pin.unpin_tooltip", { defaultValue: "Unpin this product" })
                              : t("products.pin.pin_tooltip", { defaultValue: "Pin this product" })
                          }
                          style={{
                            backgroundColor: pinned ? "#f59e0b" : "#0ea5e9",
                            color: "#fff",
                            border: "none",
                            borderRadius: "8px",
                            padding: "8px 12px",
                            fontWeight: 600,
                          }}
                        >
                          {pinLoadingId === p.clothingItemId
                            ? t("products.pin.toggling", { defaultValue: "Updating…" })
                            : pinned
                              ? t("products.pin.unpin", { defaultValue: "Unpin" })
                              : t("products.pin.pin", { defaultValue: "Pin" })}
                        </button>

                        <button
                          onClick={() => handleSale(p)}
                          className={`sale ${saleLoadingId === p.clothingItemId ? "loading" : ""}`}
                          disabled={loading || saleLoadingId === p.clothingItemId || (p.quantity ?? 0) <= 0}
                          title={t("products.sale.tooltip", { defaultValue: "Record a sale (reduce stock by 1)" })}
                          style={{
                            backgroundColor: "#16a34a",
                            color: "#fff",
                            border: "none",
                            borderRadius: "8px",
                            padding: "8px 12px",
                            fontWeight: 600,
                          }}
                        >
                          {saleLoadingId === p.clothingItemId ? t("products.sale.selling", { defaultValue: "Selling…" }) : t("products.sale.button", { defaultValue: "Sale" })}
                        </button>
                      </div>
                    </li>
                  )
                })
              ) : (
                <li className="no-results">
                  {searchQuery
                    ? t("products.search.no_match", { defaultValue: "No products match your search." })
                    : t("products.list.empty", { defaultValue: "No products found." })}
                </li>
              )}
            </ul>
          )}

          {totalCount > pageSize && (
            <Pagination
              page={page}
              pageSize={pageSize}
              totalCount={totalCount}
              onPageChange={setPage}
              maxButtons={5}
            />
          )}
        </div>
      </div>
    </>
  )
}
