/**
 * PANTALLAS 2, 3 y 4 · DIARIO
 * Historial de comidas, deposiciones y síntomas con búsqueda, filtros y resúmenes.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Search, Star, Trash2 } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { getDb } from '@/db/db';
import { deleteFavorite, isOngoing } from '@/db/repo';
import { addDays, dayKey, dayStart, relativeDayLabel, todayKey } from '@/domain/dates';
import { foodKey } from '@/domain/foods';
import { BRISTOL, SYMPTOMS, bristolTone, mealTypeLabel, symptomDef, symptomLabel, URGENCY_LABELS } from '@/domain/labels';
import type { Stool, Symptom, SymptomType } from '@/domain/types';
import { bristolDistribution, symptomSummary } from '@/analysis/stats';
import { useEntry } from '@/features/entries/EntryProvider';
import { MealRow, StoolRow, SymptomRow } from '@/components/rows';
import { BristolIcon } from '@/components/illustrations';
import { Button, Card, Chip, EmptyState, IconButton, SectionTitle, Segmented, cx, inputClass, toneBg, toneDot, useConfirm, useToast } from '@/components/ui';
import { navigate } from '@/lib/router';
import { useNow } from '@/lib/hooks';

type Tab = 'comidas' | 'deposiciones' | 'sintomas';
const PAGE_DAYS = 14;

export function DiaryScreen({ tab }: { tab?: string }) {
  const current: Tab = tab === 'deposiciones' || tab === 'sintomas' ? tab : 'comidas';
  return (
    <div className="pt-2">
      <h1 className="mb-3 px-1 text-[28px] font-extrabold tracking-tight">Diario</h1>
      <Segmented
        label="Sección del diario"
        value={current}
        onChange={(v) => navigate(`/diario/${v}`, { replace: true })}
        options={[
          { value: 'comidas', label: 'Comidas' },
          { value: 'deposiciones', label: 'Deposiciones' },
          { value: 'sintomas', label: 'Síntomas' },
        ]}
      />
      <div className="mt-4">
        {current === 'comidas' && <MealsTab />}
        {current === 'deposiciones' && <StoolsTab />}
        {current === 'sintomas' && <SymptomsTab />}
      </div>
    </div>
  );
}

/** Agrupa por día (más reciente primero). */
function groupByDay<T>(items: T[], at: (x: T) => number): [string, T[]][] {
  const m = new Map<string, T[]>();
  for (const x of [...items].sort((a, b) => at(b) - at(a))) {
    const k = dayKey(at(x));
    const l = m.get(k);
    if (l) l.push(x);
    else m.set(k, [x]);
  }
  return [...m.entries()];
}

function LoadMore({ days, onMore, hasOlder }: { days: number; onMore: () => void; hasOlder: boolean }) {
  if (!hasOlder) return <p className="py-6 text-center text-xs text-muted">No hay registros más antiguos.</p>;
  return (
    <div className="py-4 text-center">
      <Button variant="secondary" onClick={onMore}>
        Ver {PAGE_DAYS} días más (mostrando {days})
      </Button>
    </div>
  );
}

// ───────────────────────── Comidas ─────────────────────────

function MealsTab() {
  const entry = useEntry();
  const [days, setDays] = useState(PAGE_DAYS);
  const [q, setQ] = useState('');
  const from = dayStart(addDays(todayKey(), -(days - 1)));
  const query = foodKey(q);
  const data = useLiveQuery(async () => {
    const db = getDb();
    // Con búsqueda se revisa todo el historial; sin búsqueda, la ventana de días.
    const meals = query ? await db.meals.orderBy('at').reverse().toArray() : await db.meals.where('at').aboveOrEqual(from).reverse().sortBy('at');
    const oldest = await db.meals.orderBy('at').first();
    return { meals, oldest: oldest?.at };
  }, [from, query]);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!query) return data.meals;
    return data.meals.filter((m) => m.itemKeys.some((k) => k.includes(query)) || m.supplements.some((s) => foodKey(s).includes(query)) || foodKey(m.notes ?? '').includes(query));
  }, [data, query]);

  const groups = groupByDay(filtered, (m) => m.at);

  return (
    <>
      <Button size="lg" block onClick={() => entry.openMeal()}>
        <Plus size={20} /> Agregar comida
      </Button>
      <div className="relative mt-3">
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input type="search" aria-label="Buscar en tus comidas" className={cx(inputClass, 'pl-11')} placeholder="Buscar alimento, suplemento o nota…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Favorites />
      {q && <p className="mt-3 px-1 text-sm text-muted">{filtered.length} comida(s) con «{q}» en todo tu historial.</p>}
      {groups.length === 0 ? (
        <div className="mt-4">
          <EmptyState title={q ? 'Sin resultados' : 'Aún no hay comidas registradas'}>{q ? 'Prueba con otra palabra.' : 'Tus comidas aparecerán aquí, agrupadas por día.'}</EmptyState>
        </div>
      ) : (
        groups.map(([day, meals]) => (
          <Fragment key={day}>
            <SectionTitle>
              {relativeDayLabel(day)} · {meals.length}
            </SectionTitle>
            <ul className="space-y-2">
              {meals.map((m) => (
                <MealRow key={m.id} meal={m} onOpen={() => entry.openMeal({ meal: m })} onDuplicate={() => entry.openMeal({ template: m })} />
              ))}
            </ul>
          </Fragment>
        ))
      )}
      {!q && <LoadMore days={days} onMore={() => setDays((d) => d + PAGE_DAYS)} hasOlder={!!data?.oldest && data.oldest < from} />}
    </>
  );
}

