import { beforeEach, describe, expect, it } from 'vitest';
import { openDbForTests } from '@/db/db';
import {
  deleteMeal, endSymptom, getSettings, isOngoing, loadDay, patchDailyLog, saveFavorite, saveMeal, saveStool, saveSymptom,
  updateSettings, ValidationError, wipeAll, foodHistory,
} from '@/db/repo';
import { dayKey } from '@/domain/dates';
import type { MealItem } from '@/domain/types';

const item = (name: string, extra: Partial<MealItem> = {}): MealItem => ({ name, key: '', quantity: 'normal', ...extra });
let n = 0;

beforeEach(() => {
  openDbForTests(`test-persist-${n++}`);
});

describe('persistencia de comidas', () => {
  it('guarda, normaliza, deriva claves y lee por día', async () => {
    const at = new Date(2026, 10, 10, 8, 30).getTime();
    const m = await saveMeal({ at, mealType: 'desayuno', items: [item('  café con leche ', { ingredients: ['Café', 'leche'] }), item('Arepa')], flags: ['cafe'], supplements: [' creatina '] });
    expect(m.items[0].name).toBe('Café con leche');
    expect(m.items[0].key).toBe('cafe con leche');
    expect(m.itemKeys).toEqual(expect.arrayContaining(['cafe con leche', 'cafe', 'leche', 'arepa']));
    expect(m.supplements).toEqual(['creatina']);
    const day = await loadDay(dayKey(at));
    expect(day.meals).toHaveLength(1);
    expect(day.meals[0].id).toBe(m.id);
  });

  it('actualiza conservando createdAt y elimina', async () => {
    const m = await saveMeal({ at: Date.now(), mealType: 'almuerzo', items: [item('Arroz')], flags: [], supplements: [] });
    const u = await saveMeal({ ...m, items: [item('Arroz'), item('Fríjoles', { quantity: 'abundante' })] });
    expect(u.createdAt).toBe(m.createdAt);
    expect(u.items).toHaveLength(2);
    await deleteMeal(m.id);
    expect((await loadDay(dayKey(m.at))).meals).toHaveLength(0);
  });

  it('rechaza comidas sin alimentos', async () => {
    await expect(saveMeal({ at: Date.now(), mealType: 'cena', items: [], flags: [], supplements: [] })).rejects.toBeInstanceOf(ValidationError);
  });

  it('calcula historial de alimentos frecuentes', async () => {
    for (let i = 0; i < 3; i++) await saveMeal({ at: Date.now() - i * 1000, mealType: 'merienda', items: [item('Banano')], flags: [], supplements: [] });
    await saveMeal({ at: Date.now(), mealType: 'merienda', items: [item('Manzana')], flags: [], supplements: [] });
    const h = await foodHistory();
    expect(h[0]).toMatchObject({ key: 'banano', count: 3 });
  });

  it('guarda favoritas', async () => {
    const f = await saveFavorite({ name: 'Mi desayuno', mealType: 'desayuno', items: [item('Avena en hojuelas')], flags: [], supplements: [] });
    expect(f.uses).toBe(0);
    expect(f.items[0].key).toBe('avena en hojuelas');
  });
});

describe('deposiciones y síntomas', () => {
  it('permite varias deposiciones el mismo día', async () => {
    const base = new Date(2026, 10, 11, 7).getTime();
    const common = { color: 'marron' as const, amount: 'normal' as const, urgency: 0 as const, effort: 0 as const, pain: { before: false, during: false, after: false }, incomplete: false, mucus: false, blood: 'no' as const };
    await saveStool({ at: base, bristol: 4, ...common });
    await saveStool({ at: base + 3600_000 * 5, bristol: 6, ...common });
    const d = await loadDay(dayKey(base));
    expect(d.stools.map((s) => s.bristol)).toEqual([4, 6]);
  });

  it('valida Bristol fuera de rango', async () => {
    await expect(
      saveStool({ at: Date.now(), bristol: 9 as never, color: 'marron', amount: 'normal', urgency: 0, effort: 0, pain: { before: false, during: false, after: false }, incomplete: false, mucus: false, blood: 'no' }),
    ).rejects.toThrow(/Bristol|7/);
  });

  it('marca un síntoma como terminado', async () => {
    const s = await saveSymptom({ type: 'hinchazon', intensity: 6, startedAt: Date.now() - 3600_000 });
    expect(isOngoing(s)).toBe(true);
    await endSymptom(s.id);
    const d = await loadDay(dayKey(s.startedAt));
    expect(d.symptoms[0].endedAt).toBeGreaterThanOrEqual(s.startedAt);
    expect(isOngoing(d.symptoms[0])).toBe(false);
  });

  it('exige nombre en síntomas personalizados', async () => {
    await expect(saveSymptom({ type: 'otro', intensity: 3, startedAt: Date.now() })).rejects.toThrow(/nombre/);
  });

  it('rechaza fin anterior al inicio', async () => {
    const t = Date.now();
    await expect(saveSymptom({ type: 'gases', intensity: 3, startedAt: t, endedAt: t - 1000 })).rejects.toThrow(/anterior/);
  });
});

describe('registro diario y configuración', () => {
  it('fusiona parches y permite borrar campos', async () => {
    await patchDailyLog('2026-11-12', { water: 3 });
    await patchDailyLog('2026-11-12', { digestion: 4, stress: 5 });
    let d = await loadDay('2026-11-12');
    expect(d.log).toMatchObject({ water: 3, digestion: 4, stress: 5 });
    await patchDailyLog('2026-11-12', { stress: undefined });
    d = await loadDay('2026-11-12');
    expect(d.log?.stress).toBeUndefined();
    expect(d.log?.water).toBe(3);
  });

  it('configuración con valores por defecto y validación', async () => {
    expect((await getSettings()).waterGoal).toBe(8);
    await updateSettings({ waterGoal: 10, theme: 'oscuro' });
    expect(await getSettings()).toMatchObject({ waterGoal: 10, theme: 'oscuro' });
    await expect(updateSettings({ waterGoal: 0 })).rejects.toBeInstanceOf(ValidationError);
  });

  it('borra todos los datos', async () => {
    await saveSymptom({ type: 'gases', intensity: 3, startedAt: Date.now() });
    await wipeAll();
    expect((await loadDay(dayKey(Date.now()))).symptoms).toHaveLength(0);
  });
});
