// src/Components/Settings/panels/PendingChangesPanel.js
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiClient } from '../hooks/useApiClient';
import { useAuth } from '../hooks/useAuth';
import '../../../Styling/Settings/settings.css';
import '../../../Styling/Settings/pendingchangespanel.css';

export default function PendingChangesPanel({ business }) {
  const { t } = useTranslation('changes');
  const { get, put } = useApiClient();
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pendingChanges, setPendingChanges] = useState([]);

  const [employees, setEmployees] = useState([]);
  const [products, setProducts] = useState([]);

  // Per-change action loading state: { [id]: "approve" | "reject" }
  const [actionBusy, setActionBusy] = useState({});

  // ---- helpers ----
  const normalizeDetails = (changeDetails) => {
    // returns a normalized object with lowercased-first-letter keys,
    // unwrapped from itemDto if present
    let parsed = {};
    try {
      parsed = JSON.parse(changeDetails || '{}');
    } catch {
      parsed = {};
    }

    const lowerFirst = (obj) => {
      const out = {};
      Object.entries(obj || {}).forEach(([k, v]) => {
        const key = k ? k.charAt(0).toLowerCase() + k.slice(1) : k;
        out[key] = v;
      });
      return out;
    };

    const norm = lowerFirst(parsed);
    const core = norm.itemDto ? lowerFirst(norm.itemDto) : norm;
    return core;
  };

  const getOriginalProductById = (id) =>
    products.find((p) => p.clothingItemId === id) ||
    products.find((p) => p.id === id) || // fallback if API uses `id`
    null;

  // Given a change, derive a display-friendly product name
  const getProductNameDisplay = (change) => {
    const op = String(change.operationType || '').toLowerCase();
    const details = normalizeDetails(change.changeDetails);
    const hasClothingId = change.clothingItemId != null;
    const original = hasClothingId ? getOriginalProductById(change.clothingItemId) : null;

    const currentName = original?.name;
    const requestedName = details?.name;

    // prefer a clear "old → new" when renaming in Update
    if (op.includes('update')) {
      if (requestedName && currentName && String(requestedName) !== String(currentName)) {
        return `${currentName} → ${requestedName}`;
      }
      return currentName || requestedName || (hasClothingId ? `#${change.clothingItemId}` : '');
    }

    if (op.includes('delete')) {
      // deletion refers to an existing item
      return currentName || (hasClothingId ? `#${change.clothingItemId}` : '');
    }

    if (op.includes('create')) {
      // creation might not exist yet in DB, rely on payload
      return requestedName || (hasClothingId ? `#${change.clothingItemId}` : t('pending.unknown_product', { defaultValue: 'Unknown product' }));
    }

    // other ops (e.g., UpdatePhotos) – only show if we can figure it out
    if (currentName || requestedName) return currentName || requestedName;
    if (hasClothingId) return `#${change.clothingItemId}`;
    return '';
  };

  const isProductOperation = (change) => {
    const op = String(change.operationType || '').toLowerCase();
    // Treat these as product-centric; exclude pure business photo ops
    return op.includes('create') || op.includes('update') || op.includes('delete');
  };

  // 1) Fetch employees & products once per business
  useEffect(() => {
    if (!business?.businessId || !token) return;
    let cancelled = false;

    get(`/Business/${business.businessId}/employees`)
      .then((data) => { if (!cancelled) setEmployees(data); })
      .catch(console.error);

    get(`/ClothingItem/business/${business.businessId}`)
      .then((data) => { if (!cancelled) setProducts(data); })
      .catch(console.error);

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business?.businessId, token]);

  // 2) Fetch pending changes once per business
  useEffect(() => {
    if (!business?.businessId || !token) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    get(`/ProposedChanges/pending/${business.businessId}`)
      .then((data) => { if (!cancelled) setPendingChanges(data); })
      .catch((err) => {
        console.error('Failed to load pending changes:', err);
        if (!cancelled) setError(err);
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business?.businessId, token]);

  const refreshPending = async () => {
    const updated = await get(`/ProposedChanges/pending/${business.businessId}`);
    setPendingChanges(updated);
  };

  const approveChange = async (changeId) => {
    setActionBusy((prev) => ({ ...prev, [changeId]: 'approve' }));
    try {
      await put(`/ProposedChanges/${changeId}?approve=true`);
      await refreshPending();
    } catch (e) {
      console.error('Approve failed', e);
    } finally {
      setActionBusy((prev) => {
        const { [changeId]: _omit, ...rest } = prev;
        return rest;
      });
    }
  };

  const rejectChange = async (changeId) => {
    setActionBusy((prev) => ({ ...prev, [changeId]: 'reject' }));
    try {
      await put(`/ProposedChanges/${changeId}?approve=false`);
      await refreshPending();
    } catch (e) {
      console.error('Reject failed', e);
    } finally {
      setActionBusy((prev) => {
        const { [changeId]: _omit, ...rest } = prev;
        return rest;
      });
    }
  };

  if (loading) {
    return (
      <div className="pending-changes-panel">
        <p>{t('pending.loading', { defaultValue: 'Loading pending changes…' })}</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="pending-changes-panel">
        <p>{t('pending.error', { defaultValue: 'Error loading changes.' })}</p>
      </div>
    );
  }
  if (pendingChanges.length === 0) {
    return (
      <div className="pending-changes-panel">
        <h3>{t('pending.title', { defaultValue: 'Pending Changes' })}</h3>
        <p>{t('pending.empty', { defaultValue: 'No pending changes.' })}</p>
      </div>
    );
  }

  // diff-rendering helper
  const renderDiffs = (changeDetails, clothingItemId) => {
    const data = normalizeDetails(changeDetails);
    const original = getOriginalProductById(clothingItemId) || {};

    const fields = [
      { key: 'name', label: t('pending.fields.name', { defaultValue: 'Name' }) },
      { key: 'description', label: t('pending.fields.description', { defaultValue: 'Description' }) },
      { key: 'price', label: t('pending.fields.price', { defaultValue: 'Price' }) },
      { key: 'quantity', label: t('pending.fields.quantity', { defaultValue: 'Quantity' }) },
      { key: 'clothingCategoryId', label: t('pending.fields.category', { defaultValue: 'Category' }) },
      { key: 'brand', label: t('pending.fields.brand', { defaultValue: 'Brand' }) },
      { key: 'model', label: t('pending.fields.model', { defaultValue: 'Model' }) },
      { key: 'material', label: t('pending.fields.material', { defaultValue: 'Material' }) },
    ];

    const diffs = fields
      .map(({ key, label }) => {
        const oldVal = original[key];
        const newVal = data[key];
        if (newVal != null && String(oldVal) !== String(newVal)) return { label, oldVal, newVal };
        return null;
      })
      .filter(Boolean);

    if (!diffs.length) return <p>{t('pending.no_field_changes', { defaultValue: 'No field changes.' })}</p>;
    return (
      <table className="diff-table">
        <thead>
          <tr>
            <th>{t('pending.table.field', { defaultValue: 'Field' })}</th>
            <th>{t('pending.table.current', { defaultValue: 'Current' })}</th>
            <th>{t('pending.table.requested', { defaultValue: 'Requested' })}</th>
          </tr>
        </thead>
        <tbody>
          {diffs.map((d) => (
            <tr key={d.label}>
              <td>{d.label}</td>
              <td>{String(d.oldVal)}</td>
              <td>{String(d.newVal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="pending-changes-panel">
      <h3>{t('pending.title', { defaultValue: 'Pending Changes' })}</h3>
      <ul className="pending-list">
        {pendingChanges.map((change) => {
          // Parse once for this change
          const details = normalizeDetails(change.changeDetails);

          // Photos payload (for UpdatePhotos UI)
          const photosPayload = details;

          const employee = employees.find((e) => e.userId === change.employeeId);
          const opLabel = t(`pending.operations.${change.operationType}`, {
            defaultValue: change.operationType,
          });

          const busyState = actionBusy[change.proposedChangeId];
          const isApproving = busyState === 'approve';
          const isRejecting = busyState === 'reject';
          const buttonsDisabled = isApproving || isRejecting;

          // Product name line for Create/Update/Delete (and any product-centric op)
          const showProductLine = isProductOperation(change);
          const productNameDisplay = showProductLine ? getProductNameDisplay(change) : '';

          return (
            <li key={change.proposedChangeId} className="pending-item">
              <div className="pending-item-header">
                <strong>{opLabel}</strong>
                {showProductLine && productNameDisplay && (
                  <span className="pending-item-title"> — {productNameDisplay}</span>
                )}
              </div>

              <div className="pending-item-meta">
                <small>
                  <strong>{t('pending.meta.employee', { defaultValue: 'Employee' })}:</strong>{' '}
                  {employee?.name || change.employeeId}
                </small>
                <br />
                {showProductLine && (
                  <>
                    <br />
                  </>
                )}
                <small>
                  <strong>
                    {t('pending.meta.requested_at', { defaultValue: 'Date and Time of the request' })}:
                  </strong>{' '}
                  {new Date(change.createdAt).toLocaleString()}
                </small>
              </div>

              <div className="change-details-container">
                {String(change.operationType || '').toLowerCase() === 'updatephotos' ? (
                  <div className="photo-update-grid">
                    {photosPayload.profilePhotoUrl && (
                      <div className="photo-item">
                        <span>{t('pending.photos.profile', { defaultValue: 'Profile:' })}</span>
                        <img
                          src={photosPayload.profilePhotoUrl}
                          className="photo-preview"
                          alt={t('pending.photos.profile_alt', { defaultValue: 'Profile preview' })}
                        />
                      </div>
                    )}
                    {photosPayload.coverPhotoUrl && (
                      <div className="photo-item">
                        <span>{t('pending.photos.cover', { defaultValue: 'Cover:' })}</span>
                        <img
                          src={photosPayload.coverPhotoUrl}
                          className="photo-preview"
                          alt={t('pending.photos.cover_alt', { defaultValue: 'Cover preview' })}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  renderDiffs(change.changeDetails, change.clothingItemId)
                )}
              </div>

              <div className="pending-item-actions">
                <button
                  onClick={() => approveChange(change.proposedChangeId)}
                  disabled={buttonsDisabled}
                  className={isApproving ? 'loading' : ''}
                >
                  {isApproving
                    ? t('pending.actions.approving', { defaultValue: 'Approving…' })
                    : t('pending.actions.approve', { defaultValue: 'Approve' })}
                </button>
                <button
                  onClick={() => rejectChange(change.proposedChangeId)}
                  disabled={buttonsDisabled}
                  className={isRejecting ? 'loading danger' : 'danger'}
                >
                  {isRejecting
                    ? t('pending.actions.rejecting', { defaultValue: 'Rejecting…' })
                    : t('pending.actions.reject', { defaultValue: 'Reject' })}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
