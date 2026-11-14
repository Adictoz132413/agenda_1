/**
 * Generador de datos de DEMOSTRACIÓN.
 *
 * Sólo escribe en la base `digesta-demo` (nunca en tus datos reales).
 * Incluye patrones sembrados a propósito para mostrar cómo funciona el análisis:
 *  - Leche → hinchazón entre 1 y 4 horas después (frecuente).
 *  - Fríjoles en cantidad abundante → gases entre 6 y 20 horas (en poca cantidad casi nunca).
 *  - Ají / salsa picante → acidez entre 1 y 3 horas.
 */
import type { DigestaDB } from './db';
import { keysOfItems, newId, normalizeItem } from './repo';
import { addDays, dayKey, dayStart, HOUR } from '@/domain/dates';
import { deriveFlags, foodKey } from '@/domain/foods';
import { DEFAULT_SETTINGS, type BristolType, type DailyLog, type Meal, type MealItem, type MealType, type QuantityLevel, type Stool, type Symptom } from '@/domain/types';

/** PRNG determinista (mulberry32) para datos reproducibles. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const item = (name: string, quantity: QuantityLevel = 'normal', extra: Partial<MealItem> = {}): MealItem =>
  normalizeItem({ name, key: foodKey(name), quantity, ...extra });

export async function seedDemo(db: DigestaDB, days = 60, now = Date.now()): Promise<void> {
  const r = rng(20261114);
  const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)];
  const chance = (p: number) => r() < p;
  const meals: Meal[] = [];
  const symptoms: Symptom[] = [];
  const stools: Stool[] = [];
  const logs: DailyLog[] = [];
  const today = dayKey(now);

  const breakfasts: (() => MealItem[])[] = [
    () => [item('Arepa', 'normal', { preparation: 'asado' }), item('Huevos pericos', 'normal', { preparation: 'frito', ingredients: ['Huevo', 'Tomate', 'Cebolla'] }), item('Café con leche', 'normal', { ingredients: ['Café', 'Leche'] })],
    () => [item('Avena en hojuelas', 'normal', { preparation: 'cocido' }), item('Banano'), item('Tinto')],
    () => [item('Pan integral'), item('Queso campesino', 'poca'), item('Jugo de naranja')],
    () => [item('Calentado', 'normal', { ingredients: ['Arroz', 'Fríjoles', 'Huevo'] }), item('Arepa', 'normal', { preparation: 'asado' }), item('Tinto')],
    () => [item('Yogur griego'), item('Granola', 'poca'), item('Fresas')],
  ];
  const lunches: (() => MealItem[])[] = [
    () => [item('Fríjoles', chance(0.5) ? 'abundante' : 'poca', { preparation: 'guisado' }), item('Arroz'), item('Carne molida', 'normal', { preparation: 'guisado' }), item('Aguacate', 'poca')],
    () => [item('Ajiaco', 'normal', { preparation: 'cocido', ingredients: ['Papa', 'Pollo', 'Mazorca', 'Guascas', 'Crema de leche'] }), item('Arroz', 'poca'), item('Aguacate', 'poca')],
    () => [item('Pollo', 'normal', { preparation: 'asado' }), item('Arroz'), item('Ensalada', 'normal', { preparation: 'crudo' }), item('Limonada')],
    () => [item('Sancocho', 'abundante', { preparation: 'cocido', ingredients: ['Papa', 'Yuca', 'Plátano verde', 'Pollo', 'Mazorca'] }), item('Arroz', 'poca')],
    () => [item('Pescado', 'normal', { preparation: chance(0.5) ? 'frito' : 'asado' }), item('Patacón', 'normal', { preparation: 'frito' }), item('Ensalada', 'poca', { preparation: 'crudo' })],
    () => [item('Lentejas', 'normal', { preparation: 'guisado' }), item('Arroz'), item('Plátano maduro', 'normal', { preparation: 'horneado' })],
  ];
  const dinners: (() => MealItem[])[] = [
    () => [item('Arepa con queso', 'normal', { preparation: 'asado', ingredients: ['Arepa', 'Queso campesino'] }), item('Chocolate caliente', 'normal', { ingredients: ['Chocolate', 'Leche'] })],
    () => [item('Pasta', 'normal', { preparation: 'cocido' }), item('Pollo', 'poca', { preparation: 'asado' }), item('Salsa picante', 'poca')],
    () => [item('Huevo', 'normal', { preparation: 'cocido' }), item('Pan'), item('Aromática')],
    () => [item('Hamburguesa', 'normal'), item('Papas fritas', 'normal', { preparation: 'frito' }), item('Gaseosa')],
    () => [item('Pollo', 'normal', { preparation: 'asado' }), item('Brócoli', 'normal', { preparation: 'al_vapor' }), item('Papa', 'normal', { preparation: 'cocido' })],
  ];
  const snacks: (() => MealItem[])[] = [
    () => [item('Manzana')],
    () => [item('Batido de proteína', 'normal', { ingredients: ['Leche'] })],
    () => [item('Maní', 'poca')],
    () => [item('Yogur')],
    () => [item('Empanada', 'normal', { preparation: 'frito' }), item('Ají', 'poca')],
  ];

  const addMeal = (at: number, mealType: MealType, items: MealItem[], extra: Partial<Meal> = {}) => {
    const keys = keysOfItems(items);
    const m: Meal = {
      id: newId(),
      at,
      mealType,
      items,
      itemKeys: keys,
      flags: deriveFlags(keys),
      supplements: [],
      createdAt: at,
      updatedAt: at,
      ...extra,
    };
    meals.push(m);
    return m;
  };
  const addSymptom = (type: Symptom['type'], at: number, intensity: number, durMin: number, location?: Symptom['location']) => {
    if (at > now) return;
    symptoms.push({ id: newId(), type, intensity, startedAt: at, durationMin: durMin, location, createdAt: at, updatedAt: at });
  };

  for (let d = days - 1; d >= 0; d--) {
    const key = addDays(today, -d);
    const base = dayStart(key);
    const dayMeals: Meal[] = [];
    const supplements = chance(0.7) ? ['Creatina'] : [];
    dayMeals.push(addMeal(base + (6.5 + r()) * HOUR, 'desayuno', pick(breakfasts)(), { supplements }));
    dayMeals.push(addMeal(base + (12.3 + r()) * HOUR, 'almuerzo', pick(lunches)()));
    if (chance(0.6)) dayMeals.push(addMeal(base + (16 + r()) * HOUR, 'merienda', pick(snacks)()));
    dayMeals.push(addMeal(base + (19 + r() * 1.5) * HOUR, 'cena', pick(dinners)()));

    // Patrones sembrados
    for (const m of dayMeals) {
      const keys = new Set(m.itemKeys);
      if (keys.has('leche') && chance(0.72)) addSymptom('hinchazon', m.at + (1 + r() * 3) * HOUR, 5 + Math.floor(r() * 3), 90 + Math.floor(r() * 120), 'periumbilical');
      const frijoles = m.items.find((i) => i.key === 'frijoles');
      if (frijoles) {
        const p = frijoles.quantity === 'abundante' ? 0.85 : 0.1;
        if (chance(p)) addSymptom('gases', m.at + (6 + r() * 14) * HOUR, 4 + Math.floor(r() * 3), 120);
      }
      if ((keys.has('aji') || keys.has('salsa picante')) && chance(0.65)) addSymptom('acidez', m.at + (1 + r() * 2) * HOUR, 4 + Math.floor(r() * 4), 60, 'epigastrio');
      if (keys.has('papas fritas') && chance(0.4)) {
        addSymptom('pesadez', m.at + (0.5 + r()) * HOUR, 4, 90);
        m.feelingAfter = 'pesado';
      } else if (chance(0.6)) m.feelingAfter = pick(['bien', 'ligero', 'satisfecho']);
    }
    // Ruido de fondo
    if (chance(0.08)) addSymptom(pick(['dolor', 'retortijones', 'nauseas']), base + (9 + r() * 10) * HOUR, 3 + Math.floor(r() * 3), 45, 'general');

    // Deposiciones
    const nStools = chance(0.15) ? 2 : chance(0.08) ? 0 : 1;
    for (let i = 0; i < nStools; i++) {
      const at = base + (7 + i * 7 + r() * 2) * HOUR;
      if (at > now) continue;
      const hadBeans = meals.some((m) => m.items.some((it) => it.key === 'frijoles' && it.quantity === 'abundante') && at - m.at > 6 * HOUR && at - m.at < 24 * HOUR);
      const bristol = (hadBeans && chance(0.5) ? 6 : pick([3, 4, 4, 4, 5])) as BristolType;
      stools.push({
        id: newId(),
        at,
        bristol,
        color: pick(['marron', 'marron', 'marron_claro', 'marron_oscuro']),
        amount: pick(['normal', 'normal', 'poca', 'abundante']),
        urgency: (bristol >= 6 ? 2 : 0) as 0 | 2,
        effort: (bristol <= 3 ? 1 : 0) as 0 | 1,
        pain: { before: bristol >= 6, during: false, after: false },
        incomplete: chance(0.1),
        mucus: false,
        blood: 'no',
        createdAt: at,
        updatedAt: at,
      });
    }

    // Registro diario
    const daySym = symptoms.filter((s) => dayKey(s.startedAt) === key);
    const maxInt = Math.max(0, ...daySym.map((s) => s.intensity));
    const digestion = (maxInt >= 6 ? 2 : maxInt >= 4 ? 3 : chance(0.5) ? 5 : 4) as DailyLog['digestion'];
    if (d > 0 || base + 21 * HOUR < now) {
      logs.push({
        day: key,
        digestion: chance(0.85) ? digestion : undefined,
        water: 4 + Math.floor(r() * 6),
        stress: Math.floor(r() * 8),
        sleepHours: Math.round((5.5 + r() * 3) * 2) / 2,
        sleepQuality: pick([2, 3, 3]) as 2 | 3,
        exercise: chance(0.55) ? { type: pick(['Pesas', 'Correr', 'Bicicleta', 'Fútbol']), minutes: 40 + Math.floor(r() * 40), intensity: pick(['moderada', 'intensa']) } : undefined,
        updatedAt: base + 21 * HOUR,
      });
    }
  }

  const futureFree = meals.filter((m) => m.at <= now);
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
    await db.meals.bulkPut(futureFree);
    await db.symptoms.bulkPut(symptoms);
    await db.stools.bulkPut(stools);
    await db.dailyLogs.bulkPut(logs);
    await db.favorites.bulkPut([
      {
        id: newId(),
        name: 'Desayuno de entreno',
        mealType: 'desayuno',
        items: [item('Avena en hojuelas', 'normal', { preparation: 'cocido' }), item('Banano'), item('Batido de proteína', 'normal')],
        flags: [],
        supplements: ['Creatina'],
        createdAt: now,
        uses: 4,
      },
    ]);
    await db.foodNotes.put({ key: 'leche', name: 'Leche', manualStatus: 'a_medias', note: 'Probar con leche deslactosada.', updatedAt: now });
    await db.settings.put({ key: 'settings', value: { ...DEFAULT_SETTINGS, disclaimerAccepted: true } });
  });
}
