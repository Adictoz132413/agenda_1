/**
 * Motor de análisis de patrones (100 % local, funciones puras).
 *
 * Idea general:
 *  1. Cada comida genera "exposiciones": una por alimento o ingrediente.
 *  2. Los síntomas (con intensidad ≥ umbral), las deposiciones blandas/duras y
 *     el malestar inmediato al comer son "episodios".
 *  3. Para cada alimento, episodio y ventana temporal (0–6 h, 6–24 h, 24–72 h,
 *     según el tipo de síntoma) se cuenta cuántas exposiciones fueron seguidas
 *     por el episodio y se compara con las comidas SIN ese alimento (línea base).
 *  4. Se clasifica la señal con reglas conservadoras: una sola comida nunca
 *     produce una conclusión fuerte. Se informan posibles factores de confusión.
 *
 * Todo resultado describe asociaciones observadas, nunca causalidad ni diagnóstico.
 */
import { dayKey, HOUR } from '@/domain/dates';
import { foodKey as normalizeKey } from '@/domain/foods';
import { SYMPTOMS, WINDOWS, preparationLabel, quantityLabel, type WindowKey } from '@/domain/labels';
import type { DailyLog, Meal, Preparation, QuantityLevel, Stool, Symptom, SymptomType, ToleranceStatus } from '@/domain/types';

// ───────────── Tipos públicos ─────────────

export type OutcomeKey = Exclude<SymptomType, 'otro'> | 'heces_blandas' | 'heces_duras' | 'malestar_inmediato';

export interface OutcomeDef {
  key: OutcomeKey;
  label: string;
  /** Forma corta en minúsculas para frases: "hinchazón". */
  phrase: string;
  windows: WindowKey[];
}

export const OUTCOMES: OutcomeDef[] = [
  ...SYMPTOMS.filter((s) => s.type !== 'otro').map((s) => ({
    key: s.type as OutcomeKey,
    label: s.label,
    phrase: s.label.split(' / ')[0].toLowerCase(),
    windows: s.windows,
  })),
  { key: 'heces_blandas', label: 'Deposición blanda o líquida (Bristol 6–7)', phrase: 'deposiciones blandas o líquidas', windows: ['0-6', '6-24'] },
  { key: 'heces_duras', label: 'Deposición dura (Bristol 1–2)', phrase: 'deposiciones duras', windows: ['24-72'] },
  { key: 'malestar_inmediato', label: 'Malestar inmediato al comer', phrase: 'malestar justo después de comer', windows: ['0-6'] },
];
export const outcomeDef = (k: OutcomeKey) => OUTCOMES.find((o) => o.key === k)!;

export type SignalStrength = 'repetida' | 'posible' | 'aislada' | 'sin_diferencia';
export type EvidenceLevel = 'insuficiente' | 'limitada' | 'moderada' | 'amplia';

export const STRENGTH_INFO: Record<SignalStrength, { label: string; tone: 'bad' | 'mid' | 'none' | 'good' }> = {
  repetida: { label: 'Patrón repetido', tone: 'bad' },
  posible: { label: 'Posible asociación', tone: 'mid' },
  aislada: { label: 'Observación aislada', tone: 'none' },
  sin_diferencia: { label: 'Sin diferencia clara', tone: 'good' },
};

export const EVIDENCE_INFO: Record<EvidenceLevel, { label: string; description: string }> = {
  insuficiente: { label: 'Evidencia insuficiente', description: 'Menos de 3 exposiciones observadas.' },
  limitada: { label: 'Evidencia limitada', description: 'Entre 3 y 5 exposiciones: puede cambiar con más registros.' },
  moderada: { label: 'Evidencia moderada', description: 'Entre 6 y 11 exposiciones observadas.' },
  amplia: { label: 'Más registros', description: '12 o más exposiciones; sigue siendo una observación, no un diagnóstico.' },
};

export interface Confounder {
  kind: 'alimento' | 'cantidad' | 'preparacion' | 'estres' | 'sueno' | 'alcohol' | 'otras_comidas';
  label: string;
  count: number;
  of: number;
}

