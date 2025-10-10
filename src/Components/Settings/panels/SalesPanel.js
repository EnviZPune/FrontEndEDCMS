import React, { useEffect, useMemo, useState, useCallback, useRef } from "react"
import { useTranslation } from "react-i18next"
import "../../../Styling/Settings/salespanel.css"

const API_BASE = (import.meta?.env?.VITE_API_BASE_URL || "https://api.triwears.com").replace(/\/+$/,"")
const USE_COOKIES = false
const TIRANE_TZ = "Europe/Tirane"

function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("authToken") ||
    null
  )
}

function dateKeyLocal(date) {
  const d = date instanceof Date ? date : new Date(date)
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIRANE_TZ, year: "numeric", month: "2-digit", day: "2-digit"
  }).format(d)
}
function addDaysLocal(date, days) {
  const key = dateKeyLocal(date)
  const [y, m, d] = key.split("-").map(Number)
  const localMidnight = new Date(Date.UTC(y, m - 1, d))
  localMidnight.setUTCDate(localMidnight.getUTCDate() + days)
  return localMidnight
}
function startEndOfCurrentMonthUtc() {
  const now = new Date()
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: TIRANE_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now)
  const [y, m] = ymd.split("-").map(Number)
  const monthStartLocal = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0))
  const nextMonthLocal  = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0))
  nextMonthLocal.setUTCMonth(nextMonthLocal.getUTCMonth() + 1)
  return { from: monthStartLocal.toISOString(), to: nextMonthLocal.toISOString() }
}

function parseResponse(res) {
  if (Array.isArray(res)) return { list: res, total: res.length }
  if (res && typeof res === "object") {
    const list = Array.isArray(res.data) ? res.data : []
    const total = typeof res.total === "number" ? res.total : list.length
    return { list, total }
  }
  return { list: [], total: 0 }
}

/* ---------- Seller-name helpers (unchanged) ---------- */
const looksLikeGuid = (v) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
const looksLikeNumeric = (v) => typeof v === "number" || (typeof v === "string" && /^\d+$/.test(v))
const looksLikeId = (v) => looksLikeNumeric(v) || looksLikeGuid(v)

