/**
 * Filtro Obra/Presupuesto recordado en localStorage entre menús, hasta que el
 * usuario lo limpie. Cada página usa su propia clave.
 */

export interface SavedFilter {
  project: number | '';
  budget: number | '';
}

export function readSavedFilter(key: string): SavedFilter | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<SavedFilter>;
    return {
      project: typeof data.project === 'number' ? data.project : '',
      budget: typeof data.budget === 'number' ? data.budget : '',
    };
  } catch {
    return null;
  }
}

export function saveFilter(key: string, filter: SavedFilter | null): void {
  try {
    if (filter && filter.project) localStorage.setItem(key, JSON.stringify(filter));
    else localStorage.removeItem(key);
  } catch {
    // localStorage no disponible: el filtro simplemente no se recuerda
  }
}
