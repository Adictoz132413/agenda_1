/**
 * Catálogo base de alimentos (enfocado en Colombia) y utilidades de búsqueda.
 * La persona puede agregar alimentos propios; el catálogo sólo facilita la
 * escritura rápida y aporta etiquetas (lácteo, picante, cafeína…) para el análisis.
 */
import type { FoodTag, MealFlag } from './types';

export interface CatalogFood {
  name: string;
  tags: FoodTag[];
  /** Ingredientes típicos de una preparación, para sugerirlos. */
  ingredients?: string[];
  aliases?: string[];
}

/** Normaliza un nombre a una clave estable: minúsculas, sin tildes, espacios simples. */
export function foodKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Primera letra en mayúscula, resto como se escribió. */
export function prettyName(name: string): string {
  const t = name.trim().replace(/\s+/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export const FOOD_CATALOG: CatalogFood[] = [
  // Bebidas
  { name: 'Café', tags: ['cafeina'], aliases: ['tinto', 'cafe negro'] },
  { name: 'Café con leche', tags: ['cafeina', 'lacteo'], ingredients: ['Café', 'Leche'] },
  { name: 'Tinto', tags: ['cafeina'] },
  { name: 'Chocolate caliente', tags: ['lacteo', 'azucar', 'cafeina'], ingredients: ['Chocolate', 'Leche'] },
  { name: 'Aguapanela', tags: ['azucar'], ingredients: ['Panela'] },
  { name: 'Té', tags: ['cafeina'] },
  { name: 'Aromática', tags: [] },
  { name: 'Jugo de naranja', tags: ['fruta', 'azucar'] },
  { name: 'Jugo de lulo', tags: ['fruta', 'azucar'] },
  { name: 'Jugo de mora', tags: ['fruta', 'azucar'] },
  { name: 'Jugo de maracuyá', tags: ['fruta', 'azucar'] },
  { name: 'Limonada', tags: ['fruta', 'azucar'] },
  { name: 'Gaseosa', tags: ['gaseosa', 'azucar'] },
  { name: 'Gaseosa cero', tags: ['gaseosa', 'edulcorante'] },
  { name: 'Agua', tags: [] },
  { name: 'Agua con gas', tags: ['gaseosa'] },
  { name: 'Cerveza', tags: ['alcohol', 'gluten', 'gaseosa'] },
  { name: 'Vino', tags: ['alcohol'] },
  { name: 'Aguardiente', tags: ['alcohol'] },
  { name: 'Ron', tags: ['alcohol'] },
  { name: 'Bebida energizante', tags: ['cafeina', 'azucar', 'gaseosa'] },
  { name: 'Kumis', tags: ['lacteo', 'azucar'] },
  { name: 'Avena (bebida)', tags: ['lacteo', 'cereal', 'azucar'], ingredients: ['Avena', 'Leche'] },
  { name: 'Batido de proteína', tags: ['proteina'], aliases: ['whey', 'proteina en polvo'] },
  { name: 'Leche', tags: ['lacteo'] },
  { name: 'Leche deslactosada', tags: ['lacteo'] },
  { name: 'Bebida de almendras', tags: [] },
  // Lácteos
  { name: 'Queso campesino', tags: ['lacteo', 'proteina'] },
  { name: 'Queso costeño', tags: ['lacteo', 'proteina'] },
  { name: 'Queso doble crema', tags: ['lacteo', 'grasa'] },
  { name: 'Yogur', tags: ['lacteo'] },
  { name: 'Yogur griego', tags: ['lacteo', 'proteina'] },
  { name: 'Mantequilla', tags: ['lacteo', 'grasa'] },
  { name: 'Crema de leche', tags: ['lacteo', 'grasa'] },
  { name: 'Helado', tags: ['lacteo', 'azucar', 'grasa'] },
  // Desayunos y harinas
  { name: 'Arepa', tags: ['cereal'], aliases: ['arepa blanca'] },
  { name: 'Arepa con queso', tags: ['cereal', 'lacteo'], ingredients: ['Arepa', 'Queso campesino'] },
  { name: 'Arepa de huevo', tags: ['cereal', 'frito', 'grasa', 'proteina'], ingredients: ['Arepa', 'Huevo'] },
  { name: 'Pan', tags: ['gluten', 'cereal'] },
  { name: 'Pan integral', tags: ['gluten', 'cereal', 'fibra_alta'] },
  { name: 'Pan de bono', tags: ['lacteo', 'cereal'] },
  { name: 'Almojábana', tags: ['lacteo', 'cereal'] },
  { name: 'Buñuelo', tags: ['lacteo', 'frito', 'grasa'] },
  { name: 'Pandebono', tags: ['lacteo', 'cereal'] },
  { name: 'Empanada', tags: ['frito', 'grasa', 'cereal'] },
  { name: 'Changua', tags: ['lacteo', 'proteina'], ingredients: ['Leche', 'Huevo', 'Pan'] },
  { name: 'Calentado', tags: ['leguminosa', 'grasa'], ingredients: ['Arroz', 'Fríjoles', 'Huevo'] },
  { name: 'Huevo', tags: ['proteina'], aliases: ['huevos', 'huevo frito', 'huevos pericos'] },
  { name: 'Huevos pericos', tags: ['proteina'], ingredients: ['Huevo', 'Tomate', 'Cebolla'] },
  { name: 'Avena en hojuelas', tags: ['cereal', 'fibra_alta'] },
  { name: 'Granola', tags: ['cereal', 'azucar', 'fibra_alta'] },
  { name: 'Cereal de caja', tags: ['cereal', 'azucar', 'procesado'] },
  // Platos típicos
  { name: 'Bandeja paisa', tags: ['leguminosa', 'grasa', 'frito', 'proteina'], ingredients: ['Fríjoles', 'Arroz', 'Chicharrón', 'Carne molida', 'Chorizo', 'Huevo', 'Plátano maduro', 'Aguacate', 'Arepa'] },
  { name: 'Ajiaco', tags: ['proteina'], ingredients: ['Papa', 'Pollo', 'Mazorca', 'Guascas', 'Crema de leche', 'Alcaparras'] },
  { name: 'Sancocho', tags: ['proteina'], ingredients: ['Papa', 'Yuca', 'Plátano verde', 'Pollo', 'Mazorca'] },
  { name: 'Mondongo', tags: ['proteina', 'grasa'], ingredients: ['Mondongo', 'Papa', 'Yuca', 'Cerdo'] },
  { name: 'Tamal', tags: ['grasa', 'cereal', 'proteina'], ingredients: ['Masa de maíz', 'Cerdo', 'Pollo', 'Arveja', 'Zanahoria'] },
  { name: 'Lechona', tags: ['grasa', 'proteina'], ingredients: ['Cerdo', 'Arroz', 'Arveja'] },
  { name: 'Sopa de lentejas', tags: ['leguminosa', 'fibra_alta'] },
  { name: 'Fríjoles', tags: ['leguminosa', 'fibra_alta'], aliases: ['frijoles', 'frisoles'] },
  { name: 'Lentejas', tags: ['leguminosa', 'fibra_alta'] },
  { name: 'Garbanzos', tags: ['leguminosa', 'fibra_alta'] },
  { name: 'Arveja', tags: ['leguminosa'] },
  { name: 'Arroz', tags: ['cereal'], aliases: ['arroz blanco'] },
  { name: 'Arroz con pollo', tags: ['cereal', 'proteina'], ingredients: ['Arroz', 'Pollo', 'Arveja', 'Zanahoria'] },
  { name: 'Pasta', tags: ['gluten', 'cereal'] },
  { name: 'Papa', tags: [] },
  { name: 'Papa criolla', tags: [] },
  { name: 'Papas fritas', tags: ['frito', 'grasa'] },
  { name: 'Yuca', tags: [] },
  { name: 'Plátano maduro', tags: ['fruta', 'azucar'] },
  { name: 'Patacón', tags: ['frito', 'grasa'] },
  { name: 'Mazorca', tags: ['cereal'] },
  // Proteínas
  { name: 'Pollo', tags: ['proteina'] },
  { name: 'Carne de res', tags: ['proteina'] },
  { name: 'Carne molida', tags: ['proteina', 'grasa'] },
  { name: 'Cerdo', tags: ['proteina', 'grasa'] },
  { name: 'Chicharrón', tags: ['proteina', 'grasa', 'frito'] },
  { name: 'Chorizo', tags: ['proteina', 'grasa', 'procesado'] },
  { name: 'Salchicha', tags: ['proteina', 'grasa', 'procesado'] },
  { name: 'Jamón', tags: ['proteina', 'procesado'] },
  { name: 'Pescado', tags: ['proteina'] },
  { name: 'Atún', tags: ['proteina'] },
  { name: 'Camarones', tags: ['proteina'] },
  { name: 'Tofu', tags: ['proteina', 'leguminosa'] },
  // Verduras
  { name: 'Ensalada', tags: ['verdura', 'fibra_alta'] },
  { name: 'Lechuga', tags: ['verdura'] },
  { name: 'Tomate', tags: ['verdura'] },
  { name: 'Cebolla', tags: ['verdura'] },
  { name: 'Ajo', tags: ['verdura'] },
  { name: 'Brócoli', tags: ['verdura', 'cruciferas', 'fibra_alta'] },
  { name: 'Coliflor', tags: ['verdura', 'cruciferas'] },
  { name: 'Repollo', tags: ['verdura', 'cruciferas'] },
  { name: 'Zanahoria', tags: ['verdura'] },
  { name: 'Ahuyama', tags: ['verdura'] },
  { name: 'Espinaca', tags: ['verdura'] },
  { name: 'Pepino', tags: ['verdura'] },
  { name: 'Pimentón', tags: ['verdura'] },
  { name: 'Champiñones', tags: ['verdura'] },
  { name: 'Aguacate', tags: ['grasa', 'fruta'] },
  // Frutas
  { name: 'Banano', tags: ['fruta'] },
  { name: 'Manzana', tags: ['fruta', 'fibra_alta'] },
  { name: 'Pera', tags: ['fruta', 'fibra_alta'] },
  { name: 'Papaya', tags: ['fruta'] },
  { name: 'Mango', tags: ['fruta', 'azucar'] },
  { name: 'Piña', tags: ['fruta'] },
  { name: 'Fresas', tags: ['fruta'] },
  { name: 'Uvas', tags: ['fruta', 'azucar'] },
  { name: 'Sandía', tags: ['fruta'] },
  { name: 'Guayaba', tags: ['fruta', 'fibra_alta'] },
  { name: 'Granadilla', tags: ['fruta'] },
  { name: 'Mandarina', tags: ['fruta'] },
  { name: 'Naranja', tags: ['fruta'] },
  // Snacks y otros
  { name: 'Ají', tags: ['picante'], aliases: ['aji', 'salsa picante'] },
  { name: 'Salsa picante', tags: ['picante'] },
  { name: 'Mayonesa', tags: ['grasa', 'procesado'] },
  { name: 'Salsa de tomate', tags: ['azucar', 'procesado'] },
  { name: 'Chocolatina', tags: ['azucar', 'lacteo', 'grasa'] },
  { name: 'Galletas', tags: ['gluten', 'azucar', 'procesado'] },
  { name: 'Paquete de papas', tags: ['frito', 'grasa', 'procesado'] },
  { name: 'Maní', tags: ['grasa', 'leguminosa'] },
  { name: 'Nueces / almendras', tags: ['grasa'] },
  { name: 'Mantequilla de maní', tags: ['grasa', 'leguminosa'] },
  { name: 'Bocadillo', tags: ['azucar'] },
  { name: 'Postre', tags: ['azucar', 'lacteo'] },
  { name: 'Pizza', tags: ['gluten', 'lacteo', 'grasa'] },
  { name: 'Hamburguesa', tags: ['gluten', 'grasa', 'proteina'] },
  { name: 'Perro caliente', tags: ['gluten', 'grasa', 'procesado'] },
  { name: 'Salchipapa', tags: ['frito', 'grasa', 'procesado'] },
  { name: 'Comida china', tags: ['grasa', 'frito'] },
  { name: 'Barra de proteína', tags: ['proteina', 'procesado', 'edulcorante'] },
];

const CATALOG_BY_KEY = new Map<string, CatalogFood>();
for (const f of FOOD_CATALOG) {
  CATALOG_BY_KEY.set(foodKey(f.name), f);
}
const ALIAS_TO_KEY = new Map<string, string>();
for (const f of FOOD_CATALOG) {
  for (const a of f.aliases ?? []) ALIAS_TO_KEY.set(foodKey(a), foodKey(f.name));
}

export function catalogFood(key: string): CatalogFood | undefined {
  return CATALOG_BY_KEY.get(key) ?? CATALOG_BY_KEY.get(ALIAS_TO_KEY.get(key) ?? '');
}

/** Etiquetas de un alimento: catálogo + alimentos personalizados. */
export function tagsForKey(key: string, custom?: Map<string, FoodTag[]>): FoodTag[] {
  return custom?.get(key) ?? catalogFood(key)?.tags ?? [];
}

const TAG_TO_FLAG: Partial<Record<FoodTag, MealFlag>> = {
  lacteo: 'lacteos',
  picante: 'picante',
  grasa: 'grasas',
  frito: 'grasas',
  cafeina: 'cafeina',
  alcohol: 'alcohol',
  gaseosa: 'gaseosa',
  azucar: 'azucar',
};

/** Deriva banderas de comida (café, lácteos, picante…) a partir de los alimentos. */
export function deriveFlags(itemKeys: string[], custom?: Map<string, FoodTag[]>): MealFlag[] {
  const flags = new Set<MealFlag>();
  for (const k of itemKeys) {
    if (k.includes('cafe') || k === 'tinto') flags.add('cafe');
    for (const t of tagsForKey(k, custom)) {
      const f = TAG_TO_FLAG[t];
      if (f) flags.add(f);
    }
  }
  if (flags.has('cafe')) flags.add('cafeina');
  return [...flags];
}

export interface SearchCandidate {
  name: string;
  key: string;
  source: 'historial' | 'propio' | 'catalogo';
  /** Número de veces consumido (para ordenar). */
  count?: number;
  ingredients?: string[];
}

/**
 * Busca alimentos combinando historial (más usados primero), alimentos propios y catálogo.
 * Coincide por prefijo de palabra y por subcadena, sin tildes.
 */
export function searchFoods(
  query: string,
  history: { name: string; key: string; count: number }[],
  custom: { name: string; key: string }[],
  limit = 12,
): SearchCandidate[] {
  const q = foodKey(query);
  const seen = new Set<string>();
  const out: { c: SearchCandidate; score: number }[] = [];
  const score = (name: string, aliases: string[] = []) => {
    if (!q) return 1;
    const k = foodKey(name);
    const all = [k, ...aliases.map(foodKey)];
    let best = 0;
    for (const s of all) {
      if (s === q) best = Math.max(best, 100);
      else if (s.startsWith(q)) best = Math.max(best, 60);
      else if (s.split(' ').some((w) => w.startsWith(q))) best = Math.max(best, 40);
      else if (s.includes(q)) best = Math.max(best, 20);
    }
    return best;
  };
  for (const h of history) {
    const s = score(h.name);
    if (s > 0 && !seen.has(h.key)) {
      seen.add(h.key);
      out.push({ c: { name: h.name, key: h.key, source: 'historial', count: h.count, ingredients: catalogFood(h.key)?.ingredients }, score: s + 10 + Math.min(h.count, 30) });
    }
  }
  for (const c of custom) {
    const s = score(c.name);
    if (s > 0 && !seen.has(c.key)) {
      seen.add(c.key);
      out.push({ c: { name: c.name, key: c.key, source: 'propio' }, score: s + 5 });
    }
  }
  for (const f of FOOD_CATALOG) {
    const k = foodKey(f.name);
    const s = score(f.name, f.aliases);
    if (s > 0 && !seen.has(k)) {
      seen.add(k);
      out.push({ c: { name: f.name, key: k, source: 'catalogo', ingredients: f.ingredients }, score: s });
    }
  }
  if (!q) {
    // Sin búsqueda: priorizar historial
    out.sort((a, b) => b.score - a.score);
  } else {
    out.sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name, 'es'));
  }
  return out.slice(0, limit).map((o) => o.c);
}
