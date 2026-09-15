<script setup>
import { computed } from 'vue'

const props = defineProps({
  product: { type: Object, required: true }
})

const priceParts = computed(() => {
  const raw = String(props.product.price || '').replace(/[¥￥,\s]/g, '')
  const [intPart, decPart = ''] = raw.split('.')
  return {
    int: intPart || '0',
    dec: decPart.padEnd(2, '0').slice(0, 2)
  }
})
</script>

<template>
  <component
    :is="product.link ? 'a' : 'article'"
    class="card"
    :href="product.link || undefined"
    target="_blank"
    rel="noopener noreferrer"
  >
    <div class="thumb">
      <img v-if="product.img" :src="product.img" :alt="product.name" loading="lazy" />
      <div v-else class="thumb-empty">暂无图片</div>
      <span v-if="product.clean" class="ribbon">{{ product.clean }}</span>
    </div>

    <div class="body">
      <h3 class="name">{{ product.name }}</h3>

      <div class="tags">
        <span class="tag">第8天可约</span>
        <span v-if="product.gift" class="tag">另赠</span>
        <span v-if="product.regionLimited" class="tag warn">限地域</span>
      </div>

      <p v-if="product.gift" class="gift">{{ product.gift }}</p>

      <div class="price">
        <em>¥</em>
        <strong>{{ priceParts.int }}</strong>
        <i>.{{ priceParts.dec }}</i>
        <span class="label">到手约</span>
      </div>
    </div>
  </component>
</template>

<style scoped>
.card {
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  color: inherit;
}

.thumb {
  position: relative;
  aspect-ratio: 1 / 1;
  background: #f7f7f7;
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb-empty {
  height: 100%;
  display: grid;
  place-items: center;
  color: #ccc;
  font-size: 12px;
}

.ribbon {
  position: absolute;
  left: 0;
  top: 8px;
  background: var(--jd);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  line-height: 18px;
  padding: 0 6px 0 8px;
  border-radius: 0 10px 10px 0;
}

.body {
  padding: 8px 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.name {
  font-size: 13px;
  font-weight: 400;
  line-height: 18px;
  height: 36px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag {
  height: 16px;
  line-height: 14px;
  padding: 0 4px;
  border: 1px solid #ffb0aa;
  color: var(--jd);
  font-size: 10px;
  border-radius: 2px;
}

.tag.warn {
  color: #d48806;
  border-color: #ffe58f;
}

.gift {
  font-size: 11px;
  color: #d48806;
  line-height: 16px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.price {
  margin-top: auto;
  display: flex;
  align-items: baseline;
  color: var(--jd);
}

.price em,
.price i {
  font-style: normal;
  font-weight: 700;
}

.price em {
  font-size: 12px;
  margin-right: 1px;
}

.price strong {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.4px;
  line-height: 1;
}

.price i {
  font-size: 12px;
}

.price .label {
  margin-left: 4px;
  font-size: 11px;
  color: #bbb;
  font-weight: 400;
}

@media (min-width: 960px) {
  .card {
    border-radius: 0;
    border: 1px solid transparent;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .card:hover {
    border-color: var(--jd);
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.08);
    z-index: 1;
  }

  .body {
    padding: 10px 12px 12px;
    gap: 8px;
  }

  .name {
    font-size: 14px;
    line-height: 20px;
    height: 40px;
  }

  .name:hover {
    color: var(--jd);
  }

  .gift {
    white-space: normal;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .price strong {
    font-size: 22px;
  }

  .ribbon {
    font-size: 12px;
    line-height: 20px;
  }
}
</style>
