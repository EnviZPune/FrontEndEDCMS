import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './Settings/hooks/useAuth';
import { useApiClient } from './Settings/hooks/useApiClient';
import '../Styling/components/favorite.css';


export default function FavoriteButton({ businessId, className }) {
  const { token } = useAuth();
  const { API_BASE, get, post, del } = useApiClient();
  const [isFav, setIsFav]   = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    if (!token || !businessId) return;
    (async () => {
      try {
        const data = await get(`/api/favorites/${businessId}/is-favorited`);
        if (mounted && data && typeof data.isFavorited !== 'undefined') {
          setIsFav(Boolean(data.isFavorited));
        }
      } catch (e) {
      }
    })();
    return () => { mounted = false; };
  }, [token, businessId, get]);

  async function toggle() {
    if (!token) {
      navigate('/login');
      return;
    }
    if (loading) return;
    setLoading(true);
    try {
      if (isFav) {
        await del(`/api/favorites/${businessId}`);
        setIsFav(false);
      } else {
        await post(`/api/favorites/${businessId}`);
        setIsFav(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      className={`fav-btn ${isFav ? 'is-fav' : ''} ${className || ''}`}
      onClick={toggle}
      disabled={loading}
      aria-pressed={isFav}
      aria-label={isFav ? 'Unfavorite this shop' : 'Favorite this shop'}
      title={isFav ? 'Unfavorite' : 'Favorite'}
      type="button"
    >
      <svg className="fav-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        {isFav ? (
          <path d="M12 21s-6.716-4.315-9.428-7.027A6.5 6.5 0 1 1 12 5.07a6.5 6.5 0 1 1 9.428 8.903C18.716 16.685 12 21 12 21z" />
        ) : (
          <path fill="none" stroke="currentColor" strokeWidth="1.8" d="M20.84 4.61a5.5 5.5 0 0 1 .11 7.78L12 21l-8.95-8.61a5.5 5.5 0 0 1 7.78-7.78L12 5.5l1.17-1.17a5.5 5.5 0 0 1 7.67-.28z" />
        )}
      </svg>
      <span className="fav-text">{isFav ? 'Favorited' : 'Favorite'}</span>
    </button>
  );
}