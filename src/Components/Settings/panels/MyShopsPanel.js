import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApiClient } from '../hooks/useApiClient';
import '../../../Styling/Settings/myshopspanel.css';
import '../../../Styling/favorite.css';

export default function MyShopsPanel({ businesses = [] }) {
  const { t } = useTranslation('myshops');
  const { get } = useApiClient();
  const SHOPS_PER_PAGE = 12;

  const [page, setPage] = useState(1);
  const [images, setImages] = useState({}); // businessId -> coverUrl
  const imagesRef = useRef(images);
  useEffect(() => { imagesRef.current = images; }, [images]);

  const totalPages = Math.max(1, Math.ceil(businesses.length / SHOPS_PER_PAGE));
  const startIdx   = (page - 1) * SHOPS_PER_PAGE;
  const pageShops  = businesses.slice(startIdx, startIdx + SHOPS_PER_PAGE);

  // Keep current page in range if businesses change
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  // Fetch cover images only for shops missing in the cache on this page
  useEffect(() => {
    let cancelled = false;
    const toFetch = pageShops.filter(
      (shop) => imagesRef.current[shop.businessId] === undefined
    );

    toFetch.forEach((shop) => {
      get(`/Business/${shop.businessId}`)
        .then((detail) => {
          if (cancelled) return;
          const url = detail.coverPictureUrl || detail.coverPhotoUrl || '';
          setImages((prev) =>
            prev[shop.businessId] !== undefined ? prev : { ...prev, [shop.businessId]: url }
          );
        })
        .catch((err) => {
          console.error(`Failed to load business ${shop.businessId}:`, err);
          if (!cancelled) {
            setImages((prev) =>
              prev[shop.businessId] !== undefined ? prev : { ...prev, [shop.businessId]: '' }
            );
          }
        });
    });

    return () => {
      cancelled = true;
    };
  }, [pageShops, get]);

  const handlePrev = () => setPage((p) => Math.max(p - 1, 1));
  const handleNext = () => setPage((p) => Math.min(p + 1, totalPages));

  return (
    <div className="my-shops-panel">
      <h3>{t('myshops.title', { defaultValue: 'My Shops' })}</h3>

      {businesses.length === 0 ? (
        <p className="empty-state">{t('myshops.empty', { defaultValue: 'No shops to display.' })}</p>
      ) : (
        <>
          <div className="shop-grid">
            {pageShops.map((shop) => {
              const imageUrl = images[shop.businessId] || '';
              return (
                <Link
                  key={shop.slug ?? shop.businessId}
                  to={`/shop/${shop.slug ?? shop.businessId}`}
                  className="shop-card"
                >
                  <div className="shop-card-image">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={t('myshops.alt_cover', { name: shop.name, defaultValue: '{{name}} cover' })}
                      />
                    ) : (
                      <div className="shop-card-placeholder">
                        {t('myshops.placeholder', { defaultValue: 'No Image' })}
                      </div>
                    )}
                    <div className="shop-card-image-overlay">
                      <span className="fav-pill" title={t('myshops.favorites', { defaultValue: 'Favorites' })}>
                        <svg className="fav-icon" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M12 21s-6.716-4.315-9.428-7.027A6.5 6.5 0 1 1 12 5.07a6.5 6.5 0 1 1 9.428 8.903C18.716 16.685 12 21 12 21z" />
                        </svg>
                        {shop.favoritesCount ?? 0}
                      </span>
                      {shop.name}
                    </div>
                  </div>

                  {shop.description && (
                    <div className="shop-card-content">
                      <p className="shop-card-desc">{shop.description}</p>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button onClick={handlePrev} disabled={page === 1} aria-label={t('myshops.pagination.prev', { defaultValue: 'Prev' })}>
                {t('myshops.pagination.prev', { defaultValue: 'Prev' })}
              </button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i + 1}
                  className={page === i + 1 ? 'active' : ''}
                  onClick={() => setPage(i + 1)}
                  aria-current={page === i + 1 ? 'page' : undefined}
                >
                  {i + 1}
                </button>
              ))}
              <button onClick={handleNext} disabled={page === totalPages} aria-label={t('myshops.pagination.next', { defaultValue: 'Next' })}>
                {t('myshops.pagination.next', { defaultValue: 'Next' })}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
