import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiClient } from '../hooks/useApiClient';
import { useAuth } from '../hooks/useAuth';
import '../../../Styling/Settings/settings.css';
import '../../../Styling/Settings/reservationspanel.css';

export default function ReservationsPanel({ business }) {
  const { t } = useTranslation('reservations');
  const { get, put } = useApiClient();
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [reservations, setReservations] = useState([]);

  // track per-row action state: { id: number|null, type: 'complete'|'no-show'|'status'|null }
  const [actionState, setActionState] = useState({ id: null, type: null });

  // Fetch reservations once we have a businessId and a valid token
  useEffect(() => {
    if (!business?.businessId || !token) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    get(`/Reservation/business/${business.businessId}`)
      .then(data => { if (!cancelled) setReservations(data); })
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
    setReservations(updated);
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

  const handleUpdateStatus = async (reservationId, status) => {
    try {
      setActionState({ id: reservationId, type: 'status' });
      await put(`/Reservation/${reservationId}/status`, { status });
      await refresh();
    } catch (err) {
      console.error('Error updating reservation status:', err);
      alert(t('reservations.alerts.status_failed', { defaultValue: 'Failed to update reservation status.' }));
    } finally {
      setActionState({ id: null, type: null });
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

  const confirmed = reservations.filter(r => r.status === 'Confirmed');
  const pending   = reservations.filter(r => r.status === 'Pending');

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
                <th>{t('reservations.table.created_at', { defaultValue: 'Created At' })}</th>
                <th>{t('reservations.table.actions', { defaultValue: 'Actions' })}</th>
              </tr>
            </thead>
            <tbody>
              {confirmed.map(r => {
                const busy = actionState.id === r.reservationId;
                return (
                  <tr key={r.reservationId}>
                    <td>{r.reservationId}</td>
                    <td>{r.productName}</td>
                    <td>{r.customerName}</td>
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
                <th>{t('reservations.table.created_at', { defaultValue: 'Created At' })}</th>
                <th>{t('reservations.table.actions', { defaultValue: 'Actions' })}</th>
              </tr>
            </thead>
            <tbody>
              {pending.map(r => {
                const busy = actionState.id === r.reservationId;
                return (
                  <tr key={r.reservationId}>
                    <td>{r.reservationId}</td>
                    <td>{r.productName}</td>
                    <td>{r.customerName}</td>
                    <td>{new Date(r.createdAt).toLocaleString()}</td>
                    <td>
                      <button
                        onClick={() => handleUpdateStatus(r.reservationId, 'Confirmed')}
                        disabled={busy}
                      >
                        {t('reservations.actions.approve', { defaultValue: 'Approve' })}
                      </button>{' '}
                      <button
                        onClick={() => handleUpdateStatus(r.reservationId, 'Cancelled')}
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
    </div>
  );
}