export interface FoodSignal {
  foodKey: string;
  foodName: string;
  outcome: OutcomeKey;
  window: WindowKey;
  /** Exposiciones con la ventana completamente observada. */
  exposures: number;
  /** Exposiciones seguidas por el episodio dentro de la ventana. */
  followed: number;
  rate: number;
  baselineExposures: number;
  baselineFollowed: number;
  /** null si no hay suficientes comidas sin el alimento para comparar. */
  baselineRate: number | null;
  strength: SignalStrength;
  evidence: EvidenceLevel;
  /** Intensidad media de los episodios que siguieron (0–10; 0 si no aplica). */
  avgIntensity: number;
  confounders: Confounder[];
  message: string;
}

export interface GroupStat {
  label: string;
  exposures: number;
  followed: number;
}

export interface ModulationInsight {
  foodKey: string;
  foodName: string;
  kind: 'cantidad' | 'preparacion';
  outcome: OutcomeKey;
  better: GroupStat;
  worse: GroupStat;
  message: string;
}

export interface FoodProfile {
  key: string;
  name: string;
  /** Total de veces consumido (comidas distintas). */
  exposures: number;
  firstAt: number;
  lastAt: number;
  quantities: Partial<Record<QuantityLevel, number>>;
  preparations: Partial<Record<Preparation | 'sin_especificar', number>>;
  /** Señales ordenadas de más a menos relevantes (excluye "sin_diferencia" salvo que no haya otras). */
  signals: FoodSignal[];
  insights: ModulationInsight[];
  suggestion: ToleranceStatus;
  evidence: EvidenceLevel;
  summary: string;
}

export interface AnalysisInput {
  meals: Meal[];
  symptoms: Symptom[];
  stools: Stool[];
  logs: DailyLog[];
  /** Intensidad mínima (0–10) para que un síntoma cuente como episodio. */
  threshold?: number;
  now?: number;
}

export interface AnalysisResult {
  generatedAt: number;
  profiles: FoodProfile[];
  /** Señales "repetida" y "posible", ordenadas. */
  signals: FoodSignal[];
  /** Observaciones aisladas (1 episodio o muy pocas exposiciones). */
  isolated: FoodSignal[];
  insights: ModulationInsight[];
  coverage: { trackedDays: number; meals: number; symptomEpisodes: number; stools: number; firstDay?: string; lastDay?: string };
  caveats: string[];
}

// ───────────── Constantes de las reglas ─────────────

/** Mínimo de comidas sin el alimento para usar línea base. */
export const MIN_BASELINE = 3;
export const RULES = {
  repetida: { minExposures: 4, minFollowed: 3, minRate: 0.5, minLift: 0.2 },
  posible: { minExposures: 3, minFollowed: 2, minRate: 0.3, minLift: 0.1 },
};

// ───────────── Utilidades ─────────────

interface Exposure {
  mealIdx: number;
  at: number;
  key: string;
  name: string;
  quantity: QuantityLevel;
  preparation?: Preparation;
}

interface OutcomeEvent {
  at: number;
  intensity: number;
}

const QTY_RANK: Record<QuantityLevel, number> = { poca: 0, normal: 1, personalizada: 1, abundante: 2 };

export function evidenceFor(n: number): EvidenceLevel {
  if (n < 3) return 'insuficiente';
  if (n <= 5) return 'limitada';
  if (n <= 11) return 'moderada';
  return 'amplia';
}

const pct = (x: number) => `${Math.round(x * 100)} %`;

/** Primer índice con at >= t (búsqueda binaria). */
function lowerBound(arr: OutcomeEvent[], t: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].at < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Episodios dentro de [from, to). */
function eventsIn(arr: OutcomeEvent[], from: number, to: number): OutcomeEvent[] {
  const out: OutcomeEvent[] = [];
  for (let i = lowerBound(arr, from); i < arr.length && arr[i].at < to; i++) out.push(arr[i]);
  return out;
}

