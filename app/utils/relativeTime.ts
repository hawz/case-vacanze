// EPIC 22/US-2204 — formattazione "X ore fa" / "ieri" / "3 giorni fa" per il
// feed "Attività recente" della dashboard. Stessa scelta già fatta altrove
// nel progetto (calendario, richieste disponibilità): `Intl` nativo invece
// di `d()`/`n()` di vue-i18n, perché il progetto non ha `datetimeFormats`
// configurato in nuxt.config.ts.
export function formatRelativeTime(isoTimestamp: string, locale: string): string {
  const then = new Date(isoTimestamp).getTime()
  const now = Date.now()
  const diffSeconds = Math.round((then - now) / 1000)

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

  const diffMinutes = Math.round(diffSeconds / 60)
  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, 'minute')
  }

  const diffHours = Math.round(diffMinutes / 60)
  if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, 'hour')
  }

  const diffDays = Math.round(diffHours / 24)
  if (Math.abs(diffDays) < 30) {
    return rtf.format(diffDays, 'day')
  }

  const diffMonths = Math.round(diffDays / 30)
  return rtf.format(diffMonths, 'month')
}
