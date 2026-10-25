<script setup lang="ts">
import { useTitle } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import UpdateToast from './components/UpdateToast.vue'
const route = useRoute()
const { t } = useI18n()
useTitle(() => {
  const app = t('app.pageTitle')
  return route.meta.title ? `${t(route.meta.title)} · ${app}` : app
})
</script>
<template>
  <RouterView />
  <UpdateToast />
</template>
