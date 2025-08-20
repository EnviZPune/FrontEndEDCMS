import React from "react"

export const Switch = React.forwardRef(function Switch(
  { className = "", checked = false, onCheckedChange, disabled = false, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange?.(!checked)}
      className={
        "inline-flex h-5 w-9 items-center rounded-full transition-colors outline-none " +
        (checked ? "bg-black" : "bg-gray-300") +
        " disabled:opacity-50 " +
        (className || "")
      }
      {...props}
    >
      <span
        className={
          "block h-4 w-4 rounded-full bg-white shadow transition-transform " +
          (checked ? "translate-x-[18px]" : "translate-x-0.5")
        }
      />
    </button>
  )
})
