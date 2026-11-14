/**
 * PANTALLA 1 · HOY
 * Tablero del día con accesos inmediatos, resumen, hidratación, factores,
 * línea de tiempo y la pregunta de cierre "¿Cómo estuvo tu digestión hoy?".
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, ChevronRight, Droplets, Moon, Plus, Utensils } from 'lucide-react';
import { Fragment, useEffect, useMemo } from 'react';
import { getDb } from '@/db/db';
import { isOngoing, loadDay, patchDailyLog } from '@/db/repo';
import { addDays, DAY, formatLongDate, formatTime, HOUR } from '@/domain/dates';
import { DIGESTION, bristolTone } from '@/domain/labels';
import { patternAlerts, sortAlerts, stoolAlerts, symptomAlerts, type MedicalAlert } from '@/domain/alerts';
import type { DigestionRating } from '@/domain/types';
import { dayStatus } from '@/analysis/stats';
import { useEntry } from '@/features/entries/EntryProvider';
import { MealRow, StoolRow, SymptomRow } from '@/components/rows';
import { BristolIcon } from '@/components/illustrations';
import { Button, Card, SectionTitle, cx, toneBg, toneDot, useToast, type Tone } from '@/components/ui';
import { navigate } from '@/lib/router';
import { useNow, useSettings, useToday } from '@/lib/hooks';

const STATUS_LABEL: Record<Tone, string> = { good: 'Buena', mid: 'Regular', bad: 'Difícil', none: 'Sin datos', primary: '' };

export function TodayScreen({ newEntry }: { newEntry?: string }) {
  const today = useToday();
  const now = useNow(60_000);
  const entry = useEntry();
  const settings = useSettings();
  const toast = useToast();
  const bundle = useLiveQuery(() => loadDay(today), [today]);
  const yesterday = useLiveQuery(() => loadDay(addDays(today, -1)), [today]);
  const recent = useLiveQuery(async () => {
    const db = getDb();
    const from = Date.now() - 2 * DAY;
    const [stools, symptoms] = await Promise.all([db.stools.where('at').above(from).toArray(), db.symptoms.where('startedAt').above(from).toArray()]);
    return { stools, symptoms };
  }, [today]);

  // Accesos directos del icono de la app (manifest shortcuts): #/hoy?nuevo=comida
  useEffect(() => {
    if (!newEntry) return;
    if (newEntry === 'comida') entry.openMeal();
    else if (newEntry === 'deposicion') entry.openStool();
    else if (newEntry === 'sintoma') entry.openSymptom();
    navigate('/hoy', { replace: true });
  }, [newEntry, entry]);

  const alerts = useMemo<MedicalAlert[]>(() => {
    if (!recent) return [];
    return sortAlerts([...recent.stools.flatMap(stoolAlerts), ...recent.symptoms.flatMap((s) => symptomAlerts(s)), ...patternAlerts(recent.stools)]);
  }, [recent]);

  if (!bundle) return null;
  const { meals, stools, symptoms, log } = bundle;
  const status = dayStatus(log, symptoms, stools, meals);
  const ongoing = symptoms.filter((s) => isOngoing(s, now));
  const prevOngoing = (yesterday?.symptoms ?? []).filter((s) => isOngoing(s, now));
  const maxInt = Math.max(0, ...symptoms.map((s) => s.intensity));
  const water = log?.water ?? 0;
  const hour = new Date(now).getHours();
  const evening = hour >= 18;
  const yesterdayUnrated = yesterday && !yesterday.log?.digestion && (yesterday.meals.length + yesterday.stools.length + yesterday.symptoms.length > 0) && hour < 14;

  type Item = { at: number; node: React.ReactNode; key: string };
  const timeline: Item[] = [
    ...meals.map((m) => ({ at: m.at, key: `m${m.id}`, node: <MealRow meal={m} onOpen={() => entry.openMeal({ meal: m })} onDuplicate={() => entry.openMeal({ template: m })} /> })),
    ...stools.map((s) => ({ at: s.at, key: `s${s.id}`, node: <StoolRow stool={s} onOpen={() => entry.openStool(s)} /> })),
    ...symptoms.map((s) => ({ at: s.startedAt, key: `y${s.id}`, node: <SymptomRow symptom={s} now={now} onOpen={() => entry.openSymptom({ symptom: s })} /> })),
  ].sort((a, b) => b.at - a.at);

  const rate = async (day: string, v: DigestionRating, current?: DigestionRating) => {
    await patchDailyLog(day, { digestion: current === v ? undefined : v });
    if (current !== v) toast('¡Gracias! Quedó registrado.');
  };

  const setWater = (n: number) => patchDailyLog(today, { water: Math.max(0, Math.min(40, n)) });

  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const dateLabel = formatLongDate(now);

  return (
    <div className="pt-2">
      <div className="mb-4 px-1">
        <p className="text-sm font-semibold text-muted">{greeting}</p>
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">{dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}</h1>
      </div>

      {alerts.length > 0 && (
        <button type="button" onClick={() => entry.showAlerts(alerts)} className={cx('mb-4 flex w-full items-center gap-3 rounded-3xl p-4 text-left', alerts[0].level === 'urgente' ? 'bg-bad-soft text-bad' : 'bg-mid-soft text-mid')}>
          <AlertTriangle size={24} className="shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block font-bold">{alerts[0].title}</span>
            <span className="block text-sm opacity-90">Registrado en las últimas 48 h. Toca para ver la recomendación.</span>
          </span>
          <ChevronRight size={20} />
        </button>
      )}

      {/* Accesos inmediatos */}
      <div className="grid grid-cols-3 gap-2.5">
        <QuickAction label="Agregar comida" emoji="🍽️" onClick={() => entry.openMeal()} className="bg-good-soft text-good" />
        <QuickAction label="Registrar deposición" icon={<BristolIcon type={4} className="h-7 w-14" />} onClick={() => entry.openStool()} className="bg-mid-soft text-mid" />
        <QuickAction label="Registrar síntoma" emoji="🩺" onClick={() => entry.openSymptom()} className="bg-bad-soft text-bad" />
      </div>

      {/* Resumen */}
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <SummaryTile label="Comidas" value={meals.length} detail={meals.length ? `Última ${formatTime(meals[meals.length - 1].at)}` : 'Ninguna aún'} onClick={() => navigate('/diario/comidas')} />
        <SummaryTile
          label="Deposiciones"
          value={stools.length}
          detail={stools.length ? `Última: Bristol ${stools[stools.length - 1].bristol}` : 'Ninguna aún'}
          tone={stools.length ? bristolTone(stools[stools.length - 1].bristol) : undefined}
          onClick={() => navigate('/diario/deposiciones')}
        />
        <SummaryTile label="Síntomas" value={symptoms.length} detail={symptoms.length ? `Máx. intensidad ${maxInt}/10` : 'Sin molestias registradas'} tone={symptoms.length ? (maxInt >= 7 ? 'bad' : maxInt >= 4 ? 'mid' : 'good') : undefined} onClick={() => navigate('/diario/sintomas')} />
        <div className="rounded-3xl border border-border bg-surface p-4 shadow-card">
          <p className="text-[13px] font-semibold text-muted">Estado digestivo</p>
          <p className={cx('mt-1 flex items-center gap-2 text-xl font-extrabold')}>
            <span className={cx('size-3 rounded-full', toneDot[status.tone])} aria-hidden />
            {status.manual ? DIGESTION.find((d) => d.value === status.score)?.label : STATUS_LABEL[status.tone]}
          </p>
          <p className="text-xs text-muted">{status.manual ? 'Tu valoración' : status.tone === 'none' ? 'Registra para ver tu estado' : 'Estimado por tus registros'}</p>
        </div>
      </div>

      {/* Síntomas en curso */}
      {(ongoing.length > 0 || prevOngoing.length > 0) && (
        <>
          <SectionTitle>Síntomas en curso</SectionTitle>
          <ul className="space-y-2">
            {[...prevOngoing, ...ongoing].map((s) => (
              <SymptomRow key={s.id} symptom={s} now={now} onOpen={() => entry.openSymptom({ symptom: s })} />
            ))}
          </ul>
        </>
      )}

      {/* Hidratación y factores */}
      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Card className="!p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-muted">
                <Droplets size={15} className="text-primary" /> Hidratación (opcional)
              </p>
              <p className="tabular text-xl font-extrabold">
                {water} <span className="text-sm font-semibold text-muted">/ {settings.waterGoal} vasos</span>
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" aria-label="Quitar un vaso de agua" onClick={() => setWater(water - 1)} disabled={water === 0} className="size-11 rounded-full border border-border text-xl font-bold disabled:opacity-40">
                −
              </button>
              <button type="button" aria-label="Agregar un vaso de agua" onClick={() => setWater(water + 1)} className="size-11 rounded-full bg-primary text-xl font-bold text-on-primary">
                +
              </button>
            </div>
          </div>
          <div className="mt-3 flex gap-1" aria-hidden>
            {Array.from({ length: settings.waterGoal }, (_, i) => (
              <span key={i} className={cx('h-2 flex-1 rounded-full', i < water ? 'bg-primary' : 'bg-surface-3')} />
            ))}
          </div>
        </Card>
        <button type="button" onClick={() => entry.openFactors(today)} className="rounded-3xl border border-border bg-surface p-4 text-left shadow-card">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-muted">
            <Moon size={15} className="text-primary" /> Estrés, sueño y ejercicio
          </p>
          <p className="mt-1 text-[15px] font-semibold">
            {log?.stress !== undefined || log?.sleepHours !== undefined || log?.exercise
              ? [log?.stress !== undefined && `Estrés ${log.stress}/10`, log?.sleepHours !== undefined && `${log.sleepHours} h de sueño`, log?.exercise && `${log.exercise.type} ${log.exercise.minutes} min`].filter(Boolean).join(' · ')
              : 'Toca para registrar (opcional)'}
          </p>
          <p className="text-xs text-muted">Pueden influir en tu digestión</p>
        </button>
      </div>

      {/* Línea de tiempo */}
      <SectionTitle
        action={
          timeline.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => navigate(`/calendario?dia=${today}`)}>
              Ver día completo
            </Button>
          )
        }
      >
        Registros de hoy
      </SectionTitle>
      {timeline.length ? (
        <ul className="space-y-2">{timeline.map((t) => <Fragment key={t.key}>{t.node}</Fragment>)}</ul>
      ) : (
        <div className="rounded-3xl border border-dashed border-border px-6 py-8 text-center">
          <Utensils className="mx-auto mb-2 text-muted" />
          <p className="font-semibold">Aún no hay registros hoy</p>
          <p className="mt-1 text-sm text-muted">Empieza con tu primera comida o bebida. Toma pocos segundos.</p>
          <Button className="mt-4" onClick={() => entry.openMeal()}>
            <Plus size={18} /> Agregar comida
          </Button>
        </div>
      )}

      {/* ¿Y ayer? */}
      {yesterdayUnrated && (
        <Card className="mt-4">
          <p className="font-bold">¿Cómo estuvo tu digestión ayer?</p>
          <DigestionButtons value={undefined} onPick={(v) => rate(addDays(today, -1), v)} />
        </Card>
      )}

      {/* Cierre del día */}
      <Card className={cx('mt-6', evening && !log?.digestion && 'ring-2 ring-primary/40')}>
        <p className="text-lg font-extrabold">¿Cómo estuvo tu digestión hoy?</p>
        <p className="text-sm text-muted">{log?.digestion ? 'Puedes cambiar tu respuesta cuando quieras.' : evening ? 'Ya casi termina el día: tu respuesta ayuda a ver la evolución.' : 'Opcional. Respóndela al final del día.'}</p>
        <DigestionButtons value={log?.digestion} onPick={(v) => rate(today, v, log?.digestion)} />
      </Card>

      {now - (meals[meals.length - 1]?.at ?? 0) > 6 * HOUR && hour >= 9 && hour < 22 && meals.length > 0 && (
        <p className="mt-3 text-center text-xs text-muted">Tu última comida registrada fue a las {formatTime(meals[meals.length - 1].at)}.</p>
      )}
    </div>
  );
}

