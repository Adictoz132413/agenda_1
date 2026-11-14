/**
 * Repositorio: operaciones de lectura/escritura sobre la base activa.
 * Todas las escrituras se validan con zod antes de guardarse.
 */
import { getDb } from './db';
import { favoriteSchema, firstIssue, mealSchema, stoolSchema, symptomSchema, dailyLogSchema, settingsSchema, foodNoteSchema, customFoodSchema } from './schemas';
import { dayEnd, dayStart } from '@/domain/dates';
import { foodKey, prettyName } from '@/domain/foods';
import {
  DEFAULT_SETTINGS,
  type CustomFood,
  type DailyLog,
  type FavoriteMeal,
  type FoodNote,
  type FoodTag,
  type Meal,
  type MealItem,
  type Settings,
  type Stool,
  type Symptom,
} from '@/domain/types';
import type { z } from 'zod';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

function validate<T>(schema: z.ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) throw new ValidationError(firstIssue(r.error));
  return r.data;
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Claves de alimentos + ingredientes de una lista de ítems (sin duplicados). */
export function keysOfItems(items: MealItem[]): string[] {
  const s = new Set<string>();
  for (const it of items) {
    s.add(it.key || foodKey(it.name));
    for (const ing of it.ingredients ?? []) s.add(foodKey(ing));
  }
  s.delete('');
  return [...s];
}

/** Limpia un ítem: nombre bonito, clave, ingredientes sin duplicados. */
export function normalizeItem(it: MealItem): MealItem {
  const name = prettyName(it.name);
  const ingredients = it.ingredients?.map(prettyName).filter((x, i, a) => x && a.findIndex((y) => foodKey(y) === foodKey(x)) === i);
  return {
    name,
    key: foodKey(name),
    quantity: it.quantity,
    ...(it.quantity === 'personalizada' && it.customQuantity?.trim() ? { customQuantity: it.customQuantity.trim() } : {}),
    ...(it.preparation ? { preparation: it.preparation } : {}),
    ...(ingredients && ingredients.length ? { ingredients } : {}),
  };
}

// ───────────── Comidas ─────────────

export type MealInput = Omit<Meal, 'id' | 'createdAt' | 'updatedAt' | 'itemKeys'> & { id?: string };

export async function saveMeal(input: MealInput): Promise<Meal> {
  const db = getDb();
  const now = Date.now();
  const existing = input.id ? await db.meals.get(input.id) : undefined;
  const items = input.items.map(normalizeItem);
  const meal = validate(mealSchema, {
    ...input,
    id: input.id ?? newId(),
    items,
    itemKeys: keysOfItems(items),
    supplements: input.supplements.map((s) => s.trim()).filter(Boolean),
    notes: input.notes?.trim() || undefined,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }) as Meal;
  await db.transaction('rw', db.meals, db.photos, async () => {
    // Si se cambió o quitó la foto, borrar la anterior para no dejar huérfanas.
    if (existing?.photoId && existing.photoId !== meal.photoId) await db.photos.delete(existing.photoId);
    await db.meals.put(meal);
  });
  return meal;
}

export async function deleteMeal(id: string) {
  const db = getDb();
  await db.transaction('rw', db.meals, db.photos, async () => {
    const m = await db.meals.get(id);
    if (m?.photoId) await db.photos.delete(m.photoId);
    await db.meals.delete(id);
  });
}

export async function mealsBetween(from: number, to: number): Promise<Meal[]> {
  return getDb().meals.where('at').between(from, to, true, false).sortBy('at');
}

