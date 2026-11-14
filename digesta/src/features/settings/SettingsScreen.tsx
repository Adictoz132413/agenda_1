/**
 * Ajustes: apariencia, análisis, recordatorios, copias de seguridad,
 * exportación, fotos y almacenamiento, modo demostración, privacidad y borrado.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { Bell, BellOff, CalendarPlus, Download, FlaskConical, HardDrive, Lock, Plus, ShieldAlert, Stethoscope, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { exportBackupJson, importBackup, parseBackup } from '@/db/backup';
import type { BackupFile } from '@/db/schemas';
import { getDb, getMode, writeMode } from '@/db/db';
import { seedDemo } from '@/db/demo';
import { deleteAllPhotos, newId, updateSettings, wipeAll } from '@/db/repo';
import { formatDateTime, formatHHmm, todayKey } from '@/domain/dates';
import { EMERGENCY_LINE } from '@/domain/alerts';
import type { Reminder, ReminderKind, Settings, ThemePref } from '@/domain/types';
import { downloadText, readFileText } from '@/lib/download';
import { useSettings } from '@/lib/hooks';
import { formatBytes, photoStorageUsage } from '@/lib/images';
import { buildIcs, notificationPermission, REMINDER_KINDS, reminderInfo, requestNotificationPermission, showReminder, type PermissionState } from '@/lib/reminders';
import { navigate } from '@/lib/router';
import { Button, Card, IconButton, SectionTitle, Segmented, Stepper, Switch, cx, errorMessage, inputClass, useConfirm, useToast } from '@/components/ui';
import { CsvExport } from '@/features/reports/CsvExport';

const VERSION = '1.0.0';

export function SettingsScreen() {
  const settings = useSettings();
  const toast = useToast();
  const save = async (patch: Partial<Settings>) => {
    try {
      await updateSettings(patch);
    } catch (e) {
      toast(errorMessage(e), { tone: 'error' });
    }
  };

  return (
    <div className="pt-2">
      <h1 className="text-2xl font-extrabold tracking-tight">Ajustes</h1>
      <p className="text-sm text-muted">Privacidad, copias de seguridad y preferencias.</p>

      <SectionTitle>Apariencia</SectionTitle>
      <Card>
        <p className="mb-2 text-sm font-semibold">Tema</p>
        <Segmented<ThemePref>
          label="Tema"
          value={settings.theme}
          onChange={(theme) => save({ theme })}
          options={[
            { value: 'sistema', label: 'Sistema' },
            { value: 'claro', label: 'Claro' },
            { value: 'oscuro', label: 'Oscuro' },
          ]}
        />
      </Card>

      <SectionTitle>Hidratación y análisis</SectionTitle>
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-medium">Meta diaria de agua</p>
            <p className="text-sm text-muted">Vasos de unos 250 ml.</p>
          </div>
          <Stepper label="Meta de vasos de agua" value={settings.waterGoal} onChange={(waterGoal) => save({ waterGoal })} min={1} max={30} />
        </div>
        <div className="mt-4 border-t border-border pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">Intensidad mínima de un episodio</p>
              <p className="text-sm text-muted">Síntomas con intensidad menor a este valor no cuentan en el análisis de patrones.</p>
            </div>
            <Stepper label="Umbral de intensidad" value={settings.analysisThreshold} onChange={(analysisThreshold) => save({ analysisThreshold })} min={1} max={10} />
          </div>
        </div>
      </Card>

      <RemindersSection settings={settings} />
      <BackupSection />

      <SectionTitle>Exportar registros (CSV)</SectionTitle>
      <Card>
        <CsvExport />
      </Card>

      <StorageSection settings={settings} onSave={save} />
      <DemoSection />
      <PrivacySection />
      <DangerSection />

      <SectionTitle>Acerca de</SectionTitle>
      <Card>
        <div className="flex gap-3">
          <Stethoscope className="mt-0.5 shrink-0 text-primary" size={22} />
          <div className="text-sm leading-relaxed">
            <p className="font-bold">DIGESTA — Mi Diario Digestivo · versión {VERSION}</p>
            <p className="mt-1 text-muted">
              DIGESTA es un diario de seguimiento. No diagnostica enfermedades, no confirma intolerancias y no recomienda eliminar grupos de alimentos. Los análisis muestran asociaciones observadas en tus registros. Consulta siempre con un profesional de la salud.
            </p>
            <p className="mt-2 font-semibold text-bad">Ante una emergencia en Colombia llama al {EMERGENCY_LINE}.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ───────── Recordatorios ─────────

function RemindersSection({ settings }: { settings: Settings }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [perm, setPerm] = useState<PermissionState>(() => notificationPermission());
  const [kind, setKind] = useState<ReminderKind>('comida');
  const [time, setTime] = useState('13:00');
  const reminders = [...settings.reminders].sort((a, b) => a.time.localeCompare(b.time));

  const persist = async (list: Reminder[]) => {
    try {
      await updateSettings({ reminders: list });
    } catch (e) {
      toast(errorMessage(e), { tone: 'error' });
    }
  };
  const add = async () => {
    if (!/^\d{2}:\d{2}$/.test(time)) {
      toast('Elige una hora válida', { tone: 'error' });
      return;
    }
    // Si la hora de hoy ya pasó, no disparar hoy mismo al crearlo.
    const [h, m] = time.split(':').map(Number);
    const now = new Date();
    const passed = now.getHours() * 60 + now.getMinutes() >= h * 60 + m;
    await persist([...settings.reminders, { id: newId(), kind, time, enabled: true, lastFired: passed ? todayKey() : undefined }]);
    toast(`Recordatorio a las ${formatHHmm(time)} activado`);
  };
  const patch = (id: string, p: Partial<Reminder>) => persist(settings.reminders.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const remove = async (r: Reminder) => {
    if (await confirm({ title: 'Eliminar recordatorio', message: `${reminderInfo(r.kind).label} · ${formatHHmm(r.time)}`, confirmLabel: 'Eliminar', danger: true })) {
      await persist(settings.reminders.filter((x) => x.id !== r.id));
    }
  };
  const ask = async () => {
    const p = await requestNotificationPermission();
    setPerm(p);
    if (p === 'granted') toast('Notificaciones permitidas');
    else if (p === 'denied') toast('Las notificaciones están bloqueadas. Puedes cambiarlo en los ajustes del navegador.', { tone: 'info' });
  };
  const ics = (r: Reminder) => {
    const url = `${window.location.origin}${window.location.pathname}`;
    downloadText(`digesta-recordatorio-${r.kind}-${r.time.replace(':', '')}.ics`, buildIcs(r, Date.now(), url), 'text/calendar;charset=utf-8');
    toast('Abre el archivo descargado para agregarlo a tu calendario');
  };

  return (
    <>
      <SectionTitle>Recordatorios</SectionTitle>
      <Card>
        <div className="flex items-start gap-3 rounded-2xl bg-surface-2 p-3">
          {perm === 'granted' ? <Bell className="mt-0.5 shrink-0 text-good" size={20} /> : <BellOff className="mt-0.5 shrink-0 text-muted" size={20} />}
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold">
              {perm === 'granted' ? 'Notificaciones permitidas' : perm === 'denied' ? 'Notificaciones bloqueadas' : perm === 'unsupported' ? 'Este navegador no admite notificaciones' : 'Notificaciones sin permiso'}
            </p>
            <p className="text-muted">
              {perm === 'granted'
                ? 'Recibirás avisos del sistema a la hora indicada.'
                : perm === 'denied'
                  ? 'Actívalas desde los ajustes del sitio en el navegador. Mientras tanto verás los avisos dentro de la app.'
                  : 'Sin permiso, los recordatorios aparecen como aviso dentro de la app. Nunca se piden permisos sin que lo solicites.'}
            </p>
            {perm === 'default' && (
              <Button size="sm" className="mt-2" onClick={ask}>
                Permitir notificaciones
              </Button>
            )}
          </div>
        </div>

        {reminders.length > 0 && (
          <ul className="mt-3 divide-y divide-border">
            {reminders.map((r) => (
              <li key={r.id} className="py-2">
                <Switch checked={r.enabled} onChange={(enabled) => patch(r.id, { enabled })} label={`${reminderInfo(r.kind).label} · ${formatHHmm(r.time)}`} description={r.enabled ? 'Todos los días' : 'Desactivado'} />
                <div className="flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor={`time-${r.id}`}>
                    Hora del recordatorio
                  </label>
                  <input
                    id={`time-${r.id}`}
                    type="time"
                    className={cx(inputClass, 'min-h-10 w-32 text-sm')}
                    value={r.time}
                    onChange={(e) => e.target.value && patch(r.id, { time: e.target.value, lastFired: undefined })}
                  />
                  <Button size="sm" variant="secondary" onClick={() => ics(r)}>
                    <CalendarPlus size={14} /> Al calendario (.ics)
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void showReminder(r)}>
                    Probar
                  </Button>
                  <IconButton label="Eliminar recordatorio" onClick={() => remove(r)} className="ml-auto size-10 text-bad">
                    <Trash2 size={18} />
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 rounded-2xl border border-dashed border-border p-3">
          <p className="mb-2 text-sm font-semibold">Nuevo recordatorio</p>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <label className="sr-only" htmlFor="rem-kind">
              Tipo de recordatorio
            </label>
            <select id="rem-kind" className={cx(inputClass, 'text-sm')} value={kind} onChange={(e) => setKind(e.target.value as ReminderKind)}>
              {REMINDER_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="rem-time">
              Hora
            </label>
            <input id="rem-time" type="time" className={cx(inputClass, 'w-32 text-sm')} value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <Button variant="soft" block className="mt-2" onClick={add}>
            <Plus size={16} /> Agregar a las {/^\d{2}:\d{2}$/.test(time) ? formatHHmm(time) : '—'}
          </Button>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Importante: una aplicación web no puede garantizar alarmas cuando está completamente cerrada; Android puede detenerla para ahorrar batería. Si la abres dentro de las 2 horas siguientes verás el aviso pendiente. Para alarmas
          garantizadas usa «Al calendario (.ics)»: crea un evento diario con alarma en el calendario de tu teléfono. El recordatorio del resumen diario se omite si ya valoraste tu digestión de hoy.
        </p>
      </Card>
    </>
  );
}

// ───────── Copias de seguridad ─────────

function BackupSection() {
  const toast = useToast();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ text: string; parsed: BackupFile; name: string }>();
  const [error, setError] = useState<string>();

  const exportJson = async () => {
    setBusy(true);
    try {
      const json = await exportBackupJson();
      downloadText(`digesta-respaldo${getMode() === 'demo' ? '-demo' : ''}-${todayKey()}.json`, json, 'application/json');
      toast(`Copia descargada (${formatBytes(json.length)})`);
    } catch (e) {
      toast(errorMessage(e), { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };
  const pick = async (f?: File) => {
    setError(undefined);
    setPending(undefined);
    if (!f) return;
    try {
      const text = await readFileText(f);
      setPending({ text, parsed: parseBackup(text), name: f.name });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  const run = async (mode: 'replace' | 'merge') => {
    if (!pending) return;
    if (
      mode === 'replace' &&
      !(await confirm({ title: 'Reemplazar todos los datos', message: 'Se borrarán todos los registros actuales de este dispositivo y se restaurará la copia seleccionada. Esta acción no se puede deshacer.', confirmLabel: 'Reemplazar', danger: true }))
    )
      return;
    setBusy(true);
    try {
      const s = await importBackup(pending.text, mode);
      toast(`Importado: ${s.meals} comidas, ${s.stools} deposiciones, ${s.symptoms} síntomas`);
      setPending(undefined);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const d = pending?.parsed.data;

  return (
    <>
      <SectionTitle>Copia de seguridad</SectionTitle>
      <Card>
        <p className="mb-3 text-sm text-muted">El respaldo incluye todos tus registros, fotos, favoritas, clasificaciones y ajustes en un archivo JSON. Guárdalo en un lugar seguro: no está cifrado.</p>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={exportJson} disabled={busy}>
            <Download size={18} /> Exportar
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload size={18} /> Importar
          </Button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" aria-label="Seleccionar copia de seguridad" onChange={(e) => pick(e.target.files?.[0])} />
        {error && (
          <p role="alert" className="mt-3 rounded-2xl bg-bad-soft px-4 py-3 text-sm font-semibold text-bad">
            {error}
          </p>
        )}
        {pending && d && (
          <div className="animate-fade mt-3 rounded-2xl border border-border bg-surface-2 p-3 text-sm">
            <p className="font-semibold">{pending.name}</p>
            <p className="text-muted">
              Creada el {formatDateTime(Date.parse(pending.parsed.exportedAt) || 0)}
              {pending.parsed.mode === 'demo' ? ' · datos de demostración' : ''}
            </p>
            <p className="mt-1">
              {d.meals.length} comidas · {d.stools.length} deposiciones · {d.symptoms.length} síntomas · {d.dailyLogs.length} días · {d.photos.length} fotos · {d.favorites.length} favoritas
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button size="sm" variant="secondary" onClick={() => run('merge')} disabled={busy}>
                Combinar
              </Button>
              <Button size="sm" variant="danger" onClick={() => run('replace')} disabled={busy}>
                Reemplazar todo
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted">«Combinar» agrega los registros nuevos y conserva la versión más reciente de los repetidos. «Reemplazar» borra lo actual.</p>
            <button type="button" className="mt-2 text-xs font-semibold text-primary" onClick={() => setPending(undefined)}>
              Cancelar
            </button>
          </div>
        )}
      </Card>
    </>
  );
}

// ───────── Fotos y almacenamiento ─────────

function StorageSection({ settings, onSave }: { settings: Settings; onSave: (p: Partial<Settings>) => Promise<void> }) {
  const toast = useToast();
  const confirm = useConfirm();
  const photos = useLiveQuery(() => photoStorageUsage(), [], { count: 0, bytes: 0 });
  const [estimate, setEstimate] = useState<{ usage?: number; quota?: number }>();
  const [persisted, setPersisted] = useState<boolean | 'unsupported'>();

  const refresh = async () => {
    try {
      if (navigator.storage?.estimate) setEstimate(await navigator.storage.estimate());
      setPersisted(navigator.storage?.persisted ? await navigator.storage.persisted() : 'unsupported');
    } catch {
      setPersisted('unsupported');
    }
  };
  useEffect(() => {
    void refresh();
  }, [photos.bytes]);

  const requestPersist = async () => {
    const ok = navigator.storage?.persist ? await navigator.storage.persist() : false;
    setPersisted(ok);
    toast(ok ? 'Almacenamiento persistente activado' : 'El navegador no concedió el almacenamiento persistente. Instalar la app suele ayudar.', { tone: ok ? 'ok' : 'info' });
  };
  const removePhotos = async () => {
    if (await confirm({ title: 'Eliminar todas las fotos', message: `Se eliminarán ${photos.count} fotos. Los registros de comidas se conservan.`, confirmLabel: 'Eliminar fotos', danger: true })) {
      await deleteAllPhotos();
      toast('Fotos eliminadas');
    }
  };

  return (
    <>
      <SectionTitle>Fotos y almacenamiento</SectionTitle>
      <Card>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Info label="Fotos guardadas" value={`${photos.count} · ${formatBytes(photos.bytes)}`} />
          <Info label="Uso total de la app" value={estimate?.usage !== undefined ? formatBytes(estimate.usage) : '—'} />
          <Info label="Espacio disponible" value={estimate?.quota !== undefined ? formatBytes(Math.max(0, estimate.quota - (estimate.usage ?? 0))) : '—'} />
          <Info label="Almacenamiento persistente" value={persisted === undefined ? '…' : persisted === 'unsupported' ? 'No disponible' : persisted ? 'Activado' : 'No activado'} />
        </div>
        {persisted === false && (
          <Button size="sm" variant="soft" className="mt-3" onClick={requestPersist}>
            <HardDrive size={14} /> Solicitar almacenamiento persistente
          </Button>
        )}
        <p className="mt-2 text-xs text-muted">Con almacenamiento persistente el navegador no borra tus datos automáticamente cuando el teléfono tiene poco espacio.</p>
        <div className="mt-4 border-t border-border pt-4">
          <p className="mb-2 text-sm font-semibold">Tamaño de las fotos nuevas</p>
          <Segmented
            label="Tamaño máximo de foto"
            value={settings.photoMaxSide}
            onChange={(photoMaxSide) => onSave({ photoMaxSide })}
            options={[
              { value: 640, label: 'Pequeña' },
              { value: 1024, label: 'Media' },
              { value: 1600, label: 'Grande' },
            ]}
          />
          <p className="mt-1 text-xs text-muted">Pequeña ≈ 40–80 KB, media ≈ 80–200 KB, grande ≈ 200–450 KB por foto (WebP comprimido).</p>
        </div>
        {photos.count > 0 && (
          <Button size="sm" variant="secondary" className="mt-3 text-bad" onClick={removePhotos}>
            <Trash2 size={14} /> Eliminar todas las fotos
          </Button>
        )}
      </Card>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

// ───────── Modo demostración ─────────

function DemoSection() {
  const toast = useToast();
  const confirm = useConfirm();
  const demo = getMode() === 'demo';
  const [busy, setBusy] = useState(false);
  const switchTo = (m: 'real' | 'demo') => {
    writeMode(m);
    window.location.hash = '#/hoy';
    window.location.reload();
  };
  const regenerate = async () => {
    if (!(await confirm({ title: 'Regenerar datos de demostración', message: 'Se reemplazarán los datos ficticios actuales. Tus datos reales no se modifican.', confirmLabel: 'Regenerar' }))) return;
    setBusy(true);
    try {
      await seedDemo(getDb());
      toast('Datos de demostración regenerados');
    } catch (e) {
      toast(errorMessage(e), { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <SectionTitle>Modo demostración</SectionTitle>
      <Card>
        <div className="flex gap-3">
          <FlaskConical className="mt-0.5 shrink-0 text-mid" size={22} />
          <p className="text-sm leading-relaxed text-muted">
            Explora DIGESTA con 60 días de datos ficticios (incluye patrones de ejemplo como leche → hinchazón). Se guardan en una base separada (<code>digesta-demo</code>): tus datos reales nunca se mezclan ni se modifican.
          </p>
        </div>
        {demo ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button onClick={() => switchTo('real')}>Salir del modo demo</Button>
            <Button variant="secondary" onClick={regenerate} disabled={busy}>
              {busy ? 'Generando…' : 'Regenerar datos'}
            </Button>
          </div>
        ) : (
          <Button variant="secondary" block className="mt-3" onClick={() => switchTo('demo')}>
            Activar modo demostración
          </Button>
        )}
      </Card>
    </>
  );
}

// ───────── Privacidad ─────────

function PrivacySection() {
  return (
    <>
      <SectionTitle>Privacidad y seguridad</SectionTitle>
      <Card>
        <div className="flex gap-3">
          <Lock className="mt-0.5 shrink-0 text-good" size={22} />
          <div className="text-sm leading-relaxed">
            <p className="font-bold">Lo que el almacenamiento local protege</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
              <li>Tus registros se guardan sólo en este dispositivo (IndexedDB del navegador). Nada se envía a servidores.</li>
              <li>No hay cuentas, publicidad, analítica ni rastreadores.</li>
              <li>La app bloquea por política de seguridad (CSP) cualquier conexión a sitios externos.</li>
              <li>Funciona sin internet: no necesita conectarse a nada para registrar o analizar.</li>
            </ul>
          </div>
        </div>
        <div className="mt-4 flex gap-3 border-t border-border pt-4">
          <ShieldAlert className="mt-0.5 shrink-0 text-mid" size={22} />
          <div className="text-sm leading-relaxed">
            <p className="font-bold">Lo que NO protege</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
              <li>Cualquier persona con acceso a tu teléfono desbloqueado puede abrir la app y ver tus datos. Usa bloqueo de pantalla.</li>
              <li>Los datos no tienen un cifrado propio de la app; dependen del cifrado del dispositivo que trae Android.</li>
              <li>Si borras los datos del navegador, desinstalas la app o pierdes el teléfono, los registros se pierden si no tienes copia de seguridad.</li>
              <li>Las copias JSON, los CSV y los PDF que exportes no están cifrados. Guárdalos en un lugar seguro y compártelos sólo con quien elijas.</li>
            </ul>
          </div>
        </div>
      </Card>
    </>
  );
}

// ───────── Borrado ─────────

function DangerSection() {
  const toast = useToast();
  const confirm = useConfirm();
  const demo = getMode() === 'demo';
  const wipe = async () => {
    const ok = await confirm({
      title: demo ? 'Borrar datos de demostración' : 'Borrar todos tus datos',
      message: (
        <>
          Se eliminarán de forma permanente todas las comidas, deposiciones, síntomas, fotos, favoritas, clasificaciones y ajustes {demo ? 'del modo demostración' : 'de este dispositivo'}. <strong>No se puede deshacer.</strong> Considera exportar una copia de
          seguridad antes.
        </>
      ),
      confirmLabel: 'Borrar todo',
      danger: true,
      typeToConfirm: 'BORRAR',
    });
    if (!ok) return;
    try {
      await wipeAll();
      toast('Todos los datos fueron eliminados');
      navigate('/hoy');
    } catch (e) {
      toast(errorMessage(e), { tone: 'error' });
    }
  };
  return (
    <>
      <SectionTitle>Zona de peligro</SectionTitle>
      <Card className="border-bad/40">
          <p className="text-sm text-muted">Elimina permanentemente todo lo guardado en {demo ? 'la base de demostración' : 'este dispositivo'}. Te pediremos escribir BORRAR para confirmar.</p>
          <Button variant="danger" block className="mt-3" onClick={wipe}>
            <Trash2 size={18} /> Borrar todos los datos
          </Button>
      </Card>
    </>
  );
}
