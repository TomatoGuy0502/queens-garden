<script setup lang="ts">
import { SOLO_ONLY } from '../deployment'
import AccountMenu from './AccountMenu.vue'
import CrownIcon from './CrownIcon.vue'
import GamePreferences from './GamePreferences.vue'
import LanguageSwitcher from './LanguageSwitcher.vue'
import ThemeToggle from './ThemeToggle.vue'
import { useGamePreferences } from '../composables/useGamePreferences'
const { guidance, storageAvailable } = useGamePreferences()
</script>
<template>
  <header class="app-header">
    <RouterLink class="brand" to="/" :aria-label="$t('brand.home')"
      ><CrownIcon /><span>queens<span class="brand-dot">.</span></span></RouterLink
    >
    <nav>
      <RouterLink to="/play">{{ $t('nav.solo') }}</RouterLink
      ><RouterLink v-if="!SOLO_ONLY" to="/rooms">{{ $t('nav.coop') }}</RouterLink
      ><RouterLink to="/stats">{{ $t('nav.stats') }}</RouterLink
      ><RouterLink to="/tutorial">{{ $t('nav.tutorial') }}</RouterLink>
      <div class="tools">
        <LanguageSwitcher /><ThemeToggle /><GamePreferences
          v-model="guidance"
          :storage-available="storageAvailable"
        /><AccountMenu v-if="!SOLO_ONLY" />
      </div>
    </nav>
  </header>
</template>
<style scoped>
.app-header {
  height: 94px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 32px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--ink);
  font:
    600 32px Georgia,
    serif;
  letter-spacing: -1.6px;
  text-decoration: none;
}
.brand svg {
  width: 30px;
  height: 34px;
}
.brand-dot {
  color: var(--accent);
}
nav {
  display: flex;
  align-items: center;
  gap: 20px;
}
nav > a {
  font-size: 12px;
  color: var(--muted);
  text-decoration: none;
  white-space: nowrap;
}
/* Icon buttons already carry their own padding, so they sit closer than the text links. */
.tools {
  display: flex;
  align-items: center;
  gap: 2px;
}
nav > a:hover,
nav > a.router-link-active {
  color: var(--accent);
}
/* Even icon-only, the single-row header needs about 720px in the widest locale (Japanese). */
@media (max-width: 760px) {
  .app-header {
    height: auto;
    min-height: 78px;
    flex-wrap: wrap;
    justify-content: flex-start;
    gap: 4px 18px;
    padding: 10px 0;
    margin-bottom: 25px;
  }
  .brand {
    font-size: 27px;
  }
  .brand svg {
    width: 25px;
  }
  nav {
    flex: 1 1 auto;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 6px 12px;
  }
  nav > a {
    font-size: 11px;
  }
}
</style>
