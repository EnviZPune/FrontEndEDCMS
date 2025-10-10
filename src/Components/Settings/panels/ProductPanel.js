import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"
import { useApiClient } from "../hooks/useApiClient"
import { useAuth } from "../hooks/useAuth"
import Pagination from "../../Pagination.tsx"
import "../../../Styling/Settings/productpanel.css"
import { FaEdit, FaTrashAlt, FaThumbtack, FaDollarSign, FaEllipsisH, FaPlus } from "react-icons/fa"

const CLOTHING_ITEM_API = "/ClothingItem"

const SizeKind = Object.freeze({ Alpha: 1, Numeric: 2, WaistInseam: 3, OneSize: 4 })

function Portal({ children }) {
  if (typeof window === "undefined") return null
  return createPortal(children, document.body)
}

function Modal({ isOpen, title, onClose, className = "", children, footer, scopeClass = "productspanel-portal" }) {
  const isClient = typeof window !== "undefined"
  useEffect(() => {
    if (!isOpen || !isClient) return
    const root = document.documentElement
    root.classList.add("no-scroll")
    const onEsc = (e) => e.key === "Escape" && onClose?.()
    document.addEventListener("keydown", onEsc)
    return () => {
      root.classList.remove("no-scroll")
      document.removeEventListener("keydown", onEsc)
    }
  }, [isOpen, isClient, onClose])
  if (!isOpen) return null
  return (
    <Portal>
      <div className={`pp-modal is-open ${scopeClass}`} aria-hidden={false}>
        <div className={`pp-modal-backdrop ${scopeClass}`} onClick={onClose} />
        <div className={`pp-modal-dialog ${className} ${scopeClass}`} role="dialog" aria-modal="true">
          <header className="pp-modal-header">
            <h4 className="pp-modal-title">{title}</h4>
            <button className="pp-modal-x" onClick={onClose} aria-label="Close">×</button>
          </header>
          <div className="pp-modal-body">{children}</div>
          {footer && <footer className="pp-modal-actions">{footer}</footer>}
        </div>
      </div>
    </Portal>
  )
}


