import React, { useState, useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTranslation } from "react-i18next";
import HoursPicker from "../../OpeningHoursPicker";
import { useApiClient } from "../hooks/useApiClient";
import "../../../Styling/Settings/settings.css";
import "../../../Styling/Settings/businessinfopanel.css";

// Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

// ---- Schedule helpers -----------------------------------
const DAY_KEYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
const ABBR = ["Mo","Tu","We","Th","Fr","Sa","Su"];

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
    if (!openMask[i]) { i++; continue; }
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
    if (candidate.length <= maxLen) out = candidate; else break;
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
  let m, matched = false;
  while ((m = re.exec(str)) !== null) {
    matched = true;
    const dayPart = m[1];
    const open = toHHMM(m[2]);
    const close = toHHMM(m[3]);
    if (dayPart.includes("-")) {
      const [a, b] = dayPart.split("-");
      const s = idxOf(a), e = idxOf(b);
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
    } catch {}
    return parseCompact(trimmed);
  }
  return getDefaultSchedule();
};

// ---- NEW: validators for Name & Location ---------------------------
const NAME_MIN = 3;
const NAME_MAX = 80;
const NAME_REGEX = /^[\p{L}\p{N}][\p{L}\p{N}\s'&().,\-]{1,79}$/u; // letters/numbers + common punctuation

function validateBizName(name, t) {
  const v = (name || "").trim();
  if (!v) return t("errors.name_required", { defaultValue: "Business name is required." });
  if (v.length < NAME_MIN)
    return t("errors.name_too_short", { defaultValue: `Business name must be at least ${NAME_MIN} characters.` });
  if (v.length > NAME_MAX)
    return t("errors.name_too_long", { defaultValue: `Business name must be at most ${NAME_MAX} characters.` });
  if (!NAME_REGEX.test(v))
    return t("errors.name_chars", { defaultValue: "Use letters, numbers, spaces, and . , ( ) ' & - only." });
  return null;
}

function validateLocationText(text, t) {
  const v = (text || "").trim();
  if (!v) return t("errors.location_required", { defaultValue: "Location is required." });
  if (v.length < 3) return t("errors.location_too_short", { defaultValue: "Location looks too short." });
  return null;
}

function validateCoordinates(coords, t) {
  if (!coords) return t("errors.coords_required", { defaultValue: "Pick a location from the map or suggestions." });
  const [lat, lon] = coords;
  if (typeof lat !== "number" || typeof lon !== "number") return t("errors.coords_invalid", { defaultValue: "Invalid coordinates." });
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return t("errors.coords_out_of_range", { defaultValue: "Coordinates out of range." });
  return null;
}

function scheduleHasAtLeastOneOpenDay(s) {
  return Object.values(s).some((d) => !d.closed);
}
function scheduleTimesValid(s) {
  return Object.values(s).every((d) => d.closed || (d.open && d.close && d.open < d.close));
}

// ---- Component ---------------------------------------------------
export default function BusinessInfoPanel({ business }) {
  const { t } = useTranslation("businessinfo");
  const { get, put } = useApiClient();

  const getRef = useRef(get);
  const putRef = useRef(put);
  useEffect(() => { getRef.current = get; }, [get]);
  useEffect(() => { putRef.current = put; }, [put]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    nipt: "",
    businessEmailAddress: "",
    location: "",
    openingHours: "",
    businessPhoneNumber: "",
  });

  const [schedule, setSchedule] = useState(getDefaultSchedule());
  const [scheduleError, setScheduleError] = useState(null);

  const [coordinates, setCoordinates] = useState(null);
  const [suggestions, setSuggestions] = useState([]);

  // NEW: field errors + touched state
  const [fieldErrors, setFieldErrors] = useState({ name: null, location: null, coords: null });
  const [touched, setTouched] = useState({ name: false, location: false });

  const mapContainerRef = useRef(null);
  const leafletMapRef = useRef(null);
  const markerRef = useRef(null);

  // Load
  useEffect(() => {
    if (!business?.businessId) return;
    let cancelled = false;
    setLoading(true);

    getRef.current(`/Business/${business.businessId}`)
      .then((data) => {
        if (cancelled) return;
        setDetail(data);

        // Location
        if (data.location?.includes(",")) {
          const [latS, lngS] = data.location.split(",");
          const lat = parseFloat(latS), lng = parseFloat(lngS);
          if (!isNaN(lat) && !isNaN(lng)) {
            setCoordinates([lat, lng]);
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
              .then((r) => r.json())
              .then((j) => !cancelled && j.display_name && setForm((f) => ({ ...f, location: j.display_name })))
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

    return () => { cancelled = true; };
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
      layers: [L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
      })],
    });

    map.on("click", (e) => {
      const { lat, lng } = e.latlng;
      setCoordinates([lat, lng]);
      setForm((f) => ({ ...f, location: `${lat},${lng}` }));
      setSuggestions([]);
      // trigger coord validation after selecting on map
      setFieldErrors((fe) => ({ ...fe, coords: validateCoordinates([lat, lng], t) }));
    });

    map.whenReady(() => map.invalidateSize());
    leafletMapRef.current = map;

    return () => {
      map.remove();
      leafletMapRef.current = null;
      markerRef.current?.remove();
      markerRef.current = null;
    };
  }, [loading, detail, coordinates, t]);

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
      setFieldErrors((fe) => ({ ...fe, coords: validateCoordinates([lat, lng], t) }));
    });
    markerRef.current = m;
    map.setView(coordinates, map.getZoom());
  }, [coordinates, t]);

  const handleLocationChange = useCallback(async (e) => {
    const q = e.target.value;
    setForm((f) => ({ ...f, location: q }));
    setCoordinates(null); // must re-pick from suggestions or map
    setTouched((tt) => ({ ...tt, location: true }));
    setFieldErrors((fe) => ({
      ...fe,
      location: validateLocationText(q, t),
      coords: validateCoordinates(null, t),
    }));

    if ((q || "").length < 3) { setSuggestions([]); return; }
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSuggestions(data);
    } catch { setSuggestions([]); }
  }, [t]);

  const handleSelectSuggestion = useCallback((s) => {
    const lat = parseFloat(s.lat), lon = parseFloat(s.lon);
    if (isNaN(lat) || isNaN(lon)) return;
    setForm((f) => ({ ...f, location: s.display_name }));
    setCoordinates([lat, lon]);
    setSuggestions([]);
    setFieldErrors((fe) => ({ ...fe, location: null, coords: null }));
  }, []);

  // Derived validity
  const nameError = validateBizName(form.name, t);
  const locTextError = validateLocationText(form.location, t);
  const coordsError = validateCoordinates(coordinates, t);

  // Valid schedule?
  useEffect(() => {
    if (!scheduleHasAtLeastOneOpenDay(schedule)) {
      setScheduleError(t("alerts.invalid_hours_open", { defaultValue: "At least one open day required." }));
    } else if (!scheduleTimesValid(schedule)) {
      setScheduleError(t("alerts.invalid_hours_order", { defaultValue: "Each open day must have Open < Close." }));
    } else {
      setScheduleError(null);
    }
  }, [schedule, t]);

  const canSave =
    !saving &&
    !loading &&
    !nameError &&
    !locTextError &&
    !coordsError &&
    !scheduleError;

  const handleSave = useCallback(async () => {
    // mark fields touched to show messages
    setTouched({ name: true, location: true });

    // re-check
    const currentNameErr = validateBizName(form.name, t);
    const currentLocTextErr = validateLocationText(form.location, t);
    const currentCoordsErr = validateCoordinates(coordinates, t);

    setFieldErrors({ name: currentNameErr, location: currentLocTextErr, coords: currentCoordsErr });

    if (currentNameErr || currentLocTextErr || currentCoordsErr || scheduleError) return;

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

    setSaving(true);
    try {
      await putRef.current(`/Business/${detail.businessId}`, payload);
      // inline success message (no reload)
      // you can style .status-message.success in your CSS
      alert(t("alerts.updated", { defaultValue: "Business info updated!" }));
    } catch (err) {
      // try to extract server detail text
      try {
        const text = await err?.response?.text?.();
        console.error("Save failed (body):", text || err);
        alert(text || t("alerts.save_failed", { defaultValue: "Failed to save business info." }));
      } catch {
        console.error("Save failed:", err);
        alert(t("alerts.save_failed", { defaultValue: "Failed to save business info." }));
      }
    } finally {
      setSaving(false);
    }
  }, [coordinates, detail, form, schedule, scheduleError, t]);

  if (loading) {
    return (<div className="business-info-panel"><p>{t("state.loading", { defaultValue: "Loading…" })}</p></div>);
  }
  if (!detail) {
    return (<div className="business-info-panel"><p>{t("state.error_loading", { defaultValue: "Error loading info." })}</p></div>);
  }

  const compactPreview = compactSchedule(schedule, 24);

  return (
    <div className="business-info-panel" id="#business_info">
      <h3>{t("titles.edit", { defaultValue: "Edit Business Info" })}</h3>

      {/* Business Name */}
      <label htmlFor="biz-name"><b>{t("fields.name", { defaultValue: "Business Name" })}</b></label>
      <input
        id="biz-name"
        type="text"
        value={form.name}
        onBlur={() => setTouched((tt) => ({ ...tt, name: true }))}
        onChange={(e) => {
          const v = e.target.value;
          setForm((f) => ({ ...f, name: v }));
          if (touched.name) {
            setFieldErrors((fe) => ({ ...fe, name: validateBizName(v, t) }));
          }
        }}
        className={touched.name && nameError ? "input-error" : ""}
        aria-invalid={touched.name && !!nameError}
        aria-describedby="biz-name-error"
      />
      {touched.name && nameError && (
        <div id="biz-name-error" className="field-error" role="alert">{nameError}</div>
      )}

      <br /><br />

      {/* Description */}
      <label htmlFor="biz-desc"><b>{t("fields.description", { defaultValue: "Description" })}</b></label>
      <textarea
        id="biz-desc"
        value={form.description}
        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
      />
      <br /><br />

      {/* NIPT */}
      <label htmlFor="biz-nipt"><b>{t("fields.nipt", { defaultValue: "NIPT" })}</b></label>
      <input
        id="biz-nipt"
        type="text"
        value={form.nipt}
        onChange={(e) => setForm((f) => ({ ...f, nipt: e.target.value }))}
      />
      <br /><br />

      {/* Email */}
      <label htmlFor="biz-email"><b>{t("fields.email", { defaultValue: "Business Email" })}</b></label>
      <input
        id="biz-email"
        type="email"
        value={form.businessEmailAddress}
        onChange={(e) => setForm((f) => ({ ...f, businessEmailAddress: e.target.value }))}
      />
      <br /><br />

      {/* Location (text + suggestions) */}
      <label htmlFor="biz-location"><b>{t("fields.location", { defaultValue: "Location" })}</b></label>
      <div style={{ position: "relative" }}>
        <input
          id="biz-location"
          type="text"
          value={form.location}
          placeholder={t("placeholders.location", { defaultValue: "Start typing…" })}
          onBlur={() => setTouched((tt) => ({ ...tt, location: true }))}
          onChange={handleLocationChange}
          style={{ width: "100%" }}
          aria-autocomplete="list"
          aria-controls="location-suggestions"
          className={touched.location && (locTextError || coordsError) ? "input-error" : ""}
          aria-invalid={touched.location && (!!locTextError || !!coordsError)}
          aria-describedby="biz-location-error"
        />
        {touched.location && (locTextError || coordsError) && (
          <div id="biz-location-error" className="field-error" role="alert">
            {locTextError || coordsError}
          </div>
        )}
        {suggestions.length > 0 && (
          <ul id="location-suggestions" className="suggestions-list" role="listbox">
            {suggestions.map((s) => (
              <li
                key={s.place_id}
                onClick={() => handleSelectSuggestion(s)}
                role="option"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSelectSuggestion(s); }
                }}
              >
                {s.display_name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Map */}
      <div
        ref={mapContainerRef}
        style={{ height: 200, width: "100%", marginTop: 16 }}
        aria-label={t("aria.map", { defaultValue: "Business location map" })}
      />
      <br /><br />

      {/* Opening hours */}
      <label><b>{t("fields.opening_hours", { defaultValue: "Opening Hours" })}</b></label>
      <HoursPicker value={schedule} onChange={setSchedule} />
      {scheduleError && <div className="field-error" role="alert">{scheduleError}</div>}
      <br /><br />

      {/* Phone */}
      <label htmlFor="biz-phone"><b>{t("fields.phone", { defaultValue: "Business Phone Number" })}</b></label>
      <input
        id="biz-phone"
        type="tel"
        value={form.businessPhoneNumber}
        onChange={(e) => setForm((f) => ({ ...f, businessPhoneNumber: e.target.value }))}
      />

      {/* Save */}
      <div style={{ display: "flex", width: "100%", justifyContent: "center", alignItems: "center", marginTop: 20 }}>
        <button
          type="button"
          onClick={handleSave}
          style={{ padding: 10 }}
          disabled={saving || !canSave}
          className="save-business-info"
          aria-disabled={saving || !canSave}
          title={!canSave ? t("actions.fix_errors", { defaultValue: "Fix errors before saving" }) : undefined}
        >
          {saving
            ? t("actions.saving", { defaultValue: "Saving…" })
            : t("actions.save", { defaultValue: "Save Changes" })}
        </button>
      </div>
    </div>
  );
}
