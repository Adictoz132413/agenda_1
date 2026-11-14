/**
 * Modelo de datos de DIGESTA.
 *
 * Todas las marcas de tiempo (`at`, `startedAt`, `endedAt`, `createdAt`,
 * `updatedAt`) son milisegundos epoch. El "día" de un registro se calcula
 * siempre en la hora local del dispositivo (ver `domain/dates.ts`).
 */

export type ID = string;

// ───────────────────────── Comidas ─────────────────────────

export type MealType = 'desayuno' | 'almuerzo' | 'cena' | 'merienda' | 'bebida';

export type QuantityLevel = 'poca' | 'normal' | 'abundante' | 'personalizada';

export type Preparation =
  | 'crudo'
  | 'cocido'
  | 'frito'
  | 'asado'
  | 'horneado'
  | 'guisado'
  | 'al_vapor'
  | 'licuado'
  | 'procesado'
  | 'fermentado'
  | 'otro';

/** Banderas útiles para análisis (se derivan de los alimentos y se pueden marcar a mano). */
export type MealFlag = 'cafe' | 'cafeina' | 'lacteos' | 'picante' | 'grasas' | 'alcohol' | 'gaseosa' | 'azucar';

export type FeelingAfter = 'ligero' | 'bien' | 'satisfecho' | 'pesado' | 'molesto' | 'mal';

export interface MealItem {
  /** Nombre visible tal como lo escribió la persona. */
  name: string;
  /** Clave normalizada para agrupar (minúsculas, sin tildes). */
  key: string;
  quantity: QuantityLevel;
  /** Texto libre cuando `quantity === 'personalizada'` (p. ej. "2 tazas", "150 g"). */
  customQuantity?: string;
  preparation?: Preparation;
  /** Ingredientes de una preparación (p. ej. "ajiaco": papa, pollo, mazorca…). */
  ingredients?: string[];
}

export interface Meal {
  id: ID;
  at: number;
  mealType: MealType;
  items: MealItem[];
  /** Derivado al guardar: claves de alimentos e ingredientes (índice para búsquedas). */
  itemKeys: string[];
  flags: MealFlag[];
  supplements: string[];
  photoId?: ID;
  notes?: string;
  feelingAfter?: FeelingAfter;
  createdAt: number;
  updatedAt: number;
}

export interface FavoriteMeal {
  id: ID;
  name: string;
  mealType: MealType;
  items: MealItem[];
  flags: MealFlag[];
  supplements: string[];
  createdAt: number;
  /** Veces que se ha usado para ordenar por frecuencia. */
  uses: number;
}

export interface Photo {
  id: ID;
  /** Bytes de la imagen comprimida (ArrayBuffer: se clona bien en IndexedDB en todos los navegadores). */
  data: ArrayBuffer;
  mime: string;
  size: number;
  width: number;
  height: number;
  createdAt: number;
}

// ───────────────────────── Deposiciones ─────────────────────────

export type BristolType = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type StoolColor = 'marron' | 'marron_claro' | 'marron_oscuro' | 'amarillo' | 'verde' | 'negro' | 'rojo' | 'gris_claro';
export type Amount = 'poca' | 'normal' | 'abundante';
export type Level0to3 = 0 | 1 | 2 | 3;
export type BloodPresence = 'no' | 'papel' | 'heces' | 'abundante';

