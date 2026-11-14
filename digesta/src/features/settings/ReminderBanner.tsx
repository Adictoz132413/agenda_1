/** Aviso dentro de la app para recordatorios cuando no hay permiso de notificaciones. */
import { BellRing, X } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { bannerStore } from '@/lib/reminders';
import { navigate } from '@/lib/router';

export function ReminderBanner() {
  const items = useSyncExternalStore(bannerStore.subscribe, bannerStore.get, bannerStore.get);
  if (!items.length) return null;
  const m = items[items.length - 1];
  return (
    <div className="no-print animate-sheet fixed inset-x-4 top-[max(4.5rem,calc(env(safe-area-inset-top)+3.5rem))] z-[66] mx-auto flex max-w-md items-start gap-3 rounded-2xl border border-border bg-surface p-3 shadow-2xl" role="alert">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
        <BellRing size={20} />
      </span>
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={() => {
          bannerStore.dismiss(m.id);
          navigate(m.url.replace(/^#/, ''));
        }}
      >
        <span className="block text-sm font-bold">{m.title}</span>
        <span className="block text-sm text-muted">{m.body}</span>
      </button>
      <button type="button" aria-label="Cerrar recordatorio" className="inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-surface-2" onClick={() => bannerStore.dismiss(m.id)}>
        <X size={18} />
      </button>
    </div>
  );
}
