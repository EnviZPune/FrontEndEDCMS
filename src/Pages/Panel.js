import React, { useEffect, useRef, useState, useMemo } from "react"
import SupportDashboard from "./SupportDashboard"
import Navbar from "../Components/Navbar"
import Footer from "../Components/Footer"
import "../Styling/panel.css"

const tabs = [{ key: "support", label: "Support Dashboard" }]

export default function Panel() {
  const [active, setActive] = useState("support")

  // assignment filter: "assigned" | "awaiting"
  const [assignView, setAssignView] = useState("assigned")

  // mobile drawer
  const [drawerOpen, setDrawerOpen] = useState(false)

  const containerRef = useRef(null)
  const scrollYRef = useRef(0)

  const isMobile = () => {
    if (typeof window === "undefined") return false
    return window.matchMedia("(max-width: 640px)").matches
  }

  // Body scroll-lock only while drawer is open on mobile
  useEffect(() => {
    const lock = () => {
      if (!isMobile()) return
      scrollYRef.current = window.scrollY || window.pageYOffset || 0
      document.body.classList.add("panel-scroll-lock")
      document.body.style.top = `-${scrollYRef.current}px`
      document.body.style.left = "0"
      document.body.style.right = "0"
      document.body.style.width = "100%"
    }
    const unlock = () => {
      const y = scrollYRef.current || 0
      document.body.classList.remove("panel-scroll-lock")
      document.body.style.top = ""
      document.body.style.left = ""
      document.body.style.right = ""
      document.body.style.width = ""
      window.scrollTo(0, y)
    }

    if (drawerOpen) lock()
    else unlock()

    const onResize = () => {
      if (!drawerOpen) return
      if (!isMobile()) unlock()
    }
    window.addEventListener("resize", onResize)
    window.addEventListener("orientationchange", onResize)
    return () => {
      window.removeEventListener("resize", onResize)
      window.removeEventListener("orientationchange", onResize)
      if (drawerOpen) unlock()
    }
  }, [drawerOpen])

  // Close with ESC on mobile
  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e) => {
      if (e.key === "Escape") setDrawerOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [drawerOpen])

  const toggleDrawer = () => setDrawerOpen((v) => !v)

  // Pass to dashboard (optional: SupportDashboard can ignore if unknown)
  const dashboardFilters = useMemo(
    () => ({ assignment: assignView }), 
    [assignView]
  )

  return (
    <div>
      <Navbar />

      <div
        ref={containerRef}
        className={`panel-root ${drawerOpen ? "drawer-open" : ""}`}
      >
        {/* Scrim (mobile only) */}
        <div
          className="panel-drawer-scrim"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />

        <div className="panel-header">
          {/* Hamburger (mobile only) */}
          <button
            className="hamburger-btn mobile-only"
            aria-label="Open filters"
            aria-expanded={drawerOpen}
            onClick={toggleDrawer}
          >
            <span className="hamburger-bar" />
            <span className="hamburger-bar" />
            <span className="hamburger-bar" />
          </button>

          <h1>Control Panel</h1>

          {/* Desktop segmented toggle */}
          <div className="segmented hide-on-mobile" role="tablist" aria-label="Assignment filter">
            <button
              role="tab"
              aria-selected={assignView === "assigned"}
              className={assignView === "assigned" ? "active" : ""}
              onClick={() => setAssignView("assigned")}
            >
              Assigned
            </button>
            <button
              role="tab"
              aria-selected={assignView === "awaiting"}
              className={assignView === "awaiting" ? "active" : ""}
              onClick={() => setAssignView("awaiting")}
            >
              Awaiting
            </button>
          </div>

          {/* Tabs row (simple, unchanged) */}
          <div className="panel-tabs hide-on-mobile">
            {tabs.map((t) => (
              <button
                key={t.key}
                className={`panel-tab ${active === t.key ? "active" : ""}`}
                onClick={() => setActive(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile filter drawer (slides in) */}
        <aside className="panel-sidebar mobile-only" aria-label="Filters">
          <div className="panel-sidebar-header">
            <strong>Filters</strong>
            <button
              className="panel-close"
              aria-label="Close"
              onClick={() => setDrawerOpen(false)}
            >
              Close
            </button>
          </div>

          <div className="panel-sidebar-content">
            <div className="segmented" role="tablist" aria-label="Assignment filter">
              <button
                role="tab"
                aria-selected={assignView === "assigned"}
                className={assignView === "assigned" ? "active" : ""}
                onClick={() => setAssignView("assigned")}
              >
                Assigned
              </button>
              <button
                role="tab"
                aria-selected={assignView === "awaiting"}
                className={assignView === "awaiting" ? "active" : ""}
                onClick={() => setAssignView("awaiting")}
              >
                Awaiting
              </button>
            </div>

            <div className="panel-sidebar-footer">
              <button className="primary" onClick={() => setDrawerOpen(false)}>
                Apply
              </button>
            </div>
          </div>
        </aside>

        <div className="panel-body">
          {active === "support" && (
            <SupportDashboard assignment={assignView} />
          )}
        </div>
      </div>

      <Footer />
    </div>
  )
}
