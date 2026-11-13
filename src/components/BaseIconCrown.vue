<script setup lang="ts">
defineProps<{ filled?: boolean }>()
</script>
<template>
  <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path
      d="m5 10 6 5 5-9 5 9 6-5-3 15H8L5 10Z"
      :fill="filled ? 'currentColor' : 'none'"
      stroke="currentColor"
      stroke-width="2"
      stroke-linejoin="round"
    />
    <path d="M9 29h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
  </svg>
</template>
