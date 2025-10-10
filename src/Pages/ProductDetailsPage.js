// src/Pages/ProductDetailsPage.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Navbar from "../Components/Navbar";
import Footer from "../Components/Footer";
import "../Styling/productdetails.css";

const API_BASE = "https://api.triwears.com/api";

const LOADING_GIF_LIGHT = "/Assets/triwears-black-loading.gif";
const LOADING_GIF_DARK  = "/Assets/triwears-white-loading.gif";
const DEFAULT_PRODUCT_LIGHT = "/Assets/default-product-light.png";
const DEFAULT_PRODUCT_DARK  = "/Assets/default-product-dark.png";

const StatusMap = { Pending: 0, Confirmed: 1, Cancelled: 2, Completed: 3 };
const toStatusNumber = (val) => {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    if (val in StatusMap) return StatusMap[val];
    const n = Number(val);
    return Number.isFinite(n) ? n : StatusMap.Pending;
  }
  return StatusMap.Pending;
};

const getToken = () => {
  const raw = localStorage.getItem("token") || localStorage.getItem("authToken");
  if (!raw || raw.trim() === "") return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed.token || parsed;
  } catch {
    return raw;
  }
};

const getHeaders = () => {
  const token = getToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const slugify = (str) =>
  (str || "")
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const splitTokens = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val.map(String).map((s) => s.trim()).filter(Boolean);
  }
  if (typeof val === "string") {
    const s = val.trim();
    if (s.startsWith("[") && s.endsWith("]")) {
      try {
        const arr = JSON.parse(s);
        return Array.isArray(arr) ? arr.map(String).map((x) => x.trim()).filter(Boolean) : [];
      } catch {}
    }
    return s.split(",").map((x) => x.trim()).filter(Boolean);
  }
  return [];
};

const formatSizesForDisplay = (val) => splitTokens(val).join(", ");

// ---- Variant helpers (must match backend) ----
const SizeKind = {
  Alpha: 1,
  Numeric: 2,
  WaistInseam: 3,
  OneSize: 4,
};