/** Alimentos consumidos con frecuencia (para sugerencias rápidas). */
export async function foodHistory(limit = 400): Promise<{ name: string; key: string; count: number; lastAt: number }[]> {
  const meals = await getDb().meals.orderBy('at').reverse().limit(limit).toArray();
  const map = new Map<string, { name: string; key: string; count: number; lastAt: number }>();
  for (const m of meals) {
    for (const it of m.items) {
      const e = map.get(it.key);
      if (e) e.count++;
      else map.set(it.key, { name: it.name, key: it.key, count: 1, lastAt: m.at });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.lastAt - a.lastAt);
}

/** Suplementos usados antes (para autocompletar). */
export async function supplementHistory(): Promise<string[]> {
  const meals = await getDb().meals.orderBy('at').reverse().limit(300).toArray();
  const s = new Map<string, string>();
  for (const m of meals) for (const x of m.supplements) if (!s.has(foodKey(x))) s.set(foodKey(x), x);
  return [...s.values()];
}

// ───────────── Favoritas ─────────────

export async function saveFavorite(input: Omit<FavoriteMeal, 'id' | 'createdAt' | 'uses'> & { id?: string }): Promise<FavoriteMeal> {
  const db = getDb();
  const existing = input.id ? await db.favorites.get(input.id) : undefined;
  const fav = validate(favoriteSchema, {
    ...input,
    id: input.id ?? newId(),
    items: input.items.map(normalizeItem),
    createdAt: existing?.createdAt ?? Date.now(),
    uses: existing?.uses ?? 0,
  }) as FavoriteMeal;
  await db.favorites.put(fav);
  return fav;
}

export async function deleteFavorite(id: string) {
  await getDb().favorites.delete(id);
}

export async function markFavoriteUsed(id: string) {
  await getDb().favorites.where('id').equals(id).modify((f) => {
    f.uses += 1;
  });
}

// ───────────── Deposiciones ─────────────

export type StoolInput = Omit<Stool, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

export async function saveStool(input: StoolInput): Promise<Stool> {
  const db = getDb();
  const now = Date.now();
  const existing = input.id ? await db.stools.get(input.id) : undefined;
  const stool = validate(stoolSchema, {
    ...input,
    id: input.id ?? newId(),
    notes: input.notes?.trim() || undefined,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }) as Stool;
  await db.stools.put(stool);
  return stool;
}

export async function deleteStool(id: string) {
  await getDb().stools.delete(id);
}

// ───────────── Síntomas ─────────────

export type SymptomInput = Omit<Symptom, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

export async function saveSymptom(input: SymptomInput): Promise<Symptom> {
  const db = getDb();
  const now = Date.now();
  const existing = input.id ? await db.symptoms.get(input.id) : undefined;
  const s = validate(symptomSchema, {
    ...input,
    id: input.id ?? newId(),
    customName: input.type === 'otro' ? input.customName?.trim() : undefined,
    notes: input.notes?.trim() || undefined,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }) as Symptom;
  await db.symptoms.put(s);
  return s;
}

/** Marca un síntoma como terminado ("ya pasó"). */
export async function endSymptom(id: string, at = Date.now()) {
  const db = getDb();
  const s = await db.symptoms.get(id);
  if (!s) throw new ValidationError('El síntoma ya no existe');
  await saveSymptom({ ...s, endedAt: Math.max(at, s.startedAt), durationMin: undefined });
}

export async function deleteSymptom(id: string) {
  await getDb().symptoms.delete(id);
}

/** Síntoma en curso: sin fin y sin duración, iniciado hace menos de 3 días. */
export function isOngoing(s: Symptom, now = Date.now()) {
  return s.endedAt === undefined && s.durationMin === undefined && now - s.startedAt < 3 * 86_400_000;
}

// ───────────── Registro diario ─────────────

export async function getDailyLog(day: string): Promise<DailyLog | undefined> {
  return getDb().dailyLogs.get(day);
}

/** Actualiza parcialmente el registro del día (crea si no existe). */
export async function patchDailyLog(day: string, patch: Partial<Omit<DailyLog, 'day' | 'updatedAt'>>): Promise<DailyLog> {
  const db = getDb();
  return db.transaction('rw', db.dailyLogs, async () => {
    const prev = await db.dailyLogs.get(day);
    const merged: Record<string, unknown> = { ...(prev ?? {}), ...patch, day, updatedAt: Date.now() };
    // Permitir "borrar" un campo pasando undefined
    for (const k of Object.keys(patch)) if ((patch as Record<string, unknown>)[k] === undefined) delete merged[k];
    const log = validate(dailyLogSchema, merged) as DailyLog;
    await db.dailyLogs.put(log);
    return log;
  });
}

// ───────────── Día completo ─────────────

export interface DayBundle {
  day: string;
  meals: Meal[];
  stools: Stool[];
  symptoms: Symptom[];
  log?: DailyLog;
}

export async function loadDay(day: string): Promise<DayBundle> {
  const db = getDb();
  const from = dayStart(day);
  const to = dayEnd(day);
  const [meals, stools, symptoms, log] = await Promise.all([
    db.meals.where('at').between(from, to, true, false).sortBy('at'),
    db.stools.where('at').between(from, to, true, false).sortBy('at'),
    db.symptoms.where('startedAt').between(from, to, true, false).sortBy('startedAt'),
    db.dailyLogs.get(day),
  ]);
  return { day, meals, stools, symptoms, log };
}

export interface RangeBundle {
  meals: Meal[];
  stools: Stool[];
  symptoms: Symptom[];
  logs: DailyLog[];
}

/** Todos los registros entre dos días (claves inclusive). */
export async function loadRange(fromDay: string, toDay: string): Promise<RangeBundle> {
  const db = getDb();
  const from = dayStart(fromDay);
  const to = dayEnd(toDay);
  const [meals, stools, symptoms, logs] = await Promise.all([
    db.meals.where('at').between(from, to, true, false).sortBy('at'),
    db.stools.where('at').between(from, to, true, false).sortBy('at'),
    db.symptoms.where('startedAt').between(from, to, true, false).sortBy('startedAt'),
    db.dailyLogs.where('day').between(fromDay, toDay, true, true).toArray(),
  ]);
  return { meals, stools, symptoms, logs };
}

export async function loadAll(): Promise<RangeBundle> {
  const db = getDb();
  const [meals, stools, symptoms, logs] = await Promise.all([
    db.meals.orderBy('at').toArray(),
    db.stools.orderBy('at').toArray(),
    db.symptoms.orderBy('startedAt').toArray(),
    db.dailyLogs.toArray(),
  ]);
  return { meals, stools, symptoms, logs };
}

// ───────────── Alimentos ─────────────

export async function saveCustomFood(name: string, tags: FoodTag[]): Promise<CustomFood> {
  const clean = prettyName(name);
  const f = validate(customFoodSchema, { key: foodKey(clean), name: clean, tags, createdAt: Date.now() }) as CustomFood;
  await getDb().customFoods.put(f);
  return f;
}

export async function saveFoodNote(key: string, name: string, patch: Partial<Pick<FoodNote, 'manualStatus' | 'note'>>): Promise<FoodNote> {
  const db = getDb();
  const prev = await db.foodNotes.get(key);
  const merged: Record<string, unknown> = { ...(prev ?? { key, name }), ...patch, key, name, updatedAt: Date.now() };
  for (const k of Object.keys(patch)) if ((patch as Record<string, unknown>)[k] === undefined) delete merged[k];
  const n = validate(foodNoteSchema, merged) as FoodNote;
  await db.foodNotes.put(n);
  return n;
}

// ───────────── Configuración ─────────────

export async function getSettings(): Promise<Settings> {
  const row = await getDb().settings.get('settings');
  return { ...DEFAULT_SETTINGS, ...(row?.value ?? {}) };
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const db = getDb();
  return db.transaction('rw', db.settings, async () => {
    const prev = await getSettings();
    const next = validate(settingsSchema, { ...prev, ...patch }) as Settings;
    await db.settings.put({ key: 'settings', value: next });
    return next;
  });
}

// ───────────── Fotos ─────────────

/** Borra fotos que ninguna comida usa (p. ej. al cancelar un formulario). Respeta las de la última hora. */
export async function cleanOrphanPhotos(graceMs = 3600_000): Promise<number> {
  const db = getDb();
  return db.transaction('rw', db.meals, db.photos, async () => {
    const used = new Set<string>();
    await db.meals.each((m) => {
      if (m.photoId) used.add(m.photoId);
    });
    const orphan = await db.photos.filter((p) => !used.has(p.id) && Date.now() - p.createdAt > graceMs).primaryKeys();
    await db.photos.bulkDelete(orphan);
    return orphan.length;
  });
}

/** Elimina todas las fotos y las quita de las comidas. */
export async function deleteAllPhotos(): Promise<void> {
  const db = getDb();
  await db.transaction('rw', db.meals, db.photos, async () => {
    await db.meals.filter((m) => !!m.photoId).modify((m) => {
      delete m.photoId;
    });
    await db.photos.clear();
  });
}

// ───────────── Borrado total ─────────────

/** Elimina todos los registros de la base activa (incluye fotos y configuración). */
export async function wipeAll() {
  const db = getDb();
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });
}
