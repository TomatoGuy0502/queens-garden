<script setup lang="ts">
import AppHeader from '../components/AppHeader.vue'
</script>
<template>
  <main class="page-shell">
    <AppHeader />
    <h1>{{ $t('notFound.title') }}</h1>
    <p class="page-description">{{ $t('notFound.body') }}</p>
    <RouterLink to="/" class="primary">{{ $t('notFound.home') }}</RouterLink>
  </main>
</template>
