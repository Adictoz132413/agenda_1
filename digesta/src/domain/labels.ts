/** Etiquetas en español y metadatos de las enumeraciones del modelo. */
import type {
  AbdomenZone,
  Amount,
  BloodPresence,
  BristolType,
  DigestionRating,
  FeelingAfter,
  Level0to3,
  MealFlag,
  MealType,
  Preparation,
  QuantityLevel,
  StoolColor,
  SymptomType,
  ToleranceStatus,
} from './types';

export const MEAL_TYPES: { value: MealType; label: string; emoji: string }[] = [
  { value: 'desayuno', label: 'Desayuno', emoji: '🌅' },
  { value: 'almuerzo', label: 'Almuerzo', emoji: '🍲' },
  { value: 'cena', label: 'Cena', emoji: '🌙' },
  { value: 'merienda', label: 'Merienda', emoji: '🍎' },
  { value: 'bebida', label: 'Bebida', emoji: '🥤' },
];
export const mealTypeLabel = (t: MealType) => MEAL_TYPES.find((m) => m.value === t)?.label ?? t;

/** Sugiere el tipo de comida según la hora local. */
export function suggestMealType(date = new Date()): MealType {
  const h = date.getHours() + date.getMinutes() / 60;
  if (h >= 4.5 && h < 10.5) return 'desayuno';
  if (h >= 11.5 && h < 15) return 'almuerzo';
  if (h >= 18 && h < 22.5) return 'cena';
  return 'merienda';
}

export const QUANTITIES: { value: QuantityLevel; label: string }[] = [
  { value: 'poca', label: 'Poca' },
  { value: 'normal', label: 'Normal' },
  { value: 'abundante', label: 'Abundante' },
  { value: 'personalizada', label: 'Otra' },
];
export const quantityLabel = (q: QuantityLevel) => QUANTITIES.find((x) => x.value === q)?.label ?? q;

export const PREPARATIONS: { value: Preparation; label: string }[] = [
  { value: 'crudo', label: 'Crudo' },
  { value: 'cocido', label: 'Cocido' },
  { value: 'frito', label: 'Frito' },
  { value: 'asado', label: 'Asado / a la plancha' },
  { value: 'horneado', label: 'Horneado' },
  { value: 'guisado', label: 'Guisado / sudado' },
  { value: 'al_vapor', label: 'Al vapor' },
  { value: 'licuado', label: 'Licuado / jugo' },
  { value: 'procesado', label: 'Empacado / procesado' },
  { value: 'fermentado', label: 'Fermentado' },
  { value: 'otro', label: 'Otro' },
];
export const preparationLabel = (p?: Preparation) => (p ? PREPARATIONS.find((x) => x.value === p)?.label ?? p : 'Sin especificar');

export const MEAL_FLAGS: { value: MealFlag; label: string; emoji: string }[] = [
  { value: 'cafe', label: 'Café', emoji: '☕' },
  { value: 'cafeina', label: 'Cafeína', emoji: '⚡' },
  { value: 'lacteos', label: 'Lácteos', emoji: '🥛' },
  { value: 'picante', label: 'Picante', emoji: '🌶️' },
  { value: 'grasas', label: 'Grasas / frituras', emoji: '🍟' },
  { value: 'alcohol', label: 'Alcohol', emoji: '🍺' },
  { value: 'gaseosa', label: 'Gaseosa', emoji: '🫧' },
  { value: 'azucar', label: 'Dulces / azúcar', emoji: '🍬' },
];
export const flagLabel = (f: MealFlag) => MEAL_FLAGS.find((x) => x.value === f)?.label ?? f;

export const FEELINGS: { value: FeelingAfter; label: string; emoji: string; tone: 'good' | 'mid' | 'bad' }[] = [
  { value: 'ligero', label: 'Ligero', emoji: '🍃', tone: 'good' },
  { value: 'bien', label: 'Bien', emoji: '🙂', tone: 'good' },
  { value: 'satisfecho', label: 'Satisfecho', emoji: '😌', tone: 'good' },
  { value: 'pesado', label: 'Pesado', emoji: '😮‍💨', tone: 'mid' },
  { value: 'molesto', label: 'Con molestia', emoji: '😣', tone: 'bad' },
  { value: 'mal', label: 'Mal', emoji: '🤢', tone: 'bad' },
];

