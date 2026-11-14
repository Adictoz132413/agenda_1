import { describe, expect, it } from 'vitest';
import { DigestaDB, openDbForTests } from '@/db/db';
import { seedDemo } from '@/db/demo';
import { loadAll } from '@/db/repo';
import { analyze } from '@/analysis/engine';

describe('datos de demostración', () => {
  it('siembra patrones detectables y no toca la base real', async () => {
    const now = new Date(2026, 10, 14, 22, 0).getTime();
    const db = openDbForTests('test-demo');
    await seedDemo(db, 60, now);
    const data = await loadAll();
    expect(data.meals.length).toBeGreaterThan(150);
    expect(data.meals.every((m) => m.at <= now)).toBe(true);

    const r = analyze({ ...data, threshold: 3, now });
    const leche = r.profiles.find((p) => p.key === 'leche');
    const lecheSignal = leche?.signals.find((s) => s.outcome === 'hinchazon');
    expect(['repetida', 'posible']).toContain(lecheSignal?.strength);

    const frijoles = r.profiles.find((p) => p.key === 'frijoles');
    const beansGas = frijoles?.signals.find((s) => s.outcome === 'gases' && (s.strength === 'repetida' || s.strength === 'posible'));
    const beansInsight = frijoles?.insights.find((i) => i.kind === 'cantidad');
    expect(beansGas || beansInsight).toBeTruthy();

    const spicy = r.signals.filter((s) => (s.foodKey === 'aji' || s.foodKey === 'salsa picante') && s.outcome === 'acidez');
    expect(spicy.length).toBeGreaterThan(0);

    const real = new DigestaDB('digesta');
    expect(await real.meals.count()).toBe(0);
    real.close();
  });
});
