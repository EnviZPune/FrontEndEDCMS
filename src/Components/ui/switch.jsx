"use client"

import React from "react"

export const Switch = React.forwardRef(function Switch(
  { className = "", checked = false, onCheckedChange, disabled = false, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange?.(!checked)}
      /* width/height come from CSS variables with desktop defaults */
      style={{ width: "var(--sw-w, 36px)", height: "var(--sw-h, 22px)" }}
      className={
        "switch-responsive relative inline-flex shrink-0 items-center rounded-full p-0 outline-none transition-colors " +
        (checked ? "bg-gray-600" : "bg-gray-300") +
        " disabled:opacity-50 " +
        className
      }
      {...props}
    >
      <span
        /* knob auto-sizes from the same vars; we move it with transform */
        style={{
          width: "calc(var(--sw-h, 20px) - 4px)",
          height: "calc(var(--sw-h, 20px) - 6px)",
          transform: checked
            ? "translateX(calc(var(--sw-w, 36px) - var(--sw-h, 20px)))"
            : "translateX(0)",
          top: 2,
          left: 2,
        }}
        className="switch-thumb absolute rounded-full bg-white shadow transition-transform"
      />
    </button>
  )
})
