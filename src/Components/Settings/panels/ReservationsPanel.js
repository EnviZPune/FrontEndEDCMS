// src/Components/Settings/panels/ReservationsPanel.jsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiClient } from '../hooks/useApiClient';
import { useAuth } from '../hooks/useAuth';
import '../../../Styling/Settings/settings.css';
import '../../../Styling/Settings/reservationspanel.css';

// ADDED: enum mapping + helpers so we handle both strings and numbers
const StatusMap = { Pending: 0, Confirmed: 1, Cancelled: 2, Completed: 3 };
const toStatusNumber = (val) => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    if (val in StatusMap) return StatusMap[val];
    const n = Number(val);
    return Number.isFinite(n) ? n : StatusMap.Pending;
  }
  return StatusMap.Pending;
};
const isStatus = (reservation, name) => toStatusNumber(reservation?.status) === StatusMap[name];

// Robust getters (camelCase or PascalCase, just in case)
const getSize  = (r) => r?.selectedSize  ?? r?.SelectedSize  ?? null;
const getColor = (r) => r?.selectedColor ?? r?.SelectedColor ?? null;

export default function ReservationsPanel({ business }) {
  const { t } = useTranslation('reservations');
  const { get, put } = useApiClient();
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [reservations, setReservations] = useState([]);

  // track per-row action state: { id: number|null, type: 'complete'|'no-show'|'status'|null }
  const [actionState, setActionState] = useState({ id: null, type: null });

  // Reject popup state (size/color shown read-only)
  const [rejectModal, setRejectModal] = useState({
    open: false,
    reservationId: null,
    size: '',
    color: '',
    reason: '',
    submitting: false,
  });

  // Fetch reservations once we have a businessId and a valid token
  useEffect(() => {
    if (!business?.businessId || !token) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    get(`/Reservation/business/${business.businessId}`)
      .then(data => { if (!cancelled) setReservations(Array.isArray(data) ? data : []); })
      .catch(err => {
        console.error('Failed to load reservations:', err);
        if (!cancelled) setError(err);
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business?.businessId, token]);

  const refresh = async () => {
    const updated = await get(`/Reservation/business/${business.businessId}`);
    setReservations(Array.isArray(updated) ? updated : []);
  };

  const handleComplete = async (reservationId) => {
    try {
      setActionState({ id: reservationId, type: 'complete' });
      await put(`/Reservation/${reservationId}/complete`);
      await refresh();
    } catch (err) {
      console.error('Error completing reservation:', err);
      alert(t('reservations.alerts.complete_failed', { defaultValue: 'Failed to mark reservation completed.' }));
    } finally {
      setActionState({ id: null, type: null });
    }
  };

  // Send numeric enum to backend
  const handleUpdateStatus = async (reservationId, statusName) => {
    try {
      setActionState({ id: reservationId, type: 'status' });
      const status = StatusMap[statusName]; // -> number
      await put(`/Reservation/${reservationId}/status`, { status });
      await refresh();
    } catch (err) {
      console.error('Error updating reservation status:', err);
      alert(t('reservations.alerts.status_failed', { defaultValue: 'Failed to update reservation status.' }));
    } finally {
      setActionState({ id: null, type: null });
    }
  };

  // Open Reject popup (prefill size/color; read-only display)
  const openReject = (reservation) => {
    setRejectModal({
      open: true,
      reservationId: reservation.reservationId,
      size: getSize(reservation) || '',
      color: getColor(reservation) || '',
      reason: '',
      submitting: false,
    });
  };

  const closeReject = () => {
    setRejectModal({
      open: false,
      reservationId: null,
      size: '',
      color: '',
      reason: '',
      submitting: false,
    });
  };

  // Submit Reject with reason (NO size/color overrides sent)
  const submitReject = async (e) => {
    e?.preventDefault?.();
    if (!rejectModal.reason.trim()) {
      alert(t('reservations.alerts.reason_required', { defaultValue: 'Please provide a reason for the cancellation.' }));
      return;
    }
    try {
      setRejectModal((s) => ({ ...s, submitting: true }));
      await put(`/Reservation/${rejectModal.reservationId}/status`, {
        status: StatusMap.Cancelled,
        reason: rejectModal.reason.trim(),
      });
      closeReject();
      await refresh();
    } catch (err) {
      console.error('Error cancelling reservation:', err);
      alert(t('reservations.alerts.reject_failed', { defaultValue: 'Failed to cancel reservation.' }));
      setRejectModal((s) => ({ ...s, submitting: false }));
    }
  };

  // No Show = restock +1 and mark reservation accordingly
  const handleNoShow = async (reservationId) => {
    const ok = window.confirm(
      t('reservations.confirm.no_show', { defaultValue: 'Mark as No Show and return 1 item to stock?' })
    );
    if (!ok) return;
    try {
      setActionState({ id: reservationId, type: 'no-show' });
      await put(`/Reservation/${reservationId}/no-show`);
      await refresh();
    } catch (err) {
      console.error('Error marking reservation as no-show:', err);
      alert(t('reservations.alerts.no_show_failed', { defaultValue: 'Failed to mark as No Show.' }));
    } finally {
      setActionState({ id: null, type: null });
    }
  };

  // Close modal on ESC
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && rejectModal.open && !rejectModal.submitting) closeReject();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rejectModal.open, rejectModal.submitting]);

  if (loading) {
    return (
      <div className="panel reservations-panel">
        <p>{t('reservations.loading', { defaultValue: 'Loading reservations…' })}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel reservations-panel">
        <p>{t('reservations.error', { defaultValue: 'Error loading reservations.' })}</p>
      </div>
    );
  }

  const confirmed = reservations.filter(r => isStatus(r, 'Confirmed'));
  const pending   = reservations.filter(r => isStatus(r, 'Pending'));

  return (
    <div className="reservations-panel">
      <h3>{t('reservations.title', { defaultValue: 'Product Reservations' })}</h3>

      <section>
        <h4>{t('reservations.sections.confirmed', { defaultValue: 'Confirmed Reservations' })}</h4>
        {confirmed.length === 0 ? (
          <p>{t('reservations.empty.approved', { defaultValue: 'No approved reservations.' })}</p>
        ) : (
          <table className="reservations-table">
            <thead>
              <tr>
                <th>{t('reservations.table.id', { defaultValue: 'ID' })}</th>
                <th>{t('reservations.table.product', { defaultValue: 'Product' })}</th>
                <th>{t('reservations.table.customer', { defaultValue: 'Customer' })}</th>
                <th>{t('reservations.table.size', { defaultValue: 'Size' })}</th>
                <th>{t('reservations.table.color', { defaultValue: 'Color' })}</th>
                <th>{t('reservations.table.created_at', { defaultValue: 'Created At' })}</th>
                <th>{t('reservations.table.actions', { defaultValue: 'Actions' })}</th>
              </tr>
            </thead>
            <tbody>
              {confirmed.map(r => {
                const busy = actionState.id === r.reservationId;
                const size  = getSize(r)  || '—';
                const color = getColor(r) || '—';
                return (
                  <tr key={r.reservationId}>
                    <td>{r.reservationId}</td>
                    <td>{r.productName}</td>
                    <td>{r.customerName}</td>
                    <td>{size}</td>
                    <td>{color}</td>
                    <td>{new Date(r.createdAt).toLocaleString()}</td>
                    <td>
                      <button onClick={() => handleComplete(r.reservationId)} disabled={busy}>
                        {t('reservations.actions.mark_completed', { defaultValue: 'Mark Completed' })}
                      </button>{' '}
                      <button
                        className="btn-no-show"
                        onClick={() => handleNoShow(r.reservationId)}
                        disabled={busy}
                        title={t('reservations.actions.no_show_tooltip', {
                          defaultValue: 'Customer didn’t show; return item to stock (+1)'
                        })}
                      >
                        {t('reservations.actions.no_show', { defaultValue: 'No Show' })}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h4>{t('reservations.sections.pending', { defaultValue: 'Pending Reservations' })}</h4>
        {pending.length === 0 ? (
          <p>{t('reservations.empty.pending', { defaultValue: 'No pending reservations.' })}</p>
        ) : (
          <table className="reservations-table">
            <thead>
              <tr>
                <th>{t('reservations.table.id', { defaultValue: 'ID' })}</th>
                <th>{t('reservations.table.product', { defaultValue: 'Product' })}</th>
                <th>{t('reservations.table.customer', { defaultValue: 'Customer' })}</th>
                <th>{t('reservations.table.size', { defaultValue: 'Size' })}</th>
                <th>{t('reservations.table.color', { defaultValue: 'Color' })}</th>
                <th>{t('reservations.table.created_at', { defaultValue: 'Created At' })}</th>
                <th>{t('reservations.table.actions', { defaultValue: 'Actions' })}</th>
              </tr>
            </thead>
            <tbody>
              {pending.map(r => {
                const busy = actionState.id === r.reservationId;
                const size  = getSize(r)  || '—';
                const color = getColor(r) || '—';
                return (
                  <tr key={r.reservationId}>
                    <td>{r.reservationId}</td>
                    <td>{r.productName}</td>
                    <td>{r.customerName}</td>
                    <td>{size}</td>
                    <td>{color}</td>
                    <td>{new Date(r.createdAt).toLocaleString()}</td>
                    <td>
                      <button
                        onClick={() => handleUpdateStatus(r.reservationId, 'Confirmed')}
                        disabled={busy}
                      >
                        {t('reservations.actions.approve', { defaultValue: 'Approve' })}
                      </button>{' '}
                      <button
                        onClick={() => openReject(r)}
                        disabled={busy}
                      >
                        {t('reservations.actions.reject', { defaultValue: 'Reject' })}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Reject modal (size/color DISPLAY ONLY) */}
      {rejectModal.open && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target.classList.contains('modal-backdrop') && !rejectModal.submitting) closeReject();
          }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
          }}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-title"
            style={{
              background: '#fff', borderRadius: 12, padding: 20, width: 'min(560px, 92vw)',
              boxShadow: '0 10px 30px rgba(0,0,0,.25)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 id="reject-title" style={{ marginTop: 0 }}>
              {t('reservations.reject_modal.title', { defaultValue: 'Reject Reservation' })}
            </h4>
            <p style={{ marginTop: 4, color: '#555' }}>
              {t('reservations.reject_modal.subtitle_readonly', { defaultValue: 'Review the selected size/color and provide a reason for cancellation.' })}
            </p>

            <form onSubmit={submitReject}>
              <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
                {/* Read-only variant summary */}
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    padding: '10px 12px',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 8
                  }}
                >
                  <div><strong>{t('reservations.table.size', { defaultValue: 'Size' })}:</strong> {rejectModal.size || '—'}</div>
                  <div><strong>{t('reservations.table.color', { defaultValue: 'Color' })}:</strong> {rejectModal.color || '—'}</div>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
                    {t('reservations.reject_modal.reason', { defaultValue: 'Reason for cancellation' })} *
                  </label>
                  <textarea
                    required
                    value={rejectModal.reason}
                    onChange={(e) => setRejectModal((s) => ({ ...s, reason: e.target.value }))}
                    placeholder={t('reservations.reject_modal.reason_ph', { defaultValue: 'Explain why this reservation is being cancelled…' })}
                    rows={4}
                    className="textarea"
                    style={{ width: '100%', padding: '10px 12px', resize: 'vertical' }}
                  />
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: 18, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={closeReject}
                  disabled={rejectModal.submitting}
                  className="btn-secondary"
                >
                  {t('reservations.reject_modal.cancel', { defaultValue: 'Close' })}
                </button>
                <button
                  type="submit"
                  disabled={rejectModal.submitting}
                  className="btn-danger"
                >
                  {rejectModal.submitting
                    ? t('reservations.reject_modal.submitting', { defaultValue: 'Rejecting…' })
                    : t('reservations.reject_modal.submit', { defaultValue: 'Reject & Notify' })}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