/** Extrae los episodios de cada tipo, ordenados por tiempo. */
export function buildOutcomeEvents(input: AnalysisInput): Map<OutcomeKey, OutcomeEvent[]> {
  const threshold = input.threshold ?? 3;
  const map = new Map<OutcomeKey, OutcomeEvent[]>();
  for (const o of OUTCOMES) map.set(o.key, []);
  for (const s of input.symptoms) {
    if (s.type === 'otro' || s.intensity < threshold) continue;
    map.get(s.type as OutcomeKey)!.push({ at: s.startedAt, intensity: s.intensity });
  }
  for (const st of input.stools) {
    if (st.bristol >= 6) map.get('heces_blandas')!.push({ at: st.at, intensity: st.bristol === 7 ? 8 : 6 });
    if (st.bristol <= 2) map.get('heces_duras')!.push({ at: st.at, intensity: st.bristol === 1 ? 8 : 6 });
  }
  for (const m of input.meals) {
    if (m.feelingAfter === 'molesto' || m.feelingAfter === 'mal') {
      map.get('malestar_inmediato')!.push({ at: m.at + 60_000, intensity: m.feelingAfter === 'mal' ? 7 : 5 });
    }
  }
  for (const arr of map.values()) arr.sort((a, b) => a.at - b.at);
  return map;
}

/** Una exposición por (comida, alimento); los ingredientes cuentan como exposición propia. */
export function buildExposures(meals: Meal[]): Exposure[] {
  const out: Exposure[] = [];
  meals.forEach((m, mealIdx) => {
    const byKey = new Map<string, Exposure>();
    const add = (key: string, name: string, quantity: QuantityLevel, preparation?: Preparation) => {
      if (!key) return;
      const prev = byKey.get(key);
      if (!prev) byKey.set(key, { mealIdx, at: m.at, key, name, quantity, preparation });
      else if (QTY_RANK[quantity] > QTY_RANK[prev.quantity]) prev.quantity = quantity;
    };
    for (const it of m.items) {
      add(it.key, it.name, it.quantity, it.preparation);
      for (const ing of it.ingredients ?? []) {
        add(normalizeKey(ing), ing, it.quantity, it.preparation);
      }
    }
    out.push(...byKey.values());
  });
  return out;
}

// ───────────── Clasificación de una señal ─────────────

export function classifySignal(n: number, k: number, baselineRate: number | null): SignalStrength {
  if (k === 0) return 'sin_diferencia';
  const rate = n ? k / n : 0;
  const lift = baselineRate === null ? rate : rate - baselineRate;
  const R = RULES.repetida;
  if (n >= R.minExposures && k >= R.minFollowed && rate >= R.minRate && lift >= R.minLift) return 'repetida';
  const P = RULES.posible;
  if (n >= P.minExposures && k >= P.minFollowed && rate >= P.minRate && lift >= P.minLift) return 'posible';
  if (n < P.minExposures || k < P.minFollowed) return 'aislada';
  return 'sin_diferencia';
}

function windowPhrase(w: WindowKey) {
  const W = WINDOWS[w];
  return `entre ${W.from} y ${W.to} horas después`;
}

const vez = (n: number) => (n === 1 ? '1 ocasión' : `${n} ocasiones`);

export function signalMessage(s: Omit<FoodSignal, 'message'>): string {
  const o = outcomeDef(s.outcome);
  const base =
    s.baselineRate !== null
      ? ` En las comidas sin ${s.foodName.toLowerCase()} ocurrió después del ${pct(s.baselineRate)} (${s.baselineFollowed} de ${s.baselineExposures}).`
      : ' Todavía no hay suficientes comidas sin este alimento para comparar.';
  const head =
    s.outcome === 'malestar_inmediato'
      ? `Consumiste ${s.foodName.toLowerCase()} en ${vez(s.exposures)}. Marcaste malestar justo después de comer en ${s.followed} de ellas.`
      : `Consumiste ${s.foodName.toLowerCase()} en ${vez(s.exposures)}. Registraste ${o.phrase} ${windowPhrase(s.window)} en ${s.followed} de ellas.`;
  const tail: Record<SignalStrength, string> = {
    repetida: ' Es un patrón que se repite y vale la pena comentarlo con un profesional, pero no confirma una intolerancia.',
    posible: ' Existe una posible asociación, pero no confirma intolerancia.',
    aislada: ' Es una observación aislada: no permite sacar conclusiones.',
    sin_diferencia: ' No se observa una diferencia clara frente a otras comidas.',
  };
  return head + base + tail[s.strength];
}

