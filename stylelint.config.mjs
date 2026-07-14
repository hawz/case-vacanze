// @ts-check

// Config minima: cattura errori di sintassi CSS reali (es. commenti chiusi
// per errore, at-rule/unit invalidi) dentro i blocchi <style> dei componenti
// Vue — cosa che ESLint non copre, essendo un linter JS/TS che non parsa il
// CSS. Estende solo "recommended" (non "standard"): niente regole di stile/
// formattazione, per non generare rumore su tutto il CSS BEM già esistente.
/** @type {import('stylelint').Config} */
export default {
  extends: ['stylelint-config-recommended-vue'],
  rules: {
    // @tailwind/@apply/@screen/@variants/@responsive/@layer sono direttive
    // di Tailwind, non CSS standard: senza questo, ogni @apply nei
    // componenti wizard verrebbe segnalato come at-rule sconosciuta.
    'at-rule-no-unknown': [true, {
      ignoreAtRules: ['tailwind', 'apply', 'layer', 'screen', 'variants', 'responsive'],
    }],
  },
}