const ALPHA_ORDER = ["XXXS", "XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];
const alphaFromIndex = (a) => ALPHA_ORDER[a] || "S";

const sizeLabel = (kind, a, b) => {
  switch (Number(kind)) {
    case SizeKind.Alpha:
      return alphaFromIndex(Number(a) || 0);
    case SizeKind.Numeric:
      return String(Number(a) || 0);
    case SizeKind.WaistInseam: {
      const wa = Number(a) || 0;
      const inx = Number(b) || 0;
      return inx ? `${wa}/${inx}` : String(wa);
    }
    case SizeKind.OneSize:
      return "One-Size";
    default:
      return "N/A";
  }
};

const sizeSortKey = (k, a, b) => {
  const kind = Number(k);
  const A = Number(a) || 0;
  const B = Number(b) || 0;
  if (kind === SizeKind.Alpha) return A; // 0..8
  if (kind === SizeKind.Numeric) return 1000 + A; // 1000+
  if (kind === SizeKind.WaistInseam) return 2000 + A * 1000 + B; // 2000+
  if (kind === SizeKind.OneSize) return 3000; // last
  return 9999;
};

const ProductDetailsPage = () => {
  const { t, ready } = useTranslation("productdetail", { useSuspense: false });
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [shopId, setShopId] = useState(null);
  const [shopSlug, setShopSlug] = useState(null);
  const [shopName, setShopName] = useState(null);
  const [loading, setLoading] = useState(true);

  const [booking, setBooking] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [myBookingCount, setMyBookingCount] = useState(0);
  const [checkingBookings, setCheckingBookings] = useState(false);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0 });
  const offsetStartRef = useRef({ x: 0, y: 0 });

  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  const gridUI = React.useMemo(
  () =>
    isDarkMode
      ? {
          headerBg:  "#0f172a", // slate-900-ish
          headerFg:  "#cbd5e1", // slate-300
          border:    "#334155", // slate-600
          rowHeadBg: "#0b1220", // deep panel
          filledBg:  "#0b1220",
          filledFg:  "#e5e7eb", // slate-200
          emptyBg:   "#111827", // slate-800
          emptyFg:   "#64748b", // slate-500
        }
      : {
          headerBg:  "#f9fafb",
          headerFg:  "#111827",
          border:    "#e5e7eb",
          rowHeadBg: "#ffffff",
          filledBg:  "#ffffff",
          filledFg:  "#111827",
          emptyBg:   "#f3f4f6",
          emptyFg:   "#6b7280",
        },
  [isDarkMode]
);

  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => setIsDarkMode(e.matches);
    try {
      mq.addEventListener("change", onChange);
    } catch {
      mq.addListener(onChange);
    }
    return () => {
      try {
        mq.removeEventListener("change", onChange);
      } catch {
        mq.removeListener(onChange);
      }
    };
  }, []);

  const [variantOpen, setVariantOpen] = useState(false);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [variantError, setVariantError] = useState("");

  const loadMyBookingCount = useCallback(async (clothingItemId) => {
    const token = getToken();
    if (!token || !clothingItemId) {
      setMyBookingCount(0);
      return;
    }

    setCheckingBookings(true);
    try {
      const res = await fetch(`${API_BASE}/Reservation/my-bookings`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error(`Bookings fetch failed: ${res.status}`);
      const list = await res.json();

      const count = Array.isArray(list)
        ? list.filter((b) => {
            const sameItem = String(b?.clothingItemId) === String(clothingItemId);
            const rawStatus = b?.status ?? b?.Status;
            const statusNum = toStatusNumber(rawStatus);
            return sameItem && (statusNum === StatusMap.Pending || statusNum === StatusMap.Confirmed);
          }).length
        : 0;

      setMyBookingCount(count);
      try {
        localStorage.setItem(`reservations:${clothingItemId}`, String(count));
      } catch {}
    } catch {
      try {
        const saved = localStorage.getItem(`reservations:${clothingItemId}`);
        setMyBookingCount(saved ? parseInt(saved, 10) || 0 : 0);
      } catch {
        setMyBookingCount(0);
      }
    } finally {
      setCheckingBookings(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;

    const fetchAll = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/ClothingItem/${id}`, {
          headers: getHeaders(),
        });
        if (!res.ok) throw new Error(`Product fetch failed: ${res.status}`);
        const data = await res.json();
        if (!alive) return;

        setProduct(data);

        try {
          const imgs = Array.isArray(data.pictureUrls)
            ? data.pictureUrls
            : JSON.parse(data.pictureUrls || "[]");
          if (imgs.length > 0) setCurrentIndex(0);
        } catch {}

        setMyBookingCount(0);
        loadMyBookingCount(data.clothingItemId);

        const primaryBizId =
          (Array.isArray(data.businessIds) && data.businessIds[0]) ||
          data.businessId ||
          null;

        if (primaryBizId) {
          setShopId(primaryBizId);
          try {
            const bizRes = await fetch(`${API_BASE}/Business/${primaryBizId}`, {
              headers: getHeaders(),
            });
            if (bizRes.ok) {
              const biz = await bizRes.json();
              const resolvedSlug = (biz.slug && biz.slug.trim()) || slugify(biz.name);
              if (!alive) return;
              setShopSlug(resolvedSlug || null);
              setShopName(biz.name || null);
            }
          } catch {}
        }
      } catch {
        if (alive) setProduct(null);
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchAll();
    return () => {
      alive = false;
    };
  }, [id, loadMyBookingCount]);

  const parsedImages = useMemo(() => {
    if (!product) return [];
    try {
      if (Array.isArray(product.pictureUrls)) {
        return product.pictureUrls.filter(Boolean);
      }
      if (typeof product.pictureUrls === "string" && product.pictureUrls.trim() !== "") {
        try {
          const arr = JSON.parse(product.pictureUrls);
          return Array.isArray(arr) ? arr.filter(Boolean) : [product.pictureUrls];
        } catch {
          return [product.pictureUrls];
        }
      }
      return [];
    } catch {
      return [];
    }
  }, [product]);

  useEffect(() => {
    if (parsedImages.length === 0) setCurrentIndex(0);
    else if (currentIndex >= parsedImages.length) setCurrentIndex(0);
  }, [parsedImages, currentIndex]);

  const fallbackProductImg = isDarkMode ? DEFAULT_PRODUCT_DARK : DEFAULT_PRODUCT_LIGHT;
  const currentMainImage = parsedImages.length > 0 ? parsedImages[currentIndex] : fallbackProductImg;

  const handleThumbnailClick = (_url, idx) => setCurrentIndex(idx);
  const handlePrev = () => {
    if (parsedImages.length === 0) return;
    setCurrentIndex((i) => (i - 1 + parsedImages.length) % parsedImages.length);
  };
  const handleNext = () => {
    if (parsedImages.length === 0) return;
    setCurrentIndex((i) => (i + 1) % parsedImages.length);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (viewerOpen) {
        if (e.key === "Escape") {
          setViewerOpen(false);
          return;
        }
        if (e.key === "ArrowLeft") {
          handlePrev();
          return;
        }
        if (e.key === "ArrowRight") {
          handleNext();
          return;
        }
      } else {
        if (e.key === "ArrowLeft") handlePrev();
        if (e.key === "ArrowRight") handleNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewerOpen, parsedImages.length]);

  const openViewer = () => {
    setViewerOpen(true);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };
  const closeViewer = () => {
    setViewerOpen(false);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setDragging(false);
  };
  const toggleZoom = () => {
    if (zoom === 1) {
      setZoom(2);
    } else {
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    }
  };
  const onMouseDownImg = (e) => {
    if (zoom === 1) return;
    e.preventDefault();
    setDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    offsetStartRef.current = { ...offset };
  };
  const onMouseMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setOffset({ x: offsetStartRef.current.x + dx, y: offsetStartRef.current.y + dy });
  };
  const onMouseUp = () => setDragging(false);

  useEffect(() => {
    if (!viewerOpen || !dragging) return;
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [viewerOpen, dragging]);

  const sizeOptions = useMemo(() => splitTokens(product?.sizes), [product]);
  const colorOptions = useMemo(() => splitTokens(product?.colors), [product]);

  // ---- Extract variants from API payload (supports multiple shapes) ----
  const variants = useMemo(() => {
    const raw = product?.variants || product?.Variants || [];
    if (!Array.isArray(raw)) return [];
    return raw.map((v) => {
      const color = (v.color ?? v.Color ?? "Default") || "Default";
      const qty = Number(v.quantity ?? v.Quantity ?? 0) || 0;
      const s =
        v.size ??
        v.Size ?? {
          kind: v.sizeKind ?? v.SizeKind ?? v.kind ?? v.Kind,
          a: v.sizeA ?? v.SizeA ?? v.a ?? v.A,
          b: v.sizeB ?? v.SizeB ?? v.b ?? v.B,
        };
      const kind = Number(s?.kind ?? s?.Kind ?? SizeKind.OneSize) || SizeKind.OneSize;
      const a = Number(s?.a ?? s?.A ?? 0) || 0;
      const b = Number(s?.b ?? s?.B ?? 0) || 0;
      return { color: String(color), kind, a, b, quantity: qty, label: sizeLabel(kind, a, b) };
    });
  }, [product]);

  // ---- Build grid axes (unique sizes & colors) ----
  const gridAxes = useMemo(() => {
    if (variants.length === 0) return { sizes: [], colors: [] };

    const sizeMap = new Map();
    for (const v of variants) {
      const key = `${v.kind}|${v.a}|${v.b}`;
      if (!sizeMap.has(key)) {
        sizeMap.set(key, {
          key,
          kind: v.kind,
          a: v.a,
          b: v.b,
          label: v.label,
          order: sizeSortKey(v.kind, v.a, v.b),
        });
      }
    }
    const sizes = Array.from(sizeMap.values()).sort((x, y) => x.order - y.order);

    const colors = Array.from(new Set(variants.map((v) => v.color))).sort((a, b) => a.localeCompare(b));

    return { sizes, colors };
  }, [variants]);

  // ---- Build grid data: color x size -> qty ----
  const variantGrid = useMemo(() => {
    const { sizes, colors } = gridAxes;
    if (sizes.length === 0 || colors.length === 0) return [];
    const rows = colors.map((c) => {
      const cells = sizes.map((s) => {
        const found = variants.find(
          (v) => v.color === c && v.kind === s.kind && v.a === s.a && v.b === s.b
        );
        return found?.quantity ?? 0;
      });
      return { color: c, cells };
    });
    return rows;
  }, [gridAxes, variants]);

  const submitReservation = useCallback(
    async (sizeOpt, colorOpt) => {
      if (!product) return;

      if (!isNaN(Number(product.quantity)) && Number(product.quantity) <= 0) {
        alert(t("booking.out_of_stock_msg", { defaultValue: "Out Of Stock, Please Come Back Later" }));
        return;
      }

      const token = getToken();
      if (!token) {
        alert(t("booking.login_required", { defaultValue: "Please log in to make a reservation." }));
        return;
      }

      setBooking(true);
      try {
        const body = { clothingItemId: product.clothingItemId };
        if (sizeOpt) body.selectedSize = sizeOpt;
        if (colorOpt) body.selectedColor = colorOpt;

        const res = await fetch(`${API_BASE}/Reservation`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(body),
        });

        if (res.status === 401) {
          navigate("/login");
          return;
        }

        if (res.ok) {
          alert(t("booking.success", { defaultValue: "Product booked successfully!" }));
          setMyBookingCount((prev) => {
            const next = (prev || 0) + 1;
            try {
              localStorage.setItem(`reservations:${product.clothingItemId}`, String(next));
            } catch {}
            return next;
          });
          await loadMyBookingCount(product.clothingItemId);
          try {
            localStorage.setItem("reservationUpdated", Date.now().toString());
          } catch {}
        } else {
          const errText = await res.text();
          alert(t("errors.booking_api", { message: errText, defaultValue: `Booking error: ${errText}` }));
        }
      } catch {
        alert(t("errors.booking_failed", { defaultValue: "An error occurred while booking." }));
      } finally {
        setBooking(false);
        setVariantOpen(false);
      }
    },
    [product, t, navigate, loadMyBookingCount]
  );

  const handleBookClick = useCallback(() => {
    if (!product) return;

    const sizes = sizeOptions;
    const colors = colorOptions;

    const requiresSize = sizes.length > 1;
    const requiresColor = colors.length > 1;

    if (requiresSize || requiresColor) {
      setSelectedSize(sizes[0] || "");
      setSelectedColor(colors[0] || "");
      setVariantError("");
      setVariantOpen(true);
      return;
    }

    submitReservation(sizes[0] || "", colors[0] || "");
  }, [product, sizeOptions, colorOptions, submitReservation]);

  const confirmVariant = useCallback(() => {
    if (sizeOptions.length > 1 && !selectedSize) {
      setVariantError(t("booking.size_required", { defaultValue: "Please choose a size." }));
      return;
    }
    if (colorOptions.length > 1 && !selectedColor) {
      setVariantError(t("booking.color_required", { defaultValue: "Please choose a color." }));
      return;
    }
    setVariantError("");
    submitReservation(selectedSize || "", selectedColor || "");
  }, [selectedSize, selectedColor, sizeOptions.length, colorOptions.length, submitReservation, t]);

  const backToShop = async () => {
    if (shopSlug && shopSlug.trim()) {
      navigate(`/shop/${shopSlug.trim()}`);
      return;
    }
    if (shopName && slugify(shopName)) {
      navigate(`/shop/${slugify(shopName)}`);
      return;
    }
    if (shopId) {
      try {
        const shopRes = await fetch(`${API_BASE}/Business/${shopId}`, { headers: getHeaders() });
        if (shopRes.ok) {
          const shop = await shopRes.json();
          const resolvedSlug = (shop.slug && shop.slug.trim()) || slugify(shop.name);
          if (resolvedSlug) {
            setShopSlug(resolvedSlug);
            setShopName(shop.name || null);
            navigate(`/shop/${resolvedSlug}`);
            return;
          }
        }
      } catch {}
    }
    navigate("/");
  };

  if (!ready) {
    return (
      <>
            <div
      className="loading-container"
      aria-live="polite"
      aria-busy="true"
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "16px 0" }}
    >
      <img
        className="loading-gif"
        src={isDarkMode ? LOADING_GIF_DARK : LOADING_GIF_LIGHT}
        alt="Loading"
      />
      <p className="loading-text">Loading ...</p>
    </div>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <div className="product-detail-container" style={{ minHeight: "40vh" }}>
          <div
            className="loading-container"
            aria-live="polite"
            aria-busy="true"
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "40px 0" }}
          >
            <img
              className="loading-gif"
              src={isDarkMode ? LOADING_GIF_DARK : LOADING_GIF_LIGHT}
              alt="Loading"
              width={100}
              height={100}
              style={{ objectFit: "contain" }}
            />
            <p className="loading-text">Loading ...</p>
          </div>
        </div>
      </>
    );
  }

  if (!product) {
    return (
      <>
        <Navbar />
        <div className="error-container" style={{ minHeight: "40vh", display: "grid", placeItems: "center" }}>
          <div className="error-message">{t("errors.not_found", { defaultValue: "Product not found." })}</div>
        </div>
        <Footer />
      </>
    );
  }

  const arrowsDisabled = parsedImages.length <= 1;

  // after
  const arrowBaseStyle = {
    position: "absolute",
    top: "40%",
    transform: "translateY(-50%)",
    border: "none",
    background: "rgba(0,0,0,0.45)",
    color: "#fff",
    width: 40,
    height: 40,
    borderRadius: 9999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    lineHeight: 1,
    cursor: "pointer",
    zIndex: 50,
    userSelect: "none",
  };

  // Format price: no trailing .00, keep decimals if they exist (e.g., 123.5)
const priceNumber = Number(product.price);
const formatPrice = (n) =>
  Number.isFinite(n)
    ? n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    : String(product.price);

const priceLabel = !Number.isNaN(priceNumber)
  ? t("price_fmt", { value: formatPrice(priceNumber), defaultValue: `${formatPrice(priceNumber)} LEK` })
  : t("price_fmt", { value: product.price, defaultValue: `${product.price} LEK` });

  const qtyNumber = Number(product.quantity);
  const isOutOfStock = !isNaN(qtyNumber) && qtyNumber <= 0;

  // Availability label (green/red)
  const availabilityText = isOutOfStock
    ? t("availability.out_of_stock", { defaultValue: "Out of Stock" })
    : t("availability.available", { defaultValue: "Available" });

  const sizesDisplay = formatSizesForDisplay(product.sizes);

  return (
    <>
      <Navbar />
      <div className="product-detail-container">
        <div className="product-main">
          <div className="product-images" style={{ position: "relative", isolation: "isolate" }}>
            {currentMainImage && (
              <>
                <button
                  type="button"
                  aria-label={t("carousel.prev", { defaultValue: "Previous image" })}
                  onClick={handlePrev}
                  disabled={arrowsDisabled}
                  className="carousel-arrow left"
                  style={{ ...arrowBaseStyle, left: 8, opacity: arrowsDisabled ? 0.35 : 1 }}
                >
                  ‹
                </button>

                <img
                  src={currentMainImage}
                  alt={t("carousel.main_alt", { defaultValue: "Main product" })}
                  className="main-image"
                  style={{ display: "block", width: "100%", cursor: "zoom-in" }}
                  onClick={openViewer}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = fallbackProductImg;
                  }}
                />

                <button
                  type="button"
                  aria-label={t("carousel.next", { defaultValue: "Next image" })}
                  onClick={handleNext}
                  disabled={arrowsDisabled}
                  className="carousel-arrow right"
                  style={{ ...arrowBaseStyle, right: 8, opacity: arrowsDisabled ? 0.35 : 1 }}
                >
                  ›
                </button>
              </>
            )}

            <div className="thumbnail-list">
              {parsedImages.slice(0, 10).map((url, idx) => (
                <img
                  key={idx}
                  src={url}
                  alt={t("carousel.thumb_alt", { index: idx + 1, defaultValue: `Thumbnail ${idx + 1}` })}
                  onClick={() => handleThumbnailClick(url, idx)}
                  className={`thumbnail ${currentIndex === idx ? "active" : ""}`}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = fallbackProductImg;
                  }}
                />
              ))}
            </div>
          </div>

          <div className="product-info">
          <div className="title-row">
            <h1 className="product-title">
              {product.name} – {product.brand}
            </h1>
            <button
              type="button"
              onClick={backToShop}
              className="back-to-shop-button small"
              title={t("nav.back_to_shop", { defaultValue: "Back to Shop" })}
            >
             {t("nav.back_to_shop", { defaultValue: "Back to Shop" })}
            </button>
          </div>
                      <div className="product-info-grid">
              <div className="info-card">
                <p>
                  <strong>{t("fields.model", { defaultValue: "Model" })}:</strong> {product.model}
                </p>
              </div>

              <div className="info-card">
                <p>
                  <strong>{t("fields.description", { defaultValue: "Description" })}:</strong> {product.description}
                </p>
              </div>

              <div className="info-card price-card">
                <p>
                  <strong>{t("fields.price", { defaultValue: "Price" })}:</strong> {priceLabel}
                </p>
              </div>

              {/* Quantity (no inline out-of-stock message anymore) */}
              <div className="info-card">
                <p>
                  <strong>{t("fields.quantity", { defaultValue: "Quantity" })}:</strong> {product.quantity}
                </p>
              </div>

              <div className="info-card">
                <p>
                  <strong>{t("fields.material", { defaultValue: "Material" })}:</strong> {product.material}
                </p>
              </div>

              <div className="info-card">
                <p>
                  <strong>{t("fields.colors", { defaultValue: "Colors" })}:</strong>{" "}
                  {Array.isArray(product.colors)
                    ? product.colors.join(", ")
                    : splitTokens(product.colors).join(", ") || product.colors}
                </p>
              </div>

              <div className="info-card">
                <p>
                  <strong>{t("fields.size", { defaultValue: "Size" })}:</strong> {sizesDisplay}
                </p>
              </div>

              {/* NEW: Availability (green/red), placed next to Size */}
              <div className="info-card">
                <p>
                  <strong>{t("fields.availability", { defaultValue: "Availability" })}:</strong>
                  <span
                    style={{
                      marginLeft: 8,
                      fontWeight: 700,
                      color: isOutOfStock ? "var(--danger)" : "var(--success)",
                    }}
                  >
                    {availabilityText}
                  </span>
                </p>
              </div>

              {/* ---- Variant Grid (Color × Size → Qty) ---- */}
              {variants.length > 0 &&
                gridAxes.sizes.length > 0 &&
                gridAxes.colors.length > 0 && (
                  <div className="info-card" style={{ gridColumn: "1 / -1" }}>
                    <p style={{ marginBottom: 8, fontWeight: 700 }}>
                      {t("stock.per_variant", { defaultValue: "Available by Color & Size" })}
                    </p>
                    <div style={{ overflowX: "auto" }}>
                    <table
                    style={{
                      borderCollapse: "separate",
                      borderSpacing: 0,
                      minWidth: 480,
                      width: "100%",
                      fontSize: 14,
                    }}
                  >
                    <thead>
                      <tr>
                        <th
                          style={{
                            position: "sticky",
                            left: 0,
                            background: gridUI.headerBg,
                            color: gridUI.headerFg,
                            border: `1px solid ${gridUI.border}`,
                            padding: "8px 10px",
                            textAlign: "left",
                            zIndex: 1,
                          }}
                        >
                          {t("fields.color", { defaultValue: "Color" })} \{" "}
                          {t("fields.size", { defaultValue: "Size" })}
                        </th>

                        {gridAxes.sizes.map((s) => (
                          <th
                            key={s.key}
                            style={{
                              border: `1px solid ${gridUI.border}`,
                              padding: "8px 10px",
                              background: gridUI.headerBg,
                              color: gridUI.headerFg,
                              textAlign: "center",
                              whiteSpace: "nowrap",
                            }}
                            title={`${s.label}`}
                          >
                            {s.label}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {variantGrid.map((row) => (
                        <tr key={row.color}>
                          <th
                            style={{
                              position: "sticky",
                              left: 0,
                              background: gridUI.rowHeadBg,
                              color: gridUI.headerFg,
                              border: `1px solid ${gridUI.border}`,
                              padding: "8px 10px",
                              textAlign: "left",
                              zIndex: 1,
                              whiteSpace: "nowrap",
                            }}
                            scope="row"
                            title={row.color}
                          >
                            {row.color}
                          </th>

                          {row.cells.map((qty, idx) => (
                            <td
                              key={`${row.color}-${idx}`}
                              style={{
                                border: `1px solid ${gridUI.border}`,
                                padding: "8px 10px",
                                textAlign: "center",
                                background: qty > 0 ? gridUI.filledBg : gridUI.emptyBg,
                                color: qty > 0 ? gridUI.filledFg : gridUI.emptyFg,
                                fontWeight: qty > 0 ? 600 : 400,
                              }}
                              aria-label={`${row.color} / ${gridAxes.sizes[idx].label}`}
                            >
                              {qty}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                    </div>
                  </div>
                )}
            </div>

            <button onClick={handleBookClick} disabled={booking || isOutOfStock} className="rezerve-button">
              {booking
                ? t("booking.reserving", { defaultValue: "Booking this product..." })
                : isOutOfStock
                ? t("stock.out_now", { defaultValue: "Currently Out Of Stock" })
                : myBookingCount > 0
                ? t("booking.reserve_another", { defaultValue: "Book Another" })
                : t("booking.reserve", { defaultValue: "Book Product" })}
            </button>

            {myBookingCount > 0 && (
              <div className="info-card" style={{ marginTop: 8 }}>
                <p>
                  <strong>{t("booking.count_label", { defaultValue: "Booked" })}:</strong>{" "}
                  {checkingBookings ? "…" : myBookingCount}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {variantOpen && (
        <div
          className="variant-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => !booking && setVariantOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            className="variant-panel"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              color: "#111",
              width: "min(92vw, 440px)",
              borderRadius: 12,
              padding: 20,
              boxShadow: "0 10px 40px rgba(0,0,0,0.25)",
              position: "relative",
            }}
          >
            <button
              aria-label={t("lightbox.close", { defaultValue: "Close" })}
              onClick={() => !booking && setVariantOpen(false)}
              style={{
                position: "absolute",
                top: 6,
                right: 10,
                border: "none",
                background: "transparent",
                fontSize: 22,
                cursor: "pointer",
                color: "#666",
              }}
            >
              ×
            </button>

            <h3 style={{ margin: "0 0 12px 0" }}>
              {t("booking.choose_variant", { defaultValue: "Choose options" })}
            </h3>

            {sizeOptions.length > 1 && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>
                  {t("fields.size", { defaultValue: "Size" })}
                </label>
                <select
                  value={selectedSize}
                  onChange={(e) => setSelectedSize(e.target.value)}
                  disabled={booking}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
                >
                  {sizeOptions.map((sz) => (
                    <option key={sz} value={sz}>
                      {sz}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {colorOptions.length > 1 && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>
                  {t("fields.colors", { defaultValue: "Colors" })}
                </label>
                <select
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  disabled={booking}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
                >
                  {colorOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {variantError && (
              <div style={{ color: "#b91c1c", marginBottom: 8, fontWeight: 600 }}>{variantError}</div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setVariantOpen(false)}
                disabled={booking}
                style={{
                  background: "#f3f4f6",
                  color: "#111",
                  border: "1px solid #e5e7eb",
                  padding: "8px 14px",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                {t("common.cancel", { defaultValue: "Cancel" })}
              </button>
              <button
                onClick={confirmVariant}
                disabled={booking}
                style={{
                  background: "#111827",
                  color: "#fff",
                  border: "none",
                  padding: "8px 14px",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                {booking
                  ? t("booking.reserving", { defaultValue: "Booking..." })
                  : t("booking.confirm", { defaultValue: "Confirm" })}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewerOpen && (
        <div className="lightbox-overlay" role="dialog" aria-modal="true" onClick={closeViewer}>
          <div className="lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <button
              className="lightbox-close"
              aria-label={t("lightbox.close", { defaultValue: "Close" })}
              onClick={closeViewer}
              title={t("lightbox.close", { defaultValue: "Close" })}
            >
              ×
            </button>

            <button
              className="lightbox-arrow left"
              onClick={handlePrev}
              aria-label={t("carousel.prev", { defaultValue: "Previous image" })}
            >
              ‹
            </button>
            <button
              className="lightbox-arrow right"
              onClick={handleNext}
              aria-label={t("carousel.next", { defaultValue: "Next image" })}
            >
              ›
            </button>

            <div className="lightbox-viewport">
              <img
                src={currentMainImage}
                alt={t("carousel.main_alt", { defaultValue: "Main product" })}
                className="lightbox-image"
                onMouseDown={onMouseDownImg}
                onClick={toggleZoom}
                style={{
                  cursor: zoom === 1 ? "zoom-in" : dragging ? "grabbing" : "grab",
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${zoom})`,
                }}
                draggable={false}
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = fallbackProductImg;
                }}
              />
            </div>

            <div className="lightbox-toolbar">
              <button
                className="lightbox-tool"
                onClick={() => setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))}
                disabled={zoom <= 1}
                title={t("lightbox.zoom_out", { defaultValue: "Zoom out" })}
              >
                −
              </button>
              <span className="lightbox-zoom-label">{Math.round(zoom * 100)}%</span>
              <button
                className="lightbox-tool"
                onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}
                title={t("lightbox.zoom_in", { defaultValue: "Zoom in" })}
              >
                +
              </button>
              <button
                className="lightbox-tool"
                onClick={() => {
                  setZoom(1);
                  setOffset({ x: 0, y: 0 });
                }}
                title={t("lightbox.reset", { defaultValue: "Reset" })}
              >
                ⟳
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
};

export default ProductDetailsPage;