// ───────────── Motor principal ─────────────

export function analyze(input: AnalysisInput): AnalysisResult {
  const now = input.now ?? Date.now();
  const meals = [...input.meals].sort((a, b) => a.at - b.at);
  const events = buildOutcomeEvents(input);
  const exposures = buildExposures(meals);
  const logsByDay = new Map(input.logs.map((l) => [l.day, l]));

  // Alcohol del día (por comida) y factores del día
  const alcoholDays = new Set(meals.filter((m) => m.flags.includes('alcohol')).map((m) => dayKey(m.at)));

  // followedMatrix[outcome][window][mealIdx] = eventos posteriores a la comida
  const followed = new Map<string, (OutcomeEvent[] | null)[]>();
  const totals = new Map<string, { n: number; k: number }>();
  for (const o of OUTCOMES) {
    const ev = events.get(o.key)!;
    for (const w of o.windows) {
      const W = WINDOWS[w];
      const arr: (OutcomeEvent[] | null)[] = new Array(meals.length);
      let n = 0;
      let k = 0;
      meals.forEach((m, i) => {
        if (m.at + W.to * HOUR > now) {
          arr[i] = null; // ventana aún no observada
          return;
        }
        const found = eventsIn(ev, m.at + W.from * HOUR, m.at + W.to * HOUR);
        arr[i] = found;
        n++;
        if (found.length) k++;
      });
      followed.set(`${o.key}|${w}`, arr);
      totals.set(`${o.key}|${w}`, { n, k });
    }
  }

  // Agrupar exposiciones por alimento
  const byFood = new Map<string, Exposure[]>();
  for (const e of exposures) {
    const list = byFood.get(e.key);
    if (list) list.push(e);
    else byFood.set(e.key, [e]);
  }

  const mealKeys = meals.map((m) => new Set(m.itemKeys?.length ? m.itemKeys : m.items.map((i) => i.key)));

  const profiles: FoodProfile[] = [];
  const allSignals: FoodSignal[] = [];
  const isolatedAll: FoodSignal[] = [];
  const allInsights: ModulationInsight[] = [];

  for (const [key, exps] of byFood) {
    const name = exps[exps.length - 1].name;
    const quantities: FoodProfile['quantities'] = {};
    const preparations: FoodProfile['preparations'] = {};
    for (const e of exps) {
      quantities[e.quantity] = (quantities[e.quantity] ?? 0) + 1;
      const p = e.preparation ?? 'sin_especificar';
      preparations[p] = (preparations[p] ?? 0) + 1;
    }

    const signals: FoodSignal[] = [];
    const insights: ModulationInsight[] = [];

    for (const o of OUTCOMES) {
      let best: FoodSignal | null = null;
      for (const w of o.windows) {
        const arr = followed.get(`${o.key}|${w}`)!;
        const tot = totals.get(`${o.key}|${w}`)!;
        const complete = exps.filter((e) => arr[e.mealIdx] !== null);
        const n = complete.length;
        if (n === 0) continue;
        const hits = complete.filter((e) => arr[e.mealIdx]!.length > 0);
        const k = hits.length;
        const nb = tot.n - n;
        const kb = tot.k - k;
        const baselineRate = nb >= MIN_BASELINE ? kb / nb : null;
        const strength = classifySignal(n, k, baselineRate);
        const intens = hits.flatMap((e) => arr[e.mealIdx]!.map((x) => x.intensity));
        const avgIntensity = intens.length ? intens.reduce((a, b) => a + b, 0) / intens.length : 0;
        const confounders = k > 0 ? findConfounders(key, hits, meals, mealKeys, exps, logsByDay, alcoholDays, w) : [];
        const partial: Omit<FoodSignal, 'message'> = {
          foodKey: key,
          foodName: name,
          outcome: o.key,
          window: w,
          exposures: n,
          followed: k,
          rate: k / n,
          baselineExposures: nb,
          baselineFollowed: kb,
          baselineRate,
          strength,
          evidence: evidenceFor(n),
          avgIntensity,
          confounders,
        };
        const sig: FoodSignal = { ...partial, message: signalMessage(partial) };
        if (!best || strengthRank(sig) > strengthRank(best)) best = sig;

        // Modulación por cantidad o preparación (sólo con señal posible o repetida, o al menos 2 episodios)
        if (k >= 2 && n >= 4) {
          const ins = modulation(key, name, o.key, complete, arr);
          for (const i of ins) if (!insights.some((x) => x.kind === i.kind && x.outcome === i.outcome)) insights.push(i);
        }
      }
      if (best && best.followed > 0) signals.push(best);
    }

    signals.sort((a, b) => strengthRank(b) - strengthRank(a));
    const relevant = signals.filter((s) => s.strength === 'repetida' || s.strength === 'posible');
    const isolatedHere = signals.filter((s) => s.strength === 'aislada');
    // Una diferencia por cantidad o preparación sólo se informa si el propio alimento
    // muestra una señal para ese síntoma (evita atribuir efectos de alimentos acompañantes).
    const keptInsights = insights.filter((i) => relevant.some((s) => s.outcome === i.outcome));
    const n = exps.length;
    const completeN = Math.max(0, ...OUTCOMES.flatMap((o) => o.windows.map((w) => exps.filter((e) => followed.get(`${o.key}|${w}`)![e.mealIdx] !== null).length)));
    let suggestion: ToleranceStatus;
    if (completeN < 3) suggestion = 'sin_datos';
    else if (relevant.some((s) => s.strength === 'repetida')) suggestion = 'posible_mala';
    else if (relevant.length || keptInsights.length) suggestion = 'a_medias';
    else suggestion = 'tolero_bien';

    const evidence = evidenceFor(completeN);
    profiles.push({
      key,
      name,
      exposures: n,
      firstAt: exps[0].at,
      lastAt: exps[exps.length - 1].at,
      quantities,
      preparations,
      signals: [...relevant, ...isolatedHere],
      insights: keptInsights,
      suggestion,
      evidence,
      summary: profileSummary(name, n, completeN, suggestion, relevant, keptInsights),
    });
    allSignals.push(...relevant);
    allInsights.push(...keptInsights);
    isolatedAll.push(...isolatedHere);
  }

  allSignals.sort((a, b) => strengthRank(b) - strengthRank(a));
  isolatedAll.sort((a, b) => b.followed - a.followed || b.exposures - a.exposures);
  profiles.sort((a, b) => b.exposures - a.exposures || a.name.localeCompare(b.name, 'es'));

  const days = new Set<string>([
    ...meals.map((m) => dayKey(m.at)),
    ...input.stools.map((s) => dayKey(s.at)),
    ...input.symptoms.map((s) => dayKey(s.startedAt)),
  ]);
  const sortedDays = [...days].sort();
  const symptomEpisodes = input.symptoms.filter((s) => s.intensity >= (input.threshold ?? 3)).length;

  const caveats = [
    'Las asociaciones se calculan sólo con lo que registraste. Un síntoma no anotado cuenta como ausente.',
    'Cuando varias comidas caen dentro de la misma ventana, un síntoma se asocia a todas ellas.',
    'Estrés, sueño, ciclo hormonal, medicamentos, infecciones o el ejercicio también influyen en la digestión.',
    'Una asociación repetida no demuestra causa. Para confirmar una intolerancia se necesita valoración profesional.',
  ];
  if (sortedDays.length < 14) caveats.unshift(`Llevas ${sortedDays.length} día(s) con registros. Los patrones se vuelven más confiables a partir de 2 a 4 semanas.`);

  return {
    generatedAt: now,
    profiles,
    signals: allSignals,
    isolated: isolatedAll,
    insights: allInsights,
    coverage: { trackedDays: sortedDays.length, meals: meals.length, symptomEpisodes, stools: input.stools.length, firstDay: sortedDays[0], lastDay: sortedDays[sortedDays.length - 1] },
    caveats,
  };
}

