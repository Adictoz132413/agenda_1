import { describe, expect, it } from 'vitest';
import { analyze, classifySignal, compareDays, evidenceFor, foodHistoryDetail, type AnalysisInput } from '@/analysis/engine';
import { dayStatus, bristolDistribution, movingAverage } from '@/analysis/stats';
import { stoolAlerts, symptomAlerts, patternAlerts } from '@/domain/alerts';
import { foodKey } from '@/domain/foods';
import { keysOfItems } from '@/db/repo';
import type { Meal, MealItem, QuantityLevel, Stool, Symptom, Preparation } from '@/domain/types';

const H = 3600_000;
const D = 24 * H;
const T0 = new Date(2026, 8, 1, 0, 0).getTime();
const NOW = T0 + 120 * D;
let id = 0;

function meal(at: number, foods: (string | [string, QuantityLevel, Preparation?] | MealItem)[], extra: Partial<Meal> = {}): Meal {
  const items: MealItem[] = foods.map((f) => {
    if (typeof f === 'string') return { name: f, key: foodKey(f), quantity: 'normal' };
    if (Array.isArray(f)) return { name: f[0], key: foodKey(f[0]), quantity: f[1], preparation: f[2] };
    return f;
  });
  return { id: `m${id++}`, at, mealType: 'almuerzo', items, itemKeys: keysOfItems(items), flags: [], supplements: [], createdAt: at, updatedAt: at, ...extra };
}
function sym(type: Symptom['type'], at: number, intensity = 5): Symptom {
  return { id: `s${id++}`, type, intensity, startedAt: at, durationMin: 60, createdAt: at, updatedAt: at };
}
function stool(at: number, bristol: Stool['bristol'], extra: Partial<Stool> = {}): Stool {
  return { id: `b${id++}`, at, bristol, color: 'marron', amount: 'normal', urgency: 0, effort: 0, pain: { before: false, during: false, after: false }, incomplete: false, mucus: false, blood: 'no', createdAt: at, updatedAt: at, ...extra };
}
const input = (meals: Meal[], symptoms: Symptom[] = [], stools: Stool[] = []): AnalysisInput => ({ meals, symptoms, stools, logs: [], threshold: 3, now: NOW });

describe('reglas de clasificación', () => {
  it('una sola comida nunca da conclusión fuerte', () => {
    expect(classifySignal(1, 1, 0)).toBe('aislada');
    expect(classifySignal(2, 2, 0)).toBe('aislada');
  });
  it('patrón repetido con suficiente evidencia y diferencia frente a la línea base', () => {
    expect(classifySignal(8, 5, 0.1)).toBe('repetida');
    expect(classifySignal(8, 5, 0.6)).toBe('sin_diferencia');
    expect(classifySignal(6, 2, 0.05)).toBe('posible');
  });
  it('niveles de evidencia', () => {
    expect(evidenceFor(2)).toBe('insuficiente');
    expect(evidenceFor(4)).toBe('limitada');
    expect(evidenceFor(8)).toBe('moderada');
    expect(evidenceFor(20)).toBe('amplia');
  });
});

