"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useApiClient } from "../hooks/useApiClient"
import { useAuth } from "../hooks/useAuth"
import Pagination from "../../Pagination.tsx"
import "../../../Styling/Settings/productpanel.css"

const CLOTHING_ITEM_API = "/ClothingItem"

// JS-only enum map (frozen)
const SizeKind = Object.freeze({
  Alpha: 1,
  Numeric: 2,
  WaistInseam: 3,
  OneSize: 4,
})

export default function ProductPanel({ business }) {
  const { t } = useTranslation("productpanel")
  const { get, post, put, del } = useApiClient()
  const { role, userInfo } = useAuth()
  const fileInputRef = useRef(null)

  const getRef = useRef(get)
  useEffect(() => { getRef.current = get }, [get])

  // Helpers
  const csv = (s) =>
    (s || "")
      .split(",")
      .map(x => x.trim())
      .filter(Boolean)

  const parseMaybeJsonArray = (val) => {
    if (val == null) return []
    if (Array.isArray(val)) return val.map(String)
    const s = String(val).trim()
    if (!s) return []
    if ((s.startsWith("[") && s.endsWith("]")) || (s.startsWith("\"[") && s.endsWith("]\""))) {
      try {
        const parsed = JSON.parse(s)
        if (Array.isArray(parsed)) return parsed.map(String)
      } catch {}
    }
    if (s.includes(",")) return csv(s).map(String)
    return [s]
  }

  const joinForDisplay = (val) => parseMaybeJsonArray(val).join(", ")

  // State
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [saleLoadingId, setSaleLoadingId] = useState(null)
  const [pinLoadingId, setPinLoadingId] = useState(null)
  const [pinnedIds, setPinnedIds] = useState(() => new Set())

  const [openMenuId, setOpenMenuId] = useState(null)
  const [sheetProduct, setSheetProduct] = useState(null)

  const pageSize = 10

  const [fieldErrors, setFieldErrors] = useState({ name: null, price: null, quantity: null, size: null })
  const [touched, setTouched] = useState({ name: false, price: false, quantity: false, size: false })

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
  const bId = Number(businessId)
  const validBusinessId = Number.isInteger(bId) && bId > 0

  const isPhone = () => (typeof window !== "undefined") && window.matchMedia("(max-width: 640px)").matches

  // Validators
  const NAME_MIN = 2
  const NAME_MAX = 120
  const NAME_REGEX = /^[\p{L}\p{N}][\p{L}\p{N}\s'&().,\-]{0,119}$/u

  const validateProductName = useCallback((v) => {
    const s = (v || "").trim()
    if (!s) return t("products.errors.name_required", { defaultValue: "Product name is required" })
    if (s.length < NAME_MIN) return t("products.errors.name_short", { defaultValue: `Name must be at least ${NAME_MIN} characters` })
    if (s.length > NAME_MAX) return t("products.errors.name_long", { defaultValue: `Name must be at most ${NAME_MAX} characters` })
    if (!NAME_REGEX.test(s)) return t("products.errors.name_chars", { defaultValue: "Use letters, numbers, spaces and . , ( ) ' & - only" })
    return null
  }, [t])

  const validatePrice = useCallback((v) => {
    const s = (v ?? "").toString().trim()
    if (!s) return t("products.errors.price_required", { defaultValue: "Valid price is required" })
    const num = Number.parseFloat(s)
    if (Number.isNaN(num) || num <= 0) return t("products.errors.price_positive", { defaultValue: "Price must be a number greater than 0" })
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return t("products.errors.price_decimals", { defaultValue: "Price can have at most 2 decimals" })
    return null
  }, [t])

  const validateQuantity = useCallback((v) => {
    const s = (v ?? "").toString().trim()
    if (s === "") return t("products.errors.quantity_required", { defaultValue: "Valid quantity is required" })
    if (!/^\d+$/.test(s)) return t("products.errors.quantity_integer", { defaultValue: "Quantity must be a whole number" })
    const num = Number.parseInt(s, 10)
    if (num < 0) return t("products.errors.quantity_nonneg", { defaultValue: "Quantity must be 0 or greater" })
    return null
  }, [t])

  // Size parsing
  const ALPHA = /^(XXXS|XXS|XS|S|M|L|XL|XXL|XXXL)$/i
  const ONESIZE = /^(ONE-?SIZE|OS)$/i
  const NUMERIC = /^(?:\d{1,3})(?:\.\d)?$/i
  const WAIST_INSEAM = /^(?:\d{2,3})(?:[Ww])?(?:[ /-]?(?:\d{2,3})(?:[Ll])?)?$/i
  const ALPHA_ORDER = ["XXXS","XXS","XS","S","M","L","XL","XXL","XXXL"]

  const validateSize = useCallback((v) => {
    const s = (v || "").trim()
    if (!s) return t("products.errors.size_required", { defaultValue: "Size is required" })
    const tokens = csv(s)
    if (tokens.length === 0) return t("products.errors.size_required", { defaultValue: "Size is required" })

    const bad = tokens.filter(tok => {
      if (ALPHA.test(tok)) return false
      if (ONESIZE.test(tok)) return false
      if (NUMERIC.test(tok)) {
        const n = parseFloat(tok)
        return !(n >= 1 && n <= 200)
      }
      if (WAIST_INSEAM.test(tok)) return false
      return true
    })

    if (bad.length > 0) {
      return t("products.errors.size_invalid_tokens", { defaultValue: `Invalid size value(s): ${bad.join(", ")}` })
    }
    return null
  }, [t])

  const setField = (key, value, validator) => {
    setForm(prev => ({ ...prev, [key]: value }))
    if (touched[key]) {
      setFieldErrors(prev => ({ ...prev, [key]: validator ? validator(value) : null }))
    }
  }

  // Loaders
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
        await Promise.all([loadAllProducts(bId), loadCategories(bId), loadPinned(bId)])
      } catch (err) {
        console.error("Load error:", err)
        if (!cancelled) {
          setError(t("products.errors.load_failed", { defaultValue: "Failed to load data. Please try again." }))
          setProducts([]); setCategories([]); setPinnedIds(new Set())
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadData()
    return () => { cancelled = true }
  }, [validBusinessId, bId, t, loadAllProducts, loadCategories, loadPinned])

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

  // Uploads
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
    await fetch(txtUrl, { method: "PUT", headers: { "Content-Type": "text/plain" }, body: imgUrl }).catch(() => {})
    return imgUrl
  }, [t])

  const handleFileUpload = useCallback(async (files) => {
    if (!files || files.length === 0) return
    setUploading(true); setError(null)
    try {
      const list = Array.from(files)
      const filesToUpload = list.slice(0, Math.max(0, 10 - form.photos.length))
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

  const handleDragOver = useCallback((e) => { e.preventDefault(); setDragOver(true) }, [])
  const handleDragLeave = useCallback((e) => { e.preventDefault(); setDragOver(false) }, [])
  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false)
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"))
    if (files.length > 0) handleFileUpload(files)
  }, [handleFileUpload])

  // Reset form
  const resetForm = useCallback(() => {
    setEditingId(null)
    setForm({
      name: "", description: "", price: "", quantity: "",
      categoryId: "", brand: "", model: "", photos: [],
      colors: "", size: "", material: "",
    })
    setMainPhotoIndex(0); setError(null)
    setTouched({ name: false, price: false, quantity: false, size: false })
    setFieldErrors({ name: null, price: null, quantity: null, size: null })
    setVariantQty({})
  }, [])

  // ===== Variant grid =====
  // Map key: "color|kind:a:b" -> quantity
  const [variantQty, setVariantQty] = useState({})

  const parseSizes = useCallback((sizeCsv) => {
    const tokens = csv(sizeCsv)
    const sizes = []
    for (const rawTok of tokens) {
      const tok = rawTok.trim()
      if (!tok) continue

      if (ALPHA.test(tok)) {
        const idx = ALPHA_ORDER.findIndex(x => x.toLowerCase() === tok.toLowerCase())
        const a = idx >= 0 ? idx : 3
        sizes.push({ sizeKind: SizeKind.Alpha, a, b: 0, key: `1:${a}:0`, label: ALPHA_ORDER[a] ?? tok.toUpperCase() })
        continue
      }
      if (ONESIZE.test(tok)) {
        sizes.push({ sizeKind: SizeKind.OneSize, a: 1, b: 0, key: `4:1:0`, label: "OS" })
        continue
      }
      if (NUMERIC.test(tok)) {
        const n = Math.round(parseFloat(tok))
        const a = Math.max(1, Math.min(200, n))
        sizes.push({ sizeKind: SizeKind.Numeric, a, b: 0, key: `2:${a}:0`, label: String(a) })
        continue
      }
      if (WAIST_INSEAM.test(tok)) {
        const nums = tok.match(/\d{2,3}/g) || []
        const a = Math.max(1, Math.min(200, parseInt(nums[0] || "0", 10) || 0))
        const b = Math.max(0, Math.min(200, parseInt(nums[1] || "0", 10) || 0))
        sizes.push({ sizeKind: SizeKind.WaistInseam, a, b, key: `3:${a}:${b}`, label: b ? `${a}/${b}` : `${a}` })
        continue
      }
    }
    const seen = new Set()
    const uniq = []
    for (const s of sizes) {
      if (seen.has(s.key)) continue
      seen.add(s.key); uniq.push(s)
    }
    return uniq
  }, [])

  const parsedColors = useMemo(() => {
    const arr = csv(form.colors).map(c => c.trim()).filter(Boolean)
    const seen = new Set()
    const out = []
    for (const c of arr) {
      const k = c.toLowerCase()
      if (seen.has(k)) continue
      seen.add(k); out.push(c)
    }
    return out
  }, [form.colors])

  const parsedSizes = useMemo(() => parseSizes(form.size), [form.size, parseSizes])

  const gridActive = parsedColors.length > 0 && parsedSizes.length > 0

  const cellKey = (color, sizeKey) => `${color.toLowerCase()}|${sizeKey}`

  useEffect(() => {
    setVariantQty(prev => {
      const next = {}
      for (const color of parsedColors) {
        for (const s of parsedSizes) {
          const k = cellKey(color, s.key)
          next[k] = prev[k] ?? 0
        }
      }
      return next
    })
  }, [parsedColors, parsedSizes])

  const gridTotalQty = useMemo(() => {
    if (!gridActive) return 0
    let sum = 0
    for (const color of parsedColors) {
      for (const s of parsedSizes) {
        sum += variantQty[cellKey(color, s.key)] ?? 0
      }
    }
    return sum
  }, [gridActive, parsedColors, parsedSizes, variantQty])

  useEffect(() => {
    if (!gridActive) return
    setForm(prev => ({ ...prev, quantity: String(gridTotalQty) }))
    setFieldErrors(prev => ({ ...prev, quantity: null }))
  }, [gridActive, gridTotalQty])

  const onCellQtyChange = (color, sizeKey, value) => {
    const num = Math.max(0, Math.floor(Number(value || 0)))
    const k = cellKey(color, sizeKey)
    setVariantQty(prev => ({ ...prev, [k]: Number.isFinite(num) ? num : 0 }))
  }

  // DTO builders
  const buildVariantsPayload = useCallback(() => {
    if (!gridActive) return []
    const out = []
    for (const color of parsedColors) {
      for (const s of parsedSizes) {
        const qty = variantQty[cellKey(color, s.key)] ?? 0
        out.push({
          color,
          sizeKind: s.sizeKind,
          a: s.a,
          b: s.b,
          quantity: qty,
          isActive: true,
        })
      }
    }
    return out
  }, [gridActive, parsedColors, parsedSizes, variantQty])

  const buildDto = useCallback(() => {
    const orderedPhotos =
      form.photos.length > 0
        ? [form.photos[mainPhotoIndex], ...form.photos.filter((_, idx) => idx !== mainPhotoIndex)]
        : []
    const sizesArray = csv(form.size).map(String)
    const colorsArray = csv(form.colors).map(String)
    const variants = buildVariantsPayload()
    const totalQuantity = gridActive ? variants.reduce((acc, v) => acc + (v.quantity || 0), 0) : (Number.parseInt(form.quantity, 10) || 0)
    return {
      businessId: validBusinessId ? bId : null,
      businessIds: validBusinessId ? [bId] : [],
      clothingItemId: editingId ?? undefined,
      name: (form.name || "").trim(),
      description: (form.description || "").trim(),
      price: Number.parseFloat(form.price) || 0,
      quantity: totalQuantity,
      clothingCategoryId: form.categoryId ? +form.categoryId : null,
      brand: (form.brand || "").trim(),
      model: (form.model || "").trim(),
      pictureUrls: orderedPhotos,
      colors: colorsArray,
      sizes: sizesArray,
      material: (form.material || "").trim(),
      variants,
    }
  }, [form, mainPhotoIndex, validBusinessId, bId, editingId, gridActive, buildVariantsPayload])

  const assertBusinessExists = useCallback(async () => {
    try {
      const biz = await getRef.current(`/Business/${bId}`)
      if (!biz || !biz.businessId) throw new Error("Business not found on server.")
    } catch {
      throw new Error(t("products.errors.business_missing", { defaultValue: `Selected business (id ${bId}) does not exist on the server.` }))
    }
  }, [bId, t])

  const smartPutClothingItem = useCallback(async (id, dto) => {
    try {
      return await put(`${CLOTHING_ITEM_API}/${id}`, dto)
    } catch (e1) {
      try {
        return await put(`${CLOTHING_ITEM_API}/business/${bId}/items/${id}`, dto)
      } catch (e2) {
        return await put(`${CLOTHING_ITEM_API}/${id}?businessId=${bId}`, dto)
      }
    }
  }, [put, bId])

  const smartDeleteClothingItem = useCallback(async (id) => {
    try {
      return await del(`${CLOTHING_ITEM_API}/${id}`)
    } catch (e1) {
      try {
        return await del(`${CLOTHING_ITEM_API}/business/${bId}/items/${id}`)
      } catch (e2) {
        return await del(`${CLOTHING_ITEM_API}/${id}?businessId=${bId}`)
      }
    }
  }, [del, bId])

  const saveProduct = useCallback(async () => {
    setTouched(prev => ({ ...prev, name: true, price: true, size: true, quantity: !gridActive }))
    const nameErr = validateProductName(form.name)
    const priceErr = validatePrice(form.price)
    const sizeErr  = validateSize(form.size)
    const qtyErr   = gridActive ? null : validateQuantity(form.quantity)
    setFieldErrors({ name: nameErr, price: priceErr, quantity: qtyErr, size: sizeErr })

    const bizErr = !validBusinessId ? t("products.errors.select_business_first", { defaultValue: "Select a business first." }) : null
    if (nameErr || priceErr || sizeErr || qtyErr || bizErr) {
      setError(bizErr ? bizErr : t("products.errors.fix_and_retry", { defaultValue: "Please fix the highlighted fields and try again." }))
      return
    }

    setLoading(true); setError(null)
    try {
      const dto = buildDto()
      await assertBusinessExists()

      if ((role || "").toLowerCase() === "employee") {
        const variantsPascal = (dto.variants || []).map(v => ({
          Color: v.color,
          SizeKind: v.sizeKind,
          A: v.a,
          B: v.b,
          Quantity: v.quantity,
          IsActive: v.isActive,
        }))
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
          Variants: variantsPascal,
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
        setError(t("products.errors.fk_hint", { defaultValue: `Can't save because BusinessId=${bId} doesn't exist in this environment. Double-check you're selecting a valid business on the same server as the API.` }))
      } else {
        setError(msg ? t("products.errors.save_failed_with_reason", { defaultValue: "Failed to save product: {{reason}}", reason: msg }) : t("products.errors.save_failed", { defaultValue: "Failed to save product. Please check console/network for details." }))
      }
    } finally { setLoading(false) }
  }, [
    form.name, form.price, form.quantity, form.size,
    validateProductName, validatePrice, validateQuantity, validateSize,
    validBusinessId, t, role, editingId, buildDto, assertBusinessExists,
    post, smartPutClothingItem, loadAllProducts, bId, resetForm, gridActive
  ])

  const handleDelete = useCallback(async (id) => {
    if (!validBusinessId) return
    const confirmMessage =
      (role || "").toLowerCase() === "employee"
        ? t("products.confirms.delete_request", { defaultValue: "Submit delete request for approval?" })
        : t("products.confirms.delete_permanent", { defaultValue: "Permanently delete this product?" })
    if (!window.confirm(confirmMessage)) return
    setLoading(true); setError(null)
    try {
      if ((role || "").toLowerCase() === "employee") {
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
      setError(err?.message ? t("products.errors.delete_failed_with_reason", { defaultValue: "Failed to delete product: {{reason}}", reason: err.message }) : t("products.errors.delete_failed", { defaultValue: "Failed to delete product. Please check console/network for details." }))
    } finally { setLoading(false) }
  }, [validBusinessId, role, post, t, bId, loadAllProducts, smartDeleteClothingItem])

  const startEdit = useCallback((product) => {
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

    const sizesArr = parseMaybeJsonArray(product.sizes)
    const colorsArr = parseMaybeJsonArray(product.colors)

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
      colors: colorsArr.join(", "),
      size: sizesArr.join(", "),
      material: product.material || "",
    })
    setVariantQty({})
    setMainPhotoIndex(0); setError(null)
    setTouched({ name: false, price: false, quantity: false, size: false })
    setFieldErrors({ name: null, price: null, quantity: null, size: null })
  }, [])

  const removePhoto = useCallback((indexToRemove) => {
    setForm((prev) => ({ ...prev, photos: prev.photos.filter((_, idx) => idx !== indexToRemove) }))
    setMainPhotoIndex((prevIndex) => (indexToRemove === prevIndex ? 0 : indexToRemove < prevIndex ? prevIndex - 1 : prevIndex))
  }, [])

  const myDisplayName = (ui) => {
    const full = `${ui?.firstName ?? ""} ${ui?.lastName ?? ""}`.trim()
    if (full) return full
    if (ui?.name) return ui.name
    if (ui?.email) return ui.email.split("@")[0]
    return undefined
  }

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

  const formValid =
    !validateProductName(form.name) &&
    !validatePrice(form.price) &&
    !validateSize(form.size) &&
    (gridActive ? true : !validateQuantity(form.quantity)) &&
    validBusinessId

  // Menus/sheet
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpenMenuId(null)
        setSheetProduct(null)
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (sheetProduct) root.classList.add("no-scroll")
    else root.classList.remove("no-scroll")
    return () => root.classList.remove("no-scroll")
  }, [sheetProduct])

  const openActions = (product) => {
    if (isPhone()) {
      setSheetProduct(product)
      setOpenMenuId(null)
    } else {
      setOpenMenuId((prev) => (prev === product.clothingItemId ? null : product.clothingItemId))
      setSheetProduct(null)
    }
  }
  const closeAllMenus = () => { setOpenMenuId(null); setSheetProduct(null) }

  // Render
  if (!business) {
    return (
      <div className="no-business-selected">
        <h3>{t("products.empty.no_business_title", { defaultValue: "No Business Selected" })}</h3>
        <p>{t("products.empty.no_business_desc", { defaultValue: "Please select a business to manage products." })}</p>
      </div>
    )
  }

  return (
    <>
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

      <div className="panel product-form">
        <h3>
          <span className="panel-icon">📦</span>
          {editingId ? t("products.titles.edit", { defaultValue: "Edit Product" }) : t("products.titles.add", { defaultValue: "Add New Product" })}
        </h3>

        <div className="form-group">
          <div className="grid two-cols">
            <div className="form-group">
              <label htmlFor="product-name">{t("products.fields.name_req", { defaultValue: "Product Name *" })}</label>
              <input
                id="product-name"
                placeholder={t("products.placeholders.name", { defaultValue: "Enter product name" })}
                value={form.name}
                onChange={(e) => setField("name", e.target.value, validateProductName)}
                onBlur={() => { setTouched(prev => ({ ...prev, name: true })); setFieldErrors(prev => ({ ...prev, name: validateProductName(form.name) })) }}
                disabled={loading}
                className={touched.name && fieldErrors.name ? "input-error" : ""}
                aria-invalid={touched.name && !!fieldErrors.name}
                aria-describedby="product-name-err"
              />
              {touched.name && fieldErrors.name && <div id="product-name-err" className="field-error" role="alert">{fieldErrors.name}</div>}
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
                onChange={(e) => setField("price", e.target.value, validatePrice)}
                onBlur={() => { setTouched(prev => ({ ...prev, price: true })); setFieldErrors(prev => ({ ...prev, price: validatePrice(form.price) })) }}
                disabled={loading}
                className={touched.price && fieldErrors.price ? "input-error" : ""}
                aria-invalid={touched.price && !!fieldErrors.price}
                aria-describedby="product-price-err"
              />
              {touched.price && fieldErrors.price && <div id="product-price-err" className="field-error" role="alert">{fieldErrors.price}</div>}
            </div>
          </div>
        </div>

        <div className="form-group">
          <div className="grid three-cols">
            <div className="form-group">
              <label htmlFor="product-quantity">
                {gridActive
                  ? t("products.fields.total_qty_auto", { defaultValue: "Total Quantity (auto)" })
                  : t("products.fields.quantity_req", { defaultValue: "Quantity *" })}
              </label>
              <input
                id="product-quantity"
                type="number"
                min="0"
                placeholder="0"
                value={gridActive ? String(gridTotalQty) : form.quantity}
                onChange={(e) => gridActive ? void 0 : setField("quantity", e.target.value, validateQuantity)}
                onBlur={() => { if (!gridActive) { setTouched(prev => ({ ...prev, quantity: true })); setFieldErrors(prev => ({ ...prev, quantity: validateQuantity(form.quantity) })) } }}
                disabled={loading || gridActive}
                className={!gridActive && touched.quantity && fieldErrors.quantity ? "input-error" : ""}
                aria-invalid={!gridActive && touched.quantity && !!fieldErrors.quantity}
                aria-describedby="product-quantity-err"
                readOnly={gridActive}
              />
              {!gridActive && touched.quantity && fieldErrors.quantity && <div id="product-quantity-err" className="field-error" role="alert">{fieldErrors.quantity}</div>}
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
              <label htmlFor="product-size">{t("products.fields.size_req", { defaultValue: "Size(s) *" })}</label>
              <input
                id="product-size"
                placeholder={t("products.placeholders.size", { defaultValue: "e.g. S,M,L or 32/30, 34W/32L or 42" })}
                value={form.size}
                onChange={(e) => setField("size", e.target.value, validateSize)}
                onBlur={() => { setTouched(prev => ({ ...prev, size: true })); setFieldErrors(prev => ({ ...prev, size: validateSize(form.size) })) }}
                disabled={loading}
                className={touched.size && fieldErrors.size ? "input-error" : ""}
                aria-invalid={touched.size && !!fieldErrors.size}
                aria-describedby="product-size-err"
              />
              {touched.size && fieldErrors.size && <div id="product-size-err" className="field-error" role="alert">{fieldErrors.size}</div>}
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
          </div>
        </div>

        {gridActive && (
          <div className="form-group">
            <label>{t("products.fields.inventory_by_color_size", { defaultValue: "Inventory by Color & Size" })}</label>
            <div className="variant-grid">
              <table className="variants-table">
                <thead>
                  <tr>
                    <th>{t("products.grid.color", { defaultValue: "Color \\ Size" })}</th>
                    {parsedSizes.map(s => (
                      <th key={s.key}>{s.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsedColors.map(color => (
                    <tr key={color}>
                      <td><strong>{color}</strong></td>
                      {parsedSizes.map(s => {
                        const k = `${color.toLowerCase()}|${s.key}`
                        const val = variantQty[k] ?? 0
                        return (
                          <td key={k}>
                            <input
                              type="number"
                              min="0"
                              value={val}
                              onChange={(e) => onCellQtyChange(color, s.key, e.target.value)}
                              className="variant-cell-input"
                              aria-label={`${color} ${s.label} quantity`}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="variant-total">
              {t("products.grid.total", { defaultValue: "Total" })}: <strong>{gridTotalQty}</strong>
            </div>
          </div>
        )}

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
          <label>{t("products.fields.photos", { defaultValue: "Product Photos" })}</label>
          <label className="file-btn" aria-disabled={uploading || loading}>
            {uploading ? t("products.upload.uploading", { defaultValue: "⏳ Uploading..." }) : t("products.upload.button", { defaultValue: "Upload Photos" })}
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

        <div className="actions">
          <button
            onClick={saveProduct}
            disabled={loading || uploading || !formValid}
            className="primary"
            title={!formValid ? t("products.errors.fix_and_retry", { defaultValue: "Please fix the highlighted fields and try again." }) : undefined}
          >
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
                  const pinLabel = pinned ? t("products.pin.unpin", { defaultValue: "Unpin" }) : t("products.pin.pin", { defaultValue: "Pin" })
                  const quantityZero = (p.quantity ?? 0) <= 0
                  const displaySizes = joinForDisplay(p.sizes)
                  const displayColors = joinForDisplay(p.colors)

                  return (
                    <li key={p.clothingItemId}>
                      <div className="row-main">
                        <div className="product-name">
                          {p.name}{p.brand && <span className="product-brand"> - {p.brand}</span>}
                          {pinned && <span title={t("products.pin.pinned_badge", { defaultValue: "Pinned" })} style={{ marginLeft: 8, fontSize: "0.95em", verticalAlign: "middle" }}>📌</span>}
                        </div>
                        <div className="product-details">
                          {p.model && <span>{t("products.badges.model", { defaultValue: "Model" })}: {p.model}</span>}
                          <span className="price">{t("products.badges.price", { defaultValue: "Price" })}: LEK {p.price}</span>
                          {displaySizes && <span>{t("products.badges.size", { defaultValue: "Size" })}: {displaySizes}</span>}
                          <span className="quantity">{t("products.badges.qty", { defaultValue: "Qty" })}: {p.quantity}</span>
                          {displayColors && <span className="colors">{t("products.badges.color", { defaultValue: "Color" })}: {displayColors}</span>}
                        </div>
                      </div>

                      <div className="row-actions">
                        <div className="btns">
                          <button onClick={() => startEdit(p)} disabled={loading} className="edit">{t("common.edit", { defaultValue: "Edit" })}</button>
                          <button onClick={() => handleDelete(p.clothingItemId)} disabled={loading} className="delete">{t("common.delete", { defaultValue: "Delete" })}</button>
                          <button
                            onClick={() => togglePin(p)}
                            disabled={loading || pinLoadingId === p.clothingItemId}
                            className={`pin ${pinLoadingId === p.clothingItemId ? "loading" : ""}`}
                            title={pinned ? t("products.pin.unpin_tooltip", { defaultValue: "Unpin this product" }) : t("products.pin.pin_tooltip", { defaultValue: "Pin this product" })}
                          >
                            {pinLabel}
                          </button>
                          <button
                            onClick={() => handleSale(p)}
                            className={`sale ${saleLoadingId === p.clothingItemId ? "loading" : ""}`}
                            disabled={loading || saleLoadingId === p.clothingItemId || quantityZero}
                            title={t("products.sale.tooltip", { defaultValue: "Record a sale (reduce stock by 1)" })}
                          >
                            {saleLoadingId === p.clothingItemId ? t("products.sale.selling", { defaultValue: "Selling…" }) : t("products.sale.button", { defaultValue: "Sale" })}
                          </button>
                        </div>

                        <button
                          type="button"
                          className="more-trigger"
                          aria-haspopup="menu"
                          aria-expanded={openMenuId === p.clothingItemId}
                          onClick={(e) => { e.stopPropagation(); openActions(p) }}
                          title={t("products.actions.more", { defaultValue: "More options" })}
                        >
                          ...
                        </button>

                        {openMenuId === p.clothingItemId && (
                          <div className="action-menu" role="menu" aria-label={t("products.actions.more_menu", { defaultValue: "Product actions" })}>
                            <button role="menuitem" className="menu-item menu-edit" onClick={() => { closeAllMenus(); startEdit(p) }}>
                              {t("common.edit", { defaultValue: "Edit" })}
                            </button>
                            <button role="menuitem" className="menu-item menu-delete" onClick={() => { closeAllMenus(); handleDelete(p.clothingItemId) }}>
                              {t("common.delete", { defaultValue: "Delete" })}
                            </button>
                            <button
                              role="menuitem"
                              className="menu-item menu-pin"
                              disabled={pinLoadingId === p.clothingItemId}
                              onClick={() => { closeAllMenus(); togglePin(p) }}
                            >
                              {pinLabel}
                            </button>
                            <button
                              role="menuitem"
                              className="menu-item menu-sale"
                              disabled={saleLoadingId === p.clothingItemId || quantityZero}
                              onClick={() => { closeAllMenus(); handleSale(p) }}
                            >
                              {t("products.sale.button", { defaultValue: "Sale" })}
                            </button>
                          </div>
                        )}
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

      {sheetProduct && (
        <div className="bsheet is-open" aria-hidden={false}>
          <div className="bsheet-backdrop" onClick={() => setSheetProduct(null)} />
          <div className="bsheet-panel" role="dialog" aria-modal="true">
            <div className="bsheet-handle" />
            <div className="bsheet-header">
              <h4 className="bsheet-title">{sheetProduct.name}</h4>
              {sheetProduct.brand && (<div className="bsheet-sub">{sheetProduct.brand}</div>)}
            </div>
            <div className="bsheet-actions">
              <button className="sheet-btn primary" onClick={() => { setSheetProduct(null); startEdit(sheetProduct); }}>
                {t("common.edit", { defaultValue: "Edit" })}
              </button>
              <button className="sheet-btn danger" onClick={() => { setSheetProduct(null); handleDelete(sheetProduct.clothingItemId); }}>
                {t("common.delete", { defaultValue: "Delete" })}
              </button>
              <button className="sheet-btn info" disabled={pinLoadingId === sheetProduct.clothingItemId} onClick={() => { setSheetProduct(null); togglePin(sheetProduct); }}>
                {isPinned(sheetProduct.clothingItemId) ? t("products.pin.unpin", { defaultValue: "Unpin" }) : t("products.pin.pin", { defaultValue: "Pin" })}
              </button>
              <button
                className="sheet-btn success"
                disabled={saleLoadingId === sheetProduct.clothingItemId || (sheetProduct.quantity ?? 0) <= 0}
                onClick={() => { setSheetProduct(null); handleSale(sheetProduct); }}
              >
                {t("products.sale.button", { defaultValue: "Sale" })}
              </button>
            </div>
            <div className="bsheet-footer">
              <button className="sheet-close" onClick={() => setSheetProduct(null)}>
                {t("common.close", { defaultValue: "Close" })}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