function strengthRank(s: FoodSignal): number {
  const base = { repetida: 3, posible: 2, aislada: 1, sin_diferencia: 0 }[s.strength];
  return base * 1000 + s.rate * 100 + s.followed;
}

function profileSummary(name: string, n: number, completeN: number, suggestion: ToleranceStatus, relevant: FoodSignal[], insights: ModulationInsight[]): string {
  if (completeN < 3) return `Registraste ${name.toLowerCase()} ${n === 1 ? '1 vez' : `${n} veces`}. Se necesitan al menos 3 exposiciones con seguimiento para sugerir algo.`;
  if (suggestion === 'tolero_bien') return `En ${completeN} exposiciones con seguimiento no se observa una asociación consistente con molestias.`;
  if (relevant.length) return relevant[0].message;
  return insights[0]?.message ?? '';
}

function findConfounders(
  key: string,
  hits: Exposure[],
  meals: Meal[],
  mealKeys: Set<string>[],
  allExps: Exposure[],
  logsByDay: Map<string, DailyLog>,
  alcoholDays: Set<string>,
  w: WindowKey,
): Confounder[] {
  const k = hits.length;
  const out: Confounder[] = [];
  // Otros alimentos presentes en la mayoría de los episodios
  const co = new Map<string, number>();
  for (const e of hits) for (const other of mealKeys[e.mealIdx]) if (other !== key) co.set(other, (co.get(other) ?? 0) + 1);
  const nameOf = (k2: string) => {
    for (const e of allExps) if (e.key === k2) return e.name;
    for (const m of meals) for (const it of m.items) if (it.key === k2) return it.name;
    return k2;
  };
  const coList = [...co.entries()].filter(([, c]) => c >= 2 && c / k >= 0.6).sort((a, b) => b[1] - a[1]).slice(0, 3);
  for (const [k2, c] of coList) out.push({ kind: 'alimento', label: `También consumiste ${nameOf(k2).toLowerCase()}`, count: c, of: k });

  const abundant = hits.filter((e) => e.quantity === 'abundante').length;
  if (abundant >= 2 && abundant / k >= 0.6) out.push({ kind: 'cantidad', label: 'La porción fue abundante', count: abundant, of: k });
  const fried = hits.filter((e) => e.preparation === 'frito').length;
  if (fried >= 2 && fried / k >= 0.6) out.push({ kind: 'preparacion', label: 'La preparación fue frita', count: fried, of: k });

  const stress = hits.filter((e) => (logsByDay.get(dayKey(e.at))?.stress ?? 0) >= 7).length;
  if (stress >= 1) out.push({ kind: 'estres', label: 'Día con estrés alto (7 o más)', count: stress, of: k });
  const sleep = hits.filter((e) => {
    const l = logsByDay.get(dayKey(e.at));
    return l?.sleepHours !== undefined && l.sleepHours < 6;
  }).length;
  if (sleep >= 1) out.push({ kind: 'sueno', label: 'Dormiste menos de 6 horas', count: sleep, of: k });
  const alc = hits.filter((e) => alcoholDays.has(dayKey(e.at))).length;
  if (alc >= 1 && key !== 'cerveza' && key !== 'vino' && key !== 'aguardiente' && key !== 'ron') out.push({ kind: 'alcohol', label: 'Ese día hubo alcohol', count: alc, of: k });

  // Otras comidas dentro de la misma ventana
  const W = WINDOWS[w];
  const crowded = hits.filter((e) => meals.some((m, i) => i !== e.mealIdx && m.at > e.at && m.at < e.at + W.to * HOUR && !mealKeys[i].has(key))).length;
  if (crowded >= 1 && w !== '0-6') out.push({ kind: 'otras_comidas', label: 'Hubo otras comidas dentro de la ventana', count: crowded, of: k });
  return out;
}

