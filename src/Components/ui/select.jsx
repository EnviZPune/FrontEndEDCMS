import React, { createContext, useContext, useMemo, useState } from "react"

const Ctx = createContext(null)

export function Select({ value, onValueChange, disabled = false, children }) {
  const [open, setOpen] = useState(false)
  const ctx = useMemo(
    () => ({
      value,
      setValue: (v) => {
        if (disabled) return
        onValueChange?.(v)
        setOpen(false)
      },
      open,
      setOpen,
      disabled,
    }),
    [value, onValueChange, open, disabled]
  )
  return <Ctx.Provider value={ctx}>{children}</Ctx.Provider>
}

export const SelectValue = function SelectValue({ placeholder }) {
  const { value } = useContext(Ctx)
  return <span>{value || placeholder || ""}</span>
}

export const SelectTrigger = React.forwardRef(function SelectTrigger(
  { className = "", children, ...props },
  ref
) {
  const { open, setOpen, disabled } = useContext(Ctx)
  return (
    <button
      type="button"
      ref={ref}
      className={
        "inline-flex h-9 w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm outline-none disabled:opacity-50 " +
        (className || "")
      }
      aria-haspopup="listbox"
      aria-expanded={open}
      disabled={disabled}
      onClick={() => !disabled && setOpen((o) => !o)}
      {...props}
    >
      {children}
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
        <path d="M7 10l5 5 5-5H7z" />
      </svg>
    </button>
  )
})

export const SelectContent = function SelectContent({ className = "", children }) {
  const { open } = useContext(Ctx)
  if (!open) return null
  return (
    <div
      className={
        "z-50 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg " +
        (className || "")
      }
      role="listbox"
    >
      <div className="max-h-64 overflow-auto">{children}</div>
    </div>
  )
}

export const SelectItem = React.forwardRef(function SelectItem(
  { className = "", value, children, ...props },
  ref
) {
  const { setValue } = useContext(Ctx)
  return (
    <div
      ref={ref}
      role="option"
      tabIndex={0}
      onClick={() => setValue(value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          setValue(value)
        }
      }}
      className={
        "relative flex w-full cursor-pointer select-none items-center py-2 px-3 text-sm text-gray-900 outline-none hover:bg-gray-50 " +
        (className || "")
      }
      {...props}
    >
      {children}
    </div>
  )
})
