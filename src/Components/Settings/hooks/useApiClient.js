
import { useMemo } from 'react'
import { useAuth } from './useAuth'

// Base URL for your API; you can set REACT_APP_API_BASE_URL in your .env
const API_BASE = process.env.REACT_APP_API_BASE_URL || 'https://api.triwears.com'

export function useApiClient() {
  const { token } = useAuth()

  // memoize headers so they only change when token changes
  const defaultHeaders = useMemo(() => {
    const hdrs = { 'Content-Type': 'application/json' }
    if (token) hdrs.Authorization = `Bearer ${token}`
    return hdrs
  }, [token])

  // Core request function
  const request = async (endpoint, { method = 'GET', body, headers = {}, ...opts } = {}) => {
    const url = `${API_BASE}${endpoint}`
    const init = {
      method,
      headers: { ...defaultHeaders, ...headers },
      ...opts,
    }

    if (body !== undefined) {
      init.body = JSON.stringify(body)
    }

    const response = await fetch(url, init)

    // Try to parse JSON if possible
    let data
    const contentType = response.headers.get('Content-Type') || ''
    if (contentType.includes('application/json')) {
      data = await response.json()
    } else {
      data = await response.text()
    }

    if (!response.ok) {
      const error = new Error(response.statusText || 'API request failed')
      error.status = response.status
      error.data = data
      throw error
    }

    return data
  }

  // Shorthand methods
  const get   = (endpoint, opts) => request(endpoint, { method: 'GET', ...opts })
  const post  = (endpoint, body, opts) => request(endpoint, { method: 'POST', body, ...opts })
  const put   = (endpoint, body, opts) => request(endpoint, { method: 'PUT',  body, ...opts })
  const del   = (endpoint, opts) => request(endpoint, { method: 'DELETE', ...opts })
  const patch = (endpoint, body, opts) => request(endpoint, { method: 'PATCH', body, ...opts })

  return { API_BASE, get, post, put, del, patch }
}
