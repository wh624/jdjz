<script setup>
defineProps({
  product: { type: Object, required: true }
})
</script>

<template>
  <article class="card">
    <a
      v-if="product.link"
      class="thumb"
      :href="product.link"
      target="_blank"
      rel="noopener noreferrer"
      :aria-label="product.name"
    >
      <img
        v-if="product.img"
        :src="product.img"
        :alt="product.name"
        loading="lazy"
      />
      <div v-else class="thumb-empty">🛒</div>
    </a>
    <div v-else class="thumb">
      <img v-if="product.img" :src="product.img" :alt="product.name" loading="lazy" />
      <div v-else class="thumb-empty">🛒</div>
    </div>

    <div class="badge">{{ product.clean }}</div>

    <h3 class="name">
      <a
        v-if="product.link"
        :href="product.link"
        target="_blank"
        rel="noopener noreferrer"
        class="name-link"
      >{{ product.name }}</a>
      <template v-else>{{ product.name }}</template>
    </h3>

    <p class="bookable">第8天可约 · 7天有效</p>

    <div class="gift" v-if="product.gift">
      <span class="gift-tag">🎁 赠品</span>
      <span class="gift-text">{{ product.gift }}</span>
    </div>

    <div class="footer">
      <div class="price">
        <span class="price-label">到手约</span>
        <span class="price-value">{{ product.price }}</span>
      </div>
    </div>
  </article>
</template>

<style scoped>
.card {
  position: relative;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px 16px 14px;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  overflow: hidden;
}
.card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.1);
}
.thumb {
  display: block;
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 10px;
  overflow: hidden;
  background: var(--border);
  margin-bottom: 2px;
}
.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.2s ease;
}
.thumb:hover img {
  transform: scale(1.05);
}
.thumb-empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  background: #f3f4f6;
}
.name-link {
  color: inherit;
  text-decoration: none;
}
.name-link:hover {
  color: var(--primary);
}
.badge {
  position: absolute;
  top: 0;
  right: 0;
  background: var(--primary);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  padding: 4px 10px;
  border-bottom-left-radius: 10px;
}
.name {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  padding-right: 70px;
  min-height: 42px;
}
.bookable {
  font-size: 12px;
  color: #2a8f5a;
  background: #eafaf1;
  align-self: flex-start;
  padding: 2px 8px;
  border-radius: 6px;
}
.gift {
  font-size: 12px;
  background: #fff7e6;
  border: 1px dashed #ffd591;
  border-radius: 8px;
  padding: 6px 8px;
  color: #ad6800;
  line-height: 1.5;
}
.gift-tag {
  font-weight: 700;
  margin-right: 4px;
}
.footer {
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px dashed var(--border);
}
.price {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.price-label {
  font-size: 12px;
  color: var(--text-muted);
}
.price-value {
  font-size: 20px;
  font-weight: 800;
  color: var(--primary);
}
</style>