function modulation(key: string, name: string, outcome: OutcomeKey, complete: Exposure[], arr: (OutcomeEvent[] | null)[]): ModulationInsight[] {
  const out: ModulationInsight[] = [];
  const o = outcomeDef(outcome);
  const stat = (list: Exposure[], label: string): GroupStat => ({ label, exposures: list.length, followed: list.filter((e) => arr[e.mealIdx]!.length > 0).length });
  const rate = (g: GroupStat) => (g.exposures ? g.followed / g.exposures : 0);

  // Cantidad: poca vs normal/abundante
  const small = stat(complete.filter((e) => e.quantity === 'poca'), quantityLabel('poca').toLowerCase());
  const large = stat(complete.filter((e) => e.quantity === 'normal' || e.quantity === 'abundante'), 'normal o abundante');
  if (small.exposures >= 2 && large.exposures >= 2 && rate(small) <= 0.25 && rate(large) >= 0.5 && rate(large) - rate(small) >= 0.35) {
    out.push({
      foodKey: key,
      foodName: name,
      kind: 'cantidad',
      outcome,
      better: small,
      worse: large,
      message: `Con ${name.toLowerCase()} en poca cantidad registraste ${o.phrase} en ${small.followed} de ${small.exposures} ocasiones; en cantidad normal o abundante, en ${large.followed} de ${large.exposures}. Parece tolerarse mejor en porciones pequeñas.`,
    });
  }

  // Preparación: comparar cada par de preparaciones con ≥2 exposiciones
  const preps = new Map<string, Exposure[]>();
  for (const e of complete) {
    if (!e.preparation) continue;
    const l = preps.get(e.preparation);
    if (l) l.push(e);
    else preps.set(e.preparation, [e]);
  }
  const groups = [...preps.entries()].filter(([, l]) => l.length >= 2).map(([p, l]) => stat(l, preparationLabel(p as Preparation).toLowerCase()));
  if (groups.length >= 2) {
    groups.sort((a, b) => rate(a) - rate(b));
    const better = groups[0];
    const worse = groups[groups.length - 1];
    if (rate(better) <= 0.25 && rate(worse) >= 0.5 && rate(worse) - rate(better) >= 0.35) {
      out.push({
        foodKey: key,
        foodName: name,
        kind: 'preparacion',
        outcome,
        better,
        worse,
        message: `${name} ${better.label}: ${o.phrase} en ${better.followed} de ${better.exposures}. ${name} ${worse.label}: en ${worse.followed} de ${worse.exposures}. La preparación podría influir.`,
      });
    }
  }
  return out;
}

