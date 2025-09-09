import React, { useEffect, useMemo, useState, useCallback } from "react"
import { useTranslation } from "react-i18next"

const API_BASE = (import.meta?.env?.VITE_API_BASE_URL || "https://api.triwears.com").replace(/\/+$/,"")
const USE_COOKIES = false  // flip to true if you use cookie-based auth

function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("authToken") ||
    null
  )
}

const TIRANE_TZ = "Europe/Tirane"

// Stable local-date key (YYYY-MM-DD in Tirana time)
function dateKeyLocal(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIRANE_TZ, year: "numeric", month: "2-digit", day: "2-digit"
  }).format(date)
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

export default function SalesPanel({ business }) {
  const { t, i18n } = useTranslation("sales")
  const locale = i18n?.language || navigator.language || "en-GB"
  const fmtTime  = useMemo(() => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TIRANE_TZ }), [locale])
  const fmtDate  = useMemo(() => new Intl.DateTimeFormat(locale, { day: "2-digit", month: "long", year: "numeric", timeZone: TIRANE_TZ }), [locale])
  const fmtLabel = useMemo(() => new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: TIRANE_TZ }), [locale])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [page, setPage]       = useState(1)
  const [pageSize]            = useState(20)
  const [total, setTotal]     = useState(0)
  const [sales, setSales]     = useState([])
  const [refreshKey, setRefreshKey] = useState(0)

  // Refresh when a sale is recorded from ProductPanel
  useEffect(() => {
    const onSaleRecorded = (e) => {
      const affectedBiz = e?.detail?.businessId
      if (affectedBiz && business?.businessId && affectedBiz === business.businessId) {
        setPage(1)
        setRefreshKey(k => k + 1)
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

    setLoading(true)
    setError(null)

    const { from, to } = startEndOfCurrentMonthUtc()
    const url = `${API_BASE}/api/Sales/${business.businessId}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&page=${page}&pageSize=${pageSize}`
    const token = getToken()

    try {
      const resp = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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
      setSales(list)
      setTotal(total)
    } catch (e) {
      setError(e?.message || t("sales.errors.load_failed", { defaultValue: "Failed to load sales." }))
      setSales([]); setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [business?.businessId, page, pageSize, t])

  useEffect(() => { fetchSales() }, [fetchSales, refreshKey])

  // Group rows by Today / Yesterday / Date
  const grouped = useMemo(() => {
    if (!sales?.length) return []

    const today = new Date()
    const todayKey = dateKeyLocal(today)
    const yesterdayKey = dateKeyLocal(addDaysLocal(today, -1))

    // Use internal keys for robust sorting
    const groups = new Map() // key: 'today' | 'yesterday' | 'date:YYYY-MM-DD' => array

    for (const s of sales) {
      const dt = new Date(s.soldAt)
      const keyLocal = dateKeyLocal(dt)
      const key = keyLocal === todayKey ? "today" : keyLocal === yesterdayKey ? "yesterday" : `date:${keyLocal}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(s)
    }

    // Sort: today, yesterday, then recent dates desc
    const entries = Array.from(groups.entries())
    entries.sort((a, b) => {
      const rank = (k) => (k === "today" ? 0 : k === "yesterday" ? 1 : 2)
      const ra = rank(a[0]); const rb = rank(b[0])
      if (ra !== rb) return ra - rb
      if (ra < 2) return 0
      // both are date:YYYY-MM-DD -> compare by date
      const da = new Date(a[1][0].soldAt)
      const db = new Date(b[1][0].soldAt)
      return db - da
    })
    return entries
  }, [sales])

  if (!business?.businessId) {
    return (
      <div className="sales-panel">
        <h3>{t("sales.title", { defaultValue: "Sales" })}</h3>
        <p>{t("sales.select_business", { defaultValue: "Select a business to view sales." })}</p>
      </div>
    )
  }

  return (
    <div className="sales-panel">
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <strong>{t("sales.business_label", { defaultValue: "Business:" })}</strong> {business.name || business.businessId}
        <button onClick={() => setRefreshKey(k => k + 1)} disabled={loading}>
          {loading ? t("sales.refreshing", { defaultValue: "Refreshing…" }) : t("sales.refresh", { defaultValue: "Refresh" })}
        </button>
      </div>

      {error && <div className="error">{error}</div>}
      {loading && <div>{t("sales.loading", { defaultValue: "Loading sales…" })}</div>}
      {!loading && !error && !sales.length && <div>{t("sales.empty_month", { defaultValue: "No sales this month." })}</div>}

      {!loading && !error && !!sales.length && (
        <>
          {grouped.map(([key, items]) => {
            let label
            if (key === "today") label = t("sales.today", { defaultValue: "Today" })
            else if (key === "yesterday") label = t("sales.yesterday", { defaultValue: "Yesterday" })
            else {
              // key is "date:YYYY-MM-DD" → use first item's date for label
              const d = new Date(items[0].soldAt)
              label = fmtLabel.format(d)
            }

            return (
              <div className="sales-group" key={key}>
                <h3>{label}</h3>
                <ul className="sales-list">
                  {items.map((s) => {
                    const d = new Date(s.soldAt)
                    const time = fmtTime.format(d)
                    const date = fmtDate.format(d)
                    const totalPrice = s.unitPriceAtSale != null ? Number(s.unitPriceAtSale) * (s.quantity ?? 1) : null
                    return (
                      <li key={s.saleRecordId} className="sales-row">
                        <div className="sales-left">
                          <div className="sales-product">{s.productName}</div>
                          <div className="sales-sub">
                            {t("sales.qty", { defaultValue: "Qty" })}: {s.quantity ?? 1} • {date} {t("sales.at_time", { defaultValue: "at" })} {time}
                            {s.sku ? ` • ${t("sales.sku", { defaultValue: "SKU" })}: ${s.sku}` : ""}
                          </div>
                          {s.soldByName && (
                            <div className="sales-sub">
                              {t("sales.sold_by", { defaultValue: "sale made by:" })} <strong>{s.soldByName}</strong>
                            </div>
                          )}
                        </div>
                        <div className="sales-right">
                          {totalPrice != null ? `${totalPrice.toFixed(2)} LEK` : ""}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}

          {total > page * pageSize && (
            <div className="pager" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))}>
                {t("sales.prev", { defaultValue: "Prev" })}
              </button>
              <span>{t("sales.page_x", { defaultValue: "Page {{page}}", page })}</span>
              <button onClick={() => setPage((p) => p + 1)}>
                {t("sales.next", { defaultValue: "Next" })}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
