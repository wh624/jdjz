<script setup>
import { ref, computed, onMounted } from 'vue'
import SiteHeader from './components/SiteHeader.vue'
import CategoryNav from './components/CategoryNav.vue'
import ProductSection from './components/ProductSection.vue'
import InfoSection from './components/InfoSection.vue'

const tabs = [
  { key: 'all', label: '分类浏览' },
  { key: 'recent', label: '最近更新' },
  { key: 'bookable', label: '8天可约' },
  { key: 'gift', label: '赠品' }
]

const activeTab = ref('all')
const activeCategory = ref('all')
const search = ref('')

const data = ref({ categories: [], updateInfo: {}, keywords: [] })
const categories = computed(() => data.value.categories || [])
const updateInfo = computed(() => data.value.updateInfo || {})
const keywords = computed(() => data.value.keywords || [])

onMounted(async () => {
  try {
    const res = await fetch('data/jdjz_products.json', { cache: 'no-store' })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    data.value = await res.json()
  } catch (e) {
    console.error('加载商品数据失败：', e)
  }
})

const allProducts = computed(() =>
  categories.value.flatMap((c) => c.products.map((p) => ({ ...p, category: c.name })))
)

const matchSearch = (p) => {
  const q = search.value.trim()
  return !q || p.name.includes(q)
}

const resultCount = computed(() => {
  let list = allProducts.value.filter(matchSearch)
  if (activeTab.value === 'gift') list = list.filter((p) => p.gift)
  if (activeTab.value === 'bookable') list = list.filter((p) => p.bookable !== false)
  if (activeTab.value === 'all' && activeCategory.value !== 'all') {
    list = list.filter((p) => p.category === activeCategory.value)
  }
  return list.length
})

const groups = computed(() => {
  const q = search.value.trim()

  if (activeTab.value === 'all') {
    return categories.value
      .filter((c) => activeCategory.value === 'all' || c.name === activeCategory.value)
      .map((c) => ({
        name: c.name,
        products: c.products.filter((p) => !q || p.name.includes(q))
      }))
      .filter((g) => g.products.length > 0)
  }

  let list = allProducts.value.filter(matchSearch)
  if (activeTab.value === 'gift') list = list.filter((p) => p.gift)
  if (activeTab.value === 'bookable') list = list.filter((p) => p.bookable !== false)
  return list.length ? [{ name: '', products: list }] : []
})
</script>

<template>
  <div class="sticky-head">
    <SiteHeader
      :update-info="updateInfo"
      :search="search"
      :result-count="resultCount"
      :keywords="keywords"
      @update:search="search = $event"
    />
    <CategoryNav
      :tabs="tabs"
      :active-tab="activeTab"
      :categories="categories"
      :active-category="activeCategory"
      @update:active-tab="activeTab = $event"
      @update:active-category="activeCategory = $event"
    />
  </div>

  <div class="page">
    <main>
      <ProductSection :groups="groups" />
    </main>
    <InfoSection />
    <footer class="site-foot">价格、库存与赠品以京东结算页为准，本站仅整理线索</footer>
  </div>
</template>

<style scoped>
.sticky-head {
  position: sticky;
  top: 0;
  z-index: 40;
}

.site-foot {
  margin-top: 24px;
  padding: 16px 4px 8px;
  color: #bbb;
  font-size: 12px;
  text-align: center;
}

@media (min-width: 960px) {
  .sticky-head {
    position: static;
  }

  .site-foot {
    text-align: left;
    margin-top: 32px;
  }
}
</style>
