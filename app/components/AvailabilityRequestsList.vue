<script setup lang="ts">
// EPIC 14 — Backoffice: Gestione richieste di disponibilità (US-1401/1402/
// 1403). Solo lato owner: le richieste vengono create dal mini-sito
// (US-1601, EPIC 16, non ancora esistente), ma la tabella e le RLS di
// lettura/scrittura owner esistono già — costruibile ora, semplicemente
// senza dati reali finché EPIC 15/16 non esistono (stesso principio già
// seguito per calendario e comunicazioni).
//
// Nessun form di creazione qui (le richieste arrivano solo dagli ospiti):
// solo elenco, dettaglio espandibile e cambio stato (niente eliminazione,
// non richiesta dall'AC).
//
// EPIC 20/US-2005: confronto con blocked_dates (nessuna nuova RLS: stessa
// policy "blocked_dates_owner_write" già usata da BlockedDatesCalendar.vue,
// da cui è riusata anche la logica di confronto intervalli) + blocco
// automatico del calendario quando una richiesta viene accettata e le date
// non si sovrappongono già a un periodo esistente.
const STATUSES = ['NEW', 'CONTACTED', 'ACCEPTED', 'REJECTED'] as const
type RequestStatus = typeof STATUSES[number]

interface AvailabilityRequest {
  id: string
  guest_name: string
  email: string
  phone: string | null
  check_in: string
  check_out: string
  guests_count: number
  message: string | null
  status: RequestStatus
  created_at: string
}

interface BlockedRange {
  start_date: string
  end_date: string
}

const props = defineProps<{ propertyId: string }>()

const { t, locale } = useI18n()
const supabase = useSupabaseClient()

function statusLabel(status: string) {
  return t(`requests.statuses.${status}`)
}

const blockedRanges = ref<BlockedRange[]>([])

async function loadBlockedRanges() {
  const { data } = await supabase
    .from('blocked_dates')
    .select('start_date, end_date')
    .eq('property_id', props.propertyId)

  blockedRanges.value = data ?? []
}

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart <= bEnd && bStart <= aEnd
}

function hasOverlap(request: AvailabilityRequest) {
  return blockedRanges.value.some(b => rangesOverlap(request.check_in, request.check_out, b.start_date, b.end_date))
}

// Niente datetimeFormats configurato in nuxt.config.ts (il modulo i18n non
// lo definisce): si formatta a mano con Intl, come in BlockedDatesCalendar.vue,
// invece di affidarsi a d() di vue-i18n che richiederebbe quella config.
function formatDate(value: string) {
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(value))
}

