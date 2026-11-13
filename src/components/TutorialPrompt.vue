<script setup lang="ts">
import { computed } from 'vue'
import { GraduationCap } from '@lucide/vue'
import { useGameStats } from '../composables/useGameStats'
import { useTutorialStatus } from '../composables/useTutorialStatus'
const props = defineProps<{ stacked?: boolean }>()
const { status, dismiss } = useTutorialStatus(props.stacked ? 'stacked' : 'flat')
const { stats } = useGameStats()
// Only offered to someone who has neither learned nor finished a game of this kind here.
const visible = computed(
  () =>
    status.value === null &&
    !Object.keys(stats.value.buckets).some((key) => !props.stacked || key.startsWith('3d:')),
)
</script>
<template>
  <section v-if="visible" class="prompt" :aria-label="$t('tutorialPrompt.label')">
    <GraduationCap :size="22" aria-hidden="true" />
    <div>
      <p>{{ stacked ? $t('tutorialPrompt.stackedBody') : $t('tutorialPrompt.body') }}</p>
      <RouterLink class="primary" :to="stacked ? '/tutorial3d' : '/tutorial'">{{
        $t('tutorialPrompt.start')
      }}</RouterLink>
      <button type="button" class="text-button" @click="dismiss">
        {{ $t('tutorialPrompt.dismiss') }}
      </button>
    </div>
  </section>
</template>
<style scoped>
.prompt {
  display: flex;
  gap: 14px;
  margin-bottom: 27px;
  padding: 18px 20px;
  border: 1px solid var(--accent-border);
  border-radius: 7px;
  background: var(--accent-soft);
  color: var(--accent);
}
.prompt > svg {
  flex: none;
  margin-top: 2px;
}
p {
  margin: 0 0 12px;
  font-size: 12px;
  line-height: 1.8;
}
.prompt a {
  display: inline-block;
  margin-right: 12px;
  text-decoration: none;
}
</style>
