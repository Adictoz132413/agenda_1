/**
 * Informe imprimible (o guardable como PDF desde el diálogo de impresión) de
 * los últimos 7, 14, 30 o 90 días, pensado para la consulta profesional.
 */
import { ArrowLeft, Printer } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { analyze, EVIDENCE_INFO, STRENGTH_INFO } from '@/analysis/engine';
import { bristolDistribution, dayStatus, symptomSummary, topFoods } from '@/analysis/stats';
import { useFoodNotes, useRangeData } from '@/analysis/useAnalysis';
import { updateSettings } from '@/db/repo';
import { patternAlerts, sortAlerts, stoolAlerts, symptomAlerts, ALERT_LEVEL_INFO, type MedicalAlert } from '@/domain/alerts';
import { addDays, dayKey, formatDateTime, formatLongDate, formatShortDate, todayKey } from '@/domain/dates';
import { BRISTOL, TOLERANCE } from '@/domain/labels';
import { getMode } from '@/db/db';
import { useSettings } from '@/lib/hooks';
import { navigate } from '@/lib/router';
import { Button, Segmented, TextArea, cx, errorMessage, toneBg, useToast } from '@/components/ui';

const PERIODS = [7, 14, 30, 90];

const QUESTIONS = [
  '¿Los patrones observados justifican algún estudio o prueba específica?',
  '¿Debería probar cambios en la cantidad o la preparación antes de retirar algún alimento?',
  '¿Alguno de mis síntomas o cambios en las deposiciones requiere seguimiento?',
  '¿Mis suplementos, medicamentos o el entrenamiento podrían estar influyendo?',
  '¿Cómo puedo asegurar una alimentación completa si reduzco algún alimento?',
];

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)} %` : '—');
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const fmt1 = (n: number | null, unit = '') => (n === null ? '—' : `${(Math.round(n * 10) / 10).toLocaleString('es-CO')}${unit}`);

export function ReportScreen({ days }: { days: number }) {
  const period = PERIODS.includes(days) ? days : 30;
  const to = todayKey();
  const from = addDays(to, -(period - 1));
  const data = useRangeData(from, to);
  const settings = useSettings();
  const notes = useFoodNotes();
  const toast = useToast();
  const [consult, setConsult] = useState(settings.consultNotes);
  const [generatedAt] = useState(() => Date.now());

  useEffect(() => setConsult(settings.consultNotes), [settings.consultNotes]);

  // Forzar colores claros al imprimir aunque la app esté en modo oscuro.
  useEffect(() => {
    let wasDark = false;
    const before = () => {
      wasDark = document.documentElement.classList.contains('dark');
      document.documentElement.classList.remove('dark');
    };
    const after = () => {
      if (wasDark) document.documentElement.classList.add('dark');
    };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);

  const r = useMemo(() => {
    if (!data) return null;
    const { meals, stools, symptoms, logs } = data;
    const tracked = new Set([...meals.map((m) => dayKey(m.at)), ...stools.map((s) => dayKey(s.at)), ...symptoms.map((s) => dayKey(s.startedAt)), ...logs.map((l) => l.day)]);
    const logMap = new Map(logs.map((l) => [l.day, l]));
    const tones = { good: 0, mid: 0, bad: 0, manual: 0 };
    for (const d of tracked) {
      const st = dayStatus(
        logMap.get(d),
        symptoms.filter((s) => dayKey(s.startedAt) === d),
        stools.filter((s) => dayKey(s.at) === d),
        meals.filter((m) => dayKey(m.at) === d),
      );
      if (st.tone !== 'none') tones[st.tone]++;
      if (st.manual) tones.manual++;
    }
    const analysis = analyze({ meals, stools, symptoms, logs, threshold: settings.analysisThreshold, now: generatedAt });
    const alerts: MedicalAlert[] = sortAlerts([...stools.flatMap(stoolAlerts), ...symptoms.flatMap((s) => symptomAlerts(s, generatedAt)), ...patternAlerts(stools, generatedAt)]);
    return {
      tracked: tracked.size,
      meals,
      stools,
      symptoms,
      logs,
      tones,
      bristol: bristolDistribution(stools),
      avgBristol: avg(stools.map((s) => s.bristol)),
      symptomRows: symptomSummary(symptoms),
      foods: topFoods(meals, 15),
      analysis,
      alerts,
      stoolDetail: {
        urgency: stools.filter((s) => s.urgency >= 2).length,
        effort: stools.filter((s) => s.effort >= 2).length,
        pain: stools.filter((s) => s.pain.before || s.pain.during || s.pain.after).length,
        incomplete: stools.filter((s) => s.incomplete).length,
        mucus: stools.filter((s) => s.mucus).length,
        blood: stools.filter((s) => s.blood !== 'no').length,
        black: stools.filter((s) => s.color === 'negro').length,
      },
      factors: {
        stress: avg(logs.flatMap((l) => (l.stress !== undefined ? [l.stress] : []))),
        sleep: avg(logs.flatMap((l) => (l.sleepHours !== undefined ? [l.sleepHours] : []))),
        exercise: logs.filter((l) => l.exercise).length,
        water: avg(logs.flatMap((l) => (l.water !== undefined ? [l.water] : []))),
        supplements: [...new Set(meals.flatMap((m) => m.supplements))],
      },
    };
  }, [data, settings.analysisThreshold, generatedAt]);

  const tolerance = useMemo(() => {
    if (!r || !notes) return [];
    const rows = r.analysis.profiles.slice(0, 30).map((p) => ({ key: p.key, name: p.name, exposures: p.exposures, auto: p.suggestion, manual: notes.get(p.key)?.manualStatus, note: notes.get(p.key)?.note }));
    for (const n of notes.values()) {
      if ((n.manualStatus || n.note) && !rows.some((x) => x.key === n.key)) rows.push({ key: n.key, name: n.name, exposures: 0, auto: 'sin_datos', manual: n.manualStatus, note: n.note });
    }
    return rows;
  }, [r, notes]);

  const saveConsult = async () => {
    if (consult === settings.consultNotes) return;
    try {
      await updateSettings({ consultNotes: consult });
      toast('Notas guardadas');
    } catch (e) {
      toast(errorMessage(e), { tone: 'error' });
    }
  };

  return (
    <div className="pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="no-print sticky top-0 z-20 -mx-4 mb-4 flex flex-col gap-2 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/calendario')}>
            <ArrowLeft size={18} /> Volver
          </Button>
          <Button size="sm" onClick={() => window.print()} disabled={!r}>
            <Printer size={16} /> Imprimir / Guardar PDF
          </Button>
        </div>
        <Segmented label="Periodo del informe" value={period} onChange={(v) => navigate(`/informe?dias=${v}`, { replace: true })} options={PERIODS.map((p) => ({ value: p, label: `${p} días` }))} />
        <p className="text-xs text-muted">En el diálogo de impresión elige «Guardar como PDF» para obtener el archivo.</p>
      </div>

      <article className="mx-auto max-w-[800px] text-[14px] leading-relaxed">
        <header className="print-avoid border-b-2 border-text pb-3">
          <h1 className="text-2xl font-extrabold tracking-tight">DIGESTA — Informe digestivo</h1>
          <p className="text-sm">
            Periodo: <strong>{formatLongDate(from, true)}</strong> a <strong>{formatLongDate(to, true)}</strong> ({period} días)
          </p>
          <p className="text-xs text-muted">Generado el {formatDateTime(generatedAt)}</p>
          {getMode() === 'demo' && <p className="mt-1 text-xs font-bold text-mid">DATOS DE DEMOSTRACIÓN — no corresponden a una persona real.</p>}
          <p className="mt-2 rounded-lg bg-surface-2 p-2 text-xs">
            Diario de seguimiento personal; no constituye diagnóstico. Las asociaciones descritas son observaciones de los registros de la persona y no establecen causalidad ni intolerancias confirmadas.
          </p>
        </header>

        {!r ? (
          <p className="py-10 text-center text-muted">Preparando informe…</p>
        ) : (
          <>
            <Section title="Resumen">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Días con registro" value={`${r.tracked} de ${period}`} />
                <Stat label="Comidas" value={String(r.meals.length)} />
                <Stat label="Deposiciones" value={`${r.stools.length}`} sub={`${fmt1(r.stools.length / period)} por día`} />
                <Stat label="Bristol medio" value={fmt1(r.avgBristol)} />
                <Stat label="Síntomas registrados" value={String(r.symptoms.length)} />
                <Stat label="Digestión buena" value={pct(r.tones.good, r.tracked)} />
                <Stat label="Digestión regular" value={pct(r.tones.mid, r.tracked)} />
                <Stat label="Digestión mala" value={pct(r.tones.bad, r.tracked)} />
              </div>
              <p className="mt-2 text-xs text-muted">
                Valoración manual en {r.tones.manual} de {r.tracked} días; el resto se estima a partir de síntomas y deposiciones.
              </p>
            </Section>

            <Section title="Distribución de la escala de Bristol">
              {r.stools.length ? (
                <div className="space-y-1.5">
                  {r.bristol.map((b) => (
                    <div key={b.type} className="flex items-center gap-2 text-sm">
                      <span className="w-16 shrink-0 font-semibold">Tipo {b.type}</span>
                      <div className="h-4 flex-1 overflow-hidden rounded bg-surface-2" aria-hidden>
                        <div className={cx('h-full rounded', b.type <= 2 ? 'bg-mid' : b.type <= 4 ? 'bg-good' : b.type === 5 ? 'bg-mid' : 'bg-bad')} style={{ width: `${b.pct}%`, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }} />
                      </div>
                      <span className="tabular w-20 shrink-0 text-right">
                        {b.count} ({b.pct} %)
                      </span>
                    </div>
                  ))}
                  <p className="pt-1 text-xs text-muted">{BRISTOL.map((b) => `${b.type}: ${b.description.split('.')[0].toLowerCase()}`).join(' · ')}</p>
                </div>
              ) : (
                <Empty>No hay deposiciones registradas en este periodo.</Empty>
              )}
            </Section>

            <Section title="Detalle de deposiciones">
              {r.stools.length ? (
                <Table
                  head={['Característica', 'Veces', '% de deposiciones']}
                  rows={[
                    ['Urgencia moderada o alta', r.stoolDetail.urgency],
                    ['Esfuerzo moderado o alto', r.stoolDetail.effort],
                    ['Dolor (antes, durante o después)', r.stoolDetail.pain],
                    ['Sensación de evacuación incompleta', r.stoolDetail.incomplete],
                    ['Presencia de moco', r.stoolDetail.mucus],
                    ['Sangre observada', r.stoolDetail.blood],
                    ['Heces negras', r.stoolDetail.black],
                  ].map(([l, n]) => [String(l), String(n), pct(Number(n), r.stools.length)])}
                />
              ) : (
                <Empty>Sin datos.</Empty>
              )}
            </Section>

            <Section title="Síntomas">
              {r.symptomRows.length ? (
                <Table head={['Síntoma', 'Veces', 'Intensidad media', 'Máxima']} rows={r.symptomRows.map((s) => [s.label, String(s.count), `${fmt1(s.avgIntensity)}/10`, `${s.maxIntensity}/10`])} />
              ) : (
                <Empty>No se registraron síntomas en este periodo.</Empty>
              )}
            </Section>

            <Section title="Alimentos más consumidos">
              {r.foods.length ? (
                <p>
                  {r.foods.map((f, i) => (
                    <span key={f.key}>
                      {f.name} <span className="text-muted">({f.count})</span>
                      {i < r.foods.length - 1 ? ' · ' : ''}
                    </span>
                  ))}
                </p>
              ) : (
                <Empty>No hay comidas registradas en este periodo.</Empty>
              )}
              {r.factors.supplements.length > 0 && <p className="mt-2 text-sm">Suplementos registrados: {r.factors.supplements.join(', ')}.</p>}
            </Section>

            <Section title="Patrones observados">
              <p className="mb-2 text-xs text-muted">
                Asociaciones entre alimentos y síntomas registrados después, comparadas con las comidas sin ese alimento. No son diagnósticos ni demuestran causa. Umbral de síntoma: intensidad {settings.analysisThreshold}/10 o más.
              </p>
              {r.analysis.signals.length || r.analysis.insights.length ? (
                <ul className="space-y-2">
                  {r.analysis.signals.slice(0, 12).map((s) => (
                    <li key={`${s.foodKey}-${s.outcome}`} className="print-avoid rounded-lg border border-border p-2.5">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-bold', toneBg[STRENGTH_INFO[s.strength].tone])}>{STRENGTH_INFO[s.strength].label}</span>
                        <span className="text-xs text-muted">
                          {s.followed} de {s.exposures} exposiciones · {EVIDENCE_INFO[s.evidence].label}
                        </span>
                      </div>
                      <p className="text-sm">{s.message}</p>
                      {s.confounders.length > 0 && <p className="mt-1 text-xs text-muted">Posibles factores de confusión: {s.confounders.map((c) => `${c.label.toLowerCase()} (${c.count} de ${c.of})`).join('; ')}.</p>}
                    </li>
                  ))}
                  {r.analysis.insights.slice(0, 6).map((i) => (
                    <li key={`${i.foodKey}-${i.kind}-${i.outcome}`} className="print-avoid rounded-lg border border-border p-2.5 text-sm">
                      <span className="mr-2 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-bold text-primary">{i.kind === 'cantidad' ? 'Según la cantidad' : 'Según la preparación'}</span>
                      {i.message}
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>No se detectaron asociaciones repetidas con los registros de este periodo.</Empty>
              )}
              <ul className="mt-2 list-disc pl-5 text-xs text-muted">
                {r.analysis.caveats.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </Section>

            <Section title="Señales de alarma registradas">
              {r.alerts.length ? (
                <ul className="space-y-1.5">
                  {r.alerts.map((a) => (
                    <li key={a.id} className="text-sm">
                      <strong>{formatShortDate(a.at)}</strong> — {a.title} <span className="text-xs text-muted">({ALERT_LEVEL_INFO[a.level].label.toLowerCase()})</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>No se registraron señales de alarma en este periodo.</Empty>
              )}
            </Section>

            <Section title="Factores que pueden influir">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Estrés medio" value={fmt1(r.factors.stress, '/10')} />
                <Stat label="Sueño medio" value={fmt1(r.factors.sleep, ' h')} />
                <Stat label="Días con ejercicio" value={String(r.factors.exercise)} />
                <Stat label="Agua media" value={fmt1(r.factors.water, ' vasos')} />
              </div>
            </Section>

            <Section title="Mi tolerancia alimentaria">
              {tolerance.length ? (
                <Table
                  head={['Alimento', 'Veces', 'Mi clasificación', 'Sugerencia automática']}
                  rows={tolerance.map((t) => [t.note ? `${t.name} — ${t.note}` : t.name, String(t.exposures), t.manual ? TOLERANCE[t.manual].label : '—', TOLERANCE[t.auto].label])}
                />
              ) : (
                <Empty>Sin alimentos registrados.</Empty>
              )}
              <p className="mt-1 text-xs text-muted">«Posible mala tolerancia» indica molestias repetidas tras el consumo; no equivale a una intolerancia confirmada.</p>
            </Section>

            <Section title="Notas para la consulta">
              <TextArea
                aria-label="Notas para la consulta con el profesional"
                className="no-print min-h-28"
                value={consult}
                maxLength={10000}
                placeholder="Dudas, cambios que notaste, medicamentos, antecedentes…"
                onChange={(e) => setConsult(e.target.value)}
                onBlur={saveConsult}
              />
              <p className="print-only whitespace-pre-wrap">{consult || '—'}</p>
              <p className="mt-3 font-semibold">Preguntas sugeridas para el gastroenterólogo o nutricionista</p>
              <ul className="list-disc pl-5 text-sm">
                {QUESTIONS.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </Section>

            <footer className="mt-8 border-t border-border pt-2 text-[11px] text-muted">
              Generado localmente con DIGESTA — Mi Diario Digestivo. Ningún dato fue enviado a servidores externos.
            </footer>
          </>
        )}
      </article>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="print-avoid mb-2 border-b border-border pb-1 text-base font-extrabold">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="print-avoid rounded-xl border border-border p-2.5">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="tabular text-lg font-extrabold">{value}</p>
      {sub && <p className="text-[11px] text-muted">{sub}</p>}
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={h} className={cx('border-b border-border py-1.5 pr-2 text-left text-xs font-bold text-muted', i > 0 && 'text-right')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="print-avoid">
              {r.map((c, j) => (
                <td key={j} className={cx('border-b border-border py-1.5 pr-2', j > 0 && 'tabular text-right')}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}
