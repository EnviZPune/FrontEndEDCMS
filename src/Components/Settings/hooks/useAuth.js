import { useState, useEffect, useCallback } from 'react'
import {jwtDecode} from 'jwt-decode'

export function useAuth() {
  const [token, setToken]   = useState(null)
  const [role, setRole]     = useState(null)
  const [userId, setUserId] = useState(null)

  useEffect(() => {
    // 1. Read raw token value
    const raw = localStorage.getItem('token') || localStorage.getItem('authToken')
    if (!raw) return

    // 2. Parse JSON if needed
    let t
    try {
      const parsed = JSON.parse(raw)
      t = parsed.token || parsed
    } catch {
      t = raw
    }

    if (!t) return

    setToken(t)

    // 3. Decode JWT to extract claims
    try {
      const decoded = jwtDecode(t)
      // Adjust these claim URIs if your token uses different ones
      const roleClaim     = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'
      const userClaim     = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'
      const fallbackSub   = decoded.sub

      setRole((decoded[roleClaim] || '').toLowerCase() || null)
      setUserId(decoded[userClaim] || fallbackSub || null)
    } catch (err) {
      console.error('Failed to decode JWT:', err)
      setRole(null)
      setUserId(null)
    }
  }, [])

  // 4. Helper to clear auth (logout)
  const clearAuth = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('authToken')
    setToken(null)
    setRole(null)
    setUserId(null)
  }, [])

  return { token, role, userId, clearAuth }
}
