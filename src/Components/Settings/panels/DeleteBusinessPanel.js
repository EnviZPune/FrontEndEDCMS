// src/Components/Settings/panels/DeleteBusinessPanel.js
import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApiClient } from '../hooks/useApiClient';
import '../../../Styling/Settings/deletebusinesspanel.css';

export default function DeleteBusinessPanel({ business }) {
  const { t } = useTranslation('deletebusiness');
  const { del } = useApiClient();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    if (!business?.businessId) return;
    const ok = window.confirm(
      t('delete.confirm', {
        defaultValue:
          'This action cannot be undone. Are you sure you want to delete this business?',
      })
    );
    if (!ok) return;

    try {
      setDeleting(true);
      await del(`/Business/${business.businessId}`);
      alert(
        t('delete.success', { defaultValue: 'Business deleted successfully.' })
      );
      navigate('/');
    } catch (err) {
      console.error('Error deleting business:', err);
      alert(
        t('delete.error', {
          defaultValue: 'Failed to delete business. Please try again.',
        })
      );
    } finally {
      setDeleting(false);
    }
  }, [business?.businessId, del, navigate, t]);

  if (!business) {
    return (
      <div className="panel delete-business-panel">
        <p>
          {t('delete.no_business', {
            defaultValue: 'Please select a business first.',
          })}
        </p>
      </div>
    );
  }

  return (
    <div className="delete-business-panel">
      <h3>{t('delete.title', { defaultValue: 'Delete Business' })}</h3>
      <p className="warning-text" role="alert">
        <strong>
          {t('delete.warning_label', { defaultValue: 'Warning:' })}
        </strong>{' '}
        {t('delete.warning_body', {
          defaultValue:
            'Deleting a business is permanent and cannot be undone.',
        })}
      </p>
      <button
        className="delete-button"
        onClick={handleDelete}
        disabled={deleting}
        aria-busy={deleting || undefined}
      >
        {deleting
          ? t('delete.button_deleting', { defaultValue: 'Deleting…' })
          : t('delete.button', { defaultValue: 'Delete Business' })}
      </button>
    </div>
  );
}
