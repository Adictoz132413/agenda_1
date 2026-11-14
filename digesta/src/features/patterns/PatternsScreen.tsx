/**
 * PANTALLA 6 · Análisis de patrones.
 * Las señales usan todo el historial; los gráficos, el periodo elegido.
 */
import { BarChart3, ChevronDown, Info } from 'lucide-react';
import { useMemo, useState } from 'react';
import { compareDays, type FoodSignal } from '@/analysis/engine';
import { useAnalysis, useRangeData } from '@/analysis/useAnalysis';
import { addDays, formatShortDate } from '@/domain/dates';
import { navigate } from '@/lib/router';
import { useToday } from '@/lib/hooks';
import { Button, Card, EmptyState, SectionTitle, Segmented, cx, inputClass } from '@/components/ui';
import { PatternCharts } from './Charts';
import { DayComparisonTable, InsightCard, SignalCard } from './SignalCard';

const PERIODS = [7, 14, 30, 90] as const;
const SIGNALS_PREVIEW = 6;
type Period = (typeof PERIODS)[number];

const openFood = (key: string) => navigate(`/tolerancia/${encodeURIComponent(key)}`);

export function PatternsScreen() {
  const today = useToday();
  const [period, setPeriod] = useState<Period>(30);
  const from = addDays(today, -(period - 1));
  const range = useRangeData(from, today);
  const { result, data, threshold } = useAnalysis();
  const [showIsolated, setShowIsolated] = useState(false);
  const [showAllSignals, setShowAllSignals] = useState(false);
  // Una tarjeta por alimento (su señal más fuerte); el resto se ve en la ficha del alimento.
  const grouped = useMemo(() => {
    const m = new Map<string, { top: FoodSignal; more: number }>();
    for (const s of result?.signals ?? []) {
      const g = m.get(s.foodKey);
      if (g) g.more++;
      else m.set(s.foodKey, { top: s, more: 0 });
    }
    return [...m.values()];
  }, [result]);
  const comparable = useMemo(() => (result?.profiles ?? []).filter((p) => p.exposures >= 3).sort((a, b) => a.name.localeCompare(b.name, 'es')), [result]);
  const [compareKey, setCompareKey] = useState<string>('');
  const selectedKey = compareKey || comparable[0]?.key || '';
  const comparison = useMemo(() => (data && selectedKey ? compareDays(selectedKey, { ...data, threshold }) : undefined), [data, selectedKey, threshold]);

  if (!result || !data || !range) {
    return (
      <p className="py-16 text-center text-muted" role="status">
        Analizando tus registros…
      </p>
    );
  }

  const empty = data.meals.length + data.stools.length + data.symptoms.length === 0;
  const c = result.coverage;

  return (
    <div className="pt-2">
      <h1 className="px-1 text-2xl font-extrabold tracking-tight">Análisis de patrones</h1>
      <p className="px-1 text-sm text-muted">Asociaciones observadas en tus registros. No son diagnósticos ni demuestran causa.</p>

      {empty ? (
        <div className="mt-6">
          <EmptyState icon={<BarChart3 size={36} />} title="Todavía no hay datos para analizar">
            Registra comidas, síntomas y deposiciones durante algunos días. Con 2 a 4 semanas de registros los patrones empiezan a ser más confiables.
          </EmptyState>
        </div>
      ) : (
        <>
          <Card className="mt-4">
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { n: c.trackedDays, l: 'días' },
                { n: c.meals, l: 'comidas' },
                { n: c.symptomEpisodes, l: 'episodios' },
                { n: c.stools, l: 'deposic.' },
              ].map((x) => (
                <div key={x.l}>
                  <p className="tabular text-2xl font-extrabold">{x.n}</p>
                  <p className="text-[12px] text-muted">{x.l}</p>
                </div>
              ))}
            </div>
            {c.firstDay && c.lastDay && (
              <p className="mt-2 text-center text-[12px] text-muted">
                Historial completo: {formatShortDate(c.firstDay, true)} – {formatShortDate(c.lastDay, true)} · episodio = síntoma con intensidad ≥ {threshold}
              </p>
            )}
          </Card>

          <Card className="mt-3 bg-surface-2">
            <h2 className="flex items-center gap-2 font-extrabold">
              <Info size={18} className="text-mid" aria-hidden /> Incertidumbre y factores de confusión
            </h2>
            <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-muted">
              {result.caveats.map((t) => (
                <li key={t}>• {t}</li>
              ))}
            </ul>
          </Card>

          <SectionTitle>Señales observadas</SectionTitle>
          <p className="-mt-1 mb-2 px-1 text-[12px] text-muted">Calculadas con todo tu historial. Requieren al menos 3 exposiciones y 2 episodios.</p>
          {grouped.length ? (
            <>
              <ul className="space-y-3">
                {(showAllSignals ? grouped : grouped.slice(0, SIGNALS_PREVIEW)).map(({ top, more }) => (
                  <li key={top.foodKey}>
                    <SignalCard asItem={false} signal={top} onOpen={() => openFood(top.foodKey)} />
                    {more > 0 && (
                      <button type="button" onClick={() => openFood(top.foodKey)} className="mt-1 px-4 text-[13px] font-semibold text-primary">
                        + {more} señal{more === 1 ? '' : 'es'} más de {top.foodName.toLowerCase()} →
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {grouped.length > SIGNALS_PREVIEW && (
                <Button variant="secondary" block className="mt-3" onClick={() => setShowAllSignals((v) => !v)}>
                  {showAllSignals ? 'Mostrar menos' : `Mostrar los ${grouped.length} alimentos con señales`}
                </Button>
              )}
              <p className="mt-2 px-1 text-[12px] text-muted">
                Alimentos que suelen comerse juntos (p. ej. ingredientes de una misma preparación) muestran señales parecidas: revisa los factores de confusión de cada tarjeta.
              </p>
            </>
          ) : (
            <EmptyState title="Sin señales repetidas por ahora">
              No se observan asociaciones que se repitan con suficiente frecuencia. Sigue registrando: la ausencia de señales con pocos datos no garantiza buena tolerancia.
            </EmptyState>
          )}

          <SectionTitle>Mejor tolerado en poca cantidad o con otra preparación</SectionTitle>
          {result.insights.length ? (
            <ul className="space-y-3">
              {result.insights.map((i) => (
                <InsightCard key={`${i.foodKey}|${i.kind}|${i.outcome}`} insight={i} onOpen={() => openFood(i.foodKey)} />
              ))}
            </ul>
          ) : (
            <p className="px-1 text-sm text-muted">Aún no hay diferencias claras por cantidad o preparación. Registrar la cantidad y la preparación ayuda a detectarlas.</p>
          )}

          <SectionTitle>Observaciones aisladas</SectionTitle>
          <Card>
            <button type="button" onClick={() => setShowIsolated((v) => !v)} aria-expanded={showIsolated} className="flex w-full items-center justify-between gap-2 text-left">
              <span>
                <span className="block font-bold">{result.isolated.length} observación(es) aislada(s)</span>
                <span className="block text-[13px] text-muted">Un solo episodio o muy pocas exposiciones: no permiten sacar conclusiones.</span>
              </span>
              <ChevronDown size={20} className={cx('shrink-0 transition', showIsolated && 'rotate-180')} />
            </button>
            {showIsolated && (
              <ul className="mt-3 divide-y divide-border">
                {result.isolated.length === 0 && <li className="py-2 text-sm text-muted">Ninguna.</li>}
                {result.isolated.slice(0, 40).map((s) => (
                  <li key={`${s.foodKey}|${s.outcome}`}>
                    <button type="button" onClick={() => openFood(s.foodKey)} className="w-full py-2.5 text-left text-sm">
                      <span className="font-semibold">{s.foodName}</span>
                      <span className="text-muted"> · {s.message}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <SectionTitle>Comparar días con y sin un alimento</SectionTitle>
          <Card>
            {comparable.length ? (
              <>
                <label htmlFor="cmp-food" className="mb-1.5 block text-sm font-semibold">
                  Alimento
                </label>
                <select id="cmp-food" className={cx(inputClass, 'mb-3')} value={selectedKey} onChange={(e) => setCompareKey(e.target.value)}>
                  {comparable.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.name} ({p.exposures})
                    </option>
                  ))}
                </select>
                {comparison && <DayComparisonTable comparison={comparison} foodName={comparable.find((p) => p.key === selectedKey)?.name ?? ''} />}
              </>
            ) : (
              <p className="text-sm text-muted">Necesitas alimentos registrados al menos 3 veces para comparar.</p>
            )}
          </Card>

          <div className="mb-2 mt-6 flex items-center justify-between gap-2 px-1">
            <h2 className="text-[13px] font-bold uppercase tracking-wider text-muted">Gráficos del periodo</h2>
          </div>
          <Segmented label="Periodo de los gráficos" value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: p, label: `${p} días` }))} className="mb-3" />
          <PatternCharts from={from} to={today} meals={range.meals} stools={range.stools} symptoms={range.symptoms} logs={range.logs} />
        </>
      )}
    </div>
  );
}