// ───────────── Bristol ─────────────

export const BRISTOL: { type: BristolType; title: string; description: string; group: 'duro' | 'normal' | 'blando' }[] = [
  { type: 1, title: 'Tipo 1', description: 'Trozos duros separados, como nueces. Difícil de evacuar.', group: 'duro' },
  { type: 2, title: 'Tipo 2', description: 'Forma de salchicha, pero grumosa y dura.', group: 'duro' },
  { type: 3, title: 'Tipo 3', description: 'Como salchicha con grietas en la superficie.', group: 'normal' },
  { type: 4, title: 'Tipo 4', description: 'Como salchicha o serpiente, lisa y blanda.', group: 'normal' },
  { type: 5, title: 'Tipo 5', description: 'Trozos blandos con bordes definidos, fáciles de evacuar.', group: 'blando' },
  { type: 6, title: 'Tipo 6', description: 'Trozos esponjosos de bordes irregulares, pastosa.', group: 'blando' },
  { type: 7, title: 'Tipo 7', description: 'Acuosa, sin trozos sólidos. Totalmente líquida.', group: 'blando' },
];
export const bristolInfo = (t: BristolType) => BRISTOL[t - 1];
export const bristolTone = (t: BristolType): 'good' | 'mid' | 'bad' => (t === 3 || t === 4 ? 'good' : t === 2 || t === 5 ? 'mid' : 'bad');

export const STOOL_COLORS: { value: StoolColor; label: string; hex: string }[] = [
  { value: 'marron', label: 'Marrón', hex: '#7a4a26' },
  { value: 'marron_claro', label: 'Marrón claro', hex: '#a8774a' },
  { value: 'marron_oscuro', label: 'Marrón oscuro', hex: '#4e2f17' },
  { value: 'amarillo', label: 'Amarillo', hex: '#c9a23a' },
  { value: 'verde', label: 'Verde', hex: '#5d7a3a' },
  { value: 'negro', label: 'Negro / alquitrán', hex: '#1d1a17' },
  { value: 'rojo', label: 'Rojizo', hex: '#9c2f2a' },
  { value: 'gris_claro', label: 'Gris / arcilla', hex: '#c9c3b6' },
];
export const stoolColorLabel = (c: StoolColor) => STOOL_COLORS.find((x) => x.value === c)?.label ?? c;

export const AMOUNTS: { value: Amount; label: string }[] = [
  { value: 'poca', label: 'Poca' },
  { value: 'normal', label: 'Normal' },
  { value: 'abundante', label: 'Abundante' },
];

export const URGENCY_LABELS: Record<Level0to3, string> = { 0: 'Ninguna', 1: 'Leve', 2: 'Moderada', 3: 'No podía esperar' };
export const EFFORT_LABELS: Record<Level0to3, string> = { 0: 'Ninguno', 1: 'Leve', 2: 'Moderado', 3: 'Mucho' };

export const BLOOD_OPTIONS: { value: BloodPresence; label: string }[] = [
  { value: 'no', label: 'No observé' },
  { value: 'papel', label: 'Rastros en el papel' },
  { value: 'heces', label: 'En las heces' },
  { value: 'abundante', label: 'Abundante' },
];

// ───────────── Síntomas ─────────────

export type WindowKey = '0-6' | '6-24' | '24-72';
export const WINDOWS: Record<WindowKey, { from: number; to: number; label: string }> = {
  '0-6': { from: 0, to: 6, label: '0 a 6 horas' },
  '6-24': { from: 6, to: 24, label: '6 a 24 horas' },
  '24-72': { from: 24, to: 72, label: '24 a 72 horas' },
};

export interface SymptomDef {
  type: SymptomType;
  label: string;
  emoji: string;
  /** Ventanas de tiempo tras la comida en las que se busca este síntoma. */
  windows: WindowKey[];
  askLocation?: boolean;
}

