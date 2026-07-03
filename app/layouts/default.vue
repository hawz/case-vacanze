<template>
  <div class="app-shell">
    <header class="app-shell__header">
      <span class="app-shell__logo">Portale Case Vacanze</span>
    </header>

    <main class="app-shell__content">
      <slot />
    </main>

    <footer class="app-shell__footer">
      <p class="app-shell__footer-text">
        &copy; {{ new Date().getFullYear() }} Portale Case Vacanze
      </p>
    </footer>
  </div>
</template>

<style scoped>
/*
  Layout strutturale con classi BEM (app-shell, app-shell__header, ecc.)
  usato dove Tailwind da solo non basta a esprimere la semantica del blocco.
  Le utility Tailwind restano la scelta di default per spaziature/colori/tipografia.
*/
.app-shell {
  @apply flex min-h-screen flex-col;
}

.app-shell__header {
  @apply flex items-center px-4 py-3 shadow-sm;
  background-color: var(--color-surface, #ffffff);
}

.app-shell__logo {
  @apply text-lg font-semibold;
  color: var(--color-primary, #0f766e);
}

.app-shell__content {
  @apply flex-1;
}

.app-shell__footer {
  @apply px-4 py-6 text-center text-sm;
  color: var(--color-muted, #6b7280);
}
</style>
