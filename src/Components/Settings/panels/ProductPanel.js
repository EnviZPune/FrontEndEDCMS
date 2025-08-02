"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useApiClient } from "../hooks/useApiClient"
import { useAuth } from "../hooks/useAuth"
import Pagination from "../../Pagination.tsx"
import "../../../Styling/Settings/productpanel.css"

export default function ProductPanel({ business }) {
  const { get, post, put, del } = useApiClient()
  const { role } = useAuth()
  const fileInputRef = useRef(null)

  // keep a stable reference to get to avoid effect loops
  const getRef = useRef(get)
  useEffect(() => {
    getRef.current = get
  }, [get])

  // ─── State Management ────────────────────────────────────────────────────
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const pageSize = 10

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

  // ─── Form Validation ─────────────────────────────────────────────────────
  const validateForm = useCallback(() => {
    const errors = []
    if (!form.name.trim()) errors.push("Product name is required")
    if (!form.price || Number.parseFloat(form.price) <= 0) errors.push("Valid price is required")
    if (!form.quantity || Number.parseInt(form.quantity) < 0) errors.push("Valid quantity is required")
    return errors
  }, [form.name, form.price, form.quantity])

  // ─── Load Data ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!businessId) return

    let cancelled = false

    const loadData = async () => {
      setLoading(true)
      setError(null)

      try {
        const [prods, cats] = await Promise.all([
          getRef.current(`/api/ClothingItem/business/${businessId}`),
          getRef.current(`/api/ClothingCategory/business/${businessId}`),
        ])

        if (!cancelled) {
          setProducts(prods || [])
          setCategories(cats || [])
        }
      } catch (err) {
        console.error("Load error:", err)
        if (!cancelled) {
          setError("Failed to load data. Please try again.")
          setProducts([])
          setCategories([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadData()
    return () => {
      cancelled = true
    }
  }, [businessId])

  // Reset page when search or products change
  useEffect(() => {
    setPage(1)
  }, [searchQuery, products.length])

  // ─── Image Upload Helpers ────────────────────────────────────────────────
  const uploadImageToGCS = useCallback(async (file) => {
    if (!file) return null

    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      throw new Error("File size must be less than 5MB")
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if (!allowedTypes.includes(file.type)) {
      throw new Error("Only JPEG, PNG, WebP, and GIF images are allowed")
    }

    const ts = Date.now()
    const name = `${ts}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`
    const imgUrl = `https://storage.googleapis.com/edcms_bucket/${name}`
    const txtUrl = `${imgUrl}.txt`

    try {
      await fetch(imgUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      })

      await fetch(txtUrl, {
        method: "PUT",
        headers: { "Content-Type": "text/plain" },
        body: imgUrl,
      })

      return imgUrl
    } catch (uploadErr) {
      console.error("Upload error:", uploadErr)
      throw new Error("Failed to upload image")
    }
  }, [])

  const handleFileUpload = useCallback(
    async (files) => {
      if (!files || files.length === 0) return

      setUploading(true)
      setError(null)

      try {
        const uploadPromises = []
        const filesToUpload = Array.from(files).slice(0, 10 - form.photos.length)

        for (const file of filesToUpload) {
          uploadPromises.push(uploadImageToGCS(file))
        }

        const uploadedUrls = await Promise.all(uploadPromises)
        const validUrls = uploadedUrls.filter((url) => url !== null)

        if (validUrls.length > 0) {
          setForm((prevForm) => ({
            ...prevForm,
            photos: [...prevForm.photos, ...validUrls],
          }))

          setMainPhotoIndex((prevIndex) => {
            return form.photos.length === 0 ? 0 : prevIndex
          })
        }
      } catch (err) {
        console.error("Upload error:", err)
        setError(err?.message || "Failed to upload images")
      } finally {
        setUploading(false)
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      }
    },
    [form.photos.length, uploadImageToGCS],
  )

  // ─── Drag and Drop Handlers ─────────────────────────────────────────────
  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault()
      setDragOver(false)

      const files = Array.from(e.dataTransfer.files).filter((file) =>
        file.type.startsWith("image/"),
      )

      if (files.length > 0) {
        handleFileUpload(files)
      }
    },
    [handleFileUpload],
  )

  // ─── CRUD Operations ─────────────────────────────────────────────────────
  const resetForm = useCallback(() => {
    setEditingId(null)
    setForm({
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
    setMainPhotoIndex(0)
    setError(null)
  }, [])

  const saveProduct = useCallback(async () => {
    if (!businessId) return

    const validationErrors = validateForm()
    if (validationErrors.length > 0) {
      setError(validationErrors.join(", "))
      return
    }

    setLoading(true)
    setError(null)

    try {
      const orderedPhotos =
        form.photos.length > 0
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
        colors: form.colors
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s),
        sizes: (form.size || "").trim(),
        material: form.material.trim(),
      }

      if (role === "employee") {
        await post("/api/ProposedChanges/submit", {
          businessId: businessId,
          type: editingId ? "Update" : "Create",
          itemDto: { ...dto, clothingItemId: editingId || 0 },
        })
        alert("Your change has been proposed and is pending approval.")
      } else {
        if (editingId) {
          await put(`/api/ClothingItem/${editingId}`, dto)
        } else {
          await post("/api/ClothingItem", dto)
        }

        // Refresh list
        const updated = await getRef.current(`/api/ClothingItem/business/${businessId}`)
        setProducts(updated || [])
        alert("Product saved successfully!")
      }

      resetForm()
    } catch (err) {
      console.error("Save error detail:", err)
      if (err?.message) {
        setError(`Failed to save product: ${err.message}`)
      } else {
        setError("Failed to save product. Please check console/network for details.")
      }
    } finally {
      setLoading(false)
    }
  }, [businessId, validateForm, form, mainPhotoIndex, editingId, role, post, put, resetForm])

  const handleDelete = useCallback(
    async (id) => {
      if (!businessId) return

      const confirmMessage =
        role === "employee" ? "Submit delete request for approval?" : "Permanently delete this product?"

      if (!window.confirm(confirmMessage)) return

      setLoading(true)
      setError(null)

      try {
        if (role === "employee") {
          await post("/api/ProposedChanges/submit", {
            businessId: businessId,
            type: "Delete",
            itemDto: { clothingItemId: id, businessIds: [businessId] },
          })
          alert("Delete request submitted for approval.")
        } else {
          await del(`/api/ClothingItem/${id}`)
          const updated = await getRef.current(`/api/ClothingItem/business/${businessId}`)
          setProducts(updated || [])
          alert("Product deleted successfully.")
        }
      } catch (err) {
        console.error("Delete error detail:", err)
        if (err?.message) {
          setError(`Failed to delete product: ${err.message}`)
        } else {
          setError("Failed to delete product. Please check console/network for details.")
        }
      } finally {
        setLoading(false)
      }
    },
    [businessId, role, post, del],
  )

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
      size: Array.isArray(product.sizes)
        ? product.sizes.join(", ")
        : product.sizes?.toString() || "",
      material: product.material || "",
    })
    setMainPhotoIndex(0)
    setError(null)
  }, [])

  const removePhoto = useCallback((indexToRemove) => {
    setForm((prevForm) => ({
      ...prevForm,
      photos: prevForm.photos.filter((_, idx) => idx !== indexToRemove),
    }))

    setMainPhotoIndex((prevIndex) => {
      if (indexToRemove === prevIndex) {
        return 0
      } else if (indexToRemove < prevIndex) {
        return prevIndex - 1
      }
      return prevIndex
    })
  }, [])

  // ─── Filter and Pagination ───────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    return products.filter((product) =>
      [product.name, product.brand, product.model, product.description]
        .join(" ")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()),
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
          <h3>No Business Selected</h3>
          <p>Please select a business to manage products.</p>
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
              <h4>Error</h4>
              <p>{error}</p>
            </div>
            <button onClick={() => setError(null)} className="error-close">
              ×
            </button>
          </div>
        </div>
      )}

      {/* Product Form */}
      <div className="panel product-form">
        <h3>
          <span className="panel-icon">📦</span>
          {editingId ? "Edit Product" : "Add New Product"}
        </h3>

        <div className="form-group">
          <div className="grid two-cols">
            <div className="form-group">
              <label htmlFor="product-name">Product Name *</label>
              <input
                id="product-name"
                placeholder="Enter product name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="product-brand">Brand</label>
              <input
                id="product-brand"
                placeholder="Enter brand name"
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
              <label htmlFor="product-model">Model</label>
              <input
                id="product-model"
                placeholder="Enter model"
                value={form.model}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="product-price">Price *</label>
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
          <label htmlFor="product-description">Description</label>
          <textarea
            id="product-description"
            placeholder="Enter product description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <div className="grid three-cols">
            <div className="form-group">
              <label htmlFor="product-quantity">Quantity *</label>
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
              <label htmlFor="product-category">Category</label>
              <select
                id="product-category"
                value={form.categoryId}
                onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                disabled={loading}
              >
                <option value="">Select category...</option>
                {categories.map((category) => (
                  <option key={category.clothingCategoryId} value={category.clothingCategoryId}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="product-size">Size</label>
              <input
                id="product-size"
                placeholder="e.g. M, 32W, One-Size"
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
              <label htmlFor="product-colors">Colors</label>
              <input
                id="product-colors"
                placeholder="Red, Blue, Green (comma separated)"
                value={form.colors}
                onChange={(e) => setForm((f) => ({ ...f, colors: e.target.value }))}
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="product-material">Material</label>
              <input
                id="product-material"
                placeholder="Cotton, Polyester, etc."
                value={form.material}
                onChange={(e) => setForm((f) => ({ ...f, material: e.target.value }))}
                disabled={loading}
              />
            </div>
          </div>
        </div>

        {/* Photo Upload */}
        <div className="form-group">
          <label>Product Photos</label>
          <label className="file-btn" disabled={uploading || loading}>
            {uploading ? "⏳ Uploading..." : "📁 Upload Photos"}
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
              <div className="empty-photos">📸 Drop photos here or click upload button</div>
            )}

            {form.photos.map((url, index) => (
              <div
                key={`${url}-${index}`}
                className={`thumb ${index === mainPhotoIndex ? "selected" : ""}`}
                onClick={() => setMainPhotoIndex(index)}
                title={index === mainPhotoIndex ? "Main photo" : "Click to set as main photo"}
              >
                <img src={url || "/placeholder.svg"} alt={`Product photo ${index + 1}`} />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    removePhoto(index)
                  }}
                  disabled={loading}
                  title="Remove photo"
                >
                  ×
                </button>
                {index === mainPhotoIndex && <div className="main-photo-badge">Main</div>}
              </div>
            ))}

            {uploading && (
              <div className="upload-progress">
                <div className="loading-spinner"></div>
              </div>
            )}
          </div>

          {form.photos.length > 0 && (
            <p className="photo-help">
              Click on a photo to set it as the main image. Maximum 10 photos allowed.
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="actions">
          <button onClick={saveProduct} disabled={loading || uploading} className="primary">
            {loading ? "⏳ Saving..." : editingId ? "Update Product" : "Add Product"}
          </button>

          {editingId && (
            <button onClick={resetForm} disabled={loading} className="secondary">
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Products List */}
      <div className="panel product-list">
        <h3>
          <span className="panel-icon">📋</span>
          Products ({totalCount})
        </h3>

        <div className="product-list-content">
          <div className="form-group">
            <input
              className="search"
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={loading}
            />
          </div>

          {loading && products.length === 0 ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Loading products...</p>
            </div>
          ) : (
            <ul>
              {paginatedProducts.length > 0 ? (
                paginatedProducts.map((p) => (
                  <li key={p.clothingItemId}>
                      <div className="product-name">
                        {p.name}
                        {p.brand && <span className="product-brand"> - {p.brand}</span>}
                      </div>
                      <div className="product-details">
                        {p.model && <span>Model: {p.model}</span>}
                        <span className="price">Price: ${p.price}</span>
                        {p.sizes && <span>Size: {p.sizes}</span>}
                        <span className="quantity">Qty: {p.quantity}</span>
                      </div>
                    <div className="btns">
                      <button onClick={() => startEdit(p)} disabled={loading} className="edit">
                        ✏️ Edit
                      </button>
                      <button onClick={() => handleDelete(p.clothingItemId)} disabled={loading} className="delete">
                        🗑️ Delete
                      </button>
                    </div>
                  </li>
                ))
              ) : (
                <li className="no-results">
                  {searchQuery ? "No products match your search." : "No products found."}
                </li>
              )}
            </ul>
          )}

          {totalCount > pageSize && (
            <Pagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} maxButtons={5} />
          )}
        </div>
      </div>
    </>
  )
}
