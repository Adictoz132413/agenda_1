/**
 * Estructura principal: encabezado, contenido según la ruta y navegación inferior.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { BarChart3, CalendarDays, Home, NotebookPen, Settings as SettingsIcon, Sprout } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { getDb, getMode, writeMode } from '@/db/db';
import { cleanOrphanPhotos, updateSettings } from '@/db/repo';
import { seedDemo } from '@/db/demo';
import { navigate, useRoute } from '@/lib/router';
import { useSettings } from '@/lib/hooks';
import { applyTheme } from '@/lib/theme';
import { useReminderScheduler } from '@/lib/reminders';
import { Button, ConfirmProvider, ToastProvider, cx } from '@/components/ui';
import { EntryProvider } from '@/features/entries/EntryProvider';
import { Logo } from '@/components/Logo';
import { TodayScreen } from '@/features/today/TodayScreen';
import { DiaryScreen } from '@/features/diary/DiaryScreen';
import { ToleranceScreen } from '@/features/tolerance/ToleranceScreen';
import { PatternsScreen } from '@/features/patterns/PatternsScreen';
import { CalendarScreen } from '@/features/calendar/CalendarScreen';
import { ReportScreen } from '@/features/reports/ReportScreen';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { Onboarding } from '@/features/settings/Onboarding';
import { ReminderBanner } from '@/features/settings/ReminderBanner';

const TABS = [
  { path: '/hoy', label: 'Hoy', icon: Home },
  { path: '/diario', label: 'Diario', icon: NotebookPen },
  { path: '/tolerancia', label: 'Tolerancia', icon: Sprout },
  { path: '/patrones', label: 'Patrones', icon: BarChart3 },
  { path: '/calendario', label: 'Calendario', icon: CalendarDays },
];

export function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <EntryProvider>
          <Shell />
        </EntryProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}

function Shell() {
  const route = useRoute();
  const settings = useSettings();
  const [ready, setReady] = useState(false);
  const mode = getMode();

  useReminderScheduler();

  useEffect(() => applyTheme(settings.theme), [settings.theme]);
  useEffect(() => {
    if (settings.theme !== 'sistema') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => applyTheme('sistema');
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [settings.theme]);

  // Arranque: abrir base, sembrar demo si corresponde, limpiar fotos huérfanas.
  useEffect(() => {
    (async () => {
      try {
        const db = getDb();
        await db.open();
        if (mode === 'demo' && (await db.meals.count()) === 0) await seedDemo(db);
        void cleanOrphanPhotos().catch(() => undefined);
        // Pedir almacenamiento persistente para que el navegador no borre los datos por falta de espacio.
        if (navigator.storage?.persist && !(await navigator.storage.persisted?.())) void navigator.storage.persist();
      } finally {
        setReady(true);
      }
    })();
  }, [mode]);

  const root = route.segments[0] ?? 'hoy';
  let screen: ReactNode;
  switch (root) {
    case 'diario':
      screen = <DiaryScreen tab={route.segments[1]} />;
      break;
    case 'tolerancia':
      screen = <ToleranceScreen foodKey={route.segments[1]} />;
      break;
    case 'patrones':
      screen = <PatternsScreen />;
      break;
    case 'calendario':
      screen = <CalendarScreen day={route.query.get('dia') ?? undefined} />;
      break;
    case 'informe':
      screen = <ReportScreen days={Number(route.query.get('dias')) || 30} />;
      break;
    case 'ajustes':
      screen = <SettingsScreen />;
      break;
    default:
      screen = <TodayScreen newEntry={route.query.get('nuevo') ?? undefined} />;
  }

  const isReport = root === 'informe';

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      {mode === 'demo' && <DemoBanner />}
      {!isReport && (
        <header className="no-print sticky top-0 z-30 flex items-center justify-between bg-bg/85 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md">
          <button type="button" onClick={() => navigate('/hoy')} className="flex items-center gap-2" aria-label="DIGESTA, ir a Hoy">
            <Logo className="size-8" />
            <span className="text-lg font-extrabold tracking-tight">DIGESTA</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/ajustes')}
            aria-label="Ajustes, privacidad y copias de seguridad"
            className={cx('inline-flex size-11 items-center justify-center rounded-full transition hover:bg-surface-2', root === 'ajustes' ? 'bg-primary-soft text-primary' : 'text-muted')}
          >
            <SettingsIcon size={22} />
          </button>
        </header>
      )}
      <main className={cx('flex-1 px-4', isReport ? 'pb-10' : 'pb-28')}>{ready ? screen : <Loading />}</main>
      {!isReport && <BottomNav active={root} />}
      {ready && !settings.disclaimerAccepted && <Onboarding onAccept={() => updateSettings({ disclaimerAccepted: true })} />}
      <UpdatePrompt />
      <ReminderBanner />
    </div>
  );
}

function Loading() {
  return (
    <div className="flex h-64 items-center justify-center text-muted" role="status">
      Cargando tu diario…
    </div>
  );
}

function BottomNav({ active }: { active: string }) {
  return (
    <nav aria-label="Navegación principal" className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
      <ul className="mx-auto flex max-w-2xl">
        {TABS.map((t) => {
          const sel = `/${active}` === t.path;
          const Icon = t.icon;
          return (
            <li key={t.path} className="flex-1">
              <a
                href={`#${t.path}`}
                aria-current={sel ? 'page' : undefined}
                className={cx('flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition', sel ? 'text-primary' : 'text-muted hover:text-text')}
              >
                <span className={cx('flex h-8 w-14 items-center justify-center rounded-full transition', sel && 'bg-primary-soft')}>
                  <Icon size={21} strokeWidth={sel ? 2.4 : 2} />
                </span>
                {t.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function DemoBanner() {
  return (
    <div className="no-print sticky top-0 z-40 flex items-center justify-between gap-2 bg-mid px-4 py-2 text-[13px] font-semibold text-white">
      <span>Modo demostración: estos datos son ficticios y están separados de los tuyos.</span>
      <button
        type="button"
        className="shrink-0 rounded-lg bg-white/20 px-2 py-1 font-bold"
        onClick={() => {
          writeMode('real');
          window.location.hash = '#/hoy';
          window.location.reload();
        }}
      >
        Salir
      </button>
    </div>
  );
}

/** Aviso cuando hay una nueva versión de la app (service worker). */
function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // Comprobar actualizaciones cada hora mientras la app esté abierta.
      if (reg) setInterval(() => void reg.update().catch(() => undefined), 3600_000);
    },
  });
  if (!needRefresh) return null;
  return (
    <div className="no-print fixed inset-x-4 bottom-24 z-[65] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-text p-3 text-bg shadow-2xl" role="alert">
      <span className="flex-1 text-sm font-semibold">Hay una nueva versión de DIGESTA.</span>
      <Button size="sm" variant="soft" onClick={() => updateServiceWorker(true)}>
        Actualizar
      </Button>
      <Button size="sm" variant="ghost" className="text-bg" onClick={() => setNeedRefresh(false)}>
        Luego
      </Button>
    </div>
  );
}

