"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { HubConnectionBuilder, LogLevel } from "@microsoft/signalr";
import { FaBell } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import "../Styling/Notifications.css";

/** ========= API ENDPOINTS (FIXED) =========
 *  REST lives under /api
 *  SignalR hub is at /notificationHub (no /api prefix)
 */
const API_ORIGIN = "https://api.triwears.com";
const REST = (p) => `${API_ORIGIN}/api${p}`;
const HUB_URL = `${API_ORIGIN}/notificationHub`;

/* --------------------- Auth helpers --------------------- */
const getToken = () => {
  const raw =
    localStorage.getItem("token") || localStorage.getItem("authToken");
  if (!raw || raw.trim() === "") return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed.token || parsed;
  } catch {
    // remove extra quotes if stored as a stringified string
    return raw.replace(/^"|"$/g, "");
  }
};

const getHeaders = () => {
  const token = getToken();
  const h = { "Content-Type": "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
};
/* -------------------------------------------------------- */

export default function Notifications() {
  const { t } = useTranslation("notifications");

  const [invites, setInvites] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Connecting");
  const [isLoading, setIsLoading] = useState(false);

  const wrapperRef = useRef(null);
  const connectionRef = useRef(null);

  /* --------------------- Initial load --------------------- */
  const loadInitialData = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setConnectionStatus("No Token");
      return;
    }
    setIsLoading(true);
    try {
      const [invRes, noteRes] = await Promise.all([
        fetch(REST("/Business/employees/pending"), { headers: getHeaders() }),
        fetch(REST("/Notification"), { headers: getHeaders() }),
      ]);

      if (invRes.ok) {
        const pending = await invRes.json();
        setInvites(
          (Array.isArray(pending) ? pending : []).map((inv) => ({
            businessId: inv.businessId ?? inv.BusinessId,
            businessName:
              inv.businessName ??
              inv.name ??
              inv.Name ??
              t("unknown_business"),
            invitedAt:
              inv.invitedAt ??
              inv.requestedAt ??
              inv.RequestedAt ??
              new Date().toISOString(),
          }))
        );
      } else {
        console.warn("Failed to load invites:", invRes.status);
      }

      if (noteRes.ok) {
        const notes = await noteRes.json();
        setNotifications(
          (Array.isArray(notes) ? notes : []).map((n) => {
            const isRead = n.isRead ?? n.IsRead ?? false;
            return {
              id: n.id ?? n.Id,
              message: n.message ?? n.Message ?? "",
              createdAt:
                n.createdAt ?? n.CreatedAt ?? new Date().toISOString(),
              seen: !!isRead,
            };
          })
        );
      } else {
        console.warn("Failed to load notifications:", noteRes.status);
      }
    } catch (err) {
      console.error("Error loading initial data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  /* ------------------ SignalR connection ------------------ */
  const setupSignalRConnection = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setConnectionStatus("No Token");
      return;
    }

    setConnectionStatus("Connecting");

    if (connectionRef.current) {
      try {
        await connectionRef.current.stop();
      } catch (e) {
        console.error("Error stopping existing connection:", e);
      }
      connectionRef.current = null;
    }

    const connection = new HubConnectionBuilder()
      .withUrl(HUB_URL, {
        accessTokenFactory: () => getToken() || "",
      })
      .configureLogging(LogLevel.Information)
      .withAutomaticReconnect([0, 2000, 10000, 30000])
      .build();

    connectionRef.current = connection;

    connection.onreconnecting(() => setConnectionStatus("Reconnecting"));
    connection.onreconnected(() => setConnectionStatus("Connected"));
    connection.onclose(() => setConnectionStatus("Disconnected"));

    // Employee invitations
    connection.on("ReceiveEmployeeInvitation", (inv) => {
      setInvites((prev) => {
        const id = inv.businessId ?? inv.BusinessId;
        if (id && prev.some((x) => x.businessId === id)) return prev;
        const newInv = {
          businessId: id,
          businessName:
            inv.businessName ?? inv.name ?? t("unknown_business"),
          invitedAt:
            inv.invitedAt ?? inv.requestedAt ?? new Date().toISOString(),
        };
        return [...prev, newInv];
      });

      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        new Notification(t("notify_titles.new_invite"), {
          body: t("notify_bodies.invite_from", {
            name: inv.businessName ?? inv.name ?? t("unknown_business"),
          }),
          icon: "/favicon.ico",
        });
      }
    });

    // General notifications
    connection.on("ReceiveNotification", (note) => {
      setNotifications((prev) => {
        const id = note.id ?? note.Id ?? Date.now();
        if (prev.some((x) => x.id === id)) return prev;
        const isRead = note.isRead ?? note.IsRead ?? false;
        const newNote = {
          id,
          message: note.message ?? note.Message ?? "",
          createdAt:
            note.createdAt ?? note.CreatedAt ?? new Date().toISOString(),
          seen: !!isRead,
        };
        return [newNote, ...prev];
      });

      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        new Notification(t("notify_titles.new_notification"), {
          body: note.message ?? note.Message ?? "",
          icon: "/favicon.ico",
        });
      }
    });

    try {
      await connection.start();
      setConnectionStatus("Connected");
    } catch (err) {
      console.error("SignalR start failed:", err);
      setConnectionStatus("Failed");
      setTimeout(() => {
        setupSignalRConnection();
      }, 5000);
    }
  }, [t]);

  /* --------------- Browser notification perm --------------- */
  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch {
        /* ignore */
      }
    }
  }, []);

  /* -------------------- Mark as seen -------------------- */
  const markNotificationSeen = useCallback(
    async (id) => {
      const target = notifications.find((n) => n.id === id);
      if (!target || target.seen) return;

      // optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, seen: true } : n))
      );

      try {
        let res = await fetch(REST(`/Notification/${id}/read`), {
          method: "PUT",
          headers: getHeaders(),
        });
        if (!res.ok) {
          // try /seen as alias
          res = await fetch(REST(`/Notification/${id}/seen`), {
            method: "PUT",
            headers: getHeaders(),
          });
        }
        if (!res.ok) {
          // revert on failure
          setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, seen: false } : n))
          );
          const txt = await res.text().catch(() => "");
          console.error("Mark seen failed:", res.status, txt);
          alert(t("errors.mark_seen_failed"));
        }
      } catch (err) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, seen: false } : n))
        );
        console.error("Network error marking seen:", err);
        alert(t("errors.network_mark_seen"));
      }
    },
    [notifications, t]
  );

  /* ---------------------- Invite actions ---------------------- */
  const respondInvite = useCallback(
    async (businessId, approve) => {
      try {
        const res = await fetch(
          REST(`/Business/employees/respond/${businessId}?approve=${approve}`),
          { method: "PUT", headers: getHeaders() }
        );

        if (res.ok) {
          setInvites((prev) => prev.filter((i) => i.businessId !== businessId));

          if (
            typeof Notification !== "undefined" &&
            Notification.permission === "granted"
          ) {
            new Notification(
              approve ? t("toast.invite_accepted") : t("toast.invite_declined"),
              {
                body: approve
                  ? t("toast.invite_accepted_body")
                  : t("toast.invite_declined_body"),
                icon: "/favicon.ico",
              }
            );
          }
        } else {
          const text = await res.text().catch(() => "");
          console.error("Failed to respond:", res.status, text);
          alert(
            t("errors.invite_respond_failed", {
              action: approve ? t("common.accept") : t("common.decline"),
              message: text,
            })
          );
        }
      } catch (err) {
        console.error(err);
        alert(
          t("errors.invite_respond_network", {
            action: approve ? t("common.accept") : t("common.decline"),
          })
        );
      }
    },
    [t]
  );

  /* ---------------------- Clear all ---------------------- */
  const clearAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(REST("/Notification"), {
        method: "DELETE",
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error(await res.text());
      setNotifications([]);
    } catch (err) {
      console.error("Clear failed:", err);
      alert(t("errors.clear_failed"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  /* --------------------- Lifecycle hooks --------------------- */
  useEffect(() => {
    loadInitialData();
    requestPermission();
    setupSignalRConnection();

    return () => {
      if (connectionRef.current) {
        connectionRef.current
          .stop()
          .catch((e) => console.error("Error stopping on unmount:", e));
        connectionRef.current = null;
      }
    };
  }, [loadInitialData, requestPermission, setupSignalRConnection]);

  // Click outside to close
  useEffect(() => {
    const onClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  /* ---------------------- Derived count ---------------------- */
  const totalCount =
    invites.length + notifications.filter((n) => !n.seen).length;

  return (
    <div ref={wrapperRef} className="notification-wrapper">
      <div
        className="notification-bell-container"
        onClick={() => setOpen((o) => !o)}
      >
        <FaBell
          className={`notification-bell ${
            connectionStatus === "Connected" ? "connected" : ""
          }`}
          aria-expanded={open}
          aria-controls="notifications-panel"
          title={t("bell.title", { count: totalCount })}
        />
        {totalCount > 0 && (
          <span
            className="notification-badge"
            aria-live="polite"
            aria-atomic="true"
          >
            {totalCount > 99 ? "99+" : totalCount}
          </span>
        )}
        {connectionStatus === "Connected" && <div className="connection-pulse"></div>}
      </div>

      <div
        id="notifications-panel"
        className={`notifications-panel ${open ? "open" : ""} ${
          isLoading ? "loading" : ""
        }`}
        role="menu"
      >
        <div className="panel-header">
          <h3 className="panel-title">
            <span className="title-icon">🔔</span>
            {t("panel.title")}
          </h3>
          {notifications.length > 0 && (
            <button onClick={clearAll} className="clear-all-btn" disabled={isLoading}>
              {isLoading ? t("panel.clearing") : t("panel.clear_all")}
            </button>
          )}
        </div>

        <div className="panel-content">
          {invites.length > 0 && (
            <div className="section invitations-section">
              <div className="section-items">
                {invites.map((inv) => (
                  <div key={inv.businessId} className="notification-item invitation-item">
                    <div className="item-content">
                      <div className="item-title">
                        {t("invite.from", { name: inv.businessName })}
                      </div>
                      <div className="item-time">
                        {new Date(inv.invitedAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="item-actions">
                      <button
                        onClick={() => respondInvite(inv.businessId, true)}
                        className="action-btn accept-btn"
                      >
                        {t("common.accept")}
                      </button>
                      <button
                        onClick={() => respondInvite(inv.businessId, false)}
                        className="action-btn decline-btn"
                      >
                        {t("common.decline")}
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
                  <div
                    key={n.id}
                    className={`notification-item ${n.seen ? "seen" : ""}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => markNotificationSeen(n.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        markNotificationSeen(n.id);
                      }
                    }}
                    title={n.seen ? t("note.seen") : t("note.mark_seen")}
                    aria-pressed={n.seen}
                  >
                    <div className="item-content">
                      <div className="item-message">{n.message}</div>
                      <div className="item-time">
                        {new Date(n.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {invites.length === 0 && notifications.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">🔕</div>
              <div className="empty-title">{t("empty.title")}</div>
              <div className="empty-message">{t("empty.message")}</div>
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
  );
}