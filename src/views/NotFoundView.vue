<script setup lang="ts">
import AppHeader from '../components/AppHeader.vue'
</script>
<template>
  <main class="page-shell">
    <AppHeader />
    <h1>找不到這個頁面</h1>
    <p class="page-description">請確認房間連結，或重新建立房間。</p>
    <RouterLink to="/" class="primary">回到首頁</RouterLink>
  </main>
</template>
