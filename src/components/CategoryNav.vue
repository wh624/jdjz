<script setup>
import { computed } from 'vue'

const props = defineProps({
  tabs: { type: Array, required: true },
  activeTab: { type: String, required: true },
  categories: { type: Array, required: true },
  activeCategory: { type: String, required: true },
  search: { type: String, required: true },
  resultCount: { type: Number, required: true }
})

const emit = defineEmits(['update:activeTab', 'update:activeCategory', 'update:search'])

const counts = computed(() =>
  props.categories.map((c) => ({
    name: c.name,
    count: c.products.length
  }))
)
</script>

<template>
  <nav class="nav">
    <div class="tabs">
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

    <div class="chips">
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
        {{ c.name }} <span class="chip-num">{{ c.count }}</span>
      </button>
    </div>

    <div class="searchbar">
      <span class="icon">🔍</span>
      <input
        :value="search"
        type="text"
        placeholder="搜索商品名称…"
        @input="emit('update:search', $event.target.value)"
      />
      <span class="result">共 {{ resultCount }} 件商品</span>
    </div>
  </nav>
</template>

<style scoped>
.nav {
  position: sticky;
  top: 0;
  z-index: 20;
  background: var(--bg);
  padding: 10px 4px 12px;
}
.tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
}
.tab {
  padding: 8px 16px;
  border-radius: 999px;
  font-weight: 600;
  color: var(--text-muted);
  background: #fff;
  border: 1px solid var(--border);
  transition: all 0.15s ease;
}
.tab:hover {
  color: var(--text);
}
.tab.active {
  color: #fff;
  background: var(--primary);
  border-color: var(--primary);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.chip {
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  background: #fff;
  border: 1px solid var(--border);
  transition: all 0.15s ease;
}
.chip:hover {
  border-color: #ffb3ad;
}
.chip.active {
  color: var(--primary);
  background: var(--primary-soft);
  border-color: #ffb3ad;
}
.chip-num {
  color: var(--text-muted);
  font-weight: 500;
  margin-left: 2px;
}
.chip.active .chip-num {
  color: var(--primary);
}
.searchbar {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px 14px;
}
.searchbar .icon {
  font-size: 15px;
  opacity: 0.6;
}
.searchbar input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 14px;
  background: transparent;
  color: var(--text);
}
.searchbar .result {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
}
</style>
