<script setup lang="ts">
// EPIC 15 — Mini-sito pubblico: regole della casa (parte di US-1501).
// Le righe fisse (PETS/SMOKING/PARTIES, vedi HouseRulesStep.vue) hanno già
// il testo composto in description ("Consentito: ..."/"Non consentito"):
// qui si mostra così com'è, nessuna logica di parsing/toggle da rifare.
const TYPES = ['PETS', 'SMOKING', 'PARTIES', 'OTHER'] as const

interface HouseRule {
  id: string
  type: typeof TYPES[number]
  description: string | null
}

const props = defineProps<{ houseRules: HouseRule[] }>()

const { t } = useI18n()

function typeLabel(type: string) {
  return t(`minisite.houseRules.types.${type}`)
}

const rulesByType = computed(() => TYPES.map(type => ({
  type,
  rules: props.houseRules.filter(r => r.type === type),
})).filter(group => group.rules.length > 0))
</script>

<template>
  <section
    v-if="rulesByType.length > 0"
    class="minisite-section"
  >
    <h2 class="minisite-section__title">
      {{ t('minisite.houseRules.title') }}
    </h2>
    <div class="minisite-house-rules">
      <div
        v-for="group in rulesByType"
        :key="group.type"
        class="minisite-house-rule-group"
      >
        <h3 class="minisite-house-rule-group__title">
          {{ typeLabel(group.type) }}
        </h3>
        <p
          v-for="rule in group.rules"
          :key="rule.id"
          class="minisite-house-rule-group__text"
        >
          {{ rule.description }}
        </p>
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

.minisite-house-rules {
  @apply mt-3 grid gap-3 sm:grid-cols-2;
}

.minisite-house-rule-group {
  @apply border p-3;
  border-color: var(--color-border, #e5e7eb);
  background-color: var(--color-surface);
  border-radius: var(--radius-base, 8px);
}

.minisite-house-rule-group__title {
  @apply text-sm font-semibold;
  color: var(--color-text);
}

.minisite-house-rule-group__text {
  @apply mt-1 text-sm;
  color: var(--color-muted);
}
</style>
