/**
 * Gráficos interactivos (recharts) de deposiciones, Bristol, síntomas y
 * evolución digestiva. Cada gráfico tiene título, resumen accesible,
 * tooltip en español y una vista de tabla alternativa.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { bristolDistribution, dailySeries, movingAverage, symptomsByWeek } from '@/analysis/stats';
import { formatShortDate } from '@/domain/dates';
import { DIGESTION, SYMPTOMS, bristolTone, symptomLabel } from '@/domain/labels';
import type { DailyLog, Meal, Stool, Symptom, SymptomType } from '@/domain/types';
import { Card, cx } from '@/components/ui';

// Paleta categórica validada (orden fijo; azul, naranja, aguamarina, violeta, magenta) + gris para "Otros".
const CAT_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#6250d6', '#e87ba4'];
const CAT_DARK = ['#3987e5', '#d95926', '#199e70', '#9085e9', '#d55181'];
const OTHER = 'var(--none)';
const TONE_VAR = { good: 'var(--good)', mid: 'var(--mid)', bad: 'var(--bad)' } as const;

function useIsDark(): boolean {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

/** Texto de leyenda en tinta neutra (el color lo lleva el ícono, no el texto). */
const legendText = (value: unknown) => <span style={{ color: 'var(--muted)' }}>{String(value)}</span>;

const axisTick = { fill: 'var(--muted)', fontSize: 11 };
const axisProps = { tick: axisTick, tickLine: false, axisLine: { stroke: 'var(--border)' } } as const;

interface TipEntry {
  name?: string | number;
  value?: unknown;
  color?: string;
  dataKey?: unknown;
}

/** Contenido del tooltip con los colores del tema. */
function ChartTooltip({ active, payload, label, format, extra }: { active?: boolean; payload?: ReadonlyArray<TipEntry>; label?: unknown; format?: (v: number, name: string) => string; extra?: (label: unknown) => ReactNode }) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => p.value !== null && p.value !== undefined);
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 text-[13px] shadow-card">
      <p className="mb-1 font-bold">{String(label ?? '')}</p>
      {rows.map((p, i) => (
        <p key={i} className="flex items-center gap-2">
          <span className="inline-block size-2.5 rounded-sm" style={{ background: p.color }} aria-hidden />
          <span className="text-muted">{String(p.name ?? '')}:</span>
          <span className="tabular font-semibold">{format ? format(Number(p.value), String(p.name ?? '')) : String(p.value)}</span>
        </p>
      ))}
      {extra?.(label)}
    </div>
  );
}

/** Contenedor accesible con alternancia gráfico / tabla. */
function ChartFigure({ title, summary, children, table, footer }: { title: string; summary: string; children: ReactNode; table: ReactNode; footer?: ReactNode }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <Card className="mb-3">
      <figure aria-label={`${title}. ${summary}`} className="m-0">
        <div className="mb-1 flex items-start justify-between gap-2">
          <h3 className="font-extrabold">{title}</h3>
          <button type="button" onClick={() => setAsTable((t) => !t)} aria-pressed={asTable} className="shrink-0 rounded-lg px-2 py-1 text-[13px] font-semibold text-primary hover:bg-primary-soft">
            {asTable ? 'Ver gráfico' : 'Ver tabla'}
          </button>
        </div>
        <figcaption className="mb-3 text-[13px] text-muted">{summary}</figcaption>
        {asTable ? (
          <div className="max-h-72 overflow-auto">{table}</div>
        ) : (
          <>
            <div className="h-[220px] w-full">{children}</div>
            {footer}
          </>
        )}
      </figure>
    </Card>
  );
}

function SimpleTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="tabular w-full text-[13px]">
      <thead className="sticky top-0 bg-surface">
        <tr>
          {head.map((h, i) => (
            <th key={h} scope="col" className={cx('py-1.5 font-bold text-muted', i ? 'text-right' : 'text-left')}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-border">
            {r.map((c, j) => (
              <td key={j} className={cx('py-1.5', j ? 'text-right font-semibold' : '')}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export interface ChartsProps {
  from: string;
  to: string;
  meals: Meal[];
  stools: Stool[];
  symptoms: Symptom[];
  logs: DailyLog[];
}

export function PatternCharts({ from, to, meals, stools, symptoms, logs }: ChartsProps) {
  const isDark = useIsDark();
  const cat = isDark ? CAT_DARK : CAT_LIGHT;
  const series = useMemo(() => dailySeries(from, to, meals, stools, symptoms, logs), [from, to, meals, stools, symptoms, logs]);
  const nDays = series.length;

  // 1) Deposiciones por día
  const totalStools = stools.length;
  const avgStools = nDays ? totalStools / nDays : 0;
  const daysWithout = series.filter((p) => p.stools === 0).length;

  // 2) Bristol
  const bristol = useMemo(() => bristolDistribution(stools).map((b) => ({ ...b, label: `Tipo ${b.type}` })), [stools]);
  const topBristol = [...bristol].sort((a, b) => b.count - a.count)[0];
  const idealPct = totalStools ? Math.round(((bristol[2].count + bristol[3].count) / totalStools) * 100) : 0;

  // 3) Síntomas por semana: 5 tipos más frecuentes + Otros
  const weeks = useMemo(() => symptomsByWeek(from, to, symptoms), [from, to, symptoms]);
  const topTypes = useMemo(() => {
    const counts = new Map<SymptomType, number>();
    for (const s of symptoms) counts.set(s.type, (counts.get(s.type) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || SYMPTOMS.findIndex((x) => x.type === a[0]) - SYMPTOMS.findIndex((x) => x.type === b[0]))
      .slice(0, 5)
      .map(([t]) => t);
  }, [symptoms]);
  // Color fijo por tipo de síntoma (sigue a la entidad, no al ranking).
  // Evitar que dos tipos visibles compartan color: asignar en orden de catálogo con saltos.
  const typeColors = useMemo(() => {
    const used = new Set<string>();
    const m = new Map<SymptomType, string>();
    const ordered = [...topTypes].sort((a, b) => SYMPTOMS.findIndex((x) => x.type === a) - SYMPTOMS.findIndex((x) => x.type === b));
    for (const t of ordered) {
      let c = cat[SYMPTOMS.findIndex((x) => x.type === t) % cat.length];
      if (used.has(c)) c = cat.find((x) => !used.has(x)) ?? c;
      used.add(c);
      m.set(t, c);
    }
    return m;
  }, [topTypes, cat]);
  const weekData = weeks.map((w) => {
    const row: Record<string, string | number> = { label: w.label, total: w.total, avgIntensity: w.avgIntensity };
    let others = 0;
    for (const [t, n] of Object.entries(w.byType) as [SymptomType, number][]) {
      if (topTypes.includes(t)) row[t] = n;
      else others += n;
    }
    row.otros = others;
    return row;
  });
  const hasOthers = weekData.some((r) => Number(r.otros) > 0);
  const totalSym = symptoms.length;
  const avgIntensityAll = totalSym ? symptoms.reduce((a, s) => a + s.intensity, 0) / totalSym : 0;

  // 4) Evolución digestiva
  const evo = useMemo(() => {
    const combined = series.map((p) => p.digestion ?? p.estimated);
    const ma = movingAverage(combined, 7);
    return series.map((p, i) => ({ label: p.label, digestion: p.digestion, estimated: p.estimated, ma: ma[i] }));
  }, [series]);
  const rated = series.filter((p) => p.digestion !== null);
  const avgRated = rated.length ? rated.reduce((a, p) => a + (p.digestion ?? 0), 0) / rated.length : null;
  const digLabel = (v: number) => DIGESTION.find((d) => d.value === Math.round(v))?.label ?? String(v);

  const xTicks = { ...axisProps, interval: 'preserveStartEnd' as const, minTickGap: 24 };

  return (
    <div>
      <ChartFigure
        title="Frecuencia de deposiciones"
        summary={totalStools ? `${totalStools} deposiciones en ${nDays} días: ${avgStools.toFixed(1)} por día en promedio. ${daysWithout} día(s) sin deposición registrada.` : 'Sin deposiciones registradas en este periodo.'}
        table={<SimpleTable head={['Día', 'Deposiciones', 'Bristol medio']} rows={series.map((p) => [p.label, p.stools, p.avgBristol ?? '—'])} />}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barCategoryGap={nDays > 40 ? 1 : 3}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
            <XAxis dataKey="label" {...xTicks} />
            <YAxis allowDecimals={false} {...axisProps} axisLine={false} width={48} />
            <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={(p) => <ChartTooltip active={p.active} payload={p.payload} label={p.label} />} />
            <Bar dataKey="stools" name="Deposiciones" fill={cat[0]} radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </ChartFigure>

      <ChartFigure
        title="Distribución en la escala de Bristol"
        summary={totalStools ? `El tipo más frecuente fue el ${topBristol.type} (${topBristol.pct} %). El ${idealPct} % estuvo en los tipos 3–4, considerados ideales.` : 'Sin deposiciones registradas en este periodo.'}
        table={<SimpleTable head={['Tipo', 'Veces', '%']} rows={bristol.map((b) => [b.label, b.count, `${b.pct} %`])} />}
        footer={
        <div className="mt-2 flex flex-wrap justify-center gap-3 text-[12px] text-muted">
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-sm bg-good" /> Ideal (3–4)
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-sm bg-mid" /> Algo dura o blanda (2, 5)
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-sm bg-bad" /> Dura o muy blanda (1, 6, 7)
            </span>
          </div>
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bristol} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barCategoryGap={6}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="type" {...axisProps} tickFormatter={(v: number) => `T${v}`} />
            <YAxis allowDecimals={false} {...axisProps} axisLine={false} width={48} />
            <Tooltip
              cursor={{ fill: 'var(--surface-2)' }}
              content={(p) => <ChartTooltip active={p.active} payload={p.payload} label={`Bristol tipo ${String(p.label ?? '')}`} format={(v) => `${v} (${totalStools ? Math.round((v / totalStools) * 100) : 0} %)`} />}
            />
            <Bar dataKey="count" name="Deposiciones" radius={[4, 4, 0, 0]} maxBarSize={44}>
              {bristol.map((b) => (
                <Cell key={b.type} fill={TONE_VAR[bristolTone(b.type as 1 | 2 | 3 | 4 | 5 | 6 | 7)]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartFigure>

      <ChartFigure
        title="Síntomas por semana"
        summary={totalSym ? `${totalSym} síntomas registrados, intensidad media ${avgIntensityAll.toFixed(1)}/10. Más frecuente: ${symptomLabel(topTypes[0])}.` : 'Sin síntomas registrados en este periodo.'}
        table={
          <SimpleTable
            head={['Semana', 'Síntomas', 'Intensidad media', ...topTypes.map((t) => symptomLabel(t)), ...(hasOthers ? ['Otros'] : [])]}
            rows={weekData.map((r) => [String(r.label), Number(r.total), Number(r.total) ? Number(r.avgIntensity).toFixed(1) : '—', ...topTypes.map((t) => Number(r[t] ?? 0)), ...(hasOthers ? [Number(r.otros)] : [])])}
          />
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weekData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barCategoryGap={weekData.length > 8 ? 4 : 10}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="label" {...xTicks} tickFormatter={(v: string) => v.replace('Sem. ', '')} />
            <YAxis allowDecimals={false} {...axisProps} axisLine={false} width={48} />
            <Tooltip
              cursor={{ fill: 'var(--surface-2)' }}
              content={(p) => (
                <ChartTooltip
                  active={p.active}
                  payload={p.payload}
                  label={p.label}
                  extra={(l) => {
                    const w = weekData.find((r) => r.label === l);
                    return w && Number(w.total) ? <p className="mt-1 border-t border-border pt-1 text-muted">Intensidad media: <strong className="text-text">{Number(w.avgIntensity).toFixed(1)}/10</strong></p> : null;
                  }}
                />
              )}
            />
            <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} formatter={legendText} />
            {topTypes.map((t) => (
              <Bar key={t} dataKey={t} stackId="s" name={symptomLabel(t)} fill={typeColors.get(t)} stroke="var(--surface)" strokeWidth={1} maxBarSize={36} />
            ))}
            {hasOthers && <Bar dataKey="otros" stackId="s" name="Otros" fill={OTHER} stroke="var(--surface)" strokeWidth={1} maxBarSize={36} />}
          </BarChart>
        </ResponsiveContainer>
      </ChartFigure>

      <ChartFigure
        title="Evolución digestiva"
        summary={
          avgRated !== null
            ? `Valoraste ${rated.length} de ${nDays} días; promedio ${avgRated.toFixed(1)} (${digLabel(avgRated)}). La línea punteada estima los días sin valoración a partir de síntomas y deposiciones.`
            : 'Aún no has valorado tu digestión en este periodo. La línea punteada es una estimación basada en síntomas y deposiciones.'
        }
        table={<SimpleTable head={['Día', 'Tu valoración', 'Estimación', 'Media 7 días']} rows={evo.map((p) => [p.label, p.digestion ? digLabel(p.digestion) : '—', p.estimated ?? '—', p.ma ?? '—'])} />}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={evo} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="label" {...xTicks} />
            <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} {...axisProps} axisLine={false} width={64} tickFormatter={(v: number) => digLabel(v)} />
            <Tooltip cursor={{ stroke: 'var(--muted)', strokeDasharray: '3 3' }} content={(p) => <ChartTooltip active={p.active} payload={p.payload} label={p.label} format={(v) => `${Number.isInteger(v) ? digLabel(v) : v.toFixed(1)}`} />} />
            <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} formatter={legendText} />
            <Line type="linear" dataKey="digestion" name="Tu valoración" stroke={cat[0]} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: cat[0] }} activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }} connectNulls={false} isAnimationActive={false} />
            <Line type="linear" dataKey="estimated" name="Estimación" stroke="var(--none)" strokeWidth={2} strokeDasharray="4 4" dot={false} connectNulls={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="ma" name="Media 7 días" stroke="var(--text)" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartFigure>
      <p className="px-1 text-[12px] text-muted">Periodo: {formatShortDate(from, true)} – {formatShortDate(to, true)}.</p>
    </div>
  );
}
