"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { HubConnectionBuilder, LogLevel } from "@microsoft/signalr"
import { FaBell } from "react-icons/fa"
import "../Styling/Notifications.css"

const API_BASE = "http://77.242.26.150:8000"

const getToken = () => {
  const raw = localStorage.getItem("token") || localStorage.getItem("authToken")
  if (!raw || raw.trim() === "") return null
  try {
    const parsed = JSON.parse(raw)
    return parsed.token || parsed
  } catch {
    return raw
  }
}

const getHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
})

export default function Notifications() {
  const [invites, setInvites] = useState([])
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState("Connecting")
  const [isLoading, setIsLoading] = useState(false)
  const wrapperRef = useRef(null)
  const connectionRef = useRef(null)

  // Load initial data
  const loadInitialData = useCallback(async () => {
    const token = getToken()
    if (!token) {
      console.log("No token available")
      setConnectionStatus("No Token")
      return
    }

    setIsLoading(true)
    console.log("Loading initial data...")

    try {
      const [invRes, noteRes] = await Promise.all([
        fetch(`${API_BASE}/api/Business/employees/pending`, { headers: getHeaders() }),
        fetch(`${API_BASE}/api/Notification`, { headers: getHeaders() }),
      ])

      if (invRes.ok) {
        const pending = await invRes.json()
        setInvites(
          pending.map((inv) => ({
            businessId: inv.businessId,
            businessName: inv.name,
            invitedAt: inv.requestedAt,
          })),
        )
      } else {
        console.warn("Failed to load invites:", invRes.status)
      }

      if (noteRes.ok) {
        const notes = await noteRes.json()
        setNotifications(
          notes.map((n) => ({
            id: n.id ?? n.Id,
            message: n.message ?? n.Message ?? "",
            createdAt: n.createdAt ?? n.CreatedAt,
          })),
        )
      } else {
        console.warn("Failed to load notifications:", noteRes.status)
      }
    } catch (err) {
      console.error("Error loading initial data:", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Setup SignalR connection
  const setupSignalRConnection = useCallback(async () => {
    const token = getToken()
    if (!token) {
      console.log("No token for SignalR")
      setConnectionStatus("No Token")
      return
    }

    setConnectionStatus("Connecting")

    // Stop any existing connection
    if (connectionRef.current) {
      try {
        await connectionRef.current.stop()
      } catch (e) {
        console.error("Error stopping existing connection:", e)
      }
      connectionRef.current = null
    }

    const connection = new HubConnectionBuilder()
      .withUrl(`${API_BASE}/notificationHub`, { accessTokenFactory: () => getToken() || "" })
      .configureLogging(LogLevel.Information)
      .withAutomaticReconnect([0, 2000, 10000, 30000])
      .build()

    connectionRef.current = connection

    connection.onreconnecting((error) => {
      console.log("SignalR reconnecting:", error)
      setConnectionStatus("Reconnecting")
    })

    connection.onreconnected((id) => {
      console.log("SignalR reconnected, id=", id)
      setConnectionStatus("Connected")
    })

    connection.onclose((error) => {
      console.log("SignalR closed:", error)
      setConnectionStatus("Disconnected")
    })

    connection.on("ReceiveEmployeeInvitation", (inv) => {
      setInvites((prev) => {
        if (prev.some((x) => x.businessId === inv.businessId)) return prev
        const newInv = {
          businessId: inv.businessId,
          businessName: inv.businessName ?? inv.name,
          invitedAt: inv.invitedAt ?? inv.requestedAt ?? new Date().toISOString(),
        }
        return [...prev, newInv]
      })

      if (Notification.permission === "granted") {
        new Notification("New Invitation", {
          body: `Invitation from ${inv.businessName ?? inv.name}`,
          icon: "/favicon.ico",
        })
      }
    })

    connection.on("ReceiveNotification", (note) => {
      setNotifications((prev) => {
        const id = note.id ?? note.Id ?? Date.now()
        if (prev.some((x) => x.id === id)) return prev
        const newNote = {
          id,
          message: note.message ?? note.Message ?? "",
          createdAt: note.createdAt ?? note.CreatedAt ?? new Date().toISOString(),
        }
        return [newNote, ...prev]
      })

      if (Notification.permission === "granted") {
        new Notification("New Notification", {
          body: note.message ?? note.Message,
          icon: "/favicon.ico",
        })
      }
    })

    try {
      console.log("Starting SignalR connection...")
      await connection.start()
      console.log("SignalR connected, id=", connection.connectionId)
      setConnectionStatus("Connected")
    } catch (err) {
      console.error("SignalR start failed:", err)
      setConnectionStatus("Failed")
      // Auto-retry after 5 seconds
      setTimeout(() => {
        setupSignalRConnection()
      }, 5000)
    }
  }, [])

  // Request notification permission
  const requestPermission = useCallback(async () => {
    if ("Notification" in window && Notification.permission === "default") {
      const perm = await Notification.requestPermission()
      console.log("Notification permission:", perm)
    }
  }, [])

  // Initialize component
  useEffect(() => {
    loadInitialData()
    requestPermission()
    setupSignalRConnection()

    return () => {
      if (connectionRef.current) {
        connectionRef.current.stop().catch((e) => console.error("Error stopping on unmount:", e))
        connectionRef.current = null
      }
    }
  }, [loadInitialData, requestPermission, setupSignalRConnection])

  // Click outside handler
  useEffect(() => {
    const onClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  // Accept/decline invite
  const respondInvite = useCallback(async (businessId, approve) => {
    try {
      const res = await fetch(`${API_BASE}/api/Business/employees/respond/${businessId}?approve=${approve}`, {
        method: "PUT",
        headers: getHeaders(),
      })

      if (res.ok) {
        setInvites((prev) => prev.filter((i) => i.businessId !== businessId))
        if (Notification.permission === "granted") {
          new Notification(approve ? "Invitation Accepted" : "Invitation Declined", {
            body: `You have ${approve ? "accepted" : "declined"} the invitation`,
            icon: "/favicon.ico",
          })
        }
      } else {
        const text = await res.text()
        console.error("Failed to respond:", res.status, text)
        alert(`Failed to ${approve ? "accept" : "decline"} invite: ${text}`)
      }
    } catch (err) {
      console.error(err)
      alert(`Error trying to ${approve ? "accept" : "decline"} invitation`)
    }
  }, [])

  // Clear all notifications
  const clearAll = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/Notification`, {
        method: "DELETE",
        headers: getHeaders(),
      })
      if (!res.ok) throw new Error(await res.text())
      setNotifications([])
    } catch (err) {
      console.error("Clear failed:", err)
      alert("Failed to clear notifications")
    } finally {
      setIsLoading(false)
    }
  }, [])

  const totalCount = invites.length + notifications.length

  return (
    <div ref={wrapperRef} className="notification-wrapper">
      <div className="notification-bell-container">
        <FaBell
          className={`notification-bell ${connectionStatus === "Connected" ? "connected" : ""}`}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="notifications-panel"
          title={`${totalCount} notifications`}
        />
        {totalCount > 0 && (
          <span className="notification-badge" aria-live="polite" aria-atomic="true">
            {totalCount > 99 ? "99+" : totalCount}
          </span>
        )}
        {connectionStatus === "Connected" && <div className="connection-pulse"></div>}
      </div>

      <div
        id="notifications-panel"
        className={`notifications-panel ${open ? "open" : ""} ${isLoading ? "loading" : ""}`}
        role="menu"
      >
        <div className="panel-header">
          <h3 className="panel-title">
            <span className="title-icon">🔔</span>
            Notifications
          </h3>
          {notifications.length > 0 && (
            <button onClick={clearAll} className="clear-all-btn" disabled={isLoading}>
              {isLoading ? "Clearing..." : "Clear All"}
            </button>
          )}
        </div>

        <div className="panel-content">
          {invites.length > 0 && (
            <div className="section invitations-section">
              <div className="section-header">
                <span className="section-icon">📧</span>
                <span className="section-title">Invitations</span>
                <span className="section-count">{invites.length}</span>
              </div>
              <div className="section-items">
                {invites.map((inv) => (
                  <div key={inv.businessId} className="notification-item invitation-item">
                    <div className="item-content">
                      <div className="item-title">Invitation from {inv.businessName}</div>
                      <div className="item-time">{new Date(inv.invitedAt).toLocaleString()}</div>
                    </div>
                    <div className="item-actions">
                      <button onClick={() => respondInvite(inv.businessId, true)} className="action-btn accept-btn">
                        Accept
                      </button>
                      <button onClick={() => respondInvite(inv.businessId, false)} className="action-btn decline-btn">
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {notifications.length > 0 && (
            <div className="section notifications-section">
              <div className="section-items">
                {notifications.map((n) => (
                  <div key={n.id} className="notification-item">
                    <div className="item-content">
                      <div className="item-message">{n.message}</div>
                      <div className="item-time">{new Date(n.createdAt).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {invites.length === 0 && notifications.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">🔕</div>
              <div className="empty-title">All caught up!</div>
              <div className="empty-message">No new notifications right now</div>
            </div>
          )}
        </div>

        {isLoading && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
          </div>
        )}
      </div>
    </div>
  )
}
