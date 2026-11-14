/**
 * Lógica pura de recordatorios (sin DOM ni React) para poder probarla.
 */
import type { Reminder, ReminderKind } from '@/domain/types';

export const REMINDER_KINDS: { value: ReminderKind; label: string; body: string; url: string }[] = [
  { value: 'comida', label: 'Registrar comida', body: '¿Ya registraste lo que comiste? Toma solo unos segundos.', url: '#/hoy?nuevo=comida' },
  { value: 'deposicion', label: 'Registrar deposición', body: 'Si fuiste al baño, registra tu deposición.', url: '#/hoy?nuevo=deposicion' },
  { value: 'resumen', label: 'Resumen del día', body: '¿Cómo estuvo tu digestión hoy? Completa tu resumen diario.', url: '#/hoy' },
  { value: 'agua', label: 'Tomar agua', body: 'Recuerda hidratarte y anotar tus vasos de agua.', url: '#/hoy' },
];

export const reminderInfo = (k: ReminderKind) => REMINDER_KINDS.find((r) => r.value === k) ?? REMINDER_KINDS[0];

/** Ventana después de la hora programada en la que aún se dispara (si la app estaba cerrada). */
export const DUE_WINDOW_MS = 2 * 3600_000;

/** Momento (ms) de la hora HH:mm en el día local de `now`. */
export function scheduledAt(time: string, now: number): number {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0).getTime();
}

/**
 * ¿Debe dispararse ahora? Sí si está activo, la hora de hoy ya pasó hace menos
 * de 2 horas y no se disparó hoy.
 */
export function isDue(r: Reminder, now: number, today: string): boolean {
  if (!r.enabled || r.lastFired === today) return false;
  const at = scheduledAt(r.time, now);
  return now >= at && now - at < DUE_WINDOW_MS;
}

/** Recordatorios que deben dispararse, aplicando omisiones inteligentes. */
export function dueReminders(reminders: Reminder[], now: number, today: string, ctx: { digestionRated: boolean }): Reminder[] {
  return reminders.filter((r) => isDue(r, now, today) && !(r.kind === 'resumen' && ctx.digestionRated));
}

/** Próximo disparo (ms) de un recordatorio activo. */
export function nextOccurrence(r: Reminder, now: number): number {
  const at = scheduledAt(r.time, now);
  return at > now ? at : at + 24 * 3600_000;
}

const pad = (n: number) => String(n).padStart(2, '0');

function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/**
 * Evento de calendario diario con alarma (.ics). Hora flotante: el teléfono la
 * interpreta en su zona horaria local.
 */
export function buildIcs(r: Reminder, now: number, appUrl = ''): string {
  const info = reminderInfo(r.kind);
  const d = new Date(nextOccurrence(r, now));
  const [h, m] = r.time.split(':').map(Number);
  const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const start = `${date}T${pad(h)}${pad(m)}00`;
  const endD = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m + 10);
  const end = `${endD.getFullYear()}${pad(endD.getMonth() + 1)}${pad(endD.getDate())}T${pad(endD.getHours())}${pad(endD.getMinutes())}00`;
  const u = new Date(now);
  const stamp = `${u.getUTCFullYear()}${pad(u.getUTCMonth() + 1)}${pad(u.getUTCDate())}T${pad(u.getUTCHours())}${pad(u.getUTCMinutes())}${pad(u.getUTCSeconds())}Z`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DIGESTA//Recordatorios//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:digesta-${r.id}@digesta.local`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    'RRULE:FREQ=DAILY',
    `SUMMARY:${icsEscape(`DIGESTA: ${info.label}`)}`,
    `DESCRIPTION:${icsEscape(info.body + (appUrl ? ` ${appUrl}` : ''))}`,
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsEscape(info.label)}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}
