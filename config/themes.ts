/**
 * Definizione dei temi disponibili per i mini-siti delle proprietà.
 * Ogni proprietà, in futuro, potrà selezionare un tema da questo elenco:
 * i valori vengono applicati come variabili CSS custom properties
 * (vedi app/assets/css/main.css per i default) tramite uno style
 * scope o una classe sul contenitore del mini-sito.
 */
export interface Theme {
  id: string
  label: string
  colors: {
    primary: string
    primaryDark: string
    accent: string
    surface: string
    background: string
    text: string
    muted: string
  }
}

export const themes: Theme[] = [
  {
    id: 'default',
    label: 'Default (Teal)',
    colors: {
      primary: '#0f766e',
      primaryDark: '#115e59',
      accent: '#f59e0b',
      surface: '#ffffff',
      background: '#f9fafb',
      text: '#111827',
      muted: '#6b7280',
    },
  },
  {
    id: 'sunset',
    label: 'Sunset',
    colors: {
      primary: '#c2410c',
      primaryDark: '#9a3412',
      accent: '#0ea5e9',
      surface: '#fffbeb',
      background: '#fff7ed',
      text: '#1c1917',
      muted: '#78716c',
    },
  },
  {
    id: 'ocean',
    label: 'Ocean',
    colors: {
      primary: '#0369a1',
      primaryDark: '#075985',
      accent: '#f97316',
      surface: '#ffffff',
      background: '#f0f9ff',
      text: '#0c1e2e',
      muted: '#64748b',
    },
  },
]

export function getTheme(id: string): Theme {
  return themes.find(theme => theme.id === id) ?? themes[0]
}