function QuickAction({ label, emoji, icon, onClick, className }: { label: string; emoji?: string; icon?: React.ReactNode; onClick: () => void; className: string }) {
  return (
    <button type="button" onClick={onClick} className={cx('flex min-h-[104px] flex-col items-center justify-center gap-2 rounded-3xl p-3 text-center text-[13px] font-bold leading-tight shadow-card transition active:scale-[0.97]', className)}>
      <span className="flex h-9 items-center text-3xl" aria-hidden>
        {icon ?? emoji}
      </span>
      {label}
    </button>
  );
}

function SummaryTile({ label, value, detail, tone, onClick }: { label: string; value: number; detail: string; tone?: Tone; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-3xl border border-border bg-surface p-4 text-left shadow-card transition active:scale-[0.99]">
      <p className="text-[13px] font-semibold text-muted">{label}</p>
      <p className="tabular mt-1 text-3xl font-extrabold leading-none">{value}</p>
      <p className={cx('mt-1.5 inline-block rounded-full text-xs', tone ? cx('px-2 py-0.5 font-semibold', toneBg[tone]) : 'text-muted')}>{detail}</p>
    </button>
  );
}

function DigestionButtons({ value, onPick }: { value?: DigestionRating; onPick: (v: DigestionRating) => void }) {
  return (
    <div className="mt-3 grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Valoración de la digestión">
      {DIGESTION.map((d) => {
        const sel = value === d.value;
        return (
          <button
            key={d.value}
            type="button"
            role="radio"
            aria-checked={sel}
            onClick={() => onPick(d.value)}
            className={cx('flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-2xl border text-[12px] font-bold transition active:scale-95', sel ? cx('border-transparent ring-2 ring-current', toneBg[d.tone]) : 'border-border bg-surface')}
          >
            <span className="text-2xl" aria-hidden>
              {d.emoji}
            </span>
            {d.label}
          </button>
        );
      })}
    </div>
  );
}
