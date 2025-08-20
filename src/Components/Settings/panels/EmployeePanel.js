// src/Components/Settings/panels/EmployeePanel.js
import React, { useState, useEffect } from 'react'
import { useApiClient } from '../hooks/useApiClient'
import { useAuth } from '../hooks/useAuth'
import '../../../Styling/Settings/settings.css'
import '../../../Styling/Settings/employeepanel.css'

export default function EmployeePanel({ business }) {
  const { get, post, del } = useApiClient()
  const { token }           = useAuth()

  const [loading, setLoading]             = useState(true)
  const [employees, setEmployees]         = useState([])
  const [newEmployee, setNewEmployee]     = useState({ name: '', email: '' })
  const [foundUser, setFoundUser]         = useState(null)
  const [editingEmployee, setEditingEmployee] = useState(null)

  // Fetch employees once we have a businessId and a token
  useEffect(() => {
    if (!business?.businessId || !token) return

    let cancelled = false
    setLoading(true)

    get(`/api/Business/${business.businessId}/employees`)
      .then(data => {
        if (!cancelled) setEmployees(data)
      })
      .catch(err => {
        console.error('Failed to load employees:', err)
        if (!cancelled) setEmployees([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // only re-run when businessId or token changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business?.businessId, token])

  const findUserByEmail = async () => {
    const email = newEmployee.email.trim().toLowerCase()
    if (!email) {
      alert('Please enter an email to search.')
      return
    }
    try {
      const user = await get(`/api/User/email/${encodeURIComponent(email)}`)
      setFoundUser(user)
      setNewEmployee(ne => ({ ...ne, name: user.name || '' }))
      alert(`User found: ${user.name}`)
    } catch (err) {
      console.error('Error searching user:', err)
      setFoundUser(null)
      alert(err.status === 404 ? 'User not found.' : 'Error when searching for user.')
    }
  }

  const handleEmployeeSubmit = async (e) => {
    e.preventDefault()
    if (!foundUser?.userId) {
      alert('Find a user by email first.')
      return
    }
    try {
      await post(`/api/Business/${business.businessId}/assign/${foundUser.userId}`, {})
      alert('Invitation sent!')
      // refresh list
      const updated = await get(`/api/Business/${business.businessId}/employees`)
      setEmployees(updated)
    } catch (err) {
      console.error('Invite failed:', err)
      alert('Failed to invite user.')
    } finally {
      setFoundUser(null)
      setNewEmployee({ name: '', email: '' })
      setEditingEmployee(null)
    }
  }


  const handleCancelEdit = () => {
    setEditingEmployee(null)
    setFoundUser(null)
    setNewEmployee({ name: '', email: '' })
  }

  const handleDeleteEmployee = async (userId) => {
    if (!window.confirm('Are you sure you want to fire this employee?')) return
    try {
      await del(`/api/Business/${business.businessId}/employees/${userId}`)
      alert('Employee Fired.')
      const updated = await get(`/api/Business/${business.businessId}/employees`)
      setEmployees(updated)
    } catch (err) {
      console.error('Fire Process failed:', err)
      alert('Failed to fire employee.')
    }
  }

  if (loading) {
    return (
      <div className="employee-panel">
        <p>Loading employees…</p>
      </div>
    )
  }

  return (
    <div className="employee-panel">
      <h3>Employee Management</h3>

      <div className="employee-management-container">
        {/* Add / Edit Form */}
        <div className="employee-form">
          <h4>{editingEmployee ? 'Edit Employee' : 'Add New Employee'}</h4>
          <form onSubmit={handleEmployeeSubmit}>
            <label>Name</label>
            <input
              type="text"
              placeholder="Name"
              value={newEmployee.name}
              onChange={e => setNewEmployee(ne => ({ ...ne, name: e.target.value }))}
              required
            />

            <label>Email</label>
            <input
              type="email"
              placeholder="Email"
              value={newEmployee.email}
              onChange={e => setNewEmployee(ne => ({ ...ne, email: e.target.value }))}
              required
            />

            <div className="employee-form-buttons">
              <button type="button" onClick={findUserByEmail}>
                Find User
              </button>
              <button type="submit">
                {editingEmployee ? 'Update' : 'Add'}
              </button>
              {editingEmployee && (
                <button type="button" onClick={handleCancelEdit}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Employee List */}
        <div className="employee-list">
          <h4>Existing Employees</h4>
          {employees.length > 0 ? (
            <ul>
              {employees.map(emp => (
                <li key={emp.userId}>
                  <span>{emp.name} ({emp.email})</span>
                  <div className="employee-actions">
                    <button onClick={() => handleDeleteEmployee(emp.userId)}>
                      Fire
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p>No employees found.</p>
          )}
        </div>
      </div>
    </div>
  )
}
