<script setup>
import { ref } from 'vue'
import { jdActivities } from '../data/info.json'

const open = ref(0)
const toggle = (i) => (open.value = open.value === i ? -1 : i)
</script>

<template>
  <section class="info">
    <h2 class="section-title">购买与预约须知</h2>
    <div class="qa">
      <div v-for="(item, i) in jdActivities" :key="i" class="qa-item">
        <button class="qa-head" @click="toggle(i)">
          <span>{{ item.q }}</span>
          <i :class="{ open: open === i }"></i>
        </button>
        <div v-show="open === i" class="qa-body">
          <p v-for="(line, j) in item.a.split('\n')" :key="j">{{ line }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.qa {
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
}

.qa-item + .qa-item {
  border-top: 1px solid #f5f5f5;
}

.qa-head {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  text-align: left;
  padding: 14px 12px;
  font-size: 14px;
  color: #333;
}

.qa-head i {
  flex: none;
  width: 10px;
  height: 10px;
  border-right: 1.5px solid #ccc;
  border-bottom: 1.5px solid #ccc;
  transform: rotate(45deg);
  margin-top: -4px;
}

.qa-head i.open {
  transform: rotate(225deg);
  margin-top: 4px;
}

.qa-body {
  padding: 0 12px 14px;
  color: #666;
  font-size: 13px;
  line-height: 1.8;
}

.qa-body p + p {
  margin-top: 6px;
}

@media (min-width: 960px) {
  .qa {
    border-radius: 0;
    border: 1px solid #eee;
  }

  .qa-head {
    padding: 16px 18px;
  }

  .qa-head:hover {
    color: var(--jd);
  }

  .qa-body {
    padding: 0 18px 16px;
  }
}
</style>
