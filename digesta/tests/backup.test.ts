import { beforeEach, describe, expect, it } from 'vitest';
import { getDb, openDbForTests } from '@/db/db';
import { arrayBufferToBase64, base64ToArrayBuffer, buildBackup, exportBackupJson, importBackup, ImportError, parseBackup } from '@/db/backup';
import { loadAll, patchDailyLog, saveFoodNote, saveMeal, saveStool, saveSymptom, wipeAll } from '@/db/repo';
import { mealsCsv, stoolsCsv, csvCell } from '@/db/csv';

let n = 0;
beforeEach(() => {
  openDbForTests(`test-backup-${n++}`);
});

async function seed() {
  const at = new Date(2026, 10, 1, 13).getTime();
  const m = await saveMeal({ at, mealType: 'almuerzo', items: [{ name: 'Bandeja paisa', key: '', quantity: 'abundante', ingredients: ['Fríjoles', 'Arroz'] }], flags: ['grasas'], supplements: [], notes: 'Con "ají"; mucho' });
  await saveStool({ at: at + 3600_000 * 10, bristol: 6, color: 'marron', amount: 'normal', urgency: 2, effort: 0, pain: { before: true, during: false, after: false }, incomplete: false, mucus: false, blood: 'no' });
  await saveSymptom({ type: 'gases', intensity: 5, startedAt: at + 3600_000 * 8, durationMin: 60 });
  await patchDailyLog('2026-11-01', { digestion: 3, water: 6 });
  await saveFoodNote('frijoles', 'Fríjoles', { manualStatus: 'a_medias', note: 'Mejor en poca cantidad' });
  const bytes = new Uint8Array([255, 216, 255, 0, 1, 2, 3, 250]);
  await getDb().photos.put({ id: 'foto1', data: bytes.buffer, mime: 'image/jpeg', size: bytes.length, width: 10, height: 10, createdAt: at });
  await saveMeal({ ...m, photoId: 'foto1' });
}

describe('copia de seguridad JSON', () => {
  it('base64 ida y vuelta', () => {
    const b = new Uint8Array(70000).map((_, i) => i % 256);
    const back = new Uint8Array(base64ToArrayBuffer(arrayBufferToBase64(b.buffer)));
    expect(back).toEqual(b);
  });

  it('exporta, borra y restaura todo (reemplazar)', async () => {
    await seed();
    const before = await loadAll();
    const json = await exportBackupJson();
    await wipeAll();
    expect((await loadAll()).meals).toHaveLength(0);
    const summary = await importBackup(json, 'replace');
    expect(summary).toMatchObject({ meals: 1, stools: 1, symptoms: 1, dailyLogs: 1, photos: 1 });
    const after = await loadAll();
    expect(after.meals).toEqual(before.meals);
    expect(after.stools).toEqual(before.stools);
    expect(after.symptoms).toEqual(before.symptoms);
    expect(after.logs).toEqual(before.logs);
    const photo = await getDb().photos.get('foto1');
    expect(new Uint8Array(photo!.data)).toEqual(new Uint8Array([255, 216, 255, 0, 1, 2, 3, 250]));
    expect((await getDb().foodNotes.get('frijoles'))?.manualStatus).toBe('a_medias');
  });

  it('combinar conserva registros existentes y agrega los nuevos', async () => {
    await seed();
    const json = await exportBackupJson();
    await saveSymptom({ type: 'acidez', intensity: 4, startedAt: Date.now() });
    await importBackup(json, 'merge');
    const all = await loadAll();
    expect(all.symptoms).toHaveLength(2);
    expect(all.meals).toHaveLength(1);
  });

  it('rechaza archivos no válidos sin modificar datos', async () => {
    await seed();
    await expect(importBackup('no es json', 'replace')).rejects.toBeInstanceOf(ImportError);
    await expect(importBackup(JSON.stringify({ format: 'otra-app' }), 'replace')).rejects.toThrow(/no parece/);
    const b = await buildBackup();
    (b.data.stools[0] as { bristol: number }).bristol = 12;
    await expect(importBackup(JSON.stringify(b), 'replace')).rejects.toThrow(/no válidos/);
    expect((await loadAll()).stools).toHaveLength(1);
  });

  it('parseBackup acepta su propio formato', async () => {
    await seed();
    const parsed = parseBackup(await exportBackupJson());
    expect(parsed.format).toBe('digesta-backup');
  });
});

describe('CSV', () => {
  it('escapa comillas, punto y coma y saltos de línea', () => {
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('di "hola"')).toBe('"di ""hola"""');
    expect(csvCell('x\ny')).toBe('"x\ny"');
    expect(csvCell(undefined)).toBe('');
  });

  it('genera una fila por alimento con BOM', async () => {
    await seed();
    const all = await loadAll();
    const csv = mealsCsv(all.meals);
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toContain('Alimento');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('Bandeja paisa');
    expect(lines[1]).toContain('"Con ""ají""; mucho"');
    expect(stoolsCsv(all.stools)).toContain(';6;');
  });
});
