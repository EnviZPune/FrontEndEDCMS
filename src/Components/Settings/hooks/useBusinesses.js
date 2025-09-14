// src/Components/Settings/hooks/useBusinesses.js

import { useState, useEffect } from 'react'
import { useApiClient } from './useApiClient'
import { useAuth } from './useAuth'

/**
 * Custom hook to load the current user's businesses once
 * after we have a valid JWT token.
 */
export function useBusinesses() {
  const { get }    = useApiClient()
  const { token }  = useAuth()

  const [businesses, setBusinesses] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)

  useEffect(() => {
    // don’t fetch until we have a token
    if (!token) return

    let isMounted = true
    setLoading(true)

    get('/Business/my/businesses')
      .then(data => {
        if (isMounted) setBusinesses(data)
      })
      .catch(err => {
        console.error('Failed to load businesses:', err)
        if (isMounted) setError(err)
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  // run this effect whenever token changes from falsy→truthy
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return { businesses, loading, error }
}
