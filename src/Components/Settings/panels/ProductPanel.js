"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useApiClient } from "../hooks/useApiClient"
import { useAuth } from "../hooks/useAuth"
import Pagination from "../../Pagination.tsx"
import "../../../Styling/Settings/productpanel.css"

const CLOTHING_ITEM_API = "/ClothingItem"

export default function ProductPanel({ business }) {
  const { t } = useTranslation("productpanel")
  const { get, post, put, del } = useApiClient()
  const { role, userInfo } = useAuth()
  const fileInputRef = useRef(null)

  // Keep latest get in a ref so effects/callbacks don’t rebind unnecessarily
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

  // Pin state
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

  // businessId coming from parent (ensure number)
  const businessId = business?.businessId
  const bId = Number(businessId)
  const validBusinessId = Number.isInteger(bId) && bId > 0

  // ─── Helpers ─────────────────────────────────────────────────────────────
  const validateForm = useCallback(() => {
    const errors = []
    if (!form.name.trim()) errors.push(t("products.errors.name_required", { defaultValue: "Product name is required" }))

    const priceNum = Number.parseFloat(form.price)
    if (form.price === "" || Number.isNaN(priceNum) || priceNum <= 0) {
      errors.push(t("products.errors.price_required", { defaultValue: "Valid price is required" }))
    }

    const qtyNum = Number.parseInt(form.quantity, 10)
    if (form.quantity === "" || Number.isNaN(qtyNum) || qtyNum < 0) {
      errors.push(t("products.errors.quantity_required", { defaultValue: "Valid quantity is required" }))
    }

    if (!validBusinessId) errors.push(t("products.errors.select_business_first", { defaultValue: "Select a business first." }))
    return errors
  }, [form.name, form.price, form.quantity, t, validBusinessId])

  function myDisplayName(ui) {
    const full = `${ui?.firstName ?? ""} ${ui?.lastName ?? ""}`.trim()
    if (full) return full
    if (ui?.name) return ui.name
    if (ui?.email) return ui.email.split("@")[0]
    return undefined
  }

  const normalizePinned = useCallback((payload) => {
    if (!payload) return new Set()
    const arr =
      Array.isArray(payload) ? payload :
      Array.isArray(payload?.items) ? payload.items :
      Array.isArray(payload?.data) ? payload.data :
      Array.isArray(payload?.results) ? payload.results :
      []
    const ids = arr
      .map((x) => (typeof x === "number" ? x : x?.clothingItemId))
      .filter((v) => Number.isInteger(v))
    return new Set(ids)
  }, [])

  // ─── Data loaders ────────────────────────────────────────────────────────
  const loadAllProducts = useCallback(async (bizId) => {
    const res = await getRef.current(`/ClothingItem/business/${bizId}`)
    const items =
      Array.isArray(res) ? res :
      (Array.isArray(res?.items) ? res.items :
      (Array.isArray(res?.data) ? res.data :
      (Array.isArray(res?.results) ? res.results : [])))
    setProducts(items || [])
  }, [])

  const loadCategories = useCallback(async (bizId) => {
    const cats = await getRef.current(`/ClothingCategory/business/${bizId}`)
    setCategories(cats || [])
  }, [])

  const loadPinned = useCallback(async (bizId) => {
    const pins = await getRef.current(`${CLOTHING_ITEM_API}/clothingItems/${bizId}/pinned?pageNumber=1&pageSize=1000`)
    setPinnedIds(normalizePinned(pins))
  }, [normalizePinned])

  useEffect(() => {
    if (!validBusinessId) return
    let cancelled = false

    const loadData = async () => {
      setLoading(true)
      setError(null)
      try {
        await Promise.all([
          loadAllProducts(bId),
          loadCategories(bId),
          loadPinned(bId),
        ])
      } catch (err) {
        console.error("Load error:", err)
        if (!cancelled) {
          setError(t("products.errors.load_failed", { defaultValue: "Failed to load data. Please try again." }))
          setProducts([])
          setCategories([])
          setPinnedIds(new Set())
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadData()
    return () => { cancelled = true }
  }, [validBusinessId, bId, t, loadAllProducts, loadCategories, loadPinned])

  // Reset to page 1 when search or list size changes
  useEffect(() => { setPage(1) }, [searchQuery, products.length])

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return products
    return products.filter((product) =>
      [product.name, product.brand, product.model, product.description]
        .map((s) => (s || "").toString().toLowerCase())
        .join(" ")
        .includes(q)
    )
  }, [products, searchQuery])

  const totalCount = filteredProducts.length
  useEffect(() => {
    const maxPages = Math.max(1, Math.ceil(totalCount / pageSize))
    if (page > maxPages) setPage(maxPages)
  }, [totalCount, page, pageSize])

  const paginatedProducts = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredProducts.slice(start, start + pageSize)
  }, [filteredProducts, page, pageSize])

  // ─── Upload helpers ──────────────────────────────────────────────────────
  const uploadImageToGCS = useCallback(async (file) => {
    if (!file) return null
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) throw new Error(t("products.errors.file_too_large", { defaultValue: "File size must be less than 5MB" }))
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if (!allowedTypes.includes(file.type)) throw new Error(t("products.errors.bad_filetype", { defaultValue: "Only JPEG, PNG, WebP, and GIF images are allowed" }))

    const ts = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
    const objectName = `${ts}-${safeName}`
    const encoded = encodeURIComponent(objectName)
    const imgUrl = `https://storage.googleapis.com/edcms_bucket/${encoded}`
    const txtUrl = `${imgUrl}.txt`

    const putImg = await fetch(imgUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file })
    if (!putImg.ok) {
      let text = ""
      try { text = await putImg.text() } catch {}
      throw new Error(`Upload failed (${putImg.status}) ${text}`)
    }
    // best-effort text sidecar
    await fetch(txtUrl, { method: "PUT", headers: { "Content-Type": "text/plain" }, body: imgUrl }).catch(() => {})

    return imgUrl
  }, [t])

  const handleFileUpload = useCallback(async (files) => {
    if (!files || files.length === 0) return
    setUploading(true); setError(null)
    try {
      const list = Array.from(files)
      const filesToUpload = list.slice(0, Math.max(0, 10 - form.photos.length))
      const uploadedUrls = await Promise.all(list.slice(0, filesToUpload.length).map(uploadImageToGCS))
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

  // Build camelCase DTO for ClothingItem endpoints
  const buildDto = useCallback(() => {
    const orderedPhotos =
      form.photos.length > 0
        ? [form.photos[mainPhotoIndex], ...form.photos.filter((_, idx) => idx !== mainPhotoIndex)]
        : []

    return {
      businessId: validBusinessId ? bId : null,
      businessIds: validBusinessId ? [bId] : [],
      clothingItemId: editingId ?? undefined, // harmless on create

      name: form.name.trim(),
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
  }, [form, mainPhotoIndex, validBusinessId, bId, editingId])

  // Verify business exists before saving (avoid FK errors)
  const assertBusinessExists = useCallback(async () => {
    try {
      const biz = await getRef.current(`/Business/${bId}`)
      if (!biz || !biz.businessId) throw new Error("Business not found on server.")
    } catch {
      throw new Error(t("products.errors.business_missing", { defaultValue: `Selected business (id ${bId}) does not exist on the server.` }))
    }
  }, [bId, t])

  // ---- Smart endpoint fallbacks for PUT/DELETE ----
  const smartPutClothingItem = useCallback(async (id, dto) => {
    // 1) Plain: /ClothingItem/{id}
    try {
      return await put(`${CLOTHING_ITEM_API}/${id}`, dto)
    } catch (e1) {
      // 2) /ClothingItem/business/{bizId}/items/{id}
      try {
        return await put(`${CLOTHING_ITEM_API}/business/${bId}/items/${id}`, dto)
      } catch (e2) {
        // 3) /ClothingItem/{id}?businessId={bizId}
        return await put(`${CLOTHING_ITEM_API}/${id}?businessId=${bId}`, dto)
      }
    }
  }, [put, bId])

  const smartDeleteClothingItem = useCallback(async (id) => {
    // 1) Plain: /ClothingItem/{id}
    try {
      return await del(`${CLOTHING_ITEM_API}/${id}`)
    } catch (e1) {
      // 2) /ClothingItem/business/{bizId}/items/{id}
      try {
        return await del(`${CLOTHING_ITEM_API}/business/${bId}/items/${id}`)
      } catch (e2) {
        // 3) /ClothingItem/{id}?businessId={bizId}
        return await del(`${CLOTHING_ITEM_API}/${id}?businessId=${bId}`)
      }
    }
  }, [del, bId])

  const saveProduct = useCallback(async () => {
    const validationErrors = validateForm()
    if (validationErrors.length > 0) { setError(validationErrors.join(", ")); return }

    setLoading(true); setError(null)
    try {
      const dto = buildDto()
      if (!dto.businessId || !Array.isArray(dto.businessIds) || dto.businessIds.length === 0) {
        throw new Error(t("products.errors.select_business_first", { defaultValue: "Select a business first." }))
      }

      await assertBusinessExists()

      if (role === "employee") {
        // PascalCase for ProposedChanges endpoint
        const itemDtoProposal = {
          BusinessId: dto.businessId,
          BusinessIds: dto.businessIds,
          ClothingItemId: editingId || 0,
          Name: dto.name,
          Description: dto.description,
          Price: dto.price,
          Quantity: dto.quantity,
          ClothingCategoryId: dto.clothingCategoryId,
          Brand: dto.brand,
          Model: dto.model,
          PictureUrls: dto.pictureUrls,
          Colors: dto.colors,
          Sizes: dto.sizes,
          Material: dto.material,
        }

        await post("/ProposedChanges/submit", {
          BusinessId: dto.businessId,
          Type: editingId ? "Update" : "Create",
          ItemDto: itemDtoProposal,
        })
        alert(t("products.alerts.change_proposed", { defaultValue: "Your change has been proposed and is pending approval." }))
      } else {
        if (editingId) {
          await smartPutClothingItem(editingId, dto)
        } else {
          await post(`${CLOTHING_ITEM_API}`, dto)
        }
        await loadAllProducts(bId)
        alert(t("products.alerts.saved", { defaultValue: "Product saved successfully!" }))
      }

      resetForm()
    } catch (err) {
      console.error("Save error detail:", err)
      const msg = err?.message || ""
      if (/23503/.test(msg) || /foreign key/i.test(msg)) {
        setError(
          t("products.errors.fk_hint", {
            defaultValue: `Can't save because BusinessId=${bId} doesn't exist in this environment. Double-check you're selecting a valid business on the same server as the API.`,
          })
        )
      } else {
        setError(
          msg
            ? t("products.errors.save_failed_with_reason", { defaultValue: "Failed to save product: {{reason}}", reason: msg })
            : t("products.errors.save_failed", { defaultValue: "Failed to save product. Please check console/network for details." })
        )
      }
    } finally { setLoading(false) }
  }, [validateForm, buildDto, role, editingId, post, bId, resetForm, t, assertBusinessExists, loadAllProducts, smartPutClothingItem])

  const handleDelete = useCallback(async (id) => {
    if (!validBusinessId) return
    const confirmMessage =
      role === "employee"
        ? t("products.confirms.delete_request", { defaultValue: "Submit delete request for approval?" })
        : t("products.confirms.delete_permanent", { defaultValue: "Permanently delete this product?" })

    if (!window.confirm(confirmMessage)) return

    setLoading(true); setError(null)
    try {
      if (role === "employee") {
        await post("/ProposedChanges/submit", {
          BusinessId: bId,
          Type: "Delete",
          ItemDto: { ClothingItemId: id, BusinessId: bId, BusinessIds: [bId] },
        })
        alert(t("products.alerts.delete_proposed", { defaultValue: "Delete request submitted for approval." }))
      } else {
        await smartDeleteClothingItem(id)
        await loadAllProducts(bId)
        setPinnedIds(prev => { const next = new Set(prev); next.delete(id); return next })
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
  }, [validBusinessId, role, post, t, bId, loadAllProducts, smartDeleteClothingItem])

  const startEdit = useCallback((product) => {
    // Normalize pictureUrls from array | string | JSON-string
    const pics =
      Array.isArray(product.pictureUrls)
        ? product.pictureUrls
        : typeof product.pictureUrls === "string" && product.pictureUrls.trim()
          ? (() => {
              try {
                const arr = JSON.parse(product.pictureUrls)
                return Array.isArray(arr) ? arr : [product.pictureUrls]
              } catch {
                return [product.pictureUrls]
              }
            })()
          : []

    setEditingId(product.clothingItemId)
    setForm({
      name: product.name || "",
      description: product.description || "",
      price: (product.price != null ? String(product.price) : "") || "",
      quantity: (product.quantity != null ? String(product.quantity) : "") || "",
      categoryId: product.clothingCategoryId != null ? String(product.clothingCategoryId) : "",
      brand: product.brand || "",
      model: product.model || "",
      photos: pics,
      colors: Array.isArray(product.colors) ? product.colors.join(", ") : product.colors || "",
      size: Array.isArray(product.sizes) ? product.sizes.join(", ") : (product.sizes != null ? String(product.sizes) : ""),
      material: product.material || "",
    })
    setMainPhotoIndex(0); setError(null)
  }, [])

  const removePhoto = useCallback((indexToRemove) => {
    setForm((prev) => ({ ...prev, photos: prev.photos.filter((_, idx) => idx !== indexToRemove) }))
    setMainPhotoIndex((prevIndex) => (indexToRemove === prevIndex ? 0 : indexToRemove < prevIndex ? prevIndex - 1 : prevIndex))
  }, [])

  // Record Sale
  const handleSale = useCallback(async (product) => {
    if (!validBusinessId) { setError(t("products.errors.select_business_first", { defaultValue: "Select a business first." })); return; }

    const seller = myDisplayName(userInfo) || undefined

    try {
      setSaleLoadingId(product.clothingItemId)
      await post(`/Sales/ClothingItem/${product.clothingItemId}/sale`, {
        Quantity: 1,
        BusinessId: bId,
        SoldByName: seller,
      })

      setProducts(prev =>
        prev.map(p =>
          p.clothingItemId === product.clothingItemId
            ? { ...p, quantity: Math.max((p.quantity ?? 0) - 1, 0) }
            : p
        )
      )

      window.dispatchEvent(new CustomEvent("sale-recorded", { detail: { businessId: bId } }))
    } catch (err) {
      console.error("Sale error:", err)
      setError(err?.message || t("products.errors.sale_failed", { defaultValue: "Failed to record sale." }))
    } finally {
      setSaleLoadingId(null)
    }
  }, [validBusinessId, post, userInfo, t, bId])

  // Pin helpers
  const isPinned = useCallback((id) => pinnedIds.has(id), [pinnedIds])

  const togglePin = useCallback(async (product) => {
    if (!validBusinessId) return
    const id = product.clothingItemId
    const currentlyPinned = isPinned(id)

    try {
      setPinLoadingId(id)
      if (currentlyPinned) {
        await put(`${CLOTHING_ITEM_API}/business/${bId}/items/${id}/unpin`)
        setPinnedIds(prev => { const next = new Set(prev); next.delete(id); return next })
      } else {
        await put(`${CLOTHING_ITEM_API}/business/${bId}/items/${id}/pin`)
        setPinnedIds(prev => { const next = new Set(prev); next.add(id); return next })
      }
    } catch (err) {
      console.error("Pin toggle error:", err)
      setError(err?.message || t("products.errors.pin_failed", { defaultValue: "Failed to toggle pin." }))
    } finally {
      setPinLoadingId(null)
    }
  }, [validBusinessId, isPinned, put, t, bId])

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

        {/* Photos */}
        <div className="form-group">
          <label>{t("products.fields.photos", { defaultValue: "Product Photos" })}</label>
          <label className="file-btn" aria-disabled={uploading || loading}>
            {uploading ? t("products.upload.uploading", { defaultValue: "⏳ Uploading..." }) : t("products.upload.button", { defaultValue: "📁 Upload Photos" })}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
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
              <div className="empty-photos">📸 {t("products.upload.drop_hint", { defaultValue: "Drop photos here or click upload button" })}</div>
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
                          <span title={t("products.pin.pinned_badge", { defaultValue: "Pinned" })} style={{ marginLeft: 8, fontSize: "0.95em", verticalAlign: "middle" }}>📌</span>
                        )}
                      </div>
                      <div className="product-details">
                        {p.model && <span>{t("products.badges.model", { defaultValue: "Model" })}: {p.model}</span>}
                        <span className="price">{t("products.badges.price", { defaultValue: "Price" })}: LEK {p.price}</span>
                        {p.sizes && <span>{t("products.badges.size", { defaultValue: "Size" })}: {p.sizes}</span>}
                        <span className="quantity">{t("products.badges.qty", { defaultValue: "Qty" })}: {p.quantity}</span>
                      </div>
                      <div className="btns">
                        <button onClick={() => startEdit(p)} disabled={loading} className="edit"> {t("common.edit", { defaultValue: "Edit" })}</button>
                        <button onClick={() => handleDelete(p.clothingItemId)} disabled={loading} className="delete"> {t("common.delete", { defaultValue: "Delete" })}</button>

                        <button
                          onClick={() => togglePin(p)}
                          disabled={loading || pinLoadingId === p.clothingItemId}
                          className={`pin ${pinLoadingId === p.clothingItemId ? "loading" : ""}`}
                          title={pinned ? t("products.pin.unpin_tooltip", { defaultValue: "Unpin this product" }) : t("products.pin.pin_tooltip", { defaultValue: "Pin this product" })}
                          style={{ backgroundColor: pinned ? "#f59e0b" : "#0ea5e9", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 12px", fontWeight: 600 }}
                        >
                          {pinLoadingId === p.clothingItemId ? t("products.pin.toggling", { defaultValue: "Updating…" }) : pinned ? t("products.pin.unpin", { defaultValue: "Unpin" }) : t("products.pin.pin", { defaultValue: "Pin" })}
                        </button>

                        <button
                          onClick={() => handleSale(p)}
                          className={`sale ${saleLoadingId === p.clothingItemId ? "loading" : ""}`}
                          disabled={loading || saleLoadingId === p.clothingItemId || (p.quantity ?? 0) <= 0}
                          title={t("products.sale.tooltip", { defaultValue: "Record a sale (reduce stock by 1)" })}
                          style={{ backgroundColor: "#16a34a", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 12px", fontWeight: 600 }}
                        >
                          {saleLoadingId === p.clothingItemId ? t("products.sale.selling", { defaultValue: "Selling…" }) : t("products.sale.button", { defaultValue: "Sale" })}
                        </button>
                      </div>
                    </li>
                  )
                })
              ) : (
                <li className="no-results">
                  {searchQuery ? t("products.search.no_match", { defaultValue: "No products match your search." }) : t("products.list.empty", { defaultValue: "No products found." })}
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
