"use client"

import React, { useEffect, useMemo, useState, useCallback } from "react"

const API_BASE = (import.meta?.env?.VITE_API_BASE_URL || "http://77.242.26.150:8000").replace(/\/+$/,"")
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
const fmtTime  = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TIRANE_TZ })
const fmtDate  = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "long", year: "numeric", timeZone: TIRANE_TZ })
const fmtLabel = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: TIRANE_TZ })

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
  // Derive current Y/M in Tirane tz
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: TIRANE_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now)
  const [y, m] = ymd.split("-").map(Number)
  // Build "local midnight" containers as UTC instants
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
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [page, setPage]       = useState(1)
  const [pageSize]            = useState(20)
  const [total, setTotal]     = useState(0)
  const [sales, setSales]     = useState([])
  const [refreshKey, setRefreshKey] = useState(0)

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

    // Limit to current month in Europe/Tirane
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
        if (resp.status === 401) throw new Error("Unauthorized (401): token/cookie not sent or expired.")
        if (resp.status === 403) throw new Error("Forbidden (403): your user lacks the required role.")
        if (resp.status === 404) throw new Error(`Not Found (404): ${text || "Check API_BASE or route."}`)
        throw new Error(`${resp.status} ${resp.statusText} – ${text}`)
      }

      const json = await resp.json()
      const { list, total } = parseResponse(json)
      setSales(list)
      setTotal(total)
    } catch (e) {
      setError(e?.message || "Failed to load sales.")
      setSales([]); setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [business?.businessId, page, pageSize])

  useEffect(() => { fetchSales() }, [fetchSales, refreshKey])

  const grouped = useMemo(() => {
    if (!sales?.length) return []
    const today = new Date()
    const todayKey = dateKeyLocal(today)
    const yesterdayKey = dateKeyLocal(addDaysLocal(today, -1))
    const groups = new Map()

    for (const s of sales) {
      const dt = new Date(s.soldAt)
      const key = dateKeyLocal(dt)
      const label = key === todayKey ? "Today" : key === yesterdayKey ? "Yesterday" : fmtLabel.format(dt)
      if (!groups.has(label)) groups.set(label, [])
      groups.get(label).push(s)
    }

    const rank = (l) => (l === "Today" ? 0 : l === "Yesterday" ? 1 : 2)
    const entries = Array.from(groups.entries())
    entries.sort((a, b) => {
      const ra = rank(a[0]); const rb = rank(b[0])
      if (ra !== rb) return ra - rb
      if (ra < 2) return 0
      const da = new Date(a[1][0].soldAt)
      const db = new Date(b[1][0].soldAt)
      return db - da
    })
    return entries
  }, [sales])

  if (!business?.businessId) {
    return (
      <div className="sales-panel">
        <h3>Sales</h3>
        <p>Select a business to view sales.</p>
      </div>
    )
  }

  return (
    <div className="sales-panel">
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <strong>Business:</strong> {business.name || business.businessId}
        <button onClick={() => setRefreshKey(k => k + 1)} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && <div className="error">{error}</div>}
      {loading && <div>Loading sales…</div>}
      {!loading && !error && !sales.length && <div>No sales this month.</div>}

      {!loading && !error && !!sales.length && (
        <>
          {grouped.map(([label, items]) => (
            <div className="sales-group" key={label}>
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
                          Qty: {s.quantity ?? 1} • {date} at {time}
                          {s.sku ? ` • SKU: ${s.sku}` : ""}
                        </div>
                        {s.soldByName && (
                          <div className="sales-sub">
                            sale made by: <strong>{s.soldByName}</strong>
                          </div>
                        )}
                      </div>
                      <div className="sales-right">
                        {totalPrice != null ? `${totalPrice.toFixed(2)} `+ "LEK" : ""}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}

          {total > page * pageSize && (
            <div className="pager" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
              <span>Page {page}</span>
              <button onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