function titleCase(s) {
  return String(s)
    .replace(/[_.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b([a-z])/g, (_, c) => c.toUpperCase())
}
function nameFromEmailOrUsername(s) {
  if (!s) return null
  const str = String(s)
  const raw = str.includes("@") ? str.split("@")[0] : str
  return titleCase(raw)
}
function pickSellerRaw(sale) {
  const directName =
    sale.soldByName || sale.SoldByName ||
    (typeof sale.soldBy === "object" && (sale.soldBy?.name || sale.soldBy?.displayName)) ||
    (typeof sale.SoldBy === "object" && (sale.SoldBy?.name || sale.SoldBy?.displayName)) ||
    null
  if (directName) return { name: String(directName) }
  const id =
    sale.soldByUserId ?? sale.SoldByUserId ??
    sale.soldById ?? sale.SoldById ??
    sale.userId ?? sale.UserId ??
    sale.sellerId ?? sale.SellerId ??
    (typeof sale.soldBy === "string" || typeof sale.soldBy === "number" ? sale.soldBy : null) ??
    (typeof sale.SoldBy === "string" || typeof sale.SoldBy === "number" ? sale.SoldBy : null) ??
    null
  if (id == null) {
    const maybe = sale.soldBy ?? sale.SoldBy ?? sale.soldByName ?? sale.SoldByName
    const guessed = nameFromEmailOrUsername(maybe)
    return guessed ? { name: guessed } : {}
  }
  if (!looksLikeId(id)) {
    const guessed = nameFromEmailOrUsername(id)
    return guessed ? { name: guessed } : {}
  }
  return { id: String(id) }
}
async function resolveUserName(id, businessId, cache) {
  if (!id) return null
  if (cache.has(id)) return cache.get(id)
  const token = getToken()
  const headers = { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  const credOpt = USE_COOKIES ? { credentials: "include" } : {}
  const paths = [
    `/api/Users/${id}`,
    `/Users/${id}`,
    `/api/User/${id}`,
    `/User/${id}`,
    `/api/Business/${businessId}/Users/${id}`,
    `/Business/${businessId}/Users/${id}`,
    `/api/Employees/${id}`,
    `/Employees/${id}`,
  ]
  let name = null
  for (const p of paths) {
    try {
      const resp = await fetch(`${API_BASE}${p}`, { headers, ...credOpt })
      if (!resp.ok) continue
      const u = await resp.json()
      const full =
        u.displayName || u.fullName || u.name ||
        [u.firstName, u.lastName].filter(Boolean).join(" ") ||
        u.username || (u.email && nameFromEmailOrUsername(u.email)) || null
      if (full && String(full).trim()) { name = titleCase(full); break }
    } catch {}
  }
  if (!name) name = `User #${id}`
  cache.set(id, name)
  return name
}
async function decorateSalesWithSellerNames(list, businessId, cache) {
  const decorated = list.map(s => ({ ...s, _soldByResolved: null }))
  const ids = new Set()
  for (const s of decorated) {
    const { name, id } = pickSellerRaw(s)
    if (name) s._soldByResolved = titleCase(name)
    else if (id) { if (cache.has(id)) s._soldByResolved = cache.get(id); else ids.add(id) }
  }
  if (ids.size) {
    const arr = Array.from(ids)
    const results = await Promise.all(arr.map(i => resolveUserName(i, businessId, cache)))
    arr.forEach((i, idx) => cache.set(i, results[idx]))
    for (const s of decorated) {
      if (!s._soldByResolved) {
        const { id } = pickSellerRaw(s)
        if (id && cache.has(id)) s._soldByResolved = cache.get(id)
      }
    }
  }
  for (const s of decorated) {
    if (!s._soldByResolved) {
      const guess = nameFromEmailOrUsername(s.soldBy || s.SoldBy || s.soldByName || s.SoldByName)
      if (guess) s._soldByResolved = guess
    }
  }
  return decorated
}

/* ---------- Size/Color helpers (unchanged) ---------- */
const SizeKind = Object.freeze({ Alpha: 1, Numeric: 2, WaistInseam: 3, OneSize: 4 })
const ALPHA_ORDER = ["XXXS","XXS","XS","S","M","L","XL","XXL","XXXL"]
function computeSizeLabelFromFields(kindNum, a, b) {
  const kind = Number(kindNum) || 0
  const A = Number(a) || 0
  const B = Number(b) || 0
  if (kind === SizeKind.Alpha)  return ALPHA_ORDER[A] ?? "Unknown"
  if (kind === SizeKind.Numeric) return String(A)
  if (kind === SizeKind.WaistInseam) return B > 0 ? `${A}/${B}` : String(A)
  if (kind === SizeKind.OneSize) return "OS"
  return null
}
function extractSoldAt(sale) { return new Date(sale.soldAt ?? sale.SoldAt) }
function extractProductName(sale) { return sale.productName ?? sale.ProductName ?? "" }
function extractQuantity(sale) { return sale.quantity ?? sale.Quantity ?? 1 }
function extractUnitPrice(sale) { const v = sale.unitPriceAtSale ?? sale.UnitPriceAtSale; return v != null ? Number(v) : null }
function extractSku(sale) { return sale.sku ?? sale.Sku ?? null }
function extractVariantId(sale) { return sale.clothingItemVariantId ?? sale.ClothingItemVariantId ?? sale.variantId ?? sale.VariantId ?? null }
function extractColor(sale) { return sale.color ?? sale.Color ?? sale.variantColor ?? sale.VariantColor ?? null }
function extractSizeLabel(sale) {
  const snap = sale.sizeLabel ?? sale.SizeLabel
  if (snap) return snap
  const s = sale.size ?? sale.Size ?? sale.variantSize ?? sale.VariantSize
  if (s) return String(s)
  const kind = sale.sizeKind ?? sale.SizeKind
  const a = sale.a ?? sale.A
  const b = sale.b ?? sale.B
  return computeSizeLabelFromFields(kind, a, b)
}

/* ---------- Day report helpers (unchanged) ---------- */
function computeDayReport(items) {
  const productTotals = new Map()
  const sellerTotals = new Map()
  let revenue = 0
  for (const s of items) {
    const name = extractProductName(s) || "Unknown product"
    const qty = Number(extractQuantity(s) || 0)
    const unit = extractUnitPrice(s)
    const seller = (s._soldByResolved || s.soldByName || s.SoldByName || s.soldBy || "Unknown").toString()
    productTotals.set(name, (productTotals.get(name) || 0) + qty)
    sellerTotals.set(seller, (sellerTotals.get(seller) || 0) + qty)
    if (unit != null) revenue += unit * qty
  }
  const productsSorted = Array.from(productTotals.entries()).sort((a,b) => b[1] - a[1])
  const sellersSorted = Array.from(sellerTotals.entries()).sort((a,b) => b[1] - a[1])
  const bestSeller = sellersSorted[0] || null
  return { productsSorted, sellersSorted, bestSeller, revenue }
}

/* ---------- Sale details modal (unchanged) ---------- */
function SaleModal({ sale, onClose, t, fmtDate, fmtTime, money }) {
  const ref = useRef(null)
  useEffect(() => { ref.current?.focus() }, [])
  if (!sale) return null
  const soldAt = extractSoldAt(sale)
  const qty    = extractQuantity(sale)
  const size   = extractSizeLabel(sale)
  const color  = extractColor(sale)
  const variantId = extractVariantId(sale)
  const unit   = extractUnitPrice(sale)
  const total  = unit != null ? unit * qty : null
  const soldBy = sale._soldByResolved || sale.soldByName || sale.SoldByName || sale.soldBy || t("sales.unknown", { defaultValue: "Unknown" })
  const sku    = extractSku(sale)
  return (
    <div className="sp-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="sp-modal-title"
         onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
         onKeyDown={(e) => { if (e.key === "Escape") onClose() }}>
      <div className="sp-modal">
        <div className="sp-modal-head">
          <div>
            <h3 id="sp-modal-title" className="sp-modal-title">{extractProductName(sale)}</h3>
            <div className="sp-modal-sub">
              {fmtTime.format(soldAt)} · {fmtDate.format(soldAt)}
            </div>
          </div>
          <button ref={ref} className="sp-btn sp-btn-ghost sp-modal-close" onClick={onClose} aria-label={t("common.close", { defaultValue: "Close" })}>✕</button>
        </div>
        <div className="sp-kv">
          <div><label>{t("sales.qty", { defaultValue: "Quantity" })}</label><strong>{qty}</strong></div>
          {color ? <div><label>{t("sales.color", { defaultValue: "Color" })}</label><strong>{color}</strong></div> : null}
          {size  ? <div><label>{t("sales.size", { defaultValue: "Size" })}</label><strong>{size}</strong></div> : null}
          {sku   ? <div><label>{t("sales.sku", { defaultValue: "SKU" })}</label><strong>{sku}</strong></div> : null}
          {variantId ? <div><label>VariantId</label><strong>{variantId}</strong></div> : null}
          <div><label>{t("sales.sold_by", { defaultValue: "Sold by" })}</label><strong>{soldBy}</strong></div>
          {unit  != null ? <div><label>{t("sales.unit_price", { defaultValue: "Unit price" })}</label><strong>{money.format(unit)}</strong></div> : null}
          {total != null ? <div><label>{t("sales.total", { defaultValue: "Total" })}</label><strong>{money.format(total)}</strong></div> : null}
        </div>
      </div>
    </div>
  )
}

/* ---------- Day report modal (unchanged) ---------- */
function DayReportModal({ title, items, onClose, t, money }) {
  const ref = useRef(null)
  useEffect(() => { ref.current?.focus() }, [])
  if (!items) return null
  const { productsSorted, bestSeller, revenue, sellersSorted } = computeDayReport(items)
  return (
    <div className="sp-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="sp-day-title"
         onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
         onKeyDown={(e) => { if (e.key === "Escape") onClose() }}>
      <div className="sp-modal sp-modal-wide">
        <div className="sp-modal-head">
          <div>
            <h3 id="sp-day-title" className="sp-modal-title">
              {title} — {t("sales.day_report", { defaultValue: "Day Report" })}
            </h3>
            <div className="sp-modal-sub">
              {t("sales.total_revenue", { defaultValue: "Total revenue" })}: <strong>{money.format(revenue || 0)}</strong>
              {bestSeller ? <> · {t("sales.best_seller_by_units", { defaultValue: "Best seller (by units)" })}: <strong>{bestSeller[0]}</strong> ({bestSeller[1]})</> : null}
            </div>
          </div>
          <button ref={ref} className="sp-btn sp-btn-ghost sp-modal-close" onClick={onClose} aria-label={t("common.close", { defaultValue: "Close" })}>✕</button>
        </div>
        <div className="sp-report-grid">
          <div>
            <div className="sp-report-title">{t("sales.products_sold", { defaultValue: "Products sold" })}</div>
            <ul className="sp-report-list">
              {productsSorted.length ? productsSorted.map(([name, qty]) => (
                <li key={name} className="sp-report-row">
                  <span className="sp-ellipsis">{name}</span>
                  <strong>{qty}</strong>
                </li>
              )) : <li className="sp-muted">{t("sales.none", { defaultValue: "None" })}</li>}
            </ul>
          </div>
          <div>
            <div className="sp-report-title">{t("sales.sellers", { defaultValue: "Sellers" })}</div>
            <ul className="sp-report-list">
              {sellersSorted.length ? sellersSorted.map(([name, qty]) => (
                <li key={name} className="sp-report-row">
                  <span className="sp-ellipsis">{name}</span>
                  <strong>{qty}</strong>
                </li>
              )) : <li className="sp-muted">{t("sales.none", { defaultValue: "None" })}</li>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SalesPanel({ business }) {
  const { t, i18n } = useTranslation("sales")
  const locale = i18n?.language || navigator.language || "en-GB"

  const fmtTime  = useMemo(() => new Intl.DateTimeFormat(locale, {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false, timeZone: TIRANE_TZ, timeZoneName: "short"
  }), [locale])
  const fmtDate  = useMemo(() => new Intl.DateTimeFormat(locale, {
    day: "2-digit", month: "long", year: "numeric", timeZone: TIRANE_TZ
  }), [locale])
  const fmtLabel = useMemo(() => new Intl.DateTimeFormat(locale, {
    day: "numeric", month: "long", timeZone: TIRANE_TZ
  }), [locale])
  const money = useMemo(() => new Intl.NumberFormat(locale, {
    style: "currency", currency: "ALL", maximumFractionDigits: 2
  }), [locale])

  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [page, setPage]       = useState(1)
  const [pageSize]            = useState(20)
  const [total, setTotal]     = useState(0)
  const [sales, setSales]     = useState([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [selected, setSelected] = useState(null)
  const [dayReport, setDayReport] = useState(null)

  const sellerNameCacheRef = useRef(new Map())

  useEffect(() => {
    const onSaleRecorded = (e) => {
      const affectedBiz = e?.detail?.businessId
      if (affectedBiz && business?.businessId && affectedBiz === business.businessId) {
        setPage(1); setRefreshKey(k => k + 1)
      }
    }
    window.addEventListener("sale-recorded", onSaleRecorded)
    return () => window.removeEventListener("sale-recorded", onSaleRecorded)
  }, [business?.businessId])

  const fetchSales = useCallback(async () => {
    if (!business?.businessId) {
      setSales([]); setTotal(0); setLoading(false)
      return
    }
    setLoading(true); setError(null)
    const { from, to } = startEndOfCurrentMonthUtc()
    const url = `${API_BASE}/api/Sales/${business.businessId}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&page=${page}&pageSize=${pageSize}`
    const token = getToken()
    try {
      const resp = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(USE_COOKIES ? { credentials: "include" } : {}),
      })
      if (!resp.ok) {
        const text = await resp.text()
        if (resp.status === 401) throw new Error(t("sales.errors.unauthorized", { defaultValue: "Unauthorized (401): token/cookie not sent or expired." }))
        if (resp.status === 403) throw new Error(t("sales.errors.forbidden", { defaultValue: "Forbidden (403): your user lacks the required role." }))
        if (resp.status === 404) throw new Error(t("sales.errors.not_found", { defaultValue: "Not Found (404): Check API_BASE or route." }))
        throw new Error(`${resp.status} ${resp.statusText} – ${text}`)
      }
      const json = await resp.json()
      const { list, total } = parseResponse(json)
      const withNames = await decorateSalesWithSellerNames(list, business.businessId, sellerNameCacheRef.current)
      setSales(withNames)
      setTotal(total)
    } catch (e) {
      setError(e?.message || t("sales.errors.load_failed", { defaultValue: "Failed to load sales." }))
      setSales([]); setTotal(0)
    } finally { setLoading(false) }
  }, [business?.businessId, page, pageSize, t])

  useEffect(() => { fetchSales() }, [fetchSales, refreshKey])

  /* Compute today's items once for the header Report button */
  const todayItems = useMemo(() => {
    const todayKey = dateKeyLocal(new Date())
    return sales.filter(s => dateKeyLocal(s.soldAt ?? s.SoldAt) === todayKey)
  }, [sales])

  const grouped = useMemo(() => {
    if (!sales?.length) return []
    const today = new Date()
    const todayKey = dateKeyLocal(today)
    const yesterdayKey = dateKeyLocal(addDaysLocal(today, -1))
    const groups = new Map()
    for (const s of sales) {
      const dt = new Date(s.soldAt ?? s.SoldAt)
      if (isNaN(dt)) continue
      const keyLocal = dateKeyLocal(dt)
      const key = keyLocal === todayKey ? "today" : keyLocal === yesterdayKey ? "yesterday" : `date:${keyLocal}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(s)
    }
    const entries = Array.from(groups.entries())
    entries.sort((a, b) => {
      const rank = (k) => (k === "today" ? 0 : k === "yesterday" ? 1 : 2)
      const ra = rank(a[0]); const rb = rank(b[0])
      if (ra !== rb) return ra - rb
      if (ra < 2) return 0
      const da = new Date(a[1][0].soldAt ?? a[1][0].SoldAt)
      const db = new Date(b[1][0].soldAt ?? b[1][0].SoldAt)
      return db - da
    })
    return entries
  }, [sales])

  if (!business?.businessId) {
    return (
      <div className="sp">
        <div className="sp-card">
          <h3 className="sp-title">{t("sales.title", { defaultValue: "Sales" })}</h3>
          <p className="sp-muted">{t("sales.select_business", { defaultValue: "Select a business to view sales." })}</p>
        </div>
      </div>
    )
  }

  const maxPage = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="sp">
      <div className="sp-card">
        {/* HEADER: now has Report near Refresh */}
        <div className="sp-header">
          <div className="sp-header-left">
            <strong className="sp-label">{t("sales.business_label", { defaultValue: "Business:" })}</strong>
            <span className="sp-muted">{business.name || business.businessId}</span>
          </div>
          <div className="sp-header-actions" style={{ display: "flex", gap: 8 }}>
            <button
              className="sp-btn sp-btn-ghost"
              onClick={() => setDayReport({ title: t("sales.today", { defaultValue: "Today" }), items: todayItems })}
            >
              {t("sales.day_report_btn", { defaultValue: "Day's Report" })}
            </button>
            <button className="sp-btn sp-btn-ghost" onClick={() => setRefreshKey(k => k + 1)} disabled={loading}>
              {loading ? t("sales.refreshing", { defaultValue: "Refreshing…" }) : t("sales.refresh", { defaultValue: "Refresh" })}
            </button>
          </div>
        </div>

        {error && <div className="sp-alert">{error}</div>}
        {loading && <div className="sp-loading">{t("sales.loading", { defaultValue: "Loading sales…" })}</div>}
        {!loading && !error && !sales.length && <div className="sp-empty">{t("sales.empty_month", { defaultValue: "No sales this month." })}</div>}

        {!loading && !error && !!sales.length && (
          <>
        {grouped.map(([key, items]) => {
            let label
            if (key === "today") label = t("sales.today", { defaultValue: "Today" })
            else if (key === "yesterday") label = t("sales.yesterday", { defaultValue: "Yesterday" })
            else {
              const d = new Date(items[0].soldAt ?? items[0].SoldAt)
              label = fmtLabel.format(d)
            }

            const openDayReport = () =>
              setDayReport({ title: label, items })

            return (
              <section className="sp-section" key={key}>
                {/* per-day button ADDED; header shows title + report action */}
                <div className="sp-section-head">
                  <h3 className="sp-section-title">{label}</h3>
                  <button
                    className="sp-btn sp-btn-ghost sp-section-report"
                    onClick={openDayReport}
                    aria-label={t("sales.day_report_btn", { defaultValue: "Day's Report" })}
                    title={t("sales.day_report_btn", { defaultValue: "Day's Report" })}
                  >
                    {t("sales.day_report_btn", { defaultValue: "Day's Report" })}
                  </button>
                </div>

                <ul className="sp-list">
                  {items.map((s) => {
                    const qty = extractQuantity(s)
                    const unitPrice = extractUnitPrice(s)
                    const totalPrice = unitPrice != null ? unitPrice * qty : null
                    return (
                      <li
                        key={s.saleRecordId ?? s.SaleRecordId ?? `${s.soldAt ?? s.SoldAt}-${Math.random()}`}
                        className="sp-row"
                        onClick={() => setSelected(s)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(s) } }}
                        tabIndex={0}
                        role="button"
                        aria-label={t("sales.view_details", { defaultValue: "View details" })}
                      >
                        <div className="sp-row-main">
                          <div className="sp-row-title">{extractProductName(s)}</div>
                          <div className="sp-row-sub">
                            {t("sales.qty", { defaultValue: "Quantity" })}: <strong>{qty}</strong>
                          </div>
                        </div>
                        <div className="sp-row-price">{totalPrice != null ? money.format(totalPrice) : ""}</div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}

            {total > pageSize && (
              <div className="sp-pager">
                <button className="sp-btn sp-btn-ghost" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
                  {t("sales.prev", { defaultValue: "Prev" })}
                </button>
                <span className="sp-muted">{t("sales.page_x_of_y", { defaultValue: "Page {{p}} of {{m}}", p: page, m: maxPage })}</span>
                <button className="sp-btn sp-btn-ghost" onClick={() => setPage(p => Math.min(maxPage, p + 1))} disabled={page >= maxPage}>
                  {t("sales.next", { defaultValue: "Next" })}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <SaleModal sale={selected} onClose={() => setSelected(null)} t={t} fmtDate={fmtDate} fmtTime={fmtTime} money={money} />

      {dayReport && (
        <DayReportModal
          title={dayReport.title}
          items={dayReport.items}
          onClose={() => setDayReport(null)}
          t={t}
          money={money}
        />
      )}
    </div>
  )
}
