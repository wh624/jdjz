<script setup>
import { updateInfo } from '../data/products.json'

</script>

<template>
  <header class="header">
    <h1 class="title">京东送家政商品汇总</h1>

    <div class="meta">
      <span class="date">{{ updateInfo.date }}</span>
      <span class="dot">·</span>
      <span class="count">{{ updateInfo.total }} 件商品</span>
      <span class="dot">·</span>
      <span class="time">更新于 {{ updateInfo.updatedAt }}</span>
    </div>
  </header>
</template>

<style scoped>
.header {
  padding: 22px 4px 14px;
}
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.logo {
  display: flex;
  align-items: center;
  gap: 8px;
}
.logo-mark {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: linear-gradient(135deg, #ff6a00, #e1251b);
  color: #fff;
  font-weight: 800;
  font-size: 18px;
  display: grid;
  place-items: center;
}
.logo-text {
  font-size: 20px;
  font-weight: 800;
  letter-spacing: 1px;
}
.redpacket {
  background: var(--primary-soft);
  color: var(--primary);
  font-weight: 700;
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid #ffd6d2;
  transition: transform 0.15s ease;
}
.redpacket:hover {
  transform: translateY(-1px);
}
.title {
  font-size: 30px;
  font-weight: 800;
  margin: 16px 0 8px;
  letter-spacing: 0.5px;
}
.meta {
  color: var(--text-muted);
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.meta .date {
  color: var(--text);
  font-weight: 600;
}
.meta .count {
  color: var(--primary);
  font-weight: 700;
}
.dot {
  color: #ccc;
}
</style>
