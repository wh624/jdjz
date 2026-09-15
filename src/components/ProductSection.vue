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
        {{ g.name }}
        <span>{{ g.products.length }}件</span>
      </h2>
      <div class="grid">
        <ProductCard
          v-for="(p, i) in g.products"
          :key="(p.sku || '') + i"
          :product="p"
        />
      </div>
    </section>
  </div>

  <div v-else class="empty">
    <p>没有找到相关商品</p>
    <span>换个关键词试试</span>
  </div>
</template>

<style scoped>
.group-title {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 14px;
  font-weight: 700;
  padding: 12px 2px 8px;
}

.group-title span {
  font-size: 12px;
  font-weight: 400;
  color: #999;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.empty {
  text-align: center;
  padding: 64px 12px;
  color: #999;
  background: #fff;
  margin-top: 8px;
}

.empty p {
  color: #333;
  font-size: 15px;
  margin-bottom: 6px;
}

@media (min-width: 768px) {
  .group-title {
    font-size: 16px;
    padding: 20px 0 12px;
  }

  .grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }
}

@media (min-width: 1024px) {
  .grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
  }
}
</style>