export interface Stool {
  id: ID;
  at: number;
  bristol: BristolType;
  color: StoolColor;
  amount: Amount;
  /** 0 ninguna · 1 leve · 2 moderada · 3 urgente/no podía esperar */
  urgency: Level0to3;
  /** 0 ninguno · 1 leve · 2 moderado · 3 mucho esfuerzo */
  effort: Level0to3;
  pain: { before: boolean; during: boolean; after: boolean };
  /** Intensidad del dolor asociado (0–10), opcional. */
  painIntensity?: number;
  incomplete: boolean;
  mucus: boolean;
  blood: BloodPresence;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

// ───────────────────────── Síntomas ─────────────────────────

export type SymptomType =
  | 'hinchazon'
  | 'gases'
  | 'dolor'
  | 'acidez'
  | 'nauseas'
  | 'retortijones'
  | 'diarrea'
  | 'estrenimiento'
  | 'pesadez'
  | 'eructos'
  | 'vomito'
  | 'otro';

export type AbdomenZone =
  | 'epigastrio'
  | 'hipocondrio_derecho'
  | 'hipocondrio_izquierdo'
  | 'periumbilical'
  | 'flanco_derecho'
  | 'flanco_izquierdo'
  | 'fosa_iliaca_derecha'
  | 'fosa_iliaca_izquierda'
  | 'hipogastrio'
  | 'general';

export interface Symptom {
  id: ID;
  type: SymptomType;
  /** Nombre del síntoma cuando `type === 'otro'`. */
  customName?: string;
  /** 0–10 */
  intensity: number;
  startedAt: number;
  /** Momento en que desapareció. Si no existe y no hay duración, el síntoma está "en curso". */
  endedAt?: number;
  /** Duración estimada en minutos si no se conoce el fin exacto. */
  durationMin?: number;
  location?: AbdomenZone;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

// ───────────────────────── Registro diario ─────────────────────────

/** 5 muy bien · 4 bien · 3 regular · 2 mal · 1 muy mal */
export type DigestionRating = 1 | 2 | 3 | 4 | 5;

export interface DailyLog {
  /** YYYY-MM-DD local */
  day: string;
  digestion?: DigestionRating;
  /** Vasos de agua (≈250 ml) */
  water?: number;
  /** 0–10 */
  stress?: number;
  sleepHours?: number;
  /** 1 mala · 2 regular · 3 buena */
  sleepQuality?: 1 | 2 | 3;
  exercise?: { type: string; minutes: number; intensity: 'suave' | 'moderada' | 'intensa' };
  notes?: string;
  updatedAt: number;
}

// ───────────────────────── Alimentos y tolerancia ─────────────────────────

export type ToleranceStatus = 'tolero_bien' | 'a_medias' | 'posible_mala' | 'sin_datos';

export type FoodTag =
  | 'lacteo'
  | 'gluten'
  | 'picante'
  | 'grasa'
  | 'frito'
  | 'cafeina'
  | 'alcohol'
  | 'leguminosa'
  | 'cruciferas'
  | 'fruta'
  | 'verdura'
  | 'cereal'
  | 'proteina'
  | 'azucar'
  | 'gaseosa'
  | 'edulcorante'
  | 'procesado'
  | 'fibra_alta';

export interface CustomFood {
  key: string;
  name: string;
  tags: FoodTag[];
  createdAt: number;
}

/** Clasificación manual y notas de la persona para un alimento (separada de la sugerencia automática). */
export interface FoodNote {
  key: string;
  name: string;
  manualStatus?: Exclude<ToleranceStatus, 'sin_datos'> | 'sin_datos';
  note?: string;
  updatedAt: number;
}

// ───────────────────────── Configuración ─────────────────────────

export type ThemePref = 'sistema' | 'claro' | 'oscuro';
export type ReminderKind = 'comida' | 'deposicion' | 'resumen' | 'agua';

export interface Reminder {
  id: ID;
  kind: ReminderKind;
  /** HH:mm (24 h internamente; se muestra en 12 h) */
  time: string;
  enabled: boolean;
  /** YYYY-MM-DD del último disparo, para no repetir. */
  lastFired?: string;
}

export interface Settings {
  theme: ThemePref;
  waterGoal: number;
  reminders: Reminder[];
  /** Calidad/tamaño de foto comprimida */
  photoMaxSide: number;
  disclaimerAccepted: boolean;
  /** Notas para la consulta con el profesional (aparecen en el informe). */
  consultNotes: string;
  /** Umbral de intensidad (0–10) a partir del cual un síntoma cuenta como episodio para el análisis. */
  analysisThreshold: number;
}

export interface SettingRow {
  key: 'settings';
  value: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'sistema',
  waterGoal: 8,
  reminders: [],
  photoMaxSide: 1024,
  disclaimerAccepted: false,
  consultNotes: '',
  analysisThreshold: 3,
};
