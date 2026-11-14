/**
 * Copias de seguridad completas en JSON (incluye fotos en base64) e importación validada.
 */
import { getDb, getMode } from './db';
import { BACKUP_FORMAT, BACKUP_VERSION, backupSchema, firstIssue, type BackupFile } from './schemas';
import { DEFAULT_SETTINGS, type Photo, type Settings } from '@/domain/types';

export function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

export function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function photoToBackup(p: Photo) {
  return {
    id: p.id,
    dataUrl: `data:${p.mime};base64,${arrayBufferToBase64(p.data)}`,
    mime: p.mime,
    size: p.size,
    width: p.width,
    height: p.height,
    createdAt: p.createdAt,
  };
}

/** Construye el objeto de respaldo de la base activa. */
export async function buildBackup(): Promise<BackupFile> {
  const db = getDb();
  const [meals, stools, symptoms, dailyLogs, favorites, customFoods, foodNotes, photos, settingsRow] = await Promise.all([
    db.meals.toArray(),
    db.stools.toArray(),
    db.symptoms.toArray(),
    db.dailyLogs.toArray(),
    db.favorites.toArray(),
    db.customFoods.toArray(),
    db.foodNotes.toArray(),
    db.photos.toArray(),
    db.settings.get('settings'),
  ]);
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    mode: getMode(),
    data: {
      meals,
      stools,
      symptoms,
      dailyLogs,
      favorites,
      customFoods,
      foodNotes,
      photos: photos.map(photoToBackup),
      settings: settingsRow?.value ?? DEFAULT_SETTINGS,
    },
  };
}

export async function exportBackupJson(): Promise<string> {
  return JSON.stringify(await buildBackup());
}

export interface ImportSummary {
  meals: number;
  stools: number;
  symptoms: number;
  dailyLogs: number;
  photos: number;
  favorites: number;
}

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportError';
  }
}

/** Valida un texto JSON de respaldo sin escribir nada. */
export function parseBackup(text: string): BackupFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ImportError('El archivo no es un JSON válido.');
  }
  if (!raw || typeof raw !== 'object' || (raw as { format?: string }).format !== BACKUP_FORMAT) {
    throw new ImportError('El archivo no parece una copia de seguridad de DIGESTA.');
  }
  const r = backupSchema.safeParse(raw);
  if (!r.success) throw new ImportError(`La copia de seguridad tiene datos no válidos: ${firstIssue(r.error)}`);
  return r.data;
}

/**
 * Importa un respaldo.
 * - `replace`: borra todo lo de la base activa y restaura el respaldo.
 * - `merge`: agrega registros; si un id ya existe, conserva la versión más reciente (updatedAt).
 */
export async function importBackup(text: string, mode: 'replace' | 'merge'): Promise<ImportSummary> {
  const b = parseBackup(text);
  const db = getDb();
  const photos: Photo[] = b.data.photos.map((p) => {
    const b64 = p.dataUrl.slice(p.dataUrl.indexOf(',') + 1);
    return { id: p.id, data: base64ToArrayBuffer(b64), mime: p.mime, size: p.size, width: p.width, height: p.height, createdAt: p.createdAt };
  });

  await db.transaction('rw', db.tables, async () => {
    if (mode === 'replace') {
      await Promise.all(db.tables.map((t) => t.clear()));
      await db.meals.bulkPut(b.data.meals as never);
      await db.stools.bulkPut(b.data.stools as never);
      await db.symptoms.bulkPut(b.data.symptoms as never);
      await db.dailyLogs.bulkPut(b.data.dailyLogs as never);
      await db.favorites.bulkPut(b.data.favorites as never);
      await db.customFoods.bulkPut(b.data.customFoods as never);
      await db.foodNotes.bulkPut(b.data.foodNotes as never);
      await db.photos.bulkPut(photos);
      await db.settings.put({ key: 'settings', value: { ...DEFAULT_SETTINGS, ...(b.data.settings ?? {}) } as Settings });
    } else {
      const mergeNewer = async <T extends { updatedAt?: number }>(table: { get(k: string): Promise<T | undefined>; put(v: T): Promise<unknown> }, rows: T[], keyOf: (r: T) => string) => {
        for (const r of rows) {
          const prev = await table.get(keyOf(r));
          if (!prev || (r.updatedAt ?? 0) > (prev.updatedAt ?? 0)) await table.put(r);
        }
      };
      await mergeNewer(db.meals as never, b.data.meals, (r) => r.id);
      await mergeNewer(db.stools as never, b.data.stools, (r) => r.id);
      await mergeNewer(db.symptoms as never, b.data.symptoms, (r) => r.id);
      await mergeNewer(db.dailyLogs as never, b.data.dailyLogs, (r) => r.day);
      await mergeNewer(db.foodNotes as never, b.data.foodNotes, (r) => r.key);
      for (const f of b.data.favorites) if (!(await db.favorites.get(f.id))) await db.favorites.put(f as never);
      for (const f of b.data.customFoods) if (!(await db.customFoods.get(f.key))) await db.customFoods.put(f as never);
      for (const p of photos) if (!(await db.photos.get(p.id))) await db.photos.put(p);
    }
  });

  return {
    meals: b.data.meals.length,
    stools: b.data.stools.length,
    symptoms: b.data.symptoms.length,
    dailyLogs: b.data.dailyLogs.length,
    photos: photos.length,
    favorites: b.data.favorites.length,
  };
}