export default function ProductPanel({ business }) {
  const { t } = useTranslation("productpanel")
  const { get, post, put, del } = useApiClient()
  const { role, userInfo } = useAuth()

  const fileInputRef = useRef(null)
  const getRef = useRef(get)
  useEffect(() => { getRef.current = get }, [get])

  const csv = (s) => (s || "").split(",").map((x) => x.trim()).filter(Boolean)

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
  const [showEditor, setShowEditor] = useState(false)

  const pageSize = 10

  const [fieldErrors, setFieldErrors] = useState({ name: null, price: null, quantity: null, size: null })
  const [touched, setTouched] = useState({ name: false, price: false, quantity: false, size: false })

  const [form, setForm] = useState({
    name: "", description: "", price: "", quantity: "",
    categoryId: "", brand: "", model: "",
    photos: [], colors: "", size: "", material: "",
  })

  const [mainPhotoIndex, setMainPhotoIndex] = useState(0)
  const [dragOver, setDragOver] = useState(false)

  const businessId = business?.businessId
  const bId = Number(businessId)
  const validBusinessId = Number.isInteger(bId) && bId > 0

  const isPhone = () => (typeof window !== "undefined") && window.matchMedia("(max-width: 768px)").matches

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

  const ALPHA = /^(XXXS|XXS|XS|S|M|L|XL|XXL|XXXL)$/i
  const ONESIZE = /^(ONE-?SIZE|OS)$/i
  const NUMERIC = /^(?:\d{1,3})(?:\.\d)?$/i
  const WAIST_INSEAM = /^(?:\d{2,3})(?:[Ww])?(?:[ /-]?(?:\d{2,3})(?:[Ll])?)?$/i
  const ALPHA_ORDER = ["XXXS", "XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"]

  const validateSize = useCallback((v) => {
    const s = (v || "").trim()
    if (!s) return t("products.errors.size_required", { defaultValue: "Size is required" })
    const tokens = csv(s)
    if (tokens.length === 0) return t("products.errors.size_required", { defaultValue: "Size is required" })
    const bad = tokens.filter((tok) => {
      if (ALPHA.test(tok)) return false
      if (ONESIZE.test(tok)) return false
      if (NUMERIC.test(tok)) {
        const n = parseFloat(tok)
        return !(n >= 1 && n <= 200)
      }
      if (WAIST_INSEAM.test(tok)) return false
      return true
    })
    if (bad.length > 0) return t("products.errors.size_invalid_tokens", { defaultValue: `Invalid size value(s): ${bad.join(", ")}` })
    return null
  }, [t])

  const setField = (key, value, validator) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (touched[key]) setFieldErrors((prev) => ({ ...prev, [key]: validator ? validator(value) : null }))
  }

  const normalizePinned = useCallback((payload) => {
    if (!payload) return new Set()
    const arr =
      Array.isArray(payload) ? payload :
      Array.isArray(payload?.items) ? payload.items :
      Array.isArray(payload?.data) ? payload.data :
      Array.isArray(payload?.results) ? payload.results : []
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
      setLoading(true); setError(null)
      try {
        await Promise.all([loadAllProducts(bId), loadCategories(bId), loadPinned(bId)])
      } catch {
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

  const [variantQty, setVariantQty] = useState({})
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

  const parseSizes = useCallback((sizeCsv) => {
    const tokens = csv(sizeCsv)
    const sizes = []
    for (const rawTok of tokens) {
      const tok = rawTok.trim()
      if (!tok) continue
      if (ALPHA.test(tok)) {
        const idx = ALPHA_ORDER.findIndex((x) => x.toLowerCase() === tok.toLowerCase())
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
    const arr = csv(form.colors).map((c) => c.trim()).filter(Boolean)
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
    setVariantQty((prev) => {
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
    for (const color of parsedColors) for (const s of parsedSizes) sum += variantQty[cellKey(color, s.key)] ?? 0
    return sum
  }, [gridActive, parsedColors, parsedSizes, variantQty])

  useEffect(() => {
    if (!gridActive) return
    setForm((prev) => ({ ...prev, quantity: String(gridTotalQty) }))
    setFieldErrors((prev) => ({ ...prev, quantity: null }))
  }, [gridActive, gridTotalQty])

  const onCellQtyChange = (color, sizeKey, value) => {
    const num = Math.max(0, Math.floor(Number(value || 0)))
    const k = cellKey(color, sizeKey)
    setVariantQty((prev) => ({ ...prev, [k]: Number.isFinite(num) ? num : 0 }))
  }

  const buildVariantsPayload = useCallback(() => {
    if (!gridActive) return []
    const out = []
    for (const color of parsedColors) {
      for (const s of parsedSizes) {
        const qty = variantQty[cellKey(color, s.key)] ?? 0
        out.push({ color, sizeKind: s.sizeKind, a: s.a, b: s.b, quantity: qty, isActive: true })
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
    const totalQuantity = gridActive
      ? variants.reduce((acc, v) => acc + (v.quantity || 0), 0)
      : (Number.parseInt(form.quantity, 10) || 0)
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
      } catch {
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
      } catch {
        return await del(`${CLOTHING_ITEM_API}/${id}?businessId=${bId}`)
      }
    }
  }, [del, bId])

  const saveProduct = useCallback(async () => {
    setTouched((prev) => ({ ...prev, name: true, price: true, size: true, quantity: !gridActive }))
    const nameErr = validateProductName(form.name)
    const priceErr = validatePrice(form.price)
    const sizeErr = validateSize(form.size)
    const qtyErr = gridActive ? null : validateQuantity(form.quantity)
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
        const variantsPascal = (dto.variants || []).map((v) => ({ Color: v.color, SizeKind: v.sizeKind, A: v.a, B: v.b, Quantity: v.quantity, IsActive: v.isActive }))
        const itemDtoProposal = {
          BusinessId: dto.businessId, BusinessIds: dto.businessIds,
          ClothingItemId: editingId || 0, Name: dto.name, Description: dto.description,
          Price: dto.price, Quantity: dto.quantity, ClothingCategoryId: dto.clothingCategoryId,
          Brand: dto.brand, Model: dto.model, PictureUrls: dto.pictureUrls, Colors: dto.colors,
          Sizes: dto.sizes, Material: dto.material, Variants: variantsPascal,
        }
        await post("/ProposedChanges/submit", { BusinessId: dto.businessId, Type: editingId ? "Update" : "Create", ItemDto: itemDtoProposal })
        alert(t("products.alerts.change_proposed", { defaultValue: "Your change has been proposed and is pending approval." }))
      } else {
        if (editingId) await smartPutClothingItem(editingId, dto)
        else await post(`${CLOTHING_ITEM_API}`, dto)
        await loadAllProducts(bId)
        alert(t("products.alerts.saved", { defaultValue: "Product saved successfully!" }))
      }
      setShowEditor(false)
      resetForm()
    } catch (err) {
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
        await post("/ProposedChanges/submit", { BusinessId: bId, Type: "Delete", ItemDto: { ClothingItemId: id, BusinessId: bId, BusinessIds: [bId] } })
        alert(t("products.alerts.delete_proposed", { defaultValue: "Delete request submitted for approval." }))
      } else {
        await smartDeleteClothingItem(id)
        await loadAllProducts(bId)
        setPinnedIds((prev) => { const next = new Set(prev); next.delete(id); return next })
        alert(t("products.alerts.deleted", { defaultValue: "Product deleted successfully." }))
      }
    } catch (err) {
      setError(err?.message ? t("products.errors.delete_failed_with_reason", { defaultValue: "Failed to delete product: {{reason}}", reason: err.message }) : t("products.errors.delete_failed", { defaultValue: "Failed to delete product. Please check console/network for details." }))
    } finally { setLoading(false) }
  }, [validBusinessId, role, post, t, bId, loadAllProducts, smartDeleteClothingItem])

  const startEdit = useCallback((product) => {
    const pics =
      Array.isArray(product.pictureUrls) ? product.pictureUrls :
      typeof product.pictureUrls === "string" && product.pictureUrls.trim()
        ? (() => { try { const arr = JSON.parse(product.pictureUrls); return Array.isArray(arr) ? arr : [product.pictureUrls] } catch { return [product.pictureUrls] } })()
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
    const variantsRaw = Array.isArray(product.variants) ? product.variants : (Array.isArray(product.Variants) ? product.Variants : [])
    const initialVQty = {}
    for (const v of variantsRaw) {
      const color = String(v.color ?? v.Color ?? "").toLowerCase()
      const kind = Number(v.sizeKind ?? v.SizeKind ?? v.kind ?? v.Kind ?? v?.size?.kind ?? v?.size?.Kind) || 0
      const a = Number(v.a ?? v.A ?? v?.size?.a ?? v?.size?.A) || 0
      const b = Number(v.b ?? v.B ?? v?.size?.b ?? v?.size?.B) || 0
      const qty = Number(v.quantity ?? v.Quantity) || 0
      const key = `${color}|${kind}:${a}:${b}`
      initialVQty[key] = qty
    }
    setVariantQty(initialVQty)
    setMainPhotoIndex(0); setError(null)
    setTouched({ name: false, price: false, quantity: false, size: false })
    setFieldErrors({ name: null, price: null, quantity: null, size: null })
    setShowEditor(true)
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

  const formatSizeLabel = (sizeKind, a, b) => {
    const ORDER = ["XXXS", "XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"]
    if (sizeKind === SizeKind.Alpha) return ORDER[a] ?? "Unknown"
    if (sizeKind === SizeKind.Numeric) return String(a)
    if (sizeKind === SizeKind.WaistInseam) return b ? `${a}/${b}` : String(a)
    if (sizeKind === SizeKind.OneSize) return "OS"
    return "Unknown"
  }

  const fetchItemById = async (id) => getRef.current(`/ClothingItem/${id}`)

  const normalizeVariantsForSale = (variantsRaw) => {
    const vs = Array.isArray(variantsRaw) ? variantsRaw : []
    const norm = vs.map((v) => {
      const sizeKind = Number(v.sizeKind ?? v.SizeKind ?? 0)
      const a = Number(v.a ?? v.A ?? 0)
      const b = Number(v.b ?? v.B ?? 0)
      const color = String(v.color ?? v.Color ?? "Default")
      const type = String(v.type ?? v.Type ?? "Default")
      const quantity = Number(v.quantity ?? v.Quantity ?? 0)
      const sizeLabel = formatSizeLabel(sizeKind, a, b)
      const key = `${sizeKind}:${a}:${b}`
      const variantId = v.variantId ?? v.VariantId ?? v.clothingItemVariantId ?? v.ClothingItemVariantId ?? v.id ?? v.Id ?? null
      const sku = v.sku ?? v.Sku ?? null
      return { key, sizeKind, a, b, color, type, quantity, sizeLabel, sku, variantId }
    })
    return norm.filter((v) => v.quantity > 0)
  }

  const [saleProduct, setSaleProduct] = useState(null)
  const [saleVariants, setSaleVariants] = useState([])
  const [saleSelectedColor, setSaleSelectedColor] = useState("")
  const [saleSelectedType, setSaleSelectedType] = useState("")
  const [saleSelectedSizeKey, setSaleSelectedSizeKey] = useState("")
  const [saleSubmitting, setSaleSubmitting] = useState(false)

  const saleColors = useMemo(() => Array.from(new Set(saleVariants.map((v) => v.color))), [saleVariants])
  const saleTypes = useMemo(() => {
    const filtered = saleVariants.filter((v) => v.color === saleSelectedColor).map((v) => v.type || "Default")
    const arr = Array.from(new Set(filtered))
    return arr.length ? arr : Array.from(new Set(saleVariants.map((v) => v.type || "Default")))
  }, [saleVariants, saleSelectedColor])

  const saleSizes = useMemo(() => {
    const arr = saleVariants
      .filter((v) => v.color === saleSelectedColor && (saleSelectedType ? v.type === saleSelectedType : true))
      .map((v) => ({ key: v.key, label: v.variantId ? `${v.sizeLabel} (#${v.variantId})` : v.sizeLabel, a: v.a, b: v.b, sizeKind: v.sizeKind, variantId: v.variantId }))
    const uniq = new Map()
    for (const s of arr) if (!uniq.has(s.key)) uniq.set(s.key, s)
    return Array.from(uniq.values()).sort((x, y) => (x.sizeKind - y.sizeKind) || (x.a - y.a) || (x.b - y.b))
  }, [saleVariants, saleSelectedColor, saleSelectedType])

  const openSaleDialog = useCallback(async (product) => {
    if (!validBusinessId) { setError(t("products.errors.select_business_first", { defaultValue: "Select a business first." })); return }
    setSaleLoadingId(product.clothingItemId)
    try {
      let variantsRaw = Array.isArray(product.variants) ? product.variants : Array.isArray(product.Variants) ? product.Variants : null
      if (!variantsRaw) {
        const full = await fetchItemById(product.clothingItemId)
        variantsRaw = full?.variants || full?.Variants || []
      }
      const sellable = normalizeVariantsForSale(variantsRaw)
      if (!sellable.length) throw new Error(t("products.errors.no_stock_variants", { defaultValue: "No in-stock variants to sell for this product." }))
      setSaleProduct(product)
      setSaleVariants(sellable)
      const first = sellable[0]
      setSaleSelectedColor(first.color)
      setSaleSelectedType(first.type || "Default")
      setSaleSelectedSizeKey(first.key)
    } catch (e) {
      setError(e?.message || t("products.errors.sale_failed", { defaultValue: "Failed to start sale." }))
    } finally {
      setSaleLoadingId(null)
    }
  }, [validBusinessId, t])

  const confirmSale = useCallback(async () => {
    if (!saleProduct) return
    const seller = myDisplayName(userInfo) || undefined
    const chosen = saleVariants.find(
      (v) =>
        v.color === saleSelectedColor &&
        (saleSelectedType ? v.type === saleSelectedType : true) &&
        v.key === saleSelectedSizeKey
    )
    if (!chosen) { setError(t("products.errors.sale_failed", { defaultValue: "Failed to record sale." })); return }
    setSaleSubmitting(true)
    try {
      const body = {
        businessId: bId, quantity: 1, soldByName: seller,
        ...(chosen.variantId ? { variantId: chosen.variantId } : { color: chosen.color, size: chosen.sizeLabel }),
      }
      await post(`/Sales/ClothingItem/${saleProduct.clothingItemId}/sale`, body)
      setProducts((prev) =>
        prev.map((p) => {
          if (p.clothingItemId !== saleProduct.clothingItemId) return p
          const next = { ...p }
          next.quantity = Math.max((next.quantity ?? 0) - 1, 0)
          const arr = Array.isArray(next.variants) ? next.variants : (Array.isArray(next.Variants) ? next.Variants : null)
          if (arr) {
            const idx = arr.findIndex((v) => {
              const sizeKind = Number(v.sizeKind ?? v.SizeKind ?? 0)
              const a = Number(v.a ?? v.A ?? 0)
              const b = Number(v.b ?? v.B ?? 0)
              const key = `${sizeKind}:${a}:${b}`
              const color = String(v.color ?? v.Color ?? "Default")
              const type = String(v.type ?? v.Type ?? "Default")
              return key === chosen.key && color.toLowerCase() === chosen.color.toLowerCase() && type === (chosen.type || "Default")
            })
            if (idx >= 0) {
              const v = { ...arr[idx] }
              const q = Number(v.quantity ?? v.Quantity ?? 0)
              if ("quantity" in v) v.quantity = Math.max(q - 1, 0)
              else v.Quantity = Math.max(q - 1, 0)
              const newArr = arr.slice()
              newArr[idx] = v
              if (Array.isArray(next.variants)) next.variants = newArr
              else next.Variants = newArr
            }
          }
          return next
        })
      )
      window.dispatchEvent(new CustomEvent("sale-recorded", { detail: { businessId: bId } }))
      setSaleProduct(null); setSaleVariants([]); setSaleSelectedColor(""); setSaleSelectedType(""); setSaleSelectedSizeKey("")
    } catch (err) {
      setError(err?.message || t("products.errors.sale_failed", { defaultValue: "Failed to record sale." }))
    } finally { setSaleSubmitting(false) }
  }, [saleProduct, saleVariants, saleSelectedColor, saleSelectedType, saleSelectedSizeKey, userInfo, bId, post, t])

  const isPinned = useCallback((id) => pinnedIds.has(id), [pinnedIds])

  const togglePin = useCallback(async (product) => {
    if (!validBusinessId) return
    const id = product.clothingItemId
    const currentlyPinned = isPinned(id)
    try {
      setPinLoadingId(id)
      if (currentlyPinned) {
        await put(`${CLOTHING_ITEM_API}/business/${bId}/items/${id}/unpin`)
        setPinnedIds((prev) => { const next = new Set(prev); next.delete(id); return next })
      } else {
        await put(`${CLOTHING_ITEM_API}/business/${bId}/items/${id}/pin`)
        setPinnedIds((prev) => { const next = new Set(prev); next.add(id); return next })
      }
    } catch (err) {
      setError(err?.message || t("products.errors.pin_failed", { defaultValue: "Failed to toggle pin." }))
    } finally { setPinLoadingId(null) }
  }, [validBusinessId, isPinned, put, t, bId])

  const formValid =
    !validateProductName(form.name) &&
    !validatePrice(form.price) &&
    !validateSize(form.size) &&
    (gridActive ? true : !validateQuantity(form.quantity)) &&
    validBusinessId

  useEffect(() => {
    const onDocClick = (e) => {
      const open = document.querySelector(".action-menu.inline")
      if (open && !open.contains(e.target) && !e.target.closest(".more-trigger")) setOpenMenuId(null)
    }
    document.addEventListener("click", onDocClick)
    return () => document.removeEventListener("click", onDocClick)
  }, [])

  const openActions = (product) => {
    setOpenMenuId(null); setSheetProduct(null)
    if (isPhone()) {
      setSheetProduct(product)
    } else {
      setOpenMenuId((prev) => (prev === product.clothingItemId ? null : product.clothingItemId))
    }
  }

  if (!business) {
    return (
      <div className="productspanel">
        <div className="no-business-selected">
          <h3>{t("products.empty.no_business_title", { defaultValue: "No Business Selected" })}</h3>
          <p>{t("products.empty.no_business_desc", { defaultValue: "Please select a business to manage products." })}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="productspanel">
      {error && (
        <div className="panel error">
          <div className="error-message">
            <span className="error-icon">!</span>
            <div>
              <h4>{t("common.error", { defaultValue: "Error" })}</h4>
              <p>{error}</p>
            </div>
            <button onClick={() => setError(null)} className="error-close" aria-label={t("common.close", { defaultValue: "Close" })}>×</button>
          </div>
        </div>
      )}

      <div className="panel product-list">
        <div className="panel-head">
          <div className="panel-titles">
            <h3 className="panel-title">{t("products.list.title_with_count", { defaultValue: "Products ({{count}})", count: totalCount })}</h3>
            <p className="panel-sub">{business?.name || ""}</p>
          </div>
          <div className="panel-tools">
            <input
              className="search"
              type="text"
              placeholder={t("products.search.placeholder", { defaultValue: "Search products..." })}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={loading}
            />
            <button
              className="primary add-btn"
              onClick={() => { resetForm(); setShowEditor(true) }}
              title={t("products.actions.add", { defaultValue: "Add Product" })}
            >
              <FaPlus aria-hidden /> <span>{t("products.actions.add", { defaultValue: "Add Product" })}</span>
            </button>
          </div>
        </div>

        {loading && products.length === 0 ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>{t("products.list.loading", { defaultValue: "Loading products..." })}</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="products-table">
              <thead>
                <tr>
                  <th className="col-name">{t("products.table.name", { defaultValue: "Name" })}</th>
                  <th className="col-model">{t("products.table.model", { defaultValue: "Model" })}</th>
                  <th className="col-price">{t("products.table.price", { defaultValue: "Price" })}</th>
                  <th className="col-sizes">{t("products.table.sizes", { defaultValue: "Sizes" })}</th>
                  <th className="col-qty">{t("products.table.qty", { defaultValue: "Qty" })}</th>
                  <th className="col-colors">{t("products.table.colors", { defaultValue: "Colors" })}</th>
                  <th className="actions-col">{t("products.table.actions", { defaultValue: "Actions" })}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.length > 0 ? (
                  paginatedProducts.map((p) => {
                    const pinned = isPinned(p.clothingItemId)
                    const pinLabel = pinned ? t("products.pin.unpin", { defaultValue: "Unpin" }) : t("products.pin.pin", { defaultValue: "Pin" })
                    const quantityZero = (p.quantity ?? 0) <= 0
                    const displaySizes = joinForDisplay(p.sizes)
                    const displayColors = joinForDisplay(p.colors)
                    return (
                      <tr key={p.clothingItemId}>
                        <td className="col-name">
                          <div className="name-cell">
                            <span className="name">{p.name}</span>
                            {p.brand && <span className="brand"> — {p.brand}</span>}
                            {pinned && <span className="pin-badge" title={t("products.pin.pinned_badge", { defaultValue: "Pinned" })}>📌</span>}
                          </div>
                        </td>
                        <td className="col-model">{p.model || ""}</td>
                        <td className="col-price">LEK {p.price}</td>
                        <td className="col-sizes">{displaySizes || ""}</td>
                        <td className="col-qty">{p.quantity}</td>
                        <td className="col-colors">{displayColors || ""}</td>
                        <td className="actions-col">
                          <div className="row-actions">
                            <div className="btns">
                              <button
                                onClick={() => startEdit(p)}
                                disabled={loading}
                                className="icon-btn edit"
                                title={t("common.edit", { defaultValue: "Edit" })}
                                aria-label={t("common.edit", { defaultValue: "Edit" })}
                              >
                                <FaEdit />
                              </button>
                              <button
                                onClick={() => handleDelete(p.clothingItemId)}
                                disabled={loading}
                                className="icon-btn delete"
                                title={t("common.delete", { defaultValue: "Delete" })}
                                aria-label={t("common.delete", { defaultValue: "Delete" })}
                              >
                                <FaTrashAlt />
                              </button>
                              <button
                                onClick={() => togglePin(p)}
                                disabled={loading || pinLoadingId === p.clothingItemId}
                                className={`icon-btn pin ${pinned ? "is-pinned" : ""}`}
                                data-pinned={pinned ? "true" : "false"}
                                title={pinLabel}
                                aria-label={pinLabel}
                              >
                                {pinLoadingId === p.clothingItemId ? <span className="btn-spinner" /> : <FaThumbtack />}
                              </button>
                              <button
                                onClick={() => openSaleDialog(p)}
                                className={`icon-btn sale ${saleLoadingId === p.clothingItemId ? "loading" : ""}`}
                                disabled={loading || saleLoadingId === p.clothingItemId || quantityZero}
                                title={t("products.sale.tooltip", { defaultValue: "Record a sale" })}
                                aria-label={t("products.sale.tooltip", { defaultValue: "Record a sale" })}
                              >
                                {saleLoadingId === p.clothingItemId ? <span className="btn-spinner" /> : <FaDollarSign />}
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
                              <FaEllipsisH />
                            </button>
                            {openMenuId === p.clothingItemId && !isPhone() && (
                              <div className="action-menu inline" role="menu" aria-label={t("products.actions.more_menu", { defaultValue: "Product actions" })}>
                                <button role="menuitem" className="menu-item menu-edit" onClick={() => { setOpenMenuId(null); startEdit(p) }}>
                                  {t("common.edit", { defaultValue: "Edit" })}
                                </button>
                                <button role="menuitem" className="menu-item menu-delete" onClick={() => { setOpenMenuId(null); handleDelete(p.clothingItemId) }}>
                                  {t("common.delete", { defaultValue: "Delete" })}
                                </button>
                                <button role="menuitem" className="menu-item menu-pin" disabled={pinLoadingId === p.clothingItemId} onClick={() => { setOpenMenuId(null); togglePin(p) }}>
                                  {pinLabel}
                                </button>
                                <button role="menuitem" className="menu-item menu-sale" disabled={saleLoadingId === p.clothingItemId || quantityZero} onClick={() => { setOpenMenuId(null); openSaleDialog(p) }}>
                                  {t("products.sale.button", { defaultValue: "Sale" })}
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="no-results">
                      {searchQuery ? t("products.search.no_match", { defaultValue: "No products match your search." }) : t("products.list.empty", { defaultValue: "No products found." })}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {totalCount > pageSize && (
          <div className="list-pagination">
            <Pagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} maxButtons={5} />
          </div>
        )}
      </div>

      {sheetProduct && isPhone() && (
        <Portal>
          <div className="pp-modal-backdrop productspanel-portal" onClick={() => setSheetProduct(null)} />
          <div className="action-menu mobile-sheet is-open productspanel-portal" role="menu" aria-label={t("products.actions.more_menu", { defaultValue: "Product actions" })}>
            <button role="menuitem" className="menu-item menu-edit" onClick={() => { setSheetProduct(null); startEdit(sheetProduct) }}>
              {t("common.edit", { defaultValue: "Edit" })}
            </button>
            <button role="menuitem" className="menu-item menu-delete" onClick={() => { setSheetProduct(null); handleDelete(sheetProduct.clothingItemId) }}>
              {t("common.delete", { defaultValue: "Delete" })}
            </button>
            <button role="menuitem" className="menu-item menu-pin" onClick={() => { setSheetProduct(null); togglePin(sheetProduct) }} disabled={pinLoadingId === sheetProduct.clothingItemId}>
              {isPinned(sheetProduct.clothingItemId) ? t("products.pin.unpin", { defaultValue: "Unpin" }) : t("products.pin.pin", { defaultValue: "Pin" })}
            </button>
            <button role="menuitem" className="menu-item menu-sale" onClick={() => { setSheetProduct(null); openSaleDialog(sheetProduct) }} disabled={(sheetProduct.quantity ?? 0) <= 0}>
              {t("products.sale.button", { defaultValue: "Sale" })}
            </button>
          </div>
        </Portal>
      )}

      <Modal
  isOpen={showEditor}
  title={editingId
    ? t("products.titles.edit", { defaultValue: "Edit Product" })
    : t("products.titles.add",  { defaultValue: "Add New Product" })
  }
  onClose={() => { setShowEditor(false); resetForm(); }}
  className="editor-dialog"
  footer={
    <>
      <button
        type="button"
        className="sheet-btn secondary"
        onClick={() => { setShowEditor(false); resetForm(); }}
        disabled={loading}
      >
        {t("common.cancel", { defaultValue: "Cancel" })}
      </button>
      <button
        type="button"
        className="sheet-btn primary"
        onClick={saveProduct}
        disabled={!formValid || loading}
        autoFocus
      >
        {editingId
          ? t("common.save", { defaultValue: "Save" })
          : t("products.actions.create", { defaultValue: "Create" })}
      </button>
    </>
  }
>
        <div className="form-grid">
          <div className="form-col">
            <label htmlFor="product-name">{t("products.fields.name_req", { defaultValue: "Product Name *" })}</label>
            <input
              id="product-name"
              placeholder={t("products.placeholders.name", { defaultValue: "Enter product name" })}
              value={form.name}
              onChange={(e) => setField("name", e.target.value, validateProductName)}
              onBlur={() => { setTouched((p) => ({ ...p, name: true })); setFieldErrors((p) => ({ ...p, name: validateProductName(form.name) })) }}
              disabled={loading}
              className={touched.name && fieldErrors.name ? "input-error" : ""}
              aria-invalid={touched.name && !!fieldErrors.name}
              aria-describedby="product-name-err"
            />
            {touched.name && fieldErrors.name && <div id="product-name-err" className="field-error" role="alert">{fieldErrors.name}</div>}
          </div>

          <div className="form-col">
            <label htmlFor="product-brand">{t("products.fields.brand", { defaultValue: "Brand" })}</label>
            <input id="product-brand" placeholder={t("products.placeholders.brand", { defaultValue: "Enter brand name" })} value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} disabled={loading} />
          </div>

          <div className="form-col">
            <label htmlFor="product-model">{t("products.fields.model", { defaultValue: "Model" })}</label>
            <input id="product-model" placeholder={t("products.placeholders.model", { defaultValue: "Enter model" })} value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} disabled={loading} />
          </div>

          <div className="form-col">
            <label htmlFor="product-price">{t("products.fields.price_req", { defaultValue: "Price in LEK *" })}</label>
            <input
              id="product-price" type="number" step="0.01" min="0" placeholder="0.00"
              value={form.price}
              onChange={(e) => setField("price", e.target.value, validatePrice)}
              onBlur={() => { setTouched((p) => ({ ...p, price: true })); setFieldErrors((p) => ({ ...p, price: validatePrice(form.price) })) }}
              disabled={loading}
              className={touched.price && fieldErrors.price ? "input-error" : ""}
              aria-invalid={touched.price && !!fieldErrors.price}
              aria-describedby="product-price-err"
            />
            {touched.price && fieldErrors.price && <div id="product-price-err" className="field-error" role="alert">{fieldErrors.price}</div>}
          </div>

          <div className="form-col">
            <label htmlFor="product-quantity">{gridActive ? t("products.fields.total_qty_auto", { defaultValue: "Total Quantity (auto)" }) : t("products.fields.quantity_req", { defaultValue: "Quantity *" })}</label>
            <input
              id="product-quantity" type="number" min="0" placeholder="0"
              value={gridActive ? String(gridTotalQty) : form.quantity}
              onChange={(e) => gridActive ? void 0 : setField("quantity", e.target.value, validateQuantity)}
              onBlur={() => { if (!gridActive) { setTouched((p) => ({ ...p, quantity: true })); setFieldErrors((p) => ({ ...p, quantity: validateQuantity(form.quantity) })) } }}
              disabled={loading || gridActive}
              className={!gridActive && touched.quantity && fieldErrors.quantity ? "input-error" : ""}
              aria-invalid={!gridActive && touched.quantity && !!fieldErrors.quantity}
              aria-describedby="product-quantity-err"
              readOnly={gridActive}
            />
            {!gridActive && touched.quantity && fieldErrors.quantity && <div id="product-quantity-err" className="field-error" role="alert">{fieldErrors.quantity}</div>}
          </div>

          <div className="form-col">
            <label htmlFor="product-category">{t("products.fields.category", { defaultValue: "Category" })}</label>
            <select id="product-category" value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))} disabled={loading}>
              <option value="">{t("products.placeholders.category", { defaultValue: "Select category..." })}</option>
              {categories.map((c) => (
                <option key={c.clothingCategoryId} value={c.clothingCategoryId}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="form-col">
            <label htmlFor="product-size">{t("products.fields.size_req", { defaultValue: "Size(s) *" })}</label>
            <input
              id="product-size" placeholder={t("products.placeholders.size", { defaultValue: "e.g. M, 32W, One-Size" })}
              value={form.size}
              onChange={(e) => setField("size", e.target.value, validateSize)}
              onBlur={() => { setTouched((p) => ({ ...p, size: true })); setFieldErrors((p) => ({ ...p, size: validateSize(form.size) })) }}
              disabled={loading}
              className={touched.size && fieldErrors.size ? "input-error" : ""}
              aria-invalid={touched.size && !!fieldErrors.size}
              aria-describedby="product-size-err"
            />
            {touched.size && fieldErrors.size && <div id="product-size-err" className="field-error" role="alert">{fieldErrors.size}</div>}
          </div>

          <div className="form-col">
            <label htmlFor="product-colors">{t("products.fields.colors", { defaultValue: "Colors" })}</label>
            <input id="product-colors" placeholder={t("products.placeholders.colors", { defaultValue: "Red, Blue, Green" })} value={form.colors} onChange={(e) => setForm((f) => ({ ...f, colors: e.target.value }))} disabled={loading} />
          </div>

          <div className="form-col">
            <label htmlFor="product-material">{t("products.fields.material", { defaultValue: "Material" })}</label>
            <input id="product-material" placeholder={t("products.placeholders.material", { defaultValue: "Cotton, Polyester, etc." })} value={form.material} onChange={(e) => setForm((f) => ({ ...f, material: e.target.value }))} disabled={loading} />
          </div>

          <div className="form-col form-col--full">
            <label htmlFor="product-description">{t("products.fields.description", { defaultValue: "Description" })}</label>
            <textarea id="product-description" placeholder={t("products.placeholders.description", { defaultValue: "Enter product description" })} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} disabled={loading} />
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
                    {parsedSizes.map((s) => <th key={s.key}>{s.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {parsedColors.map((color) => (
                    <tr key={color}>
                      <td><strong>{color}</strong></td>
                      {parsedSizes.map((s) => {
                        const k = `${color.toLowerCase()}|${s.key}`
                        const val = variantQty[k] ?? 0
                        return (
                          <td key={k}>
                            <input
                              type="number" min="0" value={val}
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
          <label className="file-btn" aria-disabled={uploading || loading}>
            {uploading ? t("products.upload.uploading", { defaultValue: "Uploading..." }) : t("products.upload.button", { defaultValue: "Upload Photos" })}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
              disabled={uploading || loading}
            />
          </label>

          <div className={`photo-row ${dragOver ? "drag-over" : ""}`} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
            {form.photos.length === 0 && !uploading && (
              <div className="empty-photos">{t("products.upload.drop_hint", { defaultValue: "Drop photos here or click upload button" })}</div>
            )}
            {form.photos.map((url, index) => (
              <div key={`${url}-${index}`} className={`thumb ${index === mainPhotoIndex ? "selected" : ""}`} onClick={() => setMainPhotoIndex(index)} title={index === mainPhotoIndex ? t("products.upload.main_photo_title", { defaultValue: "Main photo" }) : t("products.upload.set_main_title", { defaultValue: "Click to set as main photo" })}>
                <img src={url || "/placeholder.svg"} alt={`Product photo ${index + 1}`} />
                <button type="button" onClick={(e) => { e.stopPropagation(); removePhoto(index) }} disabled={loading} title={t("products.upload.remove", { defaultValue: "Remove photo" })}>×</button>
                {index === mainPhotoIndex && <div className="main-photo-badge">{t("products.upload.main_badge", { defaultValue: "Main" })}</div>}
              </div>
            ))}
            {uploading && <div className="upload-progress"><div className="loading-spinner"></div></div>}
          </div>
          {form.photos.length > 0 && <p className="photo-help">{t("products.upload.help", { defaultValue: "Click a photo to set it as the main image. Max 10 photos." })}</p>}
        </div>
      </Modal>

      <Modal
        isOpen={!!saleProduct}
        title={t("products.sale.dialog_title", { defaultValue: "Record Sale" })}
        onClose={() => setSaleProduct(null)}
        className="sale-dialog"
        footer={
          <>
            <button className="sheet-btn danger" onClick={() => setSaleProduct(null)} disabled={saleSubmitting}>
              {t("common.cancel", { defaultValue: "Cancel" })}
            </button>
            <button className="sheet-btn success" onClick={() => confirmSale()} disabled={saleSubmitting || !saleSelectedColor || !saleSelectedSizeKey}>
              {saleSubmitting ? t("products.sale.selling", { defaultValue: "Selling…" }) : t("products.sale.button", { defaultValue: "Sale" })}
            </button>
          </>
        }
      >
        {saleProduct && (
          <>
            <div className="sale-hero">
              <div className="sale-thumb">
                {(() => {
                  const u = (() => {
                    const pu = saleProduct.pictureUrls
                    if (Array.isArray(pu)) return pu[0] || null
                    if (typeof pu === "string" && pu.trim()) {
                      try { const a = JSON.parse(pu); return Array.isArray(a) ? (a[0] || null) : pu } catch { return pu }
                    }
                    return null
                  })()
                  return u ? <img src={u} alt="" /> : <div className="thumb-fallback">📦</div>
                })()}
              </div>
              <div className="sale-titles">
                <div className="sale-name">{saleProduct.name}{saleProduct.brand ? ` — ${saleProduct.brand}` : ""}</div>
              </div>
            </div>
            <div className="form-grid modal-grid">
              <div className="form-col">
                <label>{t("products.sale.color", { defaultValue: "Color" })}</label>
                <select
                  value={saleSelectedColor}
                  onChange={(e) => {
                    setSaleSelectedColor(e.target.value)
                    const sizes = saleVariants.filter((v) => v.color === e.target.value && (saleSelectedType ? v.type === saleSelectedType : true))
                    setSaleSelectedSizeKey(sizes[0]?.key || "")
                  }}
                >
                  {saleColors.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {saleTypes.length > 1 && (
                <div className="form-col">
                  <label>{t("products.sale.type", { defaultValue: "Type" })}</label>
                  <select
                    value={saleSelectedType}
                    onChange={(e) => {
                      setSaleSelectedType(e.target.value)
                      const sizes = saleVariants.filter((v) => v.color === saleSelectedColor && v.type === e.target.value)
                      setSaleSelectedSizeKey(sizes[0]?.key || "")
                    }}
                  >
                    {saleTypes.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
                  </select>
                </div>
              )}
              <div className="form-col">
                <label>{t("products.sale.size", { defaultValue: "Size" })}</label>
                <select value={saleSelectedSizeKey} onChange={(e) => setSaleSelectedSizeKey(e.target.value)}>
                  {saleSizes.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
