import React, { useState, useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTranslation } from "react-i18next";
import HoursPicker from "../../OpeningHoursPicker"; // default export
import { useApiClient } from "../hooks/useApiClient"; // panels -> Settings -> hooks
import "../../../Styling/Settings/settings.css";
import "../../../Styling/Settings/businessinfopanel.css";

// Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

// ---- Schedule helpers (local) -----------------------------------
const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const ABBR = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const getDefaultSchedule = () => ({
  monday: { open: "09:00", close: "18:00", closed: false },
  tuesday: { open: "09:00", close: "18:00", closed: false },
  wednesday: { open: "09:00", close: "18:00", closed: false },
  thursday: { open: "09:00", close: "18:00", closed: false },
  friday: { open: "09:00", close: "18:00", closed: false },
  saturday: { open: "10:00", close: "14:00", closed: true },
  sunday: { open: "10:00", close: "14:00", closed: true },
});

const toHHMM = (s) => {
  if (typeof s !== "string") return "00:00";
  const [hRaw, mRaw] = s.split(":");
  const h = Math.max(0, Math.min(23, parseInt(hRaw, 10) || 0));
  const m = Math.max(0, Math.min(59, parseInt(mRaw ?? "0", 10) || 0));
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const fmtTimeShort = (t) => {
  const [hh, mm] = t.split(":");
  const h = String(Number(hh));
  return mm === "00" ? h : `${h}:${mm}`;
};

const sameTime = (a, b) => a && b && a.open === b.open && a.close === b.close && !a.closed && !b.closed;

const compactSchedule = (schedule, maxLen = 20) => {
  const days = DAY_KEYS.map((k) => schedule[k]);
  const openMask = days.map((d) => !d.closed);
  if (openMask.every((v) => !v)) return "Closed";

  const firstOpenIdx = openMask.findIndex(Boolean);
  const firstOpen = days[firstOpenIdx];
  const allSame =
    openMask.every((v) => v === openMask[firstOpenIdx]) && !firstOpen.closed
      ? days.every((d) => sameTime(d, firstOpen))
      : false;

  if (allSame) {
    const token = `Daily ${fmtTimeShort(firstOpen.open)}-${fmtTimeShort(firstOpen.close)}`;
    return token.length <= maxLen ? token : "Varies by day";
  }

  const groups = [];
  let i = 0;
  while (i < 7) {
    if (!openMask[i]) {
      i++;
      continue;
    }
    const start = i;
    const ref = days[i];
    while (i + 1 < 7 && openMask[i + 1] && sameTime(days[i + 1], ref)) i++;
    const end = i;
    groups.push({ start, end, open: fmtTimeShort(ref.open), close: fmtTimeShort(ref.close) });
    i++;
  }

  const tokens = groups.map((g) => {
    const dayPart = g.start === g.end ? ABBR[g.start] : `${ABBR[g.start]}-${ABBR[g.end]}`;
    return `${dayPart} ${g.open}-${g.close}`;
  });

  let out = "";
  for (const t of tokens) {
    const candidate = out ? `${out} ${t}` : t;
    if (candidate.length <= maxLen) out = candidate;
    else break;
  }
  if (!out) out = tokens[0] || "Varies by day";
  if (out.length > maxLen) out = "Varies by day";
  return out;
};

const normalizeSchedule = (obj) => {
  const base = getDefaultSchedule();
  try {
    for (const k of DAY_KEYS) {
      const d = obj?.[k] ?? {};
      base[k] = {
        open: toHHMM(d.open ?? base[k].open),
        close: toHHMM(d.close ?? base[k].close),
        closed: Boolean(d.closed),
      };
    }
  } catch {
    return getDefaultSchedule();
  }
  return base;
};

const parseCompact = (str) => {
  const base = getDefaultSchedule();
  for (const k of DAY_KEYS) base[k].closed = true;

  const re = /([A-Z][a-z]?(?:\-[A-Z][a-z]?)?)\s+(\d{1,2}(?::\d{2})?)\-(\d{1,2}(?::\d{2})?)/g;
  const idxOf = (a) => ABBR.indexOf(a);
  let m,
    matched = false;

  while ((m = re.exec(str)) !== null) {
    matched = true;
    const dayPart = m[1];
    const open = toHHMM(m[2]);
    const close = toHHMM(m[3]);

    if (dayPart.includes("-")) {
      const [a, b] = dayPart.split("-");
      const s = idxOf(a),
        e = idxOf(b);
      if (s !== -1 && e !== -1 && s <= e) {
        for (let i = s; i <= e; i++) base[DAY_KEYS[i]] = { open, close, closed: false };
      }
    } else {
      const i = idxOf(dayPart);
      if (i !== -1) base[DAY_KEYS[i]] = { open, close, closed: false };
    }
  }
  return matched ? base : getDefaultSchedule();
};

const parseIncomingOpeningHours = (incoming) => {
  if (!incoming) return getDefaultSchedule();
  if (typeof incoming === "object") return normalizeSchedule(incoming);

  if (typeof incoming === "string") {
    const trimmed = incoming.trim();
    if (trimmed.toLowerCase() === "closed") {
      const all = getDefaultSchedule();
      for (const k of DAY_KEYS) all[k].closed = true;
      return all;
    }
    try {
      const obj = JSON.parse(trimmed);
      if (obj && typeof obj === "object") return normalizeSchedule(obj);
    } catch {
      /* fall through */
    }
    return parseCompact(trimmed);
  }
  return getDefaultSchedule();
};

// ---- Component ---------------------------------------------------
export default function BusinessInfoPanel({ business }) {
  const { t } = useTranslation("businessinfo");
  const { get, put } = useApiClient();

  const getRef = useRef(get);
  const putRef = useRef(put);
  useEffect(() => {
    getRef.current = get;
  }, [get]);
  useEffect(() => {
    putRef.current = put;
  }, [put]);

  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    nipt: "",
    businessEmailAddress: "",
    location: "",
    openingHours: "", // JSON string of schedule
    businessPhoneNumber: "",
  });

  const [schedule, setSchedule] = useState(getDefaultSchedule());
  const [coordinates, setCoordinates] = useState(null);
  const [suggestions, setSuggestions] = useState([]);

  const mapContainerRef = useRef(null);
  const leafletMapRef = useRef(null);
  const markerRef = useRef(null);

  // Load
  useEffect(() => {
    if (!business?.businessId) return;
    let cancelled = false;
    setLoading(true);

    getRef
      .current(`/Business/${business.businessId}`)
      .then((data) => {
        if (cancelled) return;
        setDetail(data);

        // Location
        if (data.location?.includes(",")) {
          const [latS, lngS] = data.location.split(",");
          const lat = parseFloat(latS),
            lng = parseFloat(lngS);
          if (!isNaN(lat) && !isNaN(lng)) {
            setCoordinates([lat, lng]);
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
              .then((r) => r.json())
              .then(
                (j) => !cancelled && j.display_name && setForm((f) => ({ ...f, location: j.display_name }))
              )
              .catch(() => !cancelled && setForm((f) => ({ ...f, location: data.location })));
          } else {
            setForm((f) => ({ ...f, location: data.location || "" }));
          }
        } else {
          setForm((f) => ({ ...f, location: data.location || "" }));
        }

        // Opening hours (accept JSON/object/compact)
        const parsed = parseIncomingOpeningHours(data.openingHours);
        setSchedule(parsed);

        setForm((f) => ({
          ...f,
          name: data.name || "",
          description: data.description || "",
          nipt: data.nipt || "",
          businessEmailAddress: data.businessEmailAddress || "",
          openingHours: JSON.stringify(parsed),
          businessPhoneNumber: data.businessPhoneNumber || "",
        }));
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [business?.businessId]);

  // Sync JSON string with picker state
  useEffect(() => {
    setForm((f) => ({ ...f, openingHours: JSON.stringify(schedule) }));
  }, [schedule]);

  // Map bootstrap
  useEffect(() => {
    if (loading || !detail) return;
    if (!mapContainerRef.current || leafletMapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: coordinates || [0, 0],
      zoom: coordinates ? 13 : 2,
      layers: [
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
        }),
      ],
    });

    map.on("click", (e) => {
      const { lat, lng } = e.latlng;
      setCoordinates([lat, lng]);
      setForm((f) => ({ ...f, location: `${lat},${lng}` }));
      setSuggestions([]);
    });

    map.whenReady(() => map.invalidateSize());
    leafletMapRef.current = map;

    return () => {
      map.remove();
      leafletMapRef.current = null;
      markerRef.current?.remove();
      markerRef.current = null;
    };
  }, [loading, detail, coordinates]);

  // Marker update
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    markerRef.current?.remove();
    markerRef.current = null;

    if (!coordinates) return;

    const m = L.marker(coordinates, { draggable: true }).addTo(map);
    m.on("dragend", (e) => {
      const { lat, lng } = e.target.getLatLng();
      setCoordinates([lat, lng]);
      setForm((f) => ({ ...f, location: `${lat},${lng}` }));
    });
    markerRef.current = m;
    map.setView(coordinates, map.getZoom());
  }, [coordinates]);

  const handleLocationChange = useCallback(async (e) => {
    const q = e.target.value;
    setForm((f) => ({ ...f, location: q }));
    setCoordinates(null);
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`
      );
      const data = await res.json();
      setSuggestions(data);
    } catch {
      setSuggestions([]);
    }
  }, []);

  const handleSelectSuggestion = useCallback((s) => {
    const lat = parseFloat(s.lat),
      lon = parseFloat(s.lon);
    if (isNaN(lat) || isNaN(lon)) return;
    setForm((f) => ({ ...f, location: s.display_name }));
    setCoordinates([lat, lon]);
    setSuggestions([]);
  }, []);

  const handleSave = useCallback(async () => {
    if (!coordinates) {
      alert(t("alerts.pick_location", { defaultValue: "Please pick a location (map or suggestion)." }));
      return;
    }

    // validate schedule (HH:mm strings are zero-padded, safe lexicographic compare)
    const days = Object.values(schedule);
    const okTimes = days.every((d) => d.closed || (d.open && d.close && d.open < d.close));
    if (!okTimes || !days.some((d) => !d.closed)) {
      alert(
        t("alerts.invalid_hours", {
          defaultValue: "Invalid opening hours. Ensure at least one open day and Open < Close.",
        })
      );
      return;
    }

    const payload = {
      name: form.name?.trim() ?? detail.name,
      description: form.description ?? detail.description,
      nipt: form.nipt ?? detail.nipt,
      businessEmailAddress: form.businessEmailAddress ?? detail.businessEmailAddress,
      businessPhoneNumber: form.businessPhoneNumber ?? detail.businessPhoneNumber,
      location: `${Number(coordinates[0]).toFixed(6)},${Number(coordinates[1]).toFixed(6)}`,
      openingHours: JSON.stringify(schedule),
      coverPictureUrl: detail.coverPictureUrl ?? "",
      profilePictureUrl: detail.profilePictureUrl ?? "",
    };

    try {
      await putRef.current(`/Business/${detail.businessId}`, payload);
      alert(t("alerts.updated", { defaultValue: "Business info updated!" }));
    } catch (err) {
      console.log(err)
      try {
        const text = await err?.response?.text?.();
        console.error("Save failed (body):", text || err);
        alert(text || t("alerts.save_failed", { defaultValue: "Failed to save business info." }));
      } catch {
        console.error("Save failed:", err);
        alert(t("alerts.save_failed", { defaultValue: "Failed to save business info." }));
      }
    }
  }, [coordinates, detail?.businessId, detail, form, schedule, t]);

  if (loading) {
    return (
      <div className="business-info-panel">
        <p>{t("state.loading", { defaultValue: "Loading…" })}</p>
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="business-info-panel">
        <p>{t("state.error_loading", { defaultValue: "Error loading info." })}</p>
      </div>
    );
  }

  const compactPreview = compactSchedule(schedule, 24);

  return (
    <div className="business-info-panel" id="#business_info">
      <h3>{t("titles.edit", { defaultValue: "Edit Business Info" })}</h3>

      <label htmlFor="biz-name">
        <b>{t("fields.name", { defaultValue: "Business Name" })}</b>
      </label>
      <input
        id="biz-name"
        type="text"
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
      />
      <br />
      <br />

      <label htmlFor="biz-desc">
        <b>{t("fields.description", { defaultValue: "Description" })}</b>
      </label>
      <textarea
        id="biz-desc"
        value={form.description}
        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
      />
      <br />
      <br />

      <label htmlFor="biz-nipt">
        <b>{t("fields.nipt", { defaultValue: "NIPT" })}</b>
      </label>
      <input
        id="biz-nipt"
        type="text"
        value={form.nipt}
        onChange={(e) => setForm((f) => ({ ...f, nipt: e.target.value }))}
      />
      <br />
      <br />

      <label htmlFor="biz-email">
        <b>{t("fields.email", { defaultValue: "Business Email" })}</b>
      </label>
      <input
        id="biz-email"
        type="email"
        value={form.businessEmailAddress}
        onChange={(e) => setForm((f) => ({ ...f, businessEmailAddress: e.target.value }))}
      />
      <br />
      <br />

      <label htmlFor="biz-location">
        <b>{t("fields.location", { defaultValue: "Location" })}</b>
      </label>
      <div style={{ position: "relative" }}>
        <input
          id="biz-location"
          type="text"
          value={form.location}
          placeholder={t("placeholders.location", { defaultValue: "Start typing…" })}
          onChange={handleLocationChange}
          style={{ width: "100%" }}
          aria-autocomplete="list"
          aria-controls="location-suggestions"
        />
        {suggestions.length > 0 && (
          <ul id="location-suggestions" className="suggestions-list" role="listbox">
            {suggestions.map((s) => (
              <li
                key={s.place_id}
                onClick={() => handleSelectSuggestion(s)}
                role="option"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSelectSuggestion(s);
                  }
                }}
              >
                {s.display_name}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div
        ref={mapContainerRef}
        style={{ height: 200, width: "100%", marginTop: 16 }}
        aria-label={t("aria.map", { defaultValue: "Business location map" })}
      />
      <br />
      <br />

      <label>
        <b>{t("fields.opening_hours", { defaultValue: "Opening Hours" })}</b>
      </label>
      <HoursPicker value={schedule} onChange={setSchedule} />
      <br />
      <br />

      <label htmlFor="biz-phone">
        <b>{t("fields.phone", { defaultValue: "Business Phone Number" })}</b>
      </label>
      <input
        id="biz-phone"
        type="tel"
        value={form.businessPhoneNumber}
        onChange={(e) => setForm((f) => ({ ...f, businessPhoneNumber: e.target.value }))}
      />

      <div
        style={{ display: "flex", width: "100%", justifyContent: "center", alignItems: "center", marginTop: 20 }}
      >
        <button type="button" onClick={handleSave} style={{ padding: 10 }}>
          {t("actions.save", { defaultValue: "Save Changes" })}
        </button>
      </div>
    </div>
  );
}
