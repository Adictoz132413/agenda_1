/**
 * PANTALLA 5 · Mi tolerancia alimentaria.
 * Lista de fichas de alimentos y detalle con historial, señales y comparación.
 * La clasificación manual se guarda aparte de la sugerencia automática.
 */
import { ArrowLeft, ChevronRight, Search, Sprout } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { EVIDENCE_INFO, compareDays, foodHistoryDetail, type FoodProfile } from '@/analysis/engine';
import { useAnalysis, useFoodNotes } from '@/analysis/useAnalysis';
import { getDb } from '@/db/db';
import { saveFoodNote } from '@/db/repo';
import { HOUR, formatDateTime, formatShortDate } from '@/domain/dates';
import { foodKey as toKey } from '@/domain/foods';
import { FEELINGS, PREPARATIONS, QUANTITIES, TOLERANCE, bristolInfo, quantityLabel, preparationLabel, symptomLabel } from '@/domain/labels';
import type { FoodNote, ToleranceStatus } from '@/domain/types';
import { navigate } from '@/lib/router';
import { useEntry } from '@/features/entries/EntryProvider';
import { Badge, Button, Card, Chip, EmptyState, SectionTitle, Segmented, TextArea, cx, errorMessage, inputClass, toneBg, toneDot, useToast, type Tone } from '@/components/ui';
import { DayComparisonTable, InsightCard, SignalCard } from '@/features/patterns/SignalCard';

const STATUSES: ToleranceStatus[] = ['tolero_bien', 'a_medias', 'posible_mala', 'sin_datos'];
const toneOf = (s: ToleranceStatus): Tone => TOLERANCE[s].tone;

function Disclaimer() {
  return (
    <p className="mt-4 rounded-2xl bg-surface-2 px-4 py-3 text-[13px] leading-relaxed text-muted">
      Estas fichas reflejan asociaciones en tus registros. <strong className="text-text">No son un diagnóstico de intolerancia.</strong> No elimines grupos de alimentos sin orientación de un profesional de la salud.
    </p>
  );
}

export function ToleranceScreen({ foodKey }: { foodKey?: string }) {
  return foodKey ? <FoodDetail foodKey={foodKey} /> : <FoodList />;
}

// ───────────────────────── Lista ─────────────────────────

type Filter = 'todos' | ToleranceStatus;
type Sort = 'consumo' | 'recientes' | 'az';

function FoodList() {
  const { result } = useAnalysis();
  const notes = useFoodNotes();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('todos');
  const [sort, setSort] = useState<Sort>('consumo');

  const effective = (p: FoodProfile): ToleranceStatus => notes?.get(p.key)?.manualStatus ?? p.suggestion;

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { todos: 0, tolero_bien: 0, a_medias: 0, posible_mala: 0, sin_datos: 0 };
    for (const p of result?.profiles ?? []) {
      c.todos++;
      c[notes?.get(p.key)?.manualStatus ?? p.suggestion]++;
    }
    return c;
  }, [result, notes]);

  const list = useMemo(() => {
    const nq = toKey(q);
    const items = (result?.profiles ?? []).filter((p) => (!nq || p.key.includes(nq)) && (filter === 'todos' || (notes?.get(p.key)?.manualStatus ?? p.suggestion) === filter));
    const sorted = [...items];
    if (sort === 'recientes') sorted.sort((a, b) => b.lastAt - a.lastAt);
    else if (sort === 'az') sorted.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    else sorted.sort((a, b) => b.exposures - a.exposures || a.name.localeCompare(b.name, 'es'));
    return sorted;
  }, [result, notes, q, filter, sort]);

  if (!result) {
    return (
      <p className="py-16 text-center text-muted" role="status">
        Cargando fichas…
      </p>
    );
  }

  return (
    <div className="pt-2">
      <h1 className="px-1 text-2xl font-extrabold tracking-tight">Mi tolerancia alimentaria</h1>
      <p className="px-1 text-sm text-muted">Una ficha por cada alimento o ingrediente que registraste.</p>

      {result.profiles.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={<Sprout size={36} />} title="Aún no hay alimentos registrados">
            Registra tus comidas durante algunos días. Cada alimento tendrá su ficha con historial, síntomas posteriores y nivel de evidencia.
          </EmptyState>
          <Disclaimer />
        </div>
      ) : (
        <>
          <div className="relative mt-4">
            <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input type="search" aria-label="Buscar alimento" placeholder="Buscar alimento" className={cx(inputClass, 'pl-11')} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filtrar por estado">
            <Chip size="sm" selected={filter === 'todos'} onClick={() => setFilter('todos')}>
              Todos <span className="text-xs opacity-70">{counts.todos}</span>
            </Chip>
            {STATUSES.map((s) => (
              <Chip key={s} size="sm" tone={toneOf(s) === 'none' ? 'primary' : toneOf(s)} selected={filter === s} onClick={() => setFilter(filter === s ? 'todos' : s)}>
                <span className={cx('size-2 rounded-full', toneDot[toneOf(s)])} aria-hidden />
                {TOLERANCE[s].label} <span className="text-xs opacity-70">{counts[s]}</span>
              </Chip>
            ))}
          </div>
          <Segmented
            className="mt-2"
            label="Ordenar"
            value={sort}
            onChange={setSort}
            options={[
              { value: 'consumo', label: 'Más consumidos' },
              { value: 'recientes', label: 'Recientes' },
              { value: 'az', label: 'A–Z' },
            ]}
          />

          {list.length ? (
            <ul className="mt-3 space-y-2">
              {list.map((p) => (
                <FoodCard key={p.key} profile={p} note={notes?.get(p.key)} effective={effective(p)} />
              ))}
            </ul>
          ) : (
            <p className="mt-6 text-center text-sm text-muted">No hay alimentos que coincidan con la búsqueda o el filtro.</p>
          )}
          <Disclaimer />
        </>
      )}
    </div>
  );
}

