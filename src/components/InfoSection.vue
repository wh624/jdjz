<script setup>
import { ref } from 'vue'
import { jdActivities, aboutSite } from '../data/info.js'

const open = ref(0)
const toggle = (i) => (open.value = open.value === i ? -1 : i)
</script>

<template>
  <section class="info">
    <h2 class="section-title">关于京东家政赠品活动</h2>
    <div class="qa">
      <div
        v-for="(item, i) in jdActivities"
        :key="i"
        class="qa-item"
        :class="{ open: open === i }"
      >
        <button class="qa-head" @click="toggle(i)">
          <span>{{ item.q }}</span>
          <span class="arrow">{{ open === i ? '−' : '+' }}</span>
        </button>
        <div v-show="open === i" class="qa-body">
          <p v-for="(line, j) in item.a.split('\n')" :key="j">{{ line }}</p>
        </div>
      </div>
    </div>

    <h2 class="section-title">关于捡漏（JIANLOU.INDIELOG.CN）</h2>
    <div class="about">
      <p v-for="(p, i) in aboutSite.paragraphs" :key="i">{{ p }}</p>
    </div>
  </section>
</template>

<style scoped>
.info {
  margin-top: 30px;
}
.qa {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  background: #fff;
}
.qa-item {
  border-bottom: 1px solid var(--border);
}
.qa-item:last-child {
  border-bottom: none;
}
.qa-head {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  text-align: left;
  padding: 14px 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}
.qa-head:hover {
  background: #fafafa;
}
.arrow {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--primary-soft);
  color: var(--primary);
  display: grid;
  place-items: center;
  font-weight: 700;
}
.qa-body {
  padding: 0 16px 14px;
  color: #555;
  font-size: 13px;
  line-height: 1.8;
}
.qa-body p {
  margin-bottom: 6px;
}
.about {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px 18px;
}
.about p {
  font-size: 13px;
  line-height: 1.9;
  color: #555;
  margin-bottom: 10px;
}
.about p:last-child {
  margin-bottom: 0;
}
</style>
