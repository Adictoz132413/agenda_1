/**
 * Esquemas de validación (zod). Se usan al guardar registros desde los
 * formularios y al importar copias de seguridad.
 */
import { z } from 'zod';

const id = z.string().min(1).max(64);
const ms = z.number().int().nonnegative();
const shortText = z.string().max(2000);

export const mealItemSchema = z.object({
  name: z.string().trim().min(1, 'Escribe el nombre del alimento').max(120),
  key: z.string().min(1).max(120),
  quantity: z.enum(['poca', 'normal', 'abundante', 'personalizada']),
  customQuantity: z.string().max(60).optional(),
  preparation: z.enum(['crudo', 'cocido', 'frito', 'asado', 'horneado', 'guisado', 'al_vapor', 'licuado', 'procesado', 'fermentado', 'otro']).optional(),
  ingredients: z.array(z.string().trim().min(1).max(80)).max(40).optional(),
});

const mealFlag = z.enum(['cafe', 'cafeina', 'lacteos', 'picante', 'grasas', 'alcohol', 'gaseosa', 'azucar']);
const mealType = z.enum(['desayuno', 'almuerzo', 'cena', 'merienda', 'bebida']);

export const mealSchema = z.object({
  id,
  at: ms,
  mealType,
  items: z.array(mealItemSchema).min(1, 'Agrega al menos un alimento o bebida').max(60),
  itemKeys: z.array(z.string()).max(400),
  flags: z.array(mealFlag).max(20),
  supplements: z.array(z.string().trim().min(1).max(80)).max(30),
  photoId: id.optional(),
  notes: shortText.optional(),
  feelingAfter: z.enum(['ligero', 'bien', 'satisfecho', 'pesado', 'molesto', 'mal']).optional(),
  createdAt: ms,
  updatedAt: ms,
});

export const favoriteSchema = z.object({
  id,
  name: z.string().trim().min(1, 'Ponle un nombre').max(80),
  mealType,
  items: z.array(mealItemSchema).min(1).max(60),
  flags: z.array(mealFlag).max(20),
  supplements: z.array(z.string().max(80)).max(30),
  createdAt: ms,
  uses: z.number().int().nonnegative(),
});

const level = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);

export const stoolSchema = z.object({
  id,
  at: ms,
  bristol: z.number().int().min(1, 'Elige un tipo de Bristol').max(7),
  color: z.enum(['marron', 'marron_claro', 'marron_oscuro', 'amarillo', 'verde', 'negro', 'rojo', 'gris_claro']),
  amount: z.enum(['poca', 'normal', 'abundante']),
  urgency: level,
  effort: level,
  pain: z.object({ before: z.boolean(), during: z.boolean(), after: z.boolean() }),
  painIntensity: z.number().min(0).max(10).optional(),
  incomplete: z.boolean(),
  mucus: z.boolean(),
  blood: z.enum(['no', 'papel', 'heces', 'abundante']),
  notes: shortText.optional(),
  createdAt: ms,
  updatedAt: ms,
});

export const symptomSchema = z
  .object({
    id,
    type: z.enum(['hinchazon', 'gases', 'dolor', 'acidez', 'nauseas', 'retortijones', 'diarrea', 'estrenimiento', 'pesadez', 'eructos', 'vomito', 'otro']),
    customName: z.string().trim().max(60).optional(),
    intensity: z.number().int().min(0).max(10),
    startedAt: ms,
    endedAt: ms.optional(),
    durationMin: z.number().int().min(1).max(60 * 24 * 14).optional(),
    location: z
      .enum(['epigastrio', 'hipocondrio_derecho', 'hipocondrio_izquierdo', 'periumbilical', 'flanco_derecho', 'flanco_izquierdo', 'fosa_iliaca_derecha', 'fosa_iliaca_izquierda', 'hipogastrio', 'general'])
      .optional(),
    notes: shortText.optional(),
    createdAt: ms,
    updatedAt: ms,
  })
  .refine((s) => s.type !== 'otro' || (s.customName && s.customName.length > 0), {
    message: 'Escribe el nombre del síntoma',
    path: ['customName'],
  })
  .refine((s) => s.endedAt === undefined || s.endedAt >= s.startedAt, {
    message: 'La hora de fin no puede ser anterior al inicio',
    path: ['endedAt'],
  });

