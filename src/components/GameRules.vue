<script setup lang="ts">
import { Crown, Rows3, Columns3, Shapes, MoveDiagonal } from '@lucide/vue'
</script>
<template>
  <section id="rules" class="rules" aria-labelledby="rules-title">
    <span class="eyebrow">A LITTLE HOW-TO</span>
    <h2 id="rules-title">一頂皇冠，剛剛好。</h2>
    <p class="rules-intro">
      找到所有皇冠的位置，讓每個空間<br class="desktop-break" />都保有恰到好處的距離。
    </p>
    <ul>
      <li><Rows3 :size="18" /><span>每一列，恰好一頂皇冠。</span></li>
      <li><Columns3 :size="18" /><span>每一欄，恰好一頂皇冠。</span></li>
      <li><Shapes :size="18" /><span>每個色區，恰好一頂皇冠。</span></li>
      <li>
        <MoveDiagonal :size="18" /><span
          >皇冠不能相鄰，斜角也不行。<small>較遠的對角線位置可以放置。</small></span
        >
      </li>
    </ul>
    <div class="mini-example" aria-hidden="true">
      <div class="example-cells">
        <span>×</span><span>×</span><span>×</span><span>×</span><span><Crown :size="22" /></span
        ><span>×</span><span>×</span><span>×</span><span>×</span>
      </div>
      <span>給彼此一點空間。</span>
    </div>
    <details>
      <summary>操作與鍵盤快捷鍵</summary>
      <p>
        點一下放皇冠，再點一下取消。切換「標記」模式可放 X，也可以用滑鼠右鍵。方向鍵移動，空白鍵或
        Enter 操作，X 鍵標記。格內字母代表所屬區域。
      </p>
    </details>
  </section>
</template>
<style scoped>
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
.rules-intro {
  font-size: 12px;
  line-height: 1.9;
  color: var(--muted);
  margin: 0 0 22px;
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
  color: #95839e;
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
  font-size: 11px;
  color: var(--muted);
}
.example-cells {
  display: grid;
  grid-template-columns: repeat(3, 25px);
  border: 1px solid #b7a4c4;
  border-radius: 3px;
  overflow: hidden;
}
.example-cells span {
  width: 25px;
  height: 25px;
  background: #e5d9ed;
  display: grid;
  place-items: center;
  border: 0.5px solid #c9b6d4;
  color: #a08aad;
  font-size: 20px;
  line-height: 1;
}
.example-cells span:nth-child(5) {
  background: #cab2de;
  color: #503861;
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
