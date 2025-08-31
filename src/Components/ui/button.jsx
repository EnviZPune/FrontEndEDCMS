import React, { forwardRef } from "react"

const base =
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none h-9 px-4"

const variants = {
  default: "bg-black text-white hover:bg-black/85 focus:ring-black/40",
  secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-400",
  outline:
    "border border-gray-300 text-gray-900 hover:bg-gray-50 focus:ring-gray-400",
}

export const Button = forwardRef(function Button(
  { className = "", variant = "default", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={`${base} ${variants[variant] || variants.default} ${className}`}
      {...props}
    />
  )
})
