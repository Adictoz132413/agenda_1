import { it } from 'vitest';
import { openDbForTests } from '@/db/db';
import { seedDemo } from '@/db/demo';
import { loadAll } from '@/db/repo';
import { analyze } from '@/analysis/engine';
it('dbg', async () => {
  const now = new Date(2026, 10, 14, 22, 0).getTime();
  const db = openDbForTests('dbg');
  await seedDemo(db, 60, now);
  const data = await loadAll();
  const r = analyze({ ...data, threshold: 3, now });
  const f = r.profiles.find((p) => p.key === 'frijoles')!;
  console.log(f.exposures, JSON.stringify(f.quantities), JSON.stringify(f.signals.map(s=>[s.outcome,s.window,s.followed,s.exposures,s.baselineRate,s.strength])), JSON.stringify(f.insights));
  console.log('gases', data.symptoms.filter(s=>s.type==='gases').length);
});
