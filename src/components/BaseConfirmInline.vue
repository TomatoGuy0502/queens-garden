<script setup lang="ts">
// Asks again before something that cannot be undone, in place rather than in a dialog.
defineProps<{ prompt: string; keepLabel: string; confirmLabel: string }>()
const emit = defineEmits<{ keep: []; confirm: [] }>()
</script>
<template>
  <div class="confirm-inline">
    <p>{{ prompt }}</p>
    <div>
      <button type="button" class="text-button" @click="emit('keep')">{{ keepLabel }}</button>
      <button type="button" class="primary" @click="emit('confirm')">{{ confirmLabel }}</button>
    </div>
  </div>
</template>
<style scoped>
.confirm-inline {
  padding: 17px;
  background: var(--accent-soft);
  margin-top: 17px;
  border-radius: 5px;
}
p {
  margin: 0 0 12px;
  font-size: 12px;
}
div {
  display: flex;
  justify-content: flex-end;
  gap: 15px;
}
.primary {
  font-size: 12px;
  padding: 8px 13px;
}
</style>
