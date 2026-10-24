<script setup lang="ts">
import CrownIcon from './CrownIcon.vue'
import GamePreferences from './GamePreferences.vue'
import { useGamePreferences } from '../composables/useGamePreferences'
const { guidance, storageAvailable } = useGamePreferences()
</script>
<template>
  <header class="app-header">
    <RouterLink class="brand" to="/" aria-label="Queens 首頁"
      ><CrownIcon /><span>queens<span class="brand-dot">.</span></span></RouterLink
    >
    <nav>
      <RouterLink to="/solo">單人遊戲</RouterLink><RouterLink to="/rooms/new">多人合作</RouterLink
      ><GamePreferences v-model="guidance" :storage-available="storageAvailable" />
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
}
nav > a.router-link-active {
  color: var(--accent);
}
@media (max-width: 650px) {
  .app-header {
    height: 78px;
    margin-bottom: 25px;
  }
  .brand {
    font-size: 27px;
  }
  .brand svg {
    width: 25px;
  }
  nav {
    gap: 12px;
  }
  nav > a {
    font-size: 11px;
  }
}
</style>
