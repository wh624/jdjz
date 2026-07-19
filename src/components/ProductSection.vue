<script setup>
import ProductCard from './ProductCard.vue'

defineProps({
  groups: { type: Array, required: true }
})
</script>

<template>
  <div v-if="groups.length" class="sections">
    <section v-for="g in groups" :key="g.name || 'flat'" class="group">
      <h2 v-if="g.name" class="group-title">
        {{ g.name }} <span class="group-count">{{ g.products.length }} 件</span>
      </h2>
      <div class="grid">
        <ProductCard
          v-for="(p, i) in g.products"
          :key="g.name + i"
          :product="p"
        />
      </div>
    </section>
  </div>

  <div v-else class="empty">
    <div class="empty-emoji">🔍</div>
    <p>未找到相关商品</p>
    <span>换个关键词试试？</span>
  </div>
</template>

<style scoped>
.group {
  margin-bottom: 8px;
}
.group-title {
  font-size: 16px;
  font-weight: 700;
  margin: 22px 4px 12px;
}
.group-count {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
  margin-left: 4px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 14px;
}
.empty {
  text-align: center;
  padding: 60px 0;
  color: var(--text-muted);
}
.empty-emoji {
  font-size: 40px;
  margin-bottom: 8px;
}
.empty p {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 4px;
}
</style>