function Favorites() {
  const favorites = useLiveQuery(() => getDb().favorites.orderBy('uses').reverse().toArray(), []);
  const entry = useEntry();
  const confirm = useConfirm();
  const toast = useToast();
  if (!favorites?.length) return null;
  return (
    <>
      <SectionTitle>Comidas favoritas</SectionTitle>
      <ul className="space-y-2">
        {favorites.map((f) => (
          <li key={f.id} className="flex items-center gap-1 rounded-2xl border border-border bg-surface">
            <button type="button" onClick={() => entry.openMeal({ template: { mealType: f.mealType, items: f.items, flags: f.flags, supplements: f.supplements, itemKeys: f.items.map((i) => i.key) } })} className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left">
              <Star size={18} className="shrink-0 text-mid" fill="currentColor" />
              <span className="min-w-0">
                <span className="block font-semibold">{f.name}</span>
                <span className="line-clamp-1 block text-[13px] text-muted">
                  {mealTypeLabel(f.mealType)} · {f.items.map((i) => i.name).join(', ')}
                </span>
              </span>
            </button>
            <IconButton
              label={`Eliminar favorita ${f.name}`}
              onClick={async () => {
                if (await confirm({ title: 'Eliminar favorita', message: `«${f.name}» dejará de aparecer en Repetir rápido. Tus comidas registradas no cambian.`, confirmLabel: 'Eliminar', danger: true })) {
                  await deleteFavorite(f.id);
                  toast('Favorita eliminada');
                }
              }}
            >
              <Trash2 size={18} />
            </IconButton>
          </li>
        ))}
      </ul>
    </>
  );
}

// ───────────────────────── Deposiciones ─────────────────────────

type Period = 'dia' | 'semana' | 'mes';
const PERIOD_DAYS: Record<Period, number> = { dia: 1, semana: 7, mes: 30 };

function StoolsTab() {
  const entry = useEntry();
  const [period, setPeriod] = useState<Period>('semana');
  const [days, setDays] = useState(PAGE_DAYS);
  const today = todayKey();
  const listFrom = dayStart(addDays(today, -(days - 1)));
  const statFrom = dayStart(addDays(today, -(PERIOD_DAYS[period] - 1)));
  const prevFrom = dayStart(addDays(today, -(2 * PERIOD_DAYS[period] - 1)));
  const data = useLiveQuery(async () => {
    const db = getDb();
    const min = Math.min(listFrom, prevFrom);
    const all = await db.stools.where('at').aboveOrEqual(min).toArray();
    const oldest = await db.stools.orderBy('at').first();
    return { all, oldest: oldest?.at };
  }, [listFrom, prevFrom]);

  if (!data) return null;
  const inPeriod = data.all.filter((s) => s.at >= statFrom);
  const prev = data.all.filter((s) => s.at >= prevFrom && s.at < statFrom);
  const list = data.all.filter((s) => s.at >= listFrom);
  const groups = groupByDay(list, (s) => s.at);

  return (
    <>
      <Button size="lg" block onClick={() => entry.openStool()}>
        <Plus size={20} /> Registrar deposición
      </Button>

      <SectionTitle>Patrones</SectionTitle>
      <Segmented
        label="Periodo"
        value={period}
        onChange={setPeriod}
        options={[
          { value: 'dia', label: 'Hoy' },
          { value: 'semana', label: '7 días' },
          { value: 'mes', label: '30 días' },
        ]}
      />
      <StoolStats stools={inPeriod} prev={prev} days={effectiveDays(PERIOD_DAYS[period], data.oldest)} single={period === 'dia'} />

      <SectionTitle>Historial</SectionTitle>
      {groups.length === 0 ? (
        <EmptyState title="Sin deposiciones registradas">Puedes registrar varias el mismo día.</EmptyState>
      ) : (
        groups.map(([day, items]) => (
          <Fragment key={day}>
            <p className="mb-2 mt-4 px-1 text-sm font-bold text-muted">
              {relativeDayLabel(day)} · {items.length === 1 ? '1 deposición' : `${items.length} deposiciones`}
            </p>
            <ul className="space-y-2">
              {items.map((s) => (
                <StoolRow key={s.id} stool={s} onOpen={() => entry.openStool(s)} />
              ))}
            </ul>
          </Fragment>
        ))
      )}
      <LoadMore days={days} onMore={() => setDays((d) => d + PAGE_DAYS)} hasOlder={!!data.oldest && data.oldest < listFrom} />
    </>
  );
}