describe('motor de análisis', () => {
  it('detecta leche → hinchazón (ejemplo del enunciado: 8 exposiciones, 5 episodios)', () => {
    const meals: Meal[] = [];
    const symptoms: Symptom[] = [];
    for (let d = 0; d < 20; d++) {
      const t = T0 + d * D + 12 * H;
      if (d < 8) {
        meals.push(meal(t, ['Leche', 'Pan']));
        if (d < 5) symptoms.push(sym('hinchazon', t + 2 * H, 6));
      } else {
        meals.push(meal(t, ['Arroz', 'Pollo']));
      }
      if (d === 15) symptoms.push(sym('hinchazon', t + 2 * H, 4));
    }
    const r = analyze(input(meals, symptoms));
    const leche = r.profiles.find((p) => p.key === 'leche')!;
    const s = leche.signals.find((x) => x.outcome === 'hinchazon')!;
    expect(s.exposures).toBe(8);
    expect(s.followed).toBe(5);
    expect(s.window).toBe('0-6');
    expect(s.strength).toBe('repetida');
    expect(s.message).toContain('Consumiste leche en 8 ocasiones');
    expect(s.message).toContain('en 5 de ellas');
    expect(s.message).toMatch(/no confirma una intolerancia|no confirma intolerancia/);
    expect(leche.suggestion).toBe('posible_mala');
    // El pan aparece siempre con la leche: se reporta como factor de confusión
    expect(s.confounders.some((c) => c.kind === 'alimento' && c.label.includes('pan'))).toBe(true);
    // El arroz no tiene señal relevante
    const arroz = r.profiles.find((p) => p.key === 'arroz')!;
    expect(arroz.suggestion).toBe('tolero_bien');
  });

  it('respeta las ventanas: estreñimiento se busca en 24–72 h, no en 0–6 h', () => {
    const meals: Meal[] = [];
    const symptoms: Symptom[] = [];
    for (let d = 0; d < 10; d++) {
      const t = T0 + d * 4 * D + 12 * H;
      meals.push(meal(t, ['Queso costeño']));
      symptoms.push(sym('estrenimiento', t + 2 * H, 6)); // demasiado pronto
    }
    for (let d = 0; d < 10; d++) meals.push(meal(T0 + d * 4 * D + 2 * D + 12 * H, ['Arroz']));
    const r = analyze(input(meals, symptoms));
    const q = r.profiles.find((p) => p.key === 'queso costeno')!;
    expect(q.signals.find((s) => s.outcome === 'estrenimiento')?.strength ?? 'sin_diferencia').not.toBe('repetida');
  });

  it('distingue observaciones aisladas', () => {
    const t = T0 + 12 * H;
    const r = analyze(input([meal(t, ['Mondongo']), meal(t + 2 * D, ['Arroz']), meal(t + 3 * D, ['Arroz']), meal(t + 4 * D, ['Arroz'])], [sym('dolor', t + 2 * H, 7)]));
    const m = r.profiles.find((p) => p.key === 'mondongo')!;
    expect(m.suggestion).toBe('sin_datos');
    expect(r.signals.find((s) => s.foodKey === 'mondongo')).toBeUndefined();
    expect(r.isolated.some((s) => s.foodKey === 'mondongo' && s.outcome === 'dolor')).toBe(true);
  });

  it('ignora síntomas por debajo del umbral', () => {
    const meals: Meal[] = [];
    const symptoms: Symptom[] = [];
    for (let d = 0; d < 8; d++) {
      const t = T0 + d * D + 12 * H;
      meals.push(meal(t, ['Pera']), meal(t + 6 * H + 30 * 60_000, ['Arroz']));
      symptoms.push(sym('gases', t + H, 1));
    }
    const r = analyze(input(meals, symptoms));
    expect(r.profiles.find((p) => p.key === 'pera')!.suggestion).toBe('tolero_bien');
  });

  it('detecta mejor tolerancia en poca cantidad', () => {
    const meals: Meal[] = [];
    const symptoms: Symptom[] = [];
    for (let d = 0; d < 12; d++) {
      const t = T0 + d * D + 12 * H;
      const abundant = d % 2 === 0;
      meals.push(meal(t, [['Fríjoles', abundant ? 'abundante' : 'poca']]));
      meals.push(meal(t + 7 * H, ['Arroz']));
      if (abundant) symptoms.push(sym('gases', t + 3 * H, 5));
    }
    const r = analyze(input(meals, symptoms));
    const f = r.profiles.find((p) => p.key === 'frijoles')!;
    const ins = f.insights.find((i) => i.kind === 'cantidad');
    expect(ins).toBeDefined();
    expect(ins!.better.followed).toBe(0);
    expect(ins!.worse.followed).toBe(6);
    expect(ins!.message).toContain('porciones pequeñas');
    expect(['a_medias', 'posible_mala']).toContain(f.suggestion);
  });

  it('detecta diferencia por preparación', () => {
    const meals: Meal[] = [];
    const symptoms: Symptom[] = [];
    for (let d = 0; d < 10; d++) {
      const t = T0 + d * D + 12 * H;
      const fried = d % 2 === 0;
      meals.push(meal(t, [['Pescado', 'normal', fried ? 'frito' : 'asado']]));
      meals.push(meal(t + 7 * H, ['Arroz']));
      if (fried) symptoms.push(sym('pesadez', t + H, 5));
    }
    const r = analyze(input(meals, symptoms));
    const ins = r.profiles.find((p) => p.key === 'pescado')!.insights.find((i) => i.kind === 'preparacion');
    expect(ins?.better.label).toContain('asado');
    expect(ins?.worse.label).toBe('frito');
  });

  it('cuenta ingredientes de preparaciones como exposición', () => {
    const meals: Meal[] = [];
    const symptoms: Symptom[] = [];
    for (let d = 0; d < 6; d++) {
      const t = T0 + d * D + 8 * H;
      meals.push(meal(t, [{ name: 'Café con leche', key: 'cafe con leche', quantity: 'normal', ingredients: ['Café', 'Leche'] }]));
      meals.push(meal(t + 7 * H, ['Arroz']));
      symptoms.push(sym('hinchazon', t + 2 * H, 6));
    }
    const r = analyze(input(meals, symptoms));
    expect(r.profiles.find((p) => p.key === 'leche')?.exposures).toBe(6);
  });

  it('no cuenta comidas cuya ventana todavía no termina', () => {
    const t = NOW - 2 * H;
    const r = analyze(input([meal(t, ['Mango'])]));
    expect(r.profiles[0].suggestion).toBe('sin_datos');
  });

  it('usa deposiciones Bristol 6–7 como episodios', () => {
    const meals: Meal[] = [];
    const stools: Stool[] = [];
    for (let d = 0; d < 8; d++) {
      const t = T0 + d * D + 12 * H;
      meals.push(meal(t, d < 5 ? ['Leche'] : ['Arroz']));
      if (d < 5) stools.push(stool(t + 3 * H, 7));
      else stools.push(stool(t + 3 * H, 4));
    }
    const r = analyze(input(meals, [], stools));
    expect(r.signals.find((s) => s.foodKey === 'leche' && s.outcome === 'heces_blandas')?.strength).toBe('repetida');
  });

  it('compara días con y sin el alimento', () => {
    const meals: Meal[] = [];
    const symptoms: Symptom[] = [];
    for (let d = 0; d < 10; d++) {
      const t = T0 + d * D + 12 * H;
      meals.push(meal(t, d % 2 ? ['Leche'] : ['Arroz']));
      if (d % 2) symptoms.push(sym('hinchazon', t + 2 * H, 6));
    }
    const c = compareDays('leche', input(meals, symptoms));
    expect(c.enough).toBe(true);
    expect(c.withFood.days).toBe(5);
    expect(c.withFood.symptomDayRate).toBe(1);
    expect(c.withoutFood.symptomDayRate).toBe(0);
  });

  it('historial detallado del alimento incluye síntomas posteriores', () => {
    const t = T0 + 12 * H;
    const d = foodHistoryDetail('leche', input([meal(t, ['Leche', 'Pan'])], [sym('gases', t + 3 * H)]));
    expect(d).toHaveLength(1);
    expect(d[0].laterSymptoms).toHaveLength(1);
    expect(d[0].coFoods).toEqual(['Pan']);
  });
});

