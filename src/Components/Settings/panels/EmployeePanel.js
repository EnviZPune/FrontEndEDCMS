// src/Components/Settings/panels/EmployeePanel.js
import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useApiClient } from '../hooks/useApiClient'
import { useAuth } from '../hooks/useAuth'
import '../../../Styling/Settings/settings.css'
import '../../../Styling/Settings/employeepanel.css'

export default function EmployeePanel({ business }) {
  const { t } = useTranslation('employees')
  const { get, post, del } = useApiClient()
  const { token } = useAuth()
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState([])
  const [newEmployee, setNewEmployee] = useState({ name: '', email: '' })
  const [foundUser, setFoundUser] = useState(null)
  const [editingEmployee, setEditingEmployee] = useState(null)

  // Fetch employees once we have a businessId and a token
  useEffect(() => {
    if (!business?.businessId || !token) return

    let cancelled = false
    setLoading(true)

    get(`/Business/${business.businessId}/employees`)
      .then(data => {
        if (!cancelled) setEmployees(Array.isArray(data) ? data : [])
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
      alert(t('employees.alerts.enter_email', { defaultValue: 'Please enter an email to search.' }))
      return
    }
    try {
      const user = await get(`/User/email/${encodeURIComponent(email)}`)
      setFoundUser(user)
      setNewEmployee(ne => ({ ...ne, name: user.name || '' }))
      alert(
        t('employees.alerts.user_found', {
          name: user.name || email,
          defaultValue: `User found: ${user.name || email}`,
        })
      )
    } catch (err) {
      console.error('Error searching user:', err)
      setFoundUser(null)
      alert(
        err?.status === 404
          ? t('employees.alerts.user_not_found', { defaultValue: 'User not found.' })
          : t('employees.alerts.user_search_error', { defaultValue: 'Error when searching for user.' })
      )
    }
  }

  const handleEmployeeSubmit = async (e) => {
    e.preventDefault()
    if (!foundUser?.userId) {
      alert(t('employees.alerts.find_user_first', { defaultValue: 'Find a user by email first.' }))
      return
    }
    try {
      await post(`/Business/${business.businessId}/assign/${foundUser.userId}`, {})
      alert(t('employees.alerts.invite_sent', { defaultValue: 'Invitation sent!' }))
      // refresh list
      const updated = await get(`/Business/${business.businessId}/employees`)
      setEmployees(Array.isArray(updated) ? updated : [])
    } catch (err) {
      console.error('Invite failed:', err)
      alert(t('employees.alerts.invite_failed', { defaultValue: 'Failed to invite user.' }))
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
    if (
      !window.confirm(
        t('employees.alerts.fire_confirm', { defaultValue: 'Are you sure you want to fire this employee?' })
      )
    ) return

    try {
      await del(`/Business/${business.businessId}/employees/${userId}`)
      alert(t('employees.alerts.fired', { defaultValue: 'Employee fired.' }))
      const updated = await get(`/Business/${business.businessId}/employees`)
      setEmployees(Array.isArray(updated) ? updated : [])
    } catch (err) {
      console.error('Fire Process failed:', err)
      alert(t('employees.alerts.fire_failed', { defaultValue: 'Failed to fire employee.' }))
    }
  }

  if (loading) {
    return (
      <div className="employee-panel">
        <p>{t('employees.loading', { defaultValue: 'Loading employees…' })}</p>
      </div>
    )
  }

  return (
    <div className="employee-panel">
      <h3>{t('employees.title', { defaultValue: 'Employee Management' })}</h3>

      <div className="employee-management-container">
        {/* Add / Edit Form */}
        <div className="employee-form">
          <h4>
            {editingEmployee
              ? t('employees.form.edit_title', { defaultValue: 'Edit Employee' })
              : t('employees.form.add_title', { defaultValue: 'Add New Employee' })}
          </h4>

          <form onSubmit={handleEmployeeSubmit}>
            <label>{t('employees.form.name_label', { defaultValue: 'Name' })}</label>
            <input
              type="text"
              placeholder={t('employees.form.name_placeholder', { defaultValue: 'Name' })}
              value={newEmployee.name}
              onChange={e => setNewEmployee(ne => ({ ...ne, name: e.target.value }))}
              required
            />

            <label>{t('employees.form.email_label', { defaultValue: 'Email' })}</label>
            <input
              type="email"
              placeholder={t('employees.form.email_placeholder', { defaultValue: 'Email' })}
              value={newEmployee.email}
              onChange={e => setNewEmployee(ne => ({ ...ne, email: e.target.value }))}
              required
            />

            <div className="employee-form-buttons">
              <button type="button" onClick={findUserByEmail}>
                {t('employees.form.find_user', { defaultValue: 'Find User' })}
              </button>
              <button type="submit">
                {editingEmployee
                  ? t('employees.form.submit_update', { defaultValue: 'Update' })
                  : t('employees.form.submit_add', { defaultValue: 'Add' })}
              </button>
              {editingEmployee && (
                <button type="button" onClick={handleCancelEdit}>
                  {t('common.cancel', { defaultValue: 'Cancel' })}
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Employee List */}
        <div className="employee-list">
          <h4>{t('employees.list.title', { defaultValue: 'Existing Employees' })}</h4>
          {employees.length > 0 ? (
            <ul>
              {employees.map(emp => (
                <li key={emp.userId}>
                  <span>
                    {emp.name} ({emp.email})
                  </span>
                  <div className="employee-actions">
                    <button onClick={() => handleDeleteEmployee(emp.userId)}>
                      {t('employees.actions.fire', { defaultValue: 'Fire' })}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p>{t('employees.list.none', { defaultValue: 'No employees found.' })}</p>
          )}
        </div>
      </div>
    </div>
  )
}
