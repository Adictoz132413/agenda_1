/**
 * Programador de recordatorios.
 *
 * Limitación honesta: una aplicación web no puede garantizar alarmas cuando
 * está completamente cerrada. Los recordatorios se revisan mientras la app
 * está abierta o el navegador la mantiene en segundo plano; si la hora pasó
 * hace menos de 2 horas, se muestran al volver a abrirla. Para alarmas
 * garantizadas se ofrece exportar un evento diario al calendario (.ics).
 */
import { useEffect } from 'react';
import { getDailyLog, getSettings, updateSettings } from '@/db/repo';
import { todayKey } from '@/domain/dates';
import type { Reminder } from '@/domain/types';
import { dueReminders, reminderInfo } from './reminderLogic';

export * from './reminderLogic';

// ───────── Almacén mínimo de avisos dentro de la app ─────────

export interface BannerMessage {
  id: string;
  title: string;
  body: string;
  url: string;
}

let banners: BannerMessage[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const bannerStore = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: () => banners,
  push(m: BannerMessage) {
    banners = [...banners.filter((b) => b.id !== m.id), m];
    emit();
  },
  dismiss(id: string) {
    banners = banners.filter((b) => b.id !== id);
    emit();
  },
};

// ───────── Notificaciones ─────────

export type PermissionState = NotificationPermission | 'unsupported';

export function notificationPermission(): PermissionState {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

/** Sólo se llama tras un toque explícito de la persona. */
export async function requestNotificationPermission(): Promise<PermissionState> {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.requestPermission();
}

function appUrl(hash: string): string {
  return `${window.location.origin}${window.location.pathname}${hash}`;
}

export async function showReminder(r: Pick<Reminder, 'id' | 'kind'>): Promise<void> {
  const info = reminderInfo(r.kind);
  const url = appUrl(info.url);
  if (notificationPermission() === 'granted') {
    try {
      const reg = 'serviceWorker' in navigator ? await Promise.race([navigator.serviceWorker.ready, new Promise<null>((res) => setTimeout(() => res(null), 3000))]) : null;
      if (reg) {
        await reg.showNotification('DIGESTA', { body: info.body, tag: `digesta-${r.kind}`, icon: 'icon-192.png', badge: 'icon-192.png', data: { url } });
        return;
      }
      new Notification('DIGESTA', { body: info.body, tag: `digesta-${r.kind}`, icon: 'icon-192.png' });
      return;
    } catch {
      /* continuar con el aviso dentro de la app */
    }
  }
  bannerStore.push({ id: `${r.id}-${Date.now()}`, title: info.label, body: info.body, url: info.url });
}

let checking = false;

/** Revisa y dispara los recordatorios pendientes. */
export async function checkReminders(now = Date.now()): Promise<void> {
  if (checking) return;
  checking = true;
  try {
    const settings = await getSettings();
    if (!settings.reminders.some((r) => r.enabled)) return;
    const today = todayKey();
    const log = await getDailyLog(today);
    const due = dueReminders(settings.reminders, now, today, { digestionRated: !!log?.digestion });
    if (!due.length) return;
    for (const r of due) await showReminder(r);
    const ids = new Set(due.map((r) => r.id));
    const fresh = await getSettings();
    await updateSettings({ reminders: fresh.reminders.map((r) => (ids.has(r.id) ? { ...r, lastFired: today } : r)) });
  } catch {
    /* un fallo de recordatorio nunca debe romper la app */
  } finally {
    checking = false;
  }
}

/** Hook montado una sola vez en la app: revisa cada 30 s y al volver a la app. */
export function useReminderScheduler(): void {
  useEffect(() => {
    void checkReminders();
    const t = setInterval(() => void checkReminders(), 30_000);
    const vis = () => {
      if (document.visibilityState === 'visible') void checkReminders();
    };
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', vis);
    };
  }, []);
}