export const SYMPTOMS: SymptomDef[] = [
  { type: 'hinchazon', label: 'Hinchazón / distensión', emoji: '🎈', windows: ['0-6', '6-24'] },
  { type: 'gases', label: 'Gases', emoji: '💨', windows: ['0-6', '6-24'] },
  { type: 'dolor', label: 'Dolor abdominal', emoji: '⚡', windows: ['0-6', '6-24'], askLocation: true },
  { type: 'acidez', label: 'Acidez / ardor', emoji: '🔥', windows: ['0-6'] },
  { type: 'nauseas', label: 'Náuseas', emoji: '🤢', windows: ['0-6'] },
  { type: 'retortijones', label: 'Retortijones', emoji: '🌀', windows: ['0-6', '6-24'], askLocation: true },
  { type: 'diarrea', label: 'Diarrea', emoji: '💧', windows: ['0-6', '6-24'] },
  { type: 'estrenimiento', label: 'Estreñimiento', emoji: '🧱', windows: ['24-72'] },
  { type: 'pesadez', label: 'Pesadez', emoji: '🪨', windows: ['0-6'] },
  { type: 'eructos', label: 'Eructos / reflujo', emoji: '🫧', windows: ['0-6'] },
  { type: 'vomito', label: 'Vómito', emoji: '🤮', windows: ['0-6'] },
  { type: 'otro', label: 'Otro', emoji: '✏️', windows: ['0-6', '6-24'] },
];
export const symptomDef = (t: SymptomType) => SYMPTOMS.find((s) => s.type === t) ?? SYMPTOMS[SYMPTOMS.length - 1];
export const symptomLabel = (t: SymptomType, custom?: string) => (t === 'otro' && custom ? custom : symptomDef(t).label);

export const ABDOMEN_ZONES: { value: AbdomenZone; label: string }[] = [
  { value: 'hipocondrio_derecho', label: 'Arriba a la derecha' },
  { value: 'epigastrio', label: 'Boca del estómago' },
  { value: 'hipocondrio_izquierdo', label: 'Arriba a la izquierda' },
  { value: 'flanco_derecho', label: 'Costado derecho' },
  { value: 'periumbilical', label: 'Alrededor del ombligo' },
  { value: 'flanco_izquierdo', label: 'Costado izquierdo' },
  { value: 'fosa_iliaca_derecha', label: 'Abajo a la derecha' },
  { value: 'hipogastrio', label: 'Bajo vientre' },
  { value: 'fosa_iliaca_izquierda', label: 'Abajo a la izquierda' },
  { value: 'general', label: 'Todo el abdomen' },
];
export const zoneLabel = (z?: AbdomenZone) => (z ? ABDOMEN_ZONES.find((x) => x.value === z)?.label ?? z : '');

export const intensityWord = (n: number) =>
  n === 0 ? 'Ninguna' : n <= 3 ? 'Leve' : n <= 6 ? 'Moderada' : n <= 8 ? 'Fuerte' : 'Muy fuerte';

// ───────────── Digestión del día ─────────────

export const DIGESTION: { value: DigestionRating; label: string; emoji: string; tone: 'good' | 'mid' | 'bad' }[] = [
  { value: 5, label: 'Muy bien', emoji: '😄', tone: 'good' },
  { value: 4, label: 'Bien', emoji: '🙂', tone: 'good' },
  { value: 3, label: 'Regular', emoji: '😐', tone: 'mid' },
  { value: 2, label: 'Mal', emoji: '😕', tone: 'bad' },
  { value: 1, label: 'Muy mal', emoji: '😣', tone: 'bad' },
];
export const digestionLabel = (r?: DigestionRating) => DIGESTION.find((d) => d.value === r)?.label ?? 'Sin registrar';

// ───────────── Tolerancia ─────────────

export const TOLERANCE: Record<ToleranceStatus, { label: string; short: string; description: string; tone: 'good' | 'mid' | 'bad' | 'none' }> = {
  tolero_bien: {
    label: 'Tolero bien',
    short: 'Bien',
    description: 'No se observa una asociación consistente con molestias.',
    tone: 'good',
  },
  a_medias: {
    label: 'Tolero a medias',
    short: 'A medias',
    description: 'Se registran molestias ocasionales o que dependen de la cantidad o preparación.',
    tone: 'mid',
  },
  posible_mala: {
    label: 'Posible mala tolerancia',
    short: 'Posible mala',
    description: 'Se repiten molestias después de consumir este alimento. No es un diagnóstico.',
    tone: 'bad',
  },
  sin_datos: {
    label: 'Sin datos suficientes',
    short: 'Sin datos',
    description: 'Falta información para clasificarlo.',
    tone: 'none',
  },
};
