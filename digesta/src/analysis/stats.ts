/**
 * Estadísticas descriptivas para gráficos, calendario e informes.
 */
import { addDays, dayKey, dayRange, weekStart, formatShortDate } from '@/domain/dates';
import { SYMPTOMS, symptomLabel } from '@/domain/labels';
import type { DailyLog, Meal, Stool, Symptom, SymptomType } from '@/domain/types';

export type DayTone = 'good' | 'mid' | 'bad' | 'none';

export interface DayStatus {
  tone: DayTone;
  /** true si proviene de la valoración manual "¿Cómo estuvo tu digestión hoy?". */
  manual: boolean;
  /** Puntaje 1–5 (manual o estimado) o null. */
  score: number | null;
}

/**
 * Estado digestivo del día. Prioriza la valoración manual; si no existe, se
 * estima a partir de la intensidad de los síntomas y la consistencia de las
 * deposiciones (sólo como orientación visual).
 */
export function dayStatus(log: DailyLog | undefined, symptoms: Symptom[], stools: Stool[], meals: Meal[] = []): DayStatus {
  if (log?.digestion) {
    const d = log.digestion;
    return { tone: d >= 4 ? 'good' : d === 3 ? 'mid' : 'bad', manual: true, score: d };
  }
  if (!symptoms.length && !stools.length && !meals.length) return { tone: 'none', manual: false, score: null };
  const maxInt = Math.max(0, ...symptoms.map((s) => s.intensity));
  const soft = stools.filter((s) => s.bristol >= 6).length;
  const watery = stools.some((s) => s.bristol === 7);
  const hard = stools.some((s) => s.bristol <= 2);
  const feelingsBad = meals.filter((m) => m.feelingAfter === 'mal' || m.feelingAfter === 'molesto').length;
  let score = 5;
  if (maxInt >= 7 || watery || soft >= 3) score = 2;
  else if (maxInt >= 4 || soft >= 1 || hard || feelingsBad >= 2) score = 3;
  else if (maxInt >= 1 || feelingsBad === 1) score = 4;
  return { tone: score >= 4 ? 'good' : score === 3 ? 'mid' : 'bad', manual: false, score };
}

export interface DailySeriesPoint {
  day: string;
  label: string;
  stools: number;
  avgBristol: number | null;
  symptoms: number;
  maxIntensity: number;
  digestion: number | null;
  estimated: number | null;
  water: number | null;
  meals: number;
}

export function dailySeries(from: string, to: string, meals: Meal[], stools: Stool[], symptoms: Symptom[], logs: DailyLog[]): DailySeriesPoint[] {
  const byDay = <T,>(arr: T[], at: (x: T) => number) => {
    const m = new Map<string, T[]>();
    for (const x of arr) {
      const k = dayKey(at(x));
      const l = m.get(k);
      if (l) l.push(x);
      else m.set(k, [x]);
    }
    return m;
  };
  const md = byDay(meals, (m) => m.at);
  const sd = byDay(stools, (s) => s.at);
  const yd = byDay(symptoms, (s) => s.startedAt);
  const ld = new Map(logs.map((l) => [l.day, l]));
  return dayRange(from, to).map((day) => {
    const st = sd.get(day) ?? [];
    const sy = yd.get(day) ?? [];
    const ms = md.get(day) ?? [];
    const log = ld.get(day);
    const status = dayStatus(log, sy, st, ms);
    return {
      day,
      label: formatShortDate(day),
      stools: st.length,
      avgBristol: st.length ? Math.round((st.reduce((a, s) => a + s.bristol, 0) / st.length) * 10) / 10 : null,
      symptoms: sy.length,
      maxIntensity: Math.max(0, ...sy.map((s) => s.intensity)),
      digestion: log?.digestion ?? null,
      estimated: status.manual ? null : status.score,
      water: log?.water ?? null,
      meals: ms.length,
    };
  });
}

/** Media móvil simple (ignora nulos). */
export function movingAverage(values: (number | null)[], window = 7): (number | null)[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1).filter((v): v is number => v !== null);
    return slice.length ? Math.round((slice.reduce((a, b) => a + b, 0) / slice.length) * 100) / 100 : null;
  });
}

export function bristolDistribution(stools: Stool[]): { type: number; count: number; pct: number }[] {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const s of stools) counts[s.bristol - 1]++;
  const total = stools.length || 1;
  return counts.map((count, i) => ({ type: i + 1, count, pct: Math.round((count / total) * 100) }));
}

export interface WeekPoint {
  week: string;
  label: string;
  total: number;
  avgIntensity: number;
  byType: Partial<Record<SymptomType, number>>;
}

export function symptomsByWeek(from: string, to: string, symptoms: Symptom[]): WeekPoint[] {
  const weeks: WeekPoint[] = [];
  for (let w = weekStart(from); w <= to; w = addDays(w, 7)) {
    weeks.push({ week: w, label: `Sem. ${formatShortDate(w)}`, total: 0, avgIntensity: 0, byType: {} });
  }
  const idx = new Map(weeks.map((w, i) => [w.week, i]));
  const sums = new Array(weeks.length).fill(0);
  for (const s of symptoms) {
    const w = weekStart(dayKey(s.startedAt));
    const i = idx.get(w);
    if (i === undefined) continue;
    weeks[i].total++;
    sums[i] += s.intensity;
    weeks[i].byType[s.type] = (weeks[i].byType[s.type] ?? 0) + 1;
  }
  weeks.forEach((w, i) => (w.avgIntensity = w.total ? Math.round((sums[i] / w.total) * 10) / 10 : 0));
  return weeks;
}

export interface SymptomSummaryRow {
  type: SymptomType;
  label: string;
  count: number;
  avgIntensity: number;
  maxIntensity: number;
}

export function symptomSummary(symptoms: Symptom[]): SymptomSummaryRow[] {
  const map = new Map<string, { type: SymptomType; label: string; n: number; sum: number; max: number }>();
  for (const s of symptoms) {
    const label = symptomLabel(s.type, s.customName);
    const k = `${s.type}|${label}`;
    const e = map.get(k) ?? { type: s.type, label, n: 0, sum: 0, max: 0 };
    e.n++;
    e.sum += s.intensity;
    e.max = Math.max(e.max, s.intensity);
    map.set(k, e);
  }
  return [...map.values()]
    .map((e) => ({ type: e.type, label: e.label, count: e.n, avgIntensity: Math.round((e.sum / e.n) * 10) / 10, maxIntensity: e.max }))
    .sort((a, b) => b.count - a.count);
}

export function topFoods(meals: Meal[], limit = 15): { name: string; key: string; count: number }[] {
  const map = new Map<string, { name: string; key: string; count: number }>();
  for (const m of meals) {
    for (const it of m.items) {
      const e = map.get(it.key) ?? { name: it.name, key: it.key, count: 0 };
      e.count++;
      map.set(it.key, e);
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

export const SYMPTOM_TYPES_ORDER = SYMPTOMS.map((s) => s.type);
