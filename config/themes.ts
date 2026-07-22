/**
 * Definizione dei temi disponibili per i mini-siti delle proprietà.
 * Ogni proprietà seleziona un tema da questo elenco (ThemeStep.vue nel
 * wizard): i valori vengono applicati come variabili CSS custom properties
 * sul contenitore radice del mini-sito (vedi themeVars in app/pages/[slug].vue),
 * mai sui token globali di app/assets/css/main.css — quelli restano lo stile
 * fisso del resto del sito (dashboard, wizard, home page), indipendente dal
 * tema scelto per una singola proprietà.
 *
 * EPIC 21/US-2103: revamp deciso con Albe dopo un mockup di approvazione
 * (docs/epic-21-mockup.html) — i 13 temi precedenti (EPIC 10/US-1003)
 * differivano solo per `primary`/`accent` su uno stesso sfondo quasi bianco
 * e uno stesso font: risultavano "tutti uguali". Sostituiti con un set più
 * piccolo (4) ma ognuno realmente distinto per colore, font E forma degli
 * angoli — non solo tinta. Le proprietà con un `theme_id` non più presente
 * in questo elenco (i vecchi 'default'/'sunset'/... prima del revamp)
 * ricadono automaticamente sul primo tema tramite il fallback già presente
 * in getTheme(), senza errori — cambiano solo aspetto senza che il
 * proprietario l'abbia scelto: accettato consapevolmente con Albe.
 */
export interface Theme {
  id: string
  label: string
  /** Riga descrittiva breve, mostrata nella card di scelta nel wizard. */
  description: string
  colors: {
    primary: string
    primaryDark: string
    accent: string
    /** Colore testo/icona sopra un elemento con sfondo `primary` (bottoni, badge). */
    onPrimary: string
    surface: string
    background: string
    text: string
    muted: string
    border: string
  }
  fonts: {
    /** Font dei titoli (nome proprietà, titoli di sezione). */
    display: string
    /** Font del corpo testo — sovrascrive --font-family-base solo dentro il mini-sito. */
    body: string
    displayWeight: number
  }
  radius: {
    /** Angoli di card, foto, contenitori. */
    base: string
    /** Angoli di chip/badge/bottoni "a pillola". */
    pill: string
  }
}

export const themes: Theme[] = [
  {
    id: 'meridiana',
    label: 'Meridiana',
    description: 'Luce del giorno, teal e ambra — evoluzione del tema di partenza',
    colors: {
      primary: '#0b6e63',
      primaryDark: '#084f47',
      accent: '#c08a1e',
      onPrimary: '#fff8ec',
      surface: '#fbf6ea',
      background: '#f4ecdb',
      text: '#322c1c',
      muted: '#746952',
      border: '#e7dcc2',
    },
    fonts: {
      display: 'Georgia, "Iowan Old Style", "Palatino Linotype", serif',
      body: '"Segoe UI", -apple-system, Helvetica, Arial, sans-serif',
      displayWeight: 600,
    },
    radius: {
      base: '14px',
      pill: '999px',
    },
  },
  {
    id: 'notte',
    label: 'Notte di Castelsardo',
    description: 'Sera sulla costa — tema a sfondo scuro, ambra e acqua',
    colors: {
      primary: '#e8a33d',
      primaryDark: '#c6822a',
      accent: '#5fa8a0',
      onPrimary: '#221604',
      surface: '#1a2226',
      background: '#12181b',
      text: '#d8d2c4',
      muted: '#8b968f',
      border: '#2b3438',
    },
    fonts: {
      display: 'Futura, "Century Gothic", "Trebuchet MS", sans-serif',
      body: '-apple-system, "Segoe UI", Helvetica, Arial, sans-serif',
      displayWeight: 600,
    },
    radius: {
      base: '8px',
      pill: '8px',
    },
  },
  {
    id: 'macchia',
    label: 'Macchia',
    description: 'Verde e terra — tono informale, angoli morbidi',
    colors: {
      primary: '#4b6b3a',
      primaryDark: '#364f29',
      accent: '#9c5a3c',
      onPrimary: '#f6f7ee',
      surface: '#ffffff',
      background: '#eef0e2',
      text: '#333c26',
      muted: '#6a6e56',
      border: '#dbe0c8',
    },
    fonts: {
      display: '"Arial Rounded MT Bold", Verdana, "Trebuchet MS", sans-serif',
      body: '"Trebuchet MS", Verdana, sans-serif',
      displayWeight: 700,
    },
    radius: {
      base: '22px',
      pill: '999px',
    },
  },
  {
    id: 'calce',
    label: 'Calce',
    description: 'Bianco minimale — stile boutique, angoli squadrati',
    colors: {
      primary: '#0e0e0e',
      primaryDark: '#000000',
      accent: '#167fa3',
      onPrimary: '#ffffff',
      surface: '#ffffff',
      background: '#ffffff',
      text: '#2a2a2a',
      muted: '#767676',
      border: '#e2e2e2',
    },
    fonts: {
      display: '"Big Caslon", Didot, Georgia, serif',
      body: 'Helvetica, Arial, sans-serif',
      displayWeight: 500,
    },
    radius: {
      base: '2px',
      pill: '2px',
    },
  },
]

export function getTheme(id: string): Theme {
  return themes.find(theme => theme.id === id) ?? themes[0]
}
