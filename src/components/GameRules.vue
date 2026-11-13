<script setup lang="ts">
import { Crown, Rows3, Columns3, Shapes, MoveDiagonal, Layers } from '@lucide/vue'
defineProps<{ stacked?: boolean }>()
</script>
<template>
  <section id="rules" class="rules" aria-labelledby="rules-title">
    <h2 id="rules-title">{{ $t('rules.title') }}</h2>
    <ul>
      <li>
        <Rows3 :size="18" /><span>{{ $t('rules.rows') }}</span>
      </li>
      <li>
        <Columns3 :size="18" /><span>{{ $t('rules.columns') }}</span>
      </li>
      <li>
        <Shapes :size="18" /><span>{{ $t('rules.regions') }}</span>
      </li>
      <li>
        <MoveDiagonal :size="18" /><span
          >{{ $t('rules.adjacent') }}<small>{{ $t('rules.adjacentNote') }}</small></span
        >
      </li>
      <li v-if="stacked">
        <Layers :size="18" /><span
          >{{ $t('stacked.rules.pillars')
          }}<small>{{ $t('stacked.rules.intro') }} {{ $t('stacked.rules.apart') }}</small></span
        >
      </li>
    </ul>
    <div class="mini-example" aria-hidden="true">
      <div class="example-cells">
        <span>×</span><span>×</span><span>×</span><span>×</span><span><Crown :size="22" /></span
        ><span>×</span><span>×</span><span>×</span><span>×</span>
      </div>
      <span>{{ $t('rules.example') }}</span>
    </div>
    <details>
      <summary>{{ $t('rules.shortcuts') }}</summary>
      <p>{{ $t('rules.shortcutsBody') }}</p>
      <p v-if="stacked">{{ $t('stacked.rules.keys') }}</p>
    </details>
    <RouterLink v-if="stacked" class="tutorial-link" to="/tutorial3d">{{
      $t('stacked.rules.tutorial')
    }}</RouterLink>
  </section>
</template>
<style scoped>
.tutorial-link {
  display: inline-block;
  margin-top: 14px;
  font-size: 12px;
}
.rules {
  border-top: 1px solid var(--line);
  padding-top: 27px;
  margin-top: 27px;
}
.rules h2 {
  font-size: 18px;
  font-weight: 550;
  margin: 14px 0;
}
.rules ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 17px;
}
.rules li {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  font-size: 12px;
  line-height: 1.5;
}
.rules li svg {
  color: var(--muted);
  flex-shrink: 0;
}
.rules small {
  display: block;
  font-size: 10px;
  margin-top: 4px;
  color: var(--muted);
}
.mini-example {
  display: flex;
  gap: 20px;
  align-items: center;
  margin-top: 25px;
  padding: 16px 0;
}
.mini-example > span {
  min-width: 0;
  font-size: 11px;
  color: var(--muted);
}
.example-cells {
  flex-shrink: 0;
  display: grid;
  grid-template-columns: repeat(3, 25px);
  border: 1px solid var(--accent-border);
  border-radius: 3px;
  overflow: hidden;
}
.example-cells span {
  width: 25px;
  height: 25px;
  background: var(--accent-soft);
  display: grid;
  place-items: center;
  border: 0.5px solid var(--accent-border);
  color: var(--muted);
  font-size: 20px;
  line-height: 1;
}
.example-cells span:nth-child(5) {
  background: var(--accent-soft);
  color: var(--accent);
}
details {
  margin-top: 13px;
  font-size: 11px;
  color: var(--muted);
}
summary {
  cursor: pointer;
  padding: 7px 0;
}
details p {
  font-size: 11px;
  line-height: 1.9;
}
</style>