// ───────────── Comparación de días con y sin un alimento ─────────────

export interface DayGroupStats {
  days: number;
  /** % de días con al menos un episodio de síntoma (≥ umbral). */
  symptomDayRate: number;
  /** Intensidad máxima media del día. */
  avgMaxIntensity: number;
  /** Media de la valoración de digestión (1–5) en días valorados; null si ninguno. */
  avgDigestion: number | null;
  ratedDays: number;
  avgStools: number;
  /** % de días con alguna deposición Bristol 6–7. */
  softStoolDayRate: number;
}

export interface DayComparison {
  foodKey: string;
  withFood: DayGroupStats;
  withoutFood: DayGroupStats;
  enough: boolean;
}

export function compareDays(foodKeyValue: string, input: AnalysisInput): DayComparison {
  const threshold = input.threshold ?? 3;
  const mealDays = new Map<string, Meal[]>();
  for (const m of input.meals) {
    const d = dayKey(m.at);
    const l = mealDays.get(d);
    if (l) l.push(m);
    else mealDays.set(d, [m]);
  }
  const withDays: string[] = [];
  const withoutDays: string[] = [];
  for (const [d, ms] of mealDays) {
    const has = ms.some((m) => (m.itemKeys?.length ? m.itemKeys : m.items.map((i) => i.key)).includes(foodKeyValue));
    (has ? withDays : withoutDays).push(d);
  }
  const symByDay = new Map<string, Symptom[]>();
  for (const s of input.symptoms) {
    const d = dayKey(s.startedAt);
    const l = symByDay.get(d);
    if (l) l.push(s);
    else symByDay.set(d, [s]);
  }
  const stoolByDay = new Map<string, Stool[]>();
  for (const s of input.stools) {
    const d = dayKey(s.at);
    const l = stoolByDay.get(d);
    if (l) l.push(s);
    else stoolByDay.set(d, [s]);
  }
  const logs = new Map(input.logs.map((l) => [l.day, l]));
  const stats = (days: string[]): DayGroupStats => {
    const n = days.length;
    if (!n) return { days: 0, symptomDayRate: 0, avgMaxIntensity: 0, avgDigestion: null, ratedDays: 0, avgStools: 0, softStoolDayRate: 0 };
    let symDays = 0;
    let maxSum = 0;
    let digSum = 0;
    let rated = 0;
    let stoolSum = 0;
    let softDays = 0;
    for (const d of days) {
      const ss = (symByDay.get(d) ?? []).filter((s) => s.intensity >= threshold);
      if (ss.length) symDays++;
      maxSum += Math.max(0, ...(symByDay.get(d) ?? []).map((s) => s.intensity));
      const dig = logs.get(d)?.digestion;
      if (dig) {
        digSum += dig;
        rated++;
      }
      const st = stoolByDay.get(d) ?? [];
      stoolSum += st.length;
      if (st.some((s) => s.bristol >= 6)) softDays++;
    }
    return { days: n, symptomDayRate: symDays / n, avgMaxIntensity: maxSum / n, avgDigestion: rated ? digSum / rated : null, ratedDays: rated, avgStools: stoolSum / n, softStoolDayRate: softDays / n };
  };
  const withFood = stats(withDays);
  const withoutFood = stats(withoutDays);
  return { foodKey: foodKeyValue, withFood, withoutFood, enough: withFood.days >= 3 && withoutFood.days >= 3 };
}