function formatDateAndTime(value: string) {
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

const requests = ref<AvailabilityRequest[]>([])
const isLoading = ref(true)
const loadError = ref('')

// Ultimo stato salvato per richiesta (diverso da request.status, che viene
// mutato subito dal v-model della select appena l'owner cambia la scelta,
// prima ancora di salvare): serve per riconoscere il PASSAGGIO a "Accettata"
// nel momento del salvataggio, non semplicemente "lo stato è Accettata".
const lastSavedStatus = ref<Record<string, RequestStatus>>({})

const newCount = computed(() => requests.value.filter(r => r.status === 'NEW').length)

async function loadRequests() {
  isLoading.value = true
  loadError.value = ''

  const { data, error } = await supabase
    .from('availability_requests')
    .select('id, guest_name, email, phone, check_in, check_out, guests_count, message, status, created_at')
    .eq('property_id', props.propertyId)
    .order('created_at', { descending: true })

  isLoading.value = false

  if (error) {
    loadError.value = t('requests.errors.load')
    return
  }

  requests.value = data ?? []
  for (const request of requests.value) {
    lastSavedStatus.value[request.id] = request.status
  }
}

onMounted(() => {
  loadRequests()
  loadBlockedRanges()
})

// --- Dettaglio espandibile (US-1402) ---
const expandedId = ref<string | null>(null)

function toggleExpanded(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}

// --- Cambio stato (US-1402) ---
const savingId = ref<string | null>(null)
const savedId = ref<string | null>(null)
const saveError = ref<Record<string, string>>({})
const autoBlockMessage = ref<Record<string, string>>({})

async function saveStatus(request: AvailabilityRequest) {
  saveError.value = { ...saveError.value, [request.id]: '' }
  autoBlockMessage.value = { ...autoBlockMessage.value, [request.id]: '' }
  savingId.value = request.id

  const { error } = await supabase
    .from('availability_requests')
    .update({ status: request.status })
    .eq('id', request.id)

  savingId.value = null

  if (error) {
    saveError.value = { ...saveError.value, [request.id]: t('requests.errors.save') }
    return
  }

  // EPIC 20/US-2005: blocco automatico del calendario solo al PASSAGGIO a
  // "Accettata" (non ad ogni salvataggio successivo a stato invariato) e
  // solo se le date non si sovrappongono già a un periodo esistente.
  const previousStatus = lastSavedStatus.value[request.id]
  lastSavedStatus.value[request.id] = request.status

  if (request.status === 'ACCEPTED' && previousStatus !== 'ACCEPTED') {
    if (hasOverlap(request)) {
      autoBlockMessage.value = { ...autoBlockMessage.value, [request.id]: t('requests.autoBlock.skippedOverlap') }
    }
    else {
      const { data: blockData, error: blockError } = await supabase
        .from('blocked_dates')
        .insert({
          property_id: props.propertyId,
          start_date: request.check_in,
          end_date: request.check_out,
          reason: `${request.guest_name} (${request.email})`,
        })
        .select('start_date, end_date')
        .single()

      if (blockError || !blockData) {
        autoBlockMessage.value = { ...autoBlockMessage.value, [request.id]: t('requests.autoBlock.error') }
      }
      else {
        blockedRanges.value.push(blockData)
        autoBlockMessage.value = { ...autoBlockMessage.value, [request.id]: t('requests.autoBlock.created') }
      }
    }
  }

  savedId.value = request.id
  setTimeout(() => {
    if (savedId.value === request.id) savedId.value = null
  }, 2000)
}
</script>

<template>
  <div class="requests-widget">
    <p
      v-if="newCount > 0"
      class="requests-widget__badge"
    >
      {{ t('properties.newRequestsBadge', { count: newCount }) }}
    </p>

    <p
      v-if="loadError"
      class="requests-form__alert"
      role="alert"
    >
      {{ loadError }}
    </p>

    <p
      v-else-if="isLoading"
      class="requests-widget__loading"
    >
      {{ t('requests.loading') }}
    </p>

    <p
      v-else-if="requests.length === 0"
      class="requests-empty"
    >
      {{ t('requests.empty') }}
    </p>

    <ul
      v-else
      class="requests-list"
    >
      <li
        v-for="request in requests"
        :key="request.id"
        class="request-card"
      >
        <button
          type="button"
          class="request-card__summary"
          @click="toggleExpanded(request.id)"
        >
          <span class="request-card__name">{{ request.guest_name }}</span>
          <span class="request-card__dates">{{ formatDate(request.check_in) }} → {{ formatDate(request.check_out) }}</span>
          <span
            class="request-card__status"
            :class="`request-card__status--${request.status.toLowerCase()}`"
          >
            {{ statusLabel(request.status) }}
          </span>
          <span class="request-card__toggle">
            {{ expandedId === request.id ? t('requests.hideDetails') : t('requests.viewDetails') }}
          </span>
        </button>

        <div
          v-if="expandedId === request.id"
          class="request-card__details"
        >
          <p>
            <strong>{{ t('requests.fields.guestsCount') }}:</strong> {{ request.guests_count }}
          </p>
          <p>
            <strong>{{ t('requests.fields.email') }}:</strong> {{ request.email }}
          </p>
          <p v-if="request.phone">
            <strong>{{ t('requests.fields.phone') }}:</strong> {{ request.phone }}
          </p>
          <p v-if="request.message">
            <strong>{{ t('requests.fields.message') }}:</strong> {{ request.message }}
          </p>
          <p>
            <strong>{{ t('requests.fields.receivedAt') }}:</strong> {{ formatDateAndTime(request.created_at) }}
          </p>

          <p
            v-if="hasOverlap(request)"
            class="request-card__overlap request-card__overlap--warning"
          >
            {{ t('requests.overlapWarning') }}
          </p>
          <p
            v-else
            class="request-card__overlap request-card__overlap--ok"
          >
            {{ t('requests.overlapOk') }}
          </p>

          <div class="request-card__field">
            <label class="request-card__label">{{ t('requests.fields.statusLabel') }}</label>
            <select
              v-model="request.status"
              class="request-card__input"
            >
              <option
                v-for="status in STATUSES"
                :key="status"
                :value="status"
              >
                {{ statusLabel(status) }}
              </option>
            </select>
          </div>

          <p
            v-if="saveError[request.id]"
            class="request-card__error"
          >
            {{ saveError[request.id] }}
          </p>
          <p
            v-if="savedId === request.id"
            class="request-card__saved"
          >
            {{ t('requests.saved') }}
          </p>
          <p
            v-if="autoBlockMessage[request.id]"
            class="request-card__auto-block"
          >
            {{ autoBlockMessage[request.id] }}
          </p>

          <button
            type="button"
            class="request-card__save"
            :disabled="savingId === request.id"
            @click="saveStatus(request)"
          >
            {{ savingId === request.id ? t('requests.loading') : t('requests.save') }}
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.requests-widget__loading {
  @apply mt-6 text-sm;
  color: var(--color-muted);
}

.requests-widget__badge {
  @apply mt-4 inline-block rounded-full px-3 py-1 text-sm font-medium;
  background-color: #fee2e2;
  color: #991b1b;
}

.requests-form__alert {
  @apply mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700;
}

.requests-empty {
  @apply mt-6 text-sm;
  color: var(--color-muted);
}

.requests-list {
  @apply mt-6 space-y-3;
}

.request-card {
  @apply rounded-md border;
  border-color: #e5e7eb;
  background-color: var(--color-surface);
}

.request-card__summary {
  @apply flex w-full flex-wrap items-center gap-3 p-3 text-left text-sm;
}

.request-card__name {
  @apply font-medium;
  color: var(--color-text);
}

.request-card__dates {
  color: var(--color-muted);
}

.request-card__status {
  @apply rounded-full px-2 py-0.5 text-xs font-medium;
  background-color: #e5e7eb;
  color: var(--color-text);
}

.request-card__status--new {
  background-color: #fee2e2;
  color: #991b1b;
}

.request-card__status--contacted {
  background-color: #fef3c7;
  color: #92400e;
}

.request-card__status--accepted {
  background-color: #d1fae5;
  color: #047857;
}

.request-card__status--rejected {
  background-color: #e5e7eb;
  color: #4b5563;
}

.request-card__toggle {
  @apply ml-auto text-xs font-medium underline underline-offset-2;
  color: var(--color-primary);
}

.request-card__details {
  @apply space-y-2 border-t p-3 text-sm;
  border-color: #e5e7eb;
  color: var(--color-text);
}

.request-card__field {
  @apply space-y-1 pt-2;
}

.request-card__label {
  @apply block text-xs font-medium;
  color: var(--color-text);
}

.request-card__input {
  @apply w-full max-w-xs rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2;
  border-color: #d1d5db;
  --tw-ring-color: var(--color-primary);
}

.request-card__error {
  @apply text-xs text-red-600;
}

.request-card__saved {
  @apply text-xs;
  color: #047857;
}

.request-card__overlap {
  @apply rounded-md px-3 py-2 text-sm;
}

.request-card__overlap--warning {
  background-color: #fef2f2;
  color: #991b1b;
}

.request-card__overlap--ok {
  background-color: #ecfdf5;
  color: #047857;
}

.request-card__auto-block {
  @apply text-xs;
  color: var(--color-muted);
}

.request-card__save {
  @apply rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50;
  background-color: var(--color-primary);
}
</style>