describe('alertas médicas', () => {
  it('heces negras y sangre abundante son urgentes', () => {
    expect(stoolAlerts(stool(NOW, 4, { color: 'negro' }))[0].level).toBe('urgente');
    expect(stoolAlerts(stool(NOW, 4, { blood: 'abundante' }))[0].level).toBe('urgente');
    expect(stoolAlerts(stool(NOW, 4, { blood: 'heces' }))[0].level).toBe('pronto');
    expect(stoolAlerts(stool(NOW, 4, { blood: 'papel' }))[0].level).toBe('atencion');
    expect(stoolAlerts(stool(NOW, 4))).toHaveLength(0);
  });
  it('dolor intenso persistente es urgente', () => {
    const s = { ...sym('dolor', NOW - 8 * H, 9), durationMin: undefined };
    expect(symptomAlerts(s, NOW)[0].level).toBe('urgente');
    expect(symptomAlerts(sym('dolor', NOW, 9), NOW)[0].level).toBe('pronto');
    expect(symptomAlerts(sym('dolor', NOW, 5), NOW)).toHaveLength(0);
  });
  it('diarrea frecuente', () => {
    const st = Array.from({ length: 6 }, (_, i) => stool(NOW - i * H, 7));
    expect(patternAlerts(st, NOW).length).toBeGreaterThan(0);
  });
});

describe('estadísticas', () => {
  it('estado del día prioriza la valoración manual', () => {
    expect(dayStatus({ day: '2026-01-01', digestion: 5, updatedAt: 0 }, [sym('dolor', 0, 9)], []).tone).toBe('good');
    expect(dayStatus(undefined, [sym('dolor', 0, 8)], []).tone).toBe('bad');
    expect(dayStatus(undefined, [], []).tone).toBe('none');
  });
  it('distribución Bristol y media móvil', () => {
    const d = bristolDistribution([stool(0, 4), stool(0, 4), stool(0, 6)]);
    expect(d[3]).toMatchObject({ count: 2, pct: 67 });
    expect(movingAverage([1, null, 3], 2)).toEqual([1, 1, 3]);
  });
});