function FoodCard({ profile: p, note, effective }: { profile: FoodProfile; note?: FoodNote; effective: ToleranceStatus }) {
  const manual = note?.manualStatus;
  return (
    <li>
      <button
        type="button"
        onClick={() => navigate(`/tolerancia/${encodeURIComponent(p.key)}`)}
        className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface p-3 text-left shadow-card transition active:scale-[0.99]"
      >
        <span className={cx('h-12 w-1.5 shrink-0 rounded-full', toneDot[toneOf(effective)])} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-bold leading-tight">{p.name}</span>
          <span className="block text-[13px] text-muted">
            {p.exposures} {p.exposures === 1 ? 'vez' : 'veces'} · última {formatShortDate(p.lastAt)} · {EVIDENCE_INFO[p.evidence].label.toLowerCase()}
          </span>
          <span className="mt-1.5 flex flex-wrap gap-1">
            {manual && <Badge tone={toneOf(manual)}>Tu clasificación: {TOLERANCE[manual].short}</Badge>}
            <Badge tone={manual ? 'none' : toneOf(p.suggestion)}>Sugerencia: {TOLERANCE[p.suggestion].short}</Badge>
          </span>
        </span>
        <ChevronRight size={20} className="shrink-0 text-muted" aria-hidden />
      </button>
    </li>
  );
}

// ───────────────────────── Detalle ─────────────────────────

