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
  // US-1003 (EPIC 10): 10 temi aggiuntivi. Tutti a sfondo chiaro come i tre
  // sopra — un tema a sfondo scuro richiederebbe rivedere i colori
  // hardcoded (bordi, badge di stato, colori di brand OTA) sparsi nei
  // componenti del mini-sito, non solo queste variabili, fuori scope qui.
  // Ogni combinazione è stata verificata per il contrasto WCAG AA (testo/
  // sfondo ≥ 4.5:1, primary/bianco per i pulsanti ≥ 4.5:1) calcolando la
  // luminanza relativa, non scelta a occhio.
  {
    id: 'forest',
    label: 'Forest',
    colors: {
      primary: '#15803d',
      primaryDark: '#166534',
      accent: '#ca8a04',
      surface: '#ffffff',
      background: '#f7faf7',
      text: '#14201a',
      muted: '#5b6b60',
    },
  },
  {
    id: 'lavender',
    label: 'Lavender',
    colors: {
      primary: '#6d28d9',
      primaryDark: '#5b21b6',
      accent: '#ec4899',
      surface: '#ffffff',
      background: '#faf5ff',
      text: '#1e1b2e',
      muted: '#6b6478',
    },
  },
  {
    id: 'terracotta',
    label: 'Terracotta',
    colors: {
      primary: '#a83e26',
      primaryDark: '#7c2d1b',
      accent: '#0d9488',
      surface: '#ffffff',
      background: '#fdf6ec',
      text: '#2a1d12',
      muted: '#7a6a58',
    },
  },
  {
    id: 'slate',
    label: 'Slate',
    colors: {
      primary: '#475569',
      primaryDark: '#334155',
      accent: '#f97316',
      surface: '#ffffff',
      background: '#f8fafc',
      text: '#0f172a',
      muted: '#64748b',
    },
  },
  {
    id: 'berry',
    label: 'Berry',
    colors: {
      primary: '#9d174d',
      primaryDark: '#831843',
      accent: '#10b981',
      surface: '#ffffff',
      background: '#fdf2f8',
      text: '#27121c',
      muted: '#7a5560',
    },
  },
  {
    id: 'olive',
    label: 'Olive',
    colors: {
      primary: '#65733e',
      primaryDark: '#4d5830',
      accent: '#c2410c',
      surface: '#ffffff',
      background: '#f9f8f2',
      text: '#232318',
      muted: '#6b6b53',
    },
  },
  {
    id: 'plum',
    label: 'Plum',
    colors: {
      primary: '#86198f',
      primaryDark: '#701a75',
      accent: '#d97706',
      surface: '#ffffff',
      background: '#fdfaf6',
      text: '#23132e',
      muted: '#776a5c',
    },
  },
  {
    id: 'coral-reef',
    label: 'Coral Reef',
    colors: {
      primary: '#be123c',
      primaryDark: '#9f1239',
      accent: '#06b6d4',
      surface: '#ffffff',
      background: '#fff5f5',
      text: '#2c1215',
      muted: '#8a6367',
    },
  },
  {
    id: 'sand',
    label: 'Sand',
    colors: {
      primary: '#92400e',
      primaryDark: '#78350f',
      accent: '#1d4ed8',
      surface: '#ffffff',
      background: '#fefbf3',
      text: '#241d10',
      muted: '#756b57',
    },
  },
  {
    id: 'mint',
    label: 'Mint',
    colors: {
      primary: '#047857',
      primaryDark: '#065f46',
      accent: '#f43f5e',
      surface: '#ffffff',
      background: '#f0fdf9',
      text: '#0d211b',
      muted: '#4f6b60',
    },
  },
]

export function getTheme(id: string): Theme {
  return themes.find(theme => theme.id === id) ?? themes[0]
}