/** Días efectivos del periodo: no cuenta días anteriores al primer registro. */
function effectiveDays(days: number, oldest?: number): number {
  if (!oldest || days === 1) return days;
  const since = Math.floor((dayStart(todayKey()) - dayStart(dayKey(oldest))) / 86_400_000) + 1;
  return Math.max(1, Math.min(days, since));
}

function StoolStats({ stools, prev, days, single }: { stools: Stool[]; prev: Stool[]; days: number; single: boolean }) {
  const dist = bristolDistribution(stools);
  const max = Math.max(1, ...dist.map((d) => d.count));
  const perDay = stools.length / days;
  const prevPerDay = prev.length / days;
  const ideal = stools.filter((s) => s.bristol === 3 || s.bristol === 4).length;
  const avg = stools.length ? stools.reduce((a, s) => a + s.bristol, 0) / stools.length : null;
  const count = (f: (s: Stool) => boolean) => stools.filter(f).length;
  const extras = [
    { label: 'Con urgencia', n: count((s) => s.urgency >= 2) },
    { label: 'Con esfuerzo', n: count((s) => s.effort >= 2) },
    { label: 'Con dolor', n: count((s) => s.pain.before || s.pain.during || s.pain.after) },
    { label: 'Incompletas', n: count((s) => s.incomplete) },
    { label: 'Con moco', n: count((s) => s.mucus) },
    { label: 'Con sangre', n: count((s) => s.blood !== 'no'), bad: true },
  ];
  if (!stools.length) {
    return <p className="mt-3 rounded-2xl bg-surface-2 p-4 text-sm text-muted">Sin deposiciones en este periodo.</p>;
  }
  return (
    <Card className="mt-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="tabular text-2xl font-extrabold">{single ? stools.length : perDay.toFixed(1)}</p>
          <p className="text-xs text-muted">{single ? 'hoy' : days < 7 && days > 1 ? `por día (${days} días con datos)` : days === 1 ? 'por día (1 día con datos)' : 'por día'}</p>
        </div>
        <div>
          <p className="tabular text-2xl font-extrabold">{avg?.toFixed(1) ?? '—'}</p>
          <p className="text-xs text-muted">Bristol medio</p>
        </div>
        <div>
          <p className="tabular text-2xl font-extrabold">{Math.round((ideal / stools.length) * 100)} %</p>
          <p className="text-xs text-muted">tipo 3–4</p>
        </div>
      </div>
      {!single && prev.length > 0 && (
        <p className="mt-2 text-center text-xs text-muted">
          Periodo anterior: {prevPerDay.toFixed(1)} por día ({perDay > prevPerDay ? 'más' : perDay < prevPerDay ? 'menos' : 'igual'} que ahora)
        </p>
      )}
      <div className="mt-4 space-y-1.5" aria-label="Distribución Bristol">
        {dist.map((d) => (
          <div key={d.type} className="flex items-center gap-2 text-sm">
            <BristolIcon type={d.type as Stool['bristol']} className="h-5 w-10 shrink-0" />
            <span className="w-12 shrink-0 font-semibold">Tipo {d.type}</span>
            <span className="h-3 flex-1 overflow-hidden rounded-full bg-surface-2">
              <span className={cx('block h-full rounded-full', toneDot[bristolTone(d.type as Stool['bristol'])])} style={{ width: `${(d.count / max) * 100}%` }} />
            </span>
            <span className="tabular w-14 shrink-0 text-right text-muted">
              {d.count} · {d.pct}%
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {extras
          .filter((e) => e.n > 0)
          .map((e) => (
            <span key={e.label} className={cx('rounded-full px-2.5 py-1 text-xs font-semibold', e.bad ? toneBg.bad : toneBg.mid)}>
              {e.label}: {e.n}
            </span>
          ))}
      </div>
      <p className="mt-3 text-xs text-muted">
        Referencia general: los tipos 3 y 4 suelen considerarse ideales; {BRISTOL[0].title.toLowerCase()}–2 tienden al estreñimiento y 6–7 a la diarrea. Urgencia mostrada desde «{URGENCY_LABELS[2].toLowerCase()}».
      </p>
    </Card>
  );
}

// ───────────────────────── Síntomas ─────────────────────────

function SymptomsTab() {
  const entry = useEntry();
  const now = useNow(60_000);
  const [days, setDays] = useState(PAGE_DAYS);
  const [type, setType] = useState<SymptomType | 'todos'>('todos');
  const from = dayStart(addDays(todayKey(), -(days - 1)));
  const data = useLiveQuery(async () => {
    const db = getDb();
    const list = await db.symptoms.where('startedAt').aboveOrEqual(Math.min(from, now - 30 * 86_400_000)).toArray();
    const oldest = await db.symptoms.orderBy('startedAt').first();
    const log = await db.dailyLogs.get(todayKey());
    return { list, oldest: oldest?.startedAt, log };
  }, [from]);
  if (!data) return null;
  const ongoing = data.list.filter((s) => isOngoing(s, now));
  const visible = data.list.filter((s) => s.startedAt >= from && (type === 'todos' || s.type === type));
  const last30 = data.list.filter((s) => s.startedAt >= now - 30 * 86_400_000);
  const summary = symptomSummary(last30);
  const groups = groupByDay(visible, (s: Symptom) => s.startedAt);
  const usedTypes = new Set(data.list.map((s) => s.type));

  return (
    <>
      <Button size="lg" block onClick={() => entry.openSymptom()}>
        <Plus size={20} /> Registrar síntoma
      </Button>

      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {SYMPTOMS.filter((s) => s.type !== 'otro').slice(0, 8).map((s) => (
          <Chip key={s.type} size="sm" onClick={() => entry.openSymptom({ type: s.type })} aria-label={`Registrar ${s.label}`}>
            <span aria-hidden>{s.emoji}</span> {s.label.split(' / ')[0]}
          </Chip>
        ))}
      </div>

      {ongoing.length > 0 && (
        <>
          <SectionTitle>En curso</SectionTitle>
          <ul className="space-y-2">
            {ongoing.map((s) => (
              <SymptomRow key={s.id} symptom={s} now={now} onOpen={() => entry.openSymptom({ symptom: s })} />
            ))}
          </ul>
        </>
      )}

      <button type="button" onClick={() => entry.openFactors()} className="mt-4 flex w-full items-center justify-between rounded-2xl border border-border bg-surface p-4 text-left">
        <span>
          <span className="block font-semibold">Estrés, sueño y ejercicio de hoy</span>
          <span className="block text-sm text-muted">
            {data.log?.stress !== undefined || data.log?.sleepHours !== undefined || data.log?.exercise
              ? [data.log?.stress !== undefined && `Estrés ${data.log.stress}/10`, data.log?.sleepHours !== undefined && `Sueño ${data.log.sleepHours} h`, data.log?.exercise && `${data.log.exercise.type}`].filter(Boolean).join(' · ')
              : 'Opcional: pueden influir en la digestión'}
          </span>
        </span>
        <Plus size={20} className="text-primary" />
      </button>

      {summary.length > 0 && (
        <>
          <SectionTitle>Últimos 30 días</SectionTitle>
          <Card className="!p-3">
            <ul className="divide-y divide-border">
              {summary.slice(0, 8).map((r) => (
                <li key={r.label} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="font-semibold">
                    <span aria-hidden>{symptomDef(r.type).emoji}</span> {r.label}
                  </span>
                  <span className="tabular text-muted">
                    {r.count} {r.count === 1 ? 'vez' : 'veces'} · media {r.avgIntensity}/10 · máx {r.maxIntensity}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      <SectionTitle>Historial</SectionTitle>
      {usedTypes.size > 1 && (
        <div className="no-scrollbar -mx-4 mb-2 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filtrar por síntoma">
          <Chip size="sm" selected={type === 'todos'} onClick={() => setType('todos')}>
            Todos
          </Chip>
          {SYMPTOMS.filter((s) => usedTypes.has(s.type)).map((s) => (
            <Chip key={s.type} size="sm" selected={type === s.type} onClick={() => setType(s.type)}>
              {symptomLabel(s.type).split(' / ')[0]}
            </Chip>
          ))}
        </div>
      )}
      {groups.length === 0 ? (
        <EmptyState title="Sin síntomas en este periodo">¡Buenas noticias! Si aparece alguna molestia, regístrala con su intensidad.</EmptyState>
      ) : (
        groups.map(([day, items]) => (
          <Fragment key={day}>
            <p className="mb-2 mt-4 px-1 text-sm font-bold text-muted">{relativeDayLabel(day)}</p>
            <ul className="space-y-2">
              {items.map((s) => (
                <SymptomRow key={s.id} symptom={s} now={now} onOpen={() => entry.openSymptom({ symptom: s })} />
              ))}
            </ul>
          </Fragment>
        ))
      )}
      <LoadMore days={days} onMore={() => setDays((d) => d + PAGE_DAYS)} hasOlder={!!data.oldest && data.oldest < from} />
    </>
  );
}

