/**
 * PANTALLA 7: calendario mensual con el estado digestivo de cada día,
 * detalle completo del día, acceso a informes y exportación CSV.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, ChevronRight, Droplets, Dumbbell, FileText, Moon, Pencil, Plus, Zap } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { loadDay } from '@/db/repo';
import { addDays, dayKey, dayStart, formatMonth, relativeDayLabel, todayKey, weekStart, weekdayShort } from '@/domain/dates';
import { DIGESTION, digestionLabel } from '@/domain/labels';
import { dayStatus, type DayTone } from '@/analysis/stats';
import { useRangeData } from '@/analysis/useAnalysis';
import { navigate } from '@/lib/router';
import { useToday } from '@/lib/hooks';
import { useEntry } from '@/features/entries/EntryProvider';
import { MealRow, StoolRow, SymptomRow } from '@/components/rows';
import { Button, Card, EmptyState, IconButton, SectionTitle, cx, toneBg, toneDot } from '@/components/ui';
import { CsvExport } from '@/features/reports/CsvExport';

const TONE_LABEL: Record<DayTone, string> = { good: 'Buena', mid: 'Regular', bad: 'Mala', none: 'Sin registro' };
const TONE_CELL: Record<DayTone, string> = {
  good: 'bg-good-soft text-good',
  mid: 'bg-mid-soft text-mid',
  bad: 'bg-bad-soft text-bad',
  none: 'bg-surface text-muted',
};
const TONE_RING: Record<DayTone, string> = { good: 'ring-good', mid: 'ring-mid', bad: 'ring-bad', none: 'ring-border' };
const TONE_TEXT: Record<DayTone, string> = { good: 'text-good', mid: 'text-mid', bad: 'text-bad', none: 'text-muted' };

export function CalendarScreen({ day }: { day?: string }) {
  const today = useToday();
  const valid = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : undefined;
  const initial = valid ?? today;
  const [ym, setYm] = useState(() => ({ y: Number(initial.slice(0, 4)), m: Number(initial.slice(5, 7)) - 1 }));

  // Si cambia el día seleccionado desde la URL, mostrar su mes.
  useEffect(() => {
    if (valid) setYm({ y: Number(valid.slice(0, 4)), m: Number(valid.slice(5, 7)) - 1 });
  }, [valid]);

  const first = dayKey(new Date(ym.y, ym.m, 1, 12));
  const last = dayKey(new Date(ym.y, ym.m + 1, 0, 12));
  const gridStart = weekStart(first);
  const gridEnd = addDays(weekStart(last), 6);
  const data = useRangeData(gridStart, gridEnd);

  const cells = useMemo(() => {
    const out: { key: string; inMonth: boolean; tone: DayTone; manual: boolean; stools: number; symptoms: number; meals: number }[] = [];
    const by = <T,>(arr: T[] | undefined, at: (x: T) => number) => {
      const m = new Map<string, T[]>();
      for (const x of arr ?? []) {
        const k = dayKey(at(x));
        const l = m.get(k);
        if (l) l.push(x);
        else m.set(k, [x]);
      }
      return m;
    };
    const md = by(data?.meals, (m) => m.at);
    const sd = by(data?.stools, (s) => s.at);
    const yd = by(data?.symptoms, (s) => s.startedAt);
    const ld = new Map((data?.logs ?? []).map((l) => [l.day, l]));
    for (let k = gridStart; k <= gridEnd; k = addDays(k, 1)) {
      const st = dayStatus(ld.get(k), yd.get(k) ?? [], sd.get(k) ?? [], md.get(k) ?? []);
      out.push({ key: k, inMonth: k >= first && k <= last, tone: st.tone, manual: st.manual, stools: sd.get(k)?.length ?? 0, symptoms: yd.get(k)?.length ?? 0, meals: md.get(k)?.length ?? 0 });
    }
    return out;
  }, [data, gridStart, gridEnd, first, last]);

  const monthStats = useMemo(() => {
    const inMonth = cells.filter((c) => c.inMonth && c.key <= today);
    const count = (t: DayTone) => inMonth.filter((c) => c.tone === t).length;
    return { good: count('good'), mid: count('mid'), bad: count('bad'), none: count('none') };
  }, [cells, today]);

  const weekdays = Array.from({ length: 7 }, (_, i) => weekdayShort(addDays(gridStart, i)));
  const shift = (n: number) => setYm(({ y, m }) => ({ y: new Date(y, m + n, 1).getFullYear(), m: new Date(y, m + n, 1).getMonth() }));
  const isCurrentMonth = today >= first && today <= last;

  return (
    <div className="pt-2">
      <h1 className="text-2xl font-extrabold tracking-tight">Calendario</h1>
      <p className="text-sm text-muted">Toca un día para ver su registro completo.</p>

      <Card className="mt-4 p-3">
        <div className="mb-2 flex items-center justify-between">
          <IconButton label="Mes anterior" onClick={() => shift(-1)}>
            <ChevronLeft size={22} />
          </IconButton>
          <div className="text-center">
            <p className="text-lg font-bold">{formatMonth(ym.y, ym.m)}</p>
            {!isCurrentMonth && (
              <button type="button" className="text-xs font-semibold text-primary" onClick={() => setYm({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 })}>
                Ir a hoy
              </button>
            )}
          </div>
          <IconButton label="Mes siguiente" onClick={() => shift(1)}>
            <ChevronRight size={22} />
          </IconButton>
        </div>
        <div className="grid grid-cols-7 gap-1" role="grid" aria-label={`Calendario de ${formatMonth(ym.y, ym.m)}`}>
          {weekdays.map((w) => (
            <div key={w} role="columnheader" className="pb-1 text-center text-[11px] font-bold uppercase text-muted">
              {w}
            </div>
          ))}
          {cells.map((c) => {
            const selected = c.key === valid;
            const future = c.key > today;
            const n = Number(c.key.slice(8));
            const label = `${relativeDayLabel(c.key)}: ${c.tone === 'none' ? 'sin registro' : `digestión ${TONE_LABEL[c.tone].toLowerCase()}${c.manual ? '' : ' (estimada)'}`}${c.stools ? `, ${c.stools} deposiciones` : ''}${c.symptoms ? `, ${c.symptoms} síntomas` : ''}`;
            return (
              <button
                key={c.key}
                type="button"
                role="gridcell"
                aria-selected={selected}
                aria-label={label}
                disabled={future}
                onClick={() => navigate(`/calendario?dia=${c.key}`, { replace: true })}
                className={cx(
                  'relative flex aspect-square min-h-11 flex-col items-center justify-center rounded-xl text-sm font-bold transition active:scale-95 disabled:opacity-30',
                  c.inMonth ? '' : 'opacity-40',
                  c.tone === 'none' ? TONE_CELL.none : c.manual ? TONE_CELL[c.tone] : cx('bg-surface ring-2 ring-inset', TONE_RING[c.tone], TONE_TEXT[c.tone]),
                  selected && 'outline outline-2 outline-offset-1 outline-text',
                  c.key === today && 'underline decoration-2 underline-offset-4',
                )}
              >
                <span className="tabular">{n}</span>
                {(c.stools > 0 || c.symptoms > 0) && (
                  <span className="mt-0.5 flex gap-0.5" aria-hidden>
                    {c.stools > 0 && <span className="size-1.5 rounded-full bg-stool" />}
                    {c.symptoms > 0 && <span className="size-1.5 rounded-full bg-bad" />}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 px-1 text-xs text-muted">
          {(['good', 'mid', 'bad'] as DayTone[]).map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <span className={cx('size-3 rounded', toneDot[t])} /> {TONE_LABEL[t]}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded border border-border bg-surface" /> Sin registro
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded ring-2 ring-inset ring-muted" /> Borde = estimada (sin valoración manual)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-stool" /> Deposición
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-bad" /> Síntoma
          </span>
        </div>
        <p className="mt-3 border-t border-border px-1 pt-2 text-xs text-muted">
          Este mes: <strong className="text-good">{monthStats.good}</strong> buenos · <strong className="text-mid">{monthStats.mid}</strong> regulares · <strong className="text-bad">{monthStats.bad}</strong> malos · {monthStats.none} sin registro
        </p>
      </Card>

      {valid && <DayDetail day={valid} />}

      <SectionTitle>Informes para tu consulta</SectionTitle>
      <Card>
        <p className="mb-3 text-sm text-muted">Resumen imprimible o guardable como PDF para llevar al gastroenterólogo o nutricionista.</p>
        <div className="grid grid-cols-2 gap-2">
          {[7, 14, 30, 90].map((n) => (
            <Button key={n} variant="soft" onClick={() => navigate(`/informe?dias=${n}`)}>
              <FileText size={18} /> {n} días
            </Button>
          ))}
        </div>
      </Card>

      <SectionTitle>Exportar registros (CSV)</SectionTitle>
      <Card>
        <CsvExport />
      </Card>
    </div>
  );
}

function DayDetail({ day }: { day: string }) {
  const entry = useEntry();
  const bundle = useLiveQuery(() => loadDay(day), [day]);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [day]);
  const today = todayKey();
  if (!bundle) return <div ref={ref} className="mt-4 h-24" />;
  const { meals, stools, symptoms, log } = bundle;
  const status = dayStatus(log, symptoms, stools, meals);
  const digestion = DIGESTION.find((d) => d.value === log?.digestion);
  const empty = !meals.length && !stools.length && !symptoms.length && !log;
  // Hora sugerida para registrar en un día pasado: mediodía de ese día.
  const atForDay = day === today ? Date.now() : dayStart(day) + 12 * 3600_000;

  return (
    <div ref={ref} className="scroll-mt-20">
      <SectionTitle
        action={
          <button type="button" className="text-sm font-semibold text-primary" onClick={() => navigate('/calendario', { replace: true })}>
            Cerrar
          </button>
        }
      >
        {relativeDayLabel(day)}
      </SectionTitle>
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted">Digestión del día</p>
            <p className="text-lg font-bold">
              {digestion ? (
                <>
                  <span aria-hidden>{digestion.emoji}</span> {digestion.label}
                </>
              ) : status.tone === 'none' ? (
                'Sin registro'
              ) : (
                <>
                  {digestionLabel(undefined)} · <span className={cx('text-base', TONE_TEXT[status.tone])}>estimada {TONE_LABEL[status.tone].toLowerCase()}</span>
                </>
              )}
            </p>
          </div>
          <span className={cx('rounded-full px-3 py-1 text-xs font-bold', toneBg[status.tone === 'none' ? 'none' : status.tone])}>{TONE_LABEL[status.tone]}</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <Fact icon={<Droplets size={16} />} label="Agua" value={log?.water !== undefined ? `${log.water} vasos` : '—'} />
          <Fact icon={<Zap size={16} />} label="Estrés" value={log?.stress !== undefined ? `${log.stress}/10` : '—'} />
          <Fact icon={<Moon size={16} />} label="Sueño" value={log?.sleepHours !== undefined ? `${log.sleepHours} h${log.sleepQuality ? ` · ${['', 'mala', 'regular', 'buena'][log.sleepQuality]}` : ''}` : '—'} />
          <Fact icon={<Dumbbell size={16} />} label="Ejercicio" value={log?.exercise ? `${log.exercise.type} · ${log.exercise.minutes} min` : '—'} />
        </div>
        {log?.notes && <p className="mt-3 whitespace-pre-wrap rounded-xl bg-surface-2 p-3 text-sm">{log.notes}</p>}
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => entry.openFactors(day)}>
          <Pencil size={14} /> Editar factores y notas
        </Button>
      </Card>

      {empty ? (
        <div className="mt-3">
          <EmptyState title="No hay registros este día">Puedes agregar algo que hayas olvidado anotar.</EmptyState>
        </div>
      ) : (
        <>
          {meals.length > 0 && (
            <>
              <h3 className="mb-2 mt-4 px-1 text-sm font-bold">Comidas ({meals.length})</h3>
              <ul className="space-y-2">
                {meals.map((m) => (
                  <MealRow key={m.id} meal={m} onOpen={() => entry.openMeal({ meal: m })} onDuplicate={() => entry.openMeal({ template: m })} />
                ))}
              </ul>
            </>
          )}
          {stools.length > 0 && (
            <>
              <h3 className="mb-2 mt-4 px-1 text-sm font-bold">Deposiciones ({stools.length})</h3>
              <ul className="space-y-2">
                {stools.map((s) => (
                  <StoolRow key={s.id} stool={s} onOpen={() => entry.openStool(s)} />
                ))}
              </ul>
            </>
          )}
          {symptoms.length > 0 && (
            <>
              <h3 className="mb-2 mt-4 px-1 text-sm font-bold">Síntomas ({symptoms.length})</h3>
              <ul className="space-y-2">
                {symptoms.map((s) => (
                  <SymptomRow key={s.id} symptom={s} onOpen={() => entry.openSymptom({ symptom: s })} />
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Button variant="soft" size="sm" onClick={() => entry.openMeal({ at: atForDay })}>
          <Plus size={14} /> Comida
        </Button>
        <Button variant="soft" size="sm" onClick={() => entry.openStool(undefined, { at: atForDay })}>
          <Plus size={14} /> Deposición
        </Button>
        <Button variant="soft" size="sm" onClick={() => entry.openSymptom({ at: atForDay })}>
          <Plus size={14} /> Síntoma
        </Button>
      </div>
    </div>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2">
      <span className="text-muted">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[11px] text-muted">{label}</span>
        <span className="block truncate font-semibold">{value}</span>
      </span>
    </div>
  );
}
