/** Aplica el tema claro/oscuro al documento. */
import type { ThemePref } from '@/domain/types';

const THEME_KEY = 'digesta:theme';

export function resolveDark(pref: ThemePref): boolean {
  if (pref === 'oscuro') return true;
  if (pref === 'claro') return false;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

export function applyTheme(pref: ThemePref) {
  const dark = resolveDark(pref);
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0e1311' : '#f6f4ef');
  try {
    localStorage.setItem(THEME_KEY, pref); // para aplicar el tema antes de cargar la base (sin parpadeo)
  } catch {
    /* ignorar */
  }
}

export function cachedTheme(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'claro' || v === 'oscuro' || v === 'sistema') return v;
  } catch {
    /* ignorar */
  }
  return 'sistema';
}
