<script setup lang="ts">
// EPIC 15 — Mini-sito pubblico: calendario disponibilità di sola lettura
// (US-1502). Stessa logica di griglia mensile di BlockedDatesCalendar.vue,
// duplicata qui in versione "read only" invece di condivisa: quella del
// backoffice ha anche CRUD/riordino, non riusabile as-is per una vista
// pubblica. Il motivo del blocco non viene nemmeno passato come prop dal
// chiamante (query senza colonna `reason`, AC lo richiede esplicitamente).
interface BlockedRange {
  start_date: string
  end_date: string
}

const props = defineProps<{ blockedRanges: BlockedRange[] }>()

const { t, locale } = useI18n()

const today = new Date()
const viewYear = ref(today.getFullYear())
const viewMonth = ref(today.getMonth())

function toIsoDate(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const monthLabel = computed(() => new Intl.DateTimeFormat(locale.value, { month: 'long', year: 'numeric' }).format(new Date(viewYear.value, viewMonth.value, 1)))

const weekdayLabels = computed(() => {
  const reference = new Date(2024, 0, 1) // lunedì di riferimento
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(reference)
    d.setDate(reference.getDate() + i)
    return new Intl.DateTimeFormat(locale.value, { weekday: 'short' }).format(d)
  })
})

const calendarWeeks = computed(() => {
  const firstOfMonth = new Date(viewYear.value, viewMonth.value, 1)
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7
  const gridStart = new Date(viewYear.value, viewMonth.value, 1 - firstWeekday)

  const weeks = []
  const cursor = new Date(gridStart)
  for (let week = 0; week < 6; week++) {
    const days = []
    for (let day = 0; day < 7; day++) {
      const iso = toIsoDate(cursor)
      days.push({
        day: cursor.getDate(),
        iso,
        inMonth: cursor.getMonth() === viewMonth.value,
        blocked: props.blockedRanges.some(b => b.start_date <= iso && iso <= b.end_date),
      })
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(days)
  }
  return weeks
})

function prevMonth() {
  if (viewMonth.value === 0) {
    viewMonth.value = 11
    viewYear.value -= 1
  }
  else {
    viewMonth.value -= 1
  }
}

function nextMonth() {
  if (viewMonth.value === 11) {
    viewMonth.value = 0
    viewYear.value += 1
  }
  else {
    viewMonth.value += 1
  }
}
</script>

<template>
  <section class="minisite-section">
    <h2 class="minisite-section__title">
      {{ t('minisite.calendar.title') }}
    </h2>

    <div class="minisite-calendar">
      <div class="minisite-calendar__header">
        <button
          type="button"
          class="minisite-calendar__nav"
          :aria-label="t('minisite.calendar.prevMonth')"
          @click="prevMonth"
        >
          ←
        </button>
        <span class="minisite-calendar__label">{{ monthLabel }}</span>
        <button
          type="button"
          class="minisite-calendar__nav"
          :aria-label="t('minisite.calendar.nextMonth')"
          @click="nextMonth"
        >
          →
        </button>
      </div>

      <div class="minisite-calendar__weekdays">
        <span
          v-for="label in weekdayLabels"
          :key="label"
          class="minisite-calendar__weekday"
        >
          {{ label }}
        </span>
      </div>

      <div
        v-for="(week, index) in calendarWeeks"
        :key="index"
        class="minisite-calendar__week"
      >
        <span
          v-for="cell in week"
          :key="cell.iso"
          class="minisite-calendar__day"
          :class="{ 'minisite-calendar__day--outside': !cell.inMonth, 'minisite-calendar__day--blocked': cell.blocked }"
        >
          {{ cell.day }}
        </span>
      </div>

      <div class="minisite-calendar__legend">
        <span class="minisite-calendar__legend-item">
          <span class="minisite-calendar__legend-swatch minisite-calendar__legend-swatch--blocked" />
          {{ t('minisite.calendar.legendBlocked') }}
        </span>
        <span class="minisite-calendar__legend-item">
          <span class="minisite-calendar__legend-swatch" />
          {{ t('minisite.calendar.legendAvailable') }}
        </span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.minisite-section {
  @apply mt-8;
}

.minisite-section__title {
  @apply text-lg;
  font-family: var(--font-family-display);
  font-weight: var(--font-display-weight, 700);
  color: var(--color-text);
}

.minisite-calendar {
  @apply mt-3 max-w-sm border p-4;
  border-color: var(--color-border, #e5e7eb);
  background-color: var(--color-surface);
  border-radius: var(--radius-base, 8px);
}

.minisite-calendar__header {
  @apply flex items-center justify-between;
}

.minisite-calendar__label {
  @apply text-sm font-semibold capitalize;
  color: var(--color-text);
}

.minisite-calendar__nav {
  @apply border px-2 py-1 text-sm;
  border-color: var(--color-border, #d1d5db);
  border-radius: var(--radius-base, 8px);
  color: var(--color-text);
}

.minisite-calendar__weekdays {
  @apply mt-3 grid grid-cols-7 text-center text-xs font-medium;
  color: var(--color-muted);
}

.minisite-calendar__week {
  @apply grid grid-cols-7 text-center;
}

.minisite-calendar__day {
  @apply flex aspect-square items-center justify-center text-sm;
  color: var(--color-text);
  border-radius: var(--radius-base, 8px);
}

.minisite-calendar__day--outside {
  color: var(--color-muted);
  opacity: 0.4;
}

.minisite-calendar__day--blocked {
  background-color: #fee2e2;
  color: #991b1b;
  font-weight: 600;
}

.minisite-calendar__legend {
  @apply mt-3 flex gap-4 text-xs;
  color: var(--color-muted);
}

.minisite-calendar__legend-item {
  @apply flex items-center gap-1.5;
}

.minisite-calendar__legend-swatch {
  @apply h-3 w-3 rounded-full;
  background-color: #e5e7eb;
}

.minisite-calendar__legend-swatch--blocked {
  background-color: #fee2e2;
  border: 1px solid #991b1b;
}
</style>
