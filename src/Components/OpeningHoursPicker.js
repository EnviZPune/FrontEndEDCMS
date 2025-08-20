import React from "react";
import "../Styling/openinghours.css";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./ui/select";
import { Switch } from "./ui/switch";
import { Button } from "./ui/button";

// ---- Time + Days -------------------------------------------------
export const getDefaultSchedule = () => ({
  monday: { open: "09:00", close: "18:00", closed: false },
  tuesday: { open: "09:00", close: "18:00", closed: false },
  wednesday: { open: "09:00", close: "18:00", closed: false },
  thursday: { open: "09:00", close: "18:00", closed: false },
  friday: { open: "09:00", close: "18:00", closed: false },
  saturday: { open: "10:00", close: "14:00", closed: true },
  sunday: { open: "10:00", close: "14:00", closed: true },
});

const TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, i) => {
  const h = String(Math.floor(i / 4)).padStart(2, "0");
  const m = String((i % 4) * 15).padStart(2, "0");
  return `${h}:${m}`;
});

const DAYS = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
];

// ---- UI ----------------------------------------------------------
function HoursPicker({ value, onChange }) {
  const updateDay = (dayKey, patch) =>
    onChange({ ...value, [dayKey]: { ...value[dayKey], ...patch } });

  const copyMondayToAll = () => {
    const m = value.monday;
    const next = {};
    for (const d of DAYS) next[d.key] = { ...m };
    onChange(next);
  };

  const closeAll = () => {
    const next = {};
    for (const d of DAYS) next[d.key] = { ...value[d.key], closed: true };
    onChange(next);
  };

  return (
    <div className="hours-picker">
      <div className="hours-toolbar">
        <Button type="button" variant="secondary" onClick={copyMondayToAll}>
          Use Monday for all
        </Button>
        <Button type="button" variant="outline" onClick={closeAll}>
          Mark all closed
        </Button>
      </div>

      <div className="hours-grid">
        <div className="hours-grid-head">
          <div>Day</div>
          <div>Open</div>
          <div>Close</div>
          <div>Closed</div>
        </div>

        {DAYS.map(({ key, label }) => {
          const day = value[key];
          const disabled = !!day.closed;
          return (
            <div className="hours-row" key={key}>
              <div className="hours-day">{label}</div>

              <div className={`hours-cell ${disabled ? "disabled" : ""}`}>
                <Select
                  value={day.open}
                  onValueChange={(v) => updateDay(key, { open: v })}
                  disabled={disabled}
                >
                  <SelectTrigger className="time-trigger">
                    <SelectValue placeholder="Open" />
                  </SelectTrigger>
                  <SelectContent className="time-content">
                    {TIME_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className={`hours-cell ${disabled ? "disabled" : ""}`}>
                <Select
                  value={day.close}
                  onValueChange={(v) => updateDay(key, { close: v })}
                  disabled={disabled}
                >
                  <SelectTrigger className="time-trigger">
                    <SelectValue placeholder="Close" />
                  </SelectTrigger>
                  <SelectContent className="time-content">
                    {TIME_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="hours-cell">
                <Switch
                  checked={day.closed}
                  onCheckedChange={(ck) => updateDay(key, { closed: ck })}
                  aria-label={`Closed on ${label}`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default HoursPicker;