// ───────────── Historial de un alimento ─────────────

export interface ExposureDetail {
  mealId: string;
  at: number;
  quantity: QuantityLevel;
  customQuantity?: string;
  preparation?: Preparation;
  viaIngredientOf?: string;
  coFoods: string[];
  feelingAfter?: Meal['feelingAfter'];
  /** Síntomas iniciados entre 0 y 24 h después. */
  laterSymptoms: Symptom[];
  /** Deposiciones Bristol 6–7 en 0–24 h o 1–2 en 24–72 h. */
  laterStools: Stool[];
}

export function foodHistoryDetail(key: string, input: AnalysisInput): ExposureDetail[] {
  const out: ExposureDetail[] = [];
  const meals = [...input.meals].sort((a, b) => b.at - a.at);
  const symptoms = [...input.symptoms].sort((a, b) => a.startedAt - b.startedAt);
  for (const m of meals) {
    let found: ExposureDetail | null = null;
    for (const it of m.items) {
      const ingMatch = (it.ingredients ?? []).find((i) => normalizeKey(i) === key);
      if (it.key === key || ingMatch) {
        found = {
          mealId: m.id,
          at: m.at,
          quantity: it.quantity,
          customQuantity: it.customQuantity,
          preparation: it.preparation,
          viaIngredientOf: it.key === key ? undefined : it.name,
          coFoods: m.items.filter((x) => x !== it).map((x) => x.name),
          feelingAfter: m.feelingAfter,
          laterSymptoms: symptoms.filter((s) => s.startedAt >= m.at && s.startedAt < m.at + 24 * HOUR),
          laterStools: input.stools.filter(
            (s) => (s.bristol >= 6 && s.at >= m.at && s.at < m.at + 24 * HOUR) || (s.bristol <= 2 && s.at >= m.at + 24 * HOUR && s.at < m.at + 72 * HOUR),
          ),
        };
        break;
      }
    }
    if (found) out.push(found);
  }
  return out;
}
