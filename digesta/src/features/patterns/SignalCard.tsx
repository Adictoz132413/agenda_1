/**
 * Tarjetas para mostrar señales, observaciones de modulación (cantidad /
 * preparación) y la comparación de días con y sin un alimento.
 * Se usan tanto en Patrones como en el detalle de Tolerancia.
 */
import { ChevronRight, CircleHelp } from 'lucide-react';
import { EVIDENCE_INFO, STRENGTH_INFO, outcomeDef, type DayComparison, type FoodSignal, type ModulationInsight } from '@/analysis/engine';
import { WINDOWS } from '@/domain/labels';
import { Badge, cx, toneDot, type Tone } from '@/components/ui';

const pct = (x: number) => `${Math.round(x * 100)} %`;

/** Barra horizontal comparativa: proporción con el alimento vs sin él. */
function RateBar({ label, rate, tone, detail }: { label: string; rate: number; tone: Tone; detail: string }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
        <span className="font-semibold">{label}</span>
        <span className="tabular text-muted">
          <span className="font-bold text-text">{pct(rate)}</span> · {detail}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <div className={cx('h-full rounded-full', toneDot[tone])} style={{ width: `${Math.max(2, Math.round(rate * 100))}%` }} />
      </div>
    </div>
  );
}

/** `asItem=false` cuando la tarjeta no va directamente dentro de una lista <ul>. */
export function SignalCard({ signal, onOpen, showFood = true, asItem = true }: { signal: FoodSignal; onOpen?: () => void; showFood?: boolean; asItem?: boolean }) {
  const Wrap = asItem ? 'li' : 'div';
  const info = STRENGTH_INFO[signal.strength];
  const o = outcomeDef(signal.outcome);
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {showFood && <p className="text-base font-extrabold leading-tight">{signal.foodName}</p>}
          <p className={cx('text-sm', showFood ? 'text-muted' : 'font-bold')}>
            {o.label} · {WINDOWS[signal.window].label} después
          </p>
        </div>
        {onOpen && <ChevronRight size={20} className="mt-0.5 shrink-0 text-muted" aria-hidden />}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge tone={info.tone}>{info.label}</Badge>
        <Badge>{EVIDENCE_INFO[signal.evidence].label}</Badge>
        {signal.avgIntensity > 0 && signal.outcome !== 'heces_blandas' && signal.outcome !== 'heces_duras' && signal.outcome !== 'malestar_inmediato' && (
          <Badge>Intensidad media {signal.avgIntensity.toFixed(1)}/10</Badge>
        )}
      </div>
      <div className="mt-3 space-y-2">
        <RateBar label={`Con ${signal.foodName.toLowerCase()}`} rate={signal.rate} tone={info.tone === 'none' ? 'none' : info.tone} detail={`${signal.followed} de ${signal.exposures}`} />
        {signal.baselineRate !== null ? (
          <RateBar label="Sin este alimento" rate={signal.baselineRate} tone="none" detail={`${signal.baselineFollowed} de ${signal.baselineExposures}`} />
        ) : (
          <p className="text-[13px] text-muted">Aún no hay suficientes comidas sin este alimento para comparar.</p>
        )}
      </div>
      <p className="mt-3 text-sm leading-relaxed">{signal.message}</p>
      {signal.confounders.length > 0 && (
        <div className="mt-3 rounded-2xl bg-surface-2 p-3">
          <p className="flex items-center gap-1.5 text-[13px] font-bold">
            <CircleHelp size={15} className="text-mid" aria-hidden /> Posibles factores de confusión
          </p>
          <ul className="mt-1 space-y-0.5 text-[13px] text-muted">
            {signal.confounders.map((c, i) => (
              <li key={i}>
                • {c.label}: {c.count} de {c.of} episodios
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
  if (onOpen) {
    return (
      <Wrap>
        <button type="button" onClick={onOpen} className="block w-full rounded-3xl border border-border bg-surface p-4 text-left shadow-card transition active:scale-[0.99]">
          {body}
        </button>
      </Wrap>
    );
  }
  return <Wrap className="rounded-3xl border border-border bg-surface p-4 shadow-card">{body}</Wrap>;
}

export function InsightCard({ insight, onOpen, showFood = true }: { insight: ModulationInsight; onOpen?: () => void; showFood?: boolean }) {
  const o = outcomeDef(insight.outcome);
  const rate = (g: { exposures: number; followed: number }) => (g.exposures ? g.followed / g.exposures : 0);
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div>
          {showFood && <p className="font-extrabold">{insight.foodName}</p>}
          <p className="text-sm text-muted">
            {insight.kind === 'cantidad' ? 'Según la cantidad' : 'Según la preparación'} · {o.label}
          </p>
        </div>
        {onOpen && <ChevronRight size={20} className="mt-0.5 shrink-0 text-muted" aria-hidden />}
      </div>
      <div className="mt-3 space-y-2">
        <RateBar label={capitalize(insight.better.label)} rate={rate(insight.better)} tone="good" detail={`${insight.better.followed} de ${insight.better.exposures}`} />
        <RateBar label={capitalize(insight.worse.label)} rate={rate(insight.worse)} tone="mid" detail={`${insight.worse.followed} de ${insight.worse.exposures}`} />
      </div>
      <p className="mt-3 text-sm leading-relaxed">{insight.message}</p>
      <p className="mt-1 text-[12px] text-muted">Pocas observaciones por grupo: tómalo como una pista para seguir observando.</p>
    </>
  );
  if (onOpen)
    return (
      <li>
        <button type="button" onClick={onOpen} className="block w-full rounded-3xl border border-border bg-surface p-4 text-left shadow-card transition active:scale-[0.99]">
          {content}
        </button>
      </li>
    );
  return <li className="rounded-3xl border border-border bg-surface p-4 shadow-card">{content}</li>;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Tabla de comparación de días con y sin consumo de un alimento. */
export function DayComparisonTable({ comparison, foodName }: { comparison: DayComparison; foodName: string }) {
  const w = comparison.withFood;
  const wo = comparison.withoutFood;
  const rows: { label: string; a: string; b: string }[] = [
    { label: 'Días', a: String(w.days), b: String(wo.days) },
    { label: 'Días con síntomas', a: pct(w.symptomDayRate), b: pct(wo.symptomDayRate) },
    { label: 'Intensidad máx. media', a: `${w.avgMaxIntensity.toFixed(1)}/10`, b: `${wo.avgMaxIntensity.toFixed(1)}/10` },
    {
      label: 'Digestión media (1–5)',
      a: w.avgDigestion === null ? '—' : `${w.avgDigestion.toFixed(1)} (${w.ratedDays} d)`,
      b: wo.avgDigestion === null ? '—' : `${wo.avgDigestion.toFixed(1)} (${wo.ratedDays} d)`,
    },
    { label: 'Deposiciones por día', a: w.avgStools.toFixed(1), b: wo.avgStools.toFixed(1) },
    { label: 'Días con heces blandas', a: pct(w.softStoolDayRate), b: pct(wo.softStoolDayRate) },
  ];
  return (
    <div>
      {!comparison.enough && (
        <p className="mb-3 rounded-2xl bg-mid-soft px-3 py-2 text-[13px] font-semibold text-mid">
          Datos insuficientes: se necesitan al menos 3 días con y 3 días sin {foodName.toLowerCase()} (días con comidas registradas).
        </p>
      )}
      <table className="w-full text-sm">
        <caption className="sr-only">Comparación de días con y sin {foodName}</caption>
        <thead>
          <tr className="text-left text-[12px] uppercase tracking-wide text-muted">
            <th scope="col" className="py-2 font-bold">
              Medida
            </th>
            <th scope="col" className="py-2 text-right font-bold">
              Con consumo
            </th>
            <th scope="col" className="py-2 text-right font-bold">
              Sin consumo
            </th>
          </tr>
        </thead>
        <tbody className="tabular">
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-border">
              <th scope="row" className="py-2 text-left font-medium">
                {r.label}
              </th>
              <td className="py-2 text-right font-semibold">{r.a}</td>
              <td className="py-2 text-right font-semibold">{r.b}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[12px] text-muted">Se comparan días completos. Otros alimentos y factores del día también influyen.</p>
    </div>
  );
}
