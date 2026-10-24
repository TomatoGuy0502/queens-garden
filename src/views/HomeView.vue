<script setup lang="ts">
import { Crown, Users, ArrowRight } from '@lucide/vue'
import AppHeader from '../components/AppHeader.vue'
</script>
<template>
  <main class="page-shell">
    <AppHeader />
    <h1>Queens 益智遊戲</h1>
    <p class="page-description">選擇遊玩模式。</p>
    <div class="mode-cards">
      <RouterLink to="/solo" class="mode-card"
        ><Crown :size="28" />
        <h2>單人遊戲</h2>
        <p>依照自己的步調解題，支援種子重現與邏輯提示。</p>
        <span>開始遊戲 <ArrowRight :size="16" /></span></RouterLink
      ><RouterLink to="/rooms/new" class="mode-card"
        ><Users :size="28" />
        <h2>多人合作</h2>
        <p>邀請朋友，同時操作棋盤、分享推理與指示格子。</p>
        <span>建立或加入房間 <ArrowRight :size="16" /></span
      ></RouterLink>
    </div>
  </main>
</template>
<style scoped>
h1 {
  font-size: 29px;
  font-weight: 500;
  margin: 42px 0 14px;
}
.mode-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-top: 32px;
}
.mode-card {
  display: block;
  padding: 30px;
  border: 1px solid var(--line);
  border-radius: 7px;
  text-decoration: none;
  color: var(--ink);
  background: #fffdfa;
}
.mode-card > svg {
  color: var(--accent);
}
.mode-card h2 {
  font-size: 20px;
  font-weight: 550;
  margin: 20px 0 12px;
}
.mode-card p {
  font-size: 13px;
  line-height: 1.9;
  color: var(--muted);
  min-height: 50px;
}
.mode-card > span {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--accent);
  font-size: 12px;
  margin-top: 25px;
}
.mode-card:hover {
  border-color: #b49cc4;
}
@media (max-width: 650px) {
  .mode-cards {
    grid-template-columns: 1fr;
    gap: 18px;
  }
  .mode-card {
    padding: 24px;
  }
}
</style>