function FoodDetail({ foodKey }: { foodKey: string }) {
  const { result, data, threshold } = useAnalysis();
  const notes = useFoodNotes();
  const entry = useEntry();
  const toast = useToast();
  const profile = result?.profiles.find((p) => p.key === foodKey);
  const note = notes?.get(foodKey);
  const [noteText, setNoteText] = useState('');
  const [noteDirty, setNoteDirty] = useState(false);
  const [showIsolated, setShowIsolated] = useState(false);

  useEffect(() => {
    if (!noteDirty) setNoteText(note?.note ?? '');
  }, [note?.note, noteDirty]);

  const comparison = useMemo(() => (data ? compareDays(foodKey, { ...data, threshold }) : undefined), [data, foodKey, threshold]);
  const history = useMemo(() => (data ? foodHistoryDetail(foodKey, { ...data, threshold }) : []), [data, foodKey, threshold]);

  const back = () => {
    if (window.history.length > 1) window.history.back();
    else navigate('/tolerancia');
  };

  if (!result || !notes) {
    return (
      <p className="py-16 text-center text-muted" role="status">
        Cargando ficha…
      </p>
    );
  }

  if (!profile) {
    return (
      <div className="pt-2">
        <BackButton onClick={() => navigate('/tolerancia')} />
        <EmptyState title="No encontramos este alimento" action={<Button onClick={() => navigate('/tolerancia')}>Ver todas las fichas</Button>}>
          Puede que se haya eliminado de tus registros.
        </EmptyState>
      </div>
    );
  }

  const manual = note?.manualStatus;
  const setManual = async (s: ToleranceStatus | undefined) => {
    try {
      await saveFoodNote(foodKey, profile.name, { manualStatus: s });
      toast(s ? `Clasificado como «${TOLERANCE[s].label}»` : 'Clasificación manual quitada');
    } catch (e) {
      toast(errorMessage(e), { tone: 'error' });
    }
  };
  const saveNote = async () => {
    try {
      await saveFoodNote(foodKey, profile.name, { note: noteText.trim() || undefined });
      setNoteDirty(false);
      toast('Nota guardada');
    } catch (e) {
      toast(errorMessage(e), { tone: 'error' });
    }
  };

  const openMeal = async (mealId: string) => {
    const meal = await getDb().meals.get(mealId);
    if (meal) entry.openMeal({ meal });
    else toast('Esa comida ya no existe', { tone: 'error' });
  };

  const relevant = profile.signals.filter((s) => s.strength !== 'aislada');
  const isolated = profile.signals.filter((s) => s.strength === 'aislada');
  const totalQ = Object.values(profile.quantities).reduce((a, b) => a + (b ?? 0), 0);
  const prepEntries = Object.entries(profile.preparations).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)) as [string, number][];

  return (
    <div className="pt-2">
      <BackButton onClick={back} />
      <h1 className="px-1 text-2xl font-extrabold tracking-tight">{profile.name}</h1>
      <p className="px-1 text-sm text-muted">
        {profile.exposures} {profile.exposures === 1 ? 'exposición' : 'exposiciones'} · desde {formatShortDate(profile.firstAt, true)} · última {formatShortDate(profile.lastAt, true)}
      </p>

      <Card className="mt-4">
        <h2 className="font-extrabold">Tu clasificación</h2>
        <p className="text-[13px] text-muted">Se guarda aparte y no cambia la sugerencia automática.</p>
        <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Clasificación manual">
          {STATUSES.map((s) => {
            const sel = manual === s;
            const tone = toneOf(s);
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={sel}
                onClick={() => setManual(sel ? undefined : s)}
                className={cx('flex min-h-14 items-center gap-2 rounded-2xl border px-3 text-left text-sm font-semibold transition active:scale-[0.98]', sel ? cx('border-transparent ring-2 ring-current', toneBg[tone]) : 'border-border bg-surface')}
              >
                <span className={cx('size-3 shrink-0 rounded-full', toneDot[tone])} aria-hidden />
                {TOLERANCE[s].label}
              </button>
            );
          })}
        </div>
        {manual && (
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setManual(undefined)}>
            Quitar mi clasificación
          </Button>
        )}
        <label htmlFor="food-note" className="mb-1.5 mt-4 block text-sm font-semibold">
          Observaciones personales
        </label>
        <TextArea
          id="food-note"
          value={noteText}
          maxLength={2000}
          placeholder="p. ej. Me cae mejor deslactosada, o en la mañana…"
          onChange={(e) => {
            setNoteText(e.target.value);
            setNoteDirty(true);
          }}
          onBlur={() => noteDirty && void saveNote()}
        />
        {noteDirty && (
          <Button size="sm" variant="soft" className="mt-2" onClick={saveNote}>
            Guardar nota
          </Button>
        )}
      </Card>

      <Card className="mt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-extrabold">Sugerencia automática</h2>
          <Badge tone={toneOf(profile.suggestion)}>{TOLERANCE[profile.suggestion].label}</Badge>
        </div>
        <p className="mt-1 text-[13px] text-muted">{TOLERANCE[profile.suggestion].description}</p>
        <p className="mt-3 text-sm leading-relaxed">{profile.summary}</p>
        <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-[13px]">
          <strong>{EVIDENCE_INFO[profile.evidence].label}.</strong> <span className="text-muted">{EVIDENCE_INFO[profile.evidence].description}</span>
        </p>
      </Card>

      <SectionTitle>Señales observadas</SectionTitle>
      {relevant.length ? (
        <ul className="space-y-3">
          {relevant.map((s) => (
            <SignalCard key={`${s.outcome}|${s.window}`} signal={s} showFood={false} />
          ))}
        </ul>
      ) : (
        <p className="px-1 text-sm text-muted">
          {isolated.length ? 'No hay asociaciones que se repitan con este alimento.' : 'No se registraron síntomas ni deposiciones alteradas en las ventanas posteriores a este alimento.'}
        </p>
      )}
      {isolated.length > 0 && (
        <div className="mt-3">
          <Button variant="secondary" block onClick={() => setShowIsolated((v) => !v)} aria-expanded={showIsolated}>
            {showIsolated ? 'Ocultar' : 'Ver'} observaciones aisladas ({isolated.length})
          </Button>
          {showIsolated && (
            <>
              <p className="mt-2 px-1 text-[12px] text-muted">Un solo episodio o muy pocas exposiciones: no permiten sacar conclusiones.</p>
              <ul className="mt-2 space-y-3">
                {isolated.map((s) => (
                  <SignalCard key={`${s.outcome}|${s.window}`} signal={s} showFood={false} />
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {profile.insights.length > 0 && (
        <>
          <SectionTitle>Cantidad y preparación</SectionTitle>
          <ul className="space-y-3">
            {profile.insights.map((i) => (
              <InsightCard key={`${i.kind}|${i.outcome}`} insight={i} showFood={false} />
            ))}
          </ul>
        </>
      )}

      <SectionTitle>Cómo lo consumes</SectionTitle>
      <Card>
        <p className="mb-2 text-sm font-semibold">Cantidad</p>
        <Distribution
          rows={QUANTITIES.filter((q) => profile.quantities[q.value]).map((q) => ({ label: q.label, n: profile.quantities[q.value] ?? 0 }))}
          total={totalQ}
        />
        <p className="mb-2 mt-4 text-sm font-semibold">Preparación</p>
        <Distribution
          rows={prepEntries.map(([p, n]) => ({ label: p === 'sin_especificar' ? 'Sin especificar' : PREPARATIONS.find((x) => x.value === p)?.label ?? p, n }))}
          total={totalQ}
        />
      </Card>

      <SectionTitle>Días con consumo vs. sin consumo</SectionTitle>
      <Card>{comparison && <DayComparisonTable comparison={comparison} foodName={profile.name} />}</Card>

      <SectionTitle>Historial de consumo</SectionTitle>
      <ul className="space-y-2">
        {history.map((h) => {
          const feeling = FEELINGS.find((f) => f.value === h.feelingAfter);
          return (
            <li key={h.mealId}>
              <button type="button" onClick={() => openMeal(h.mealId)} className="w-full rounded-2xl border border-border bg-surface p-3 text-left transition active:scale-[0.99]" aria-label={`Abrir comida del ${formatDateTime(h.at)}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-bold">{formatDateTime(h.at)}</span>
                  <ChevronRight size={16} className="shrink-0 text-muted" aria-hidden />
                </div>
                <p className="text-[13px] text-muted">
                  {h.quantity === 'personalizada' ? h.customQuantity ?? 'Otra cantidad' : quantityLabel(h.quantity)} · {preparationLabel(h.preparation)}
                  {h.viaIngredientOf ? ` · como ingrediente de ${h.viaIngredientOf}` : ''}
                </p>
                {h.coFoods.length > 0 && <p className="text-[13px] text-muted">Con: {h.coFoods.join(', ')}</p>}
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {feeling && <Badge tone={feeling.tone}>Al terminar: {feeling.label.toLowerCase()}</Badge>}
                  {h.laterSymptoms.map((s) => (
                    <Badge key={s.id} tone={s.intensity >= threshold ? (s.intensity >= 7 ? 'bad' : 'mid') : 'none'}>
                      {symptomLabel(s.type, s.customName)} {s.intensity}/10 · +{formatHoursAfter(s.startedAt - h.at)}
                    </Badge>
                  ))}
                  {h.laterStools.map((s) => (
                    <Badge key={s.id} tone="mid">
                      Bristol {s.bristol} ({bristolInfo(s.bristol).group === 'duro' ? 'dura' : 'blanda'}) · +{formatHoursAfter(s.at - h.at)}
                    </Badge>
                  ))}
                  {!feeling && h.laterSymptoms.length === 0 && h.laterStools.length === 0 && <Badge tone="good">Sin molestias registradas después</Badge>}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 px-1 text-[12px] text-muted">Se muestran síntomas iniciados hasta 24 h después y deposiciones blandas (0–24 h) o duras (24–72 h).</p>
      <Disclaimer />
    </div>
  );
}

function formatHoursAfter(ms: number): string {
  const h = ms / HOUR;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  return `${h < 10 ? h.toFixed(1).replace('.', ',') : Math.round(h)} h`;
}

function Distribution({ rows, total }: { rows: { label: string; n: number }[]; total: number }) {
  if (!rows.length) return <p className="text-sm text-muted">Sin datos.</p>;
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex justify-between text-[13px]">
            <span>{r.label}</span>
            <span className="tabular font-semibold">
              {r.n} <span className="font-normal text-muted">({total ? Math.round((r.n / total) * 100) : 0} %)</span>
            </span>
          </div>
          <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
            <div className="h-full rounded-full bg-primary" style={{ width: `${total ? (r.n / total) * 100 : 0}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="-ml-1 mb-2 inline-flex min-h-10 items-center gap-1 rounded-xl px-2 text-sm font-semibold text-primary hover:bg-primary-soft">
      <ArrowLeft size={18} /> Mis alimentos
    </button>
  );
}
