/**
 * Utilidades de fecha en hora local, con formato es-CO y reloj de 12 horas.
 */

export const LOCALE = 'es-CO';
export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

const pad = (n: number) => String(n).padStart(2, '0');

/** Clave de día local YYYY-MM-DD. */
export function dayKey(t: number | Date): string {
  const d = typeof t === 'number' ? new Date(t) : t;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Inicio del día local (ms) para una clave YYYY-MM-DD. */
export function dayStart(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

export function dayEnd(key: string): number {
  return dayStart(addDays(key, 1));
}

/** Suma días a una clave (maneja meses y años). */
export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + n, 12));
}

export function todayKey(): string {
  return dayKey(Date.now());
}

/** Lista de claves de día desde `from` hasta `to` (inclusive). */
export function dayRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let k = from; k <= to; k = addDays(k, 1)) out.push(k);
  return out;
}

const timeFmt = new Intl.DateTimeFormat(LOCALE, { hour: 'numeric', minute: '2-digit', hour12: true });
const longDateFmt = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
const longDateYearFmt = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const shortDateFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' });
const shortDateYearFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
const monthFmt = new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric' });
const weekdayShortFmt = new Intl.DateTimeFormat(LOCALE, { weekday: 'short' });

/** "2:30 p. m." */
export function formatTime(t: number): string {
  return timeFmt.format(t).replace(/ /g, ' ');
}

/** "viernes, 14 de noviembre" */
export function formatLongDate(t: number | string, withYear = false): string {
  const ms = typeof t === 'string' ? dayStart(t) : t;
  return (withYear ? longDateYearFmt : longDateFmt).format(ms);
}

/** "14 nov" */
export function formatShortDate(t: number | string, withYear = false): string {
  const ms = typeof t === 'string' ? dayStart(t) + 12 * HOUR : t;
  return (withYear ? shortDateYearFmt : shortDateFmt).format(ms).replace(/\./g, '');
}

/** "14 nov · 2:30 p. m." */
export function formatDateTime(t: number): string {
  return `${formatShortDate(t)} · ${formatTime(t)}`;
}

export function formatMonth(year: number, month0: number): string {
  const s = monthFmt.format(new Date(year, month0, 1));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function weekdayShort(key: string): string {
  return weekdayShortFmt.format(dayStart(key) + 12 * HOUR).replace(/\./g, '');
}

/** Encabezado relativo: "Hoy", "Ayer" o fecha larga. */
export function relativeDayLabel(key: string): string {
  const today = todayKey();
  if (key === today) return 'Hoy';
  if (key === addDays(today, -1)) return 'Ayer';
  const s = formatLongDate(key);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Duración legible: "45 min", "2 h 10 min". */
export function formatDuration(min: number): string {
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Valores para <input type="date"> y <input type="time"> en hora local. */
export function toDateInput(t: number): string {
  return dayKey(t);
}
export function toTimeInput(t: number): string {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function fromDateTimeInputs(date: string, time: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time || '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
}

/** "08:30" → "8:30 a. m." */
export function formatHHmm(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return formatTime(new Date(2000, 0, 1, h, m).getTime());
}

/** Lunes de la semana (clave) que contiene `key`. */
export function weekStart(key: string): string {
  const d = new Date(dayStart(key));
  const dow = (d.getDay() + 6) % 7; // 0 = lunes
  return addDays(key, -dow);
}
