<script setup>
import { computed } from 'vue'

const props = defineProps({
  tabs: { type: Array, required: true },
  activeTab: { type: String, required: true },
  categories: { type: Array, required: true },
  activeCategory: { type: String, required: true }
})

const emit = defineEmits(['update:activeTab', 'update:activeCategory'])

const counts = computed(() =>
  props.categories.map((c) => ({
    name: c.name,
    count: c.products.length
  }))
)
</script>

<template>
  <nav class="nav">
    <div class="nav-inner">
      <div class="tabs" role="tablist">
        <button
          v-for="t in tabs"
          :key="t.key"
          class="tab"
          :class="{ active: t.key === activeTab }"
          @click="emit('update:activeTab', t.key)"
        >
          {{ t.label }}
        </button>
      </div>

      <div v-if="activeTab === 'all'" class="chips">
        <button
          class="chip"
          :class="{ active: activeCategory === 'all' }"
          @click="emit('update:activeCategory', 'all')"
        >
          全部
        </button>
        <button
          v-for="c in counts"
          :key="c.name"
          class="chip"
          :class="{ active: activeCategory === c.name }"
          @click="emit('update:activeCategory', c.name)"
        >
          {{ c.name }}<i>{{ c.count }}</i>
        </button>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.nav {
  background: #fff;
  border-bottom: 1px solid var(--border);
}

.tabs {
  display: flex;
}

.tab {
  flex: 1;
  height: 42px;
  font-size: 14px;
  color: #666;
  position: relative;
  white-space: nowrap;
}

.tab.active {
  color: var(--jd);
  font-weight: 700;
}

.tab.active::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 28px;
  height: 2px;
  background: var(--jd);
  transform: translateX(-50%);
}

.chips {
  display: flex;
  gap: 8px;
  padding: 8px 8px 10px;
  overflow-x: auto;
  scrollbar-width: none;
}

.chips::-webkit-scrollbar {
  display: none;
}

.chip {
  flex: none;
  height: 28px;
  padding: 0 10px;
  border-radius: 14px;
  background: #f5f5f5;
  color: #666;
  font-size: 12px;
}

.chip i {
  font-style: normal;
  margin-left: 3px;
  color: #bbb;
}

.chip.active {
  background: var(--tag);
  color: var(--jd);
  font-weight: 700;
}

.chip.active i {
  color: var(--jd);
}

@media (min-width: 960px) {
  .nav {
    position: sticky;
    top: 0;
    z-index: 30;
  }

  .nav-inner {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 16px;
  }

  .tabs {
    gap: 8px;
    width: fit-content;
  }

  .tab {
    flex: none;
    padding: 0 18px;
    height: 46px;
    font-size: 15px;
  }

  .tab:hover {
    color: var(--jd);
  }

  .chips {
    flex-wrap: wrap;
    overflow: visible;
    padding: 0 0 12px;
    gap: 8px;
  }

  .chip {
    height: 30px;
    padding: 0 12px;
    border-radius: 2px;
    background: #fff;
    border: 1px solid #eee;
  }

  .chip:hover,
  .chip.active {
    border-color: var(--jd);
  }
}
</style>