export const dailyLogSchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  digestion: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
  water: z.number().int().min(0).max(40).optional(),
  stress: z.number().int().min(0).max(10).optional(),
  sleepHours: z.number().min(0).max(24).optional(),
  sleepQuality: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  exercise: z
    .object({
      type: z.string().trim().max(60),
      minutes: z.number().int().min(0).max(1440),
      intensity: z.enum(['suave', 'moderada', 'intensa']),
    })
    .optional(),
  notes: shortText.optional(),
  updatedAt: ms,
});

const foodTag = z.enum([
  'lacteo', 'gluten', 'picante', 'grasa', 'frito', 'cafeina', 'alcohol', 'leguminosa', 'cruciferas', 'fruta', 'verdura', 'cereal', 'proteina', 'azucar', 'gaseosa', 'edulcorante', 'procesado', 'fibra_alta',
]);

export const customFoodSchema = z.object({
  key: z.string().min(1).max(120),
  name: z.string().trim().min(1).max(120),
  tags: z.array(foodTag).max(20),
  createdAt: ms,
});

export const foodNoteSchema = z.object({
  key: z.string().min(1).max(120),
  name: z.string().max(120),
  manualStatus: z.enum(['tolero_bien', 'a_medias', 'posible_mala', 'sin_datos']).optional(),
  note: shortText.optional(),
  updatedAt: ms,
});

export const reminderSchema = z.object({
  id,
  kind: z.enum(['comida', 'deposicion', 'resumen', 'agua']),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  enabled: z.boolean(),
  lastFired: z.string().optional(),
});

export const settingsSchema = z.object({
  theme: z.enum(['sistema', 'claro', 'oscuro']),
  waterGoal: z.number().int().min(1).max(30),
  reminders: z.array(reminderSchema).max(30),
  photoMaxSide: z.number().int().min(320).max(2048),
  disclaimerAccepted: z.boolean(),
  consultNotes: z.string().max(10000),
  analysisThreshold: z.number().int().min(1).max(10),
});

/** Foto dentro del respaldo JSON: el Blob viaja como data URL base64. */
export const backupPhotoSchema = z.object({
  id,
  dataUrl: z.string().startsWith('data:image/'),
  mime: z.string().max(40),
  size: z.number().int().nonnegative(),
  width: z.number().int().nonnegative(),
  height: z.number().int().nonnegative(),
  createdAt: ms,
});

export const BACKUP_FORMAT = 'digesta-backup';
export const BACKUP_VERSION = 1;

export const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.number().int().min(1).max(BACKUP_VERSION),
  exportedAt: z.string(),
  mode: z.enum(['real', 'demo']).optional(),
  data: z.object({
    meals: z.array(mealSchema),
    stools: z.array(stoolSchema),
    symptoms: z.array(symptomSchema),
    dailyLogs: z.array(dailyLogSchema),
    favorites: z.array(favoriteSchema),
    customFoods: z.array(customFoodSchema),
    foodNotes: z.array(foodNoteSchema),
    photos: z.array(backupPhotoSchema),
    settings: settingsSchema.partial().optional(),
  }),
});

export type BackupFile = z.infer<typeof backupSchema>;

/** Convierte un error de zod en un mensaje legible en español. */
export function firstIssue(err: z.ZodError): string {
  const i = err.issues[0];
  if (!i) return 'Datos no válidos';
  const path = i.path.join('.');
  return path ? `${i.message} (${path})` : i.message;
}
