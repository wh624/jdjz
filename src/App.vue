<script setup>
import { ref, computed } from 'vue'
import { categories } from './data/products.json'
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

const allProducts = computed(() =>
  categories.flatMap((c) => c.products.map((p) => ({ ...p, category: c.name })))
)

const matchSearch = (p) => {
  const q = search.value.trim()
  return !q || p.name.includes(q)
}

// 用于头部/导航的「共 N 件」统计（不含分组）
const resultCount = computed(() => {
  let list = allProducts.value.filter(matchSearch)
  if (activeTab.value === 'gift') list = list.filter((p) => p.gift)
  if (activeTab.value === 'bookable') list = list.filter((p) => p.bookable !== false)
  if (activeTab.value === 'all' && activeCategory.value !== 'all') {
    list = list.filter((p) => p.category === activeCategory.value)
  }
  return list.length
})

// 分组展示
const groups = computed(() => {
  const q = search.value.trim()

  if (activeTab.value === 'all') {
    return categories
      .filter((c) => activeCategory.value === 'all' || c.name === activeCategory.value)
      .map((c) => ({
        name: c.name,
        products: c.products.filter((p) => !q || p.name.includes(q))
      }))
      .filter((g) => g.products.length > 0)
  }

  // 其余 tab 使用平铺列表
  let list = allProducts.value.filter(matchSearch)
  if (activeTab.value === 'gift') list = list.filter((p) => p.gift)
  if (activeTab.value === 'bookable') list = list.filter((p) => p.bookable !== false)
  // recent：展示全部（数据无时间戳，按原始顺序）
  return list.length ? [{ name: '', products: list }] : []
})

</script>

<template>
  <SiteHeader  />

  <CategoryNav
    :tabs="tabs"
    :active-tab="activeTab"
    :categories="categories"
    :active-category="activeCategory"
    :search="search"
    :result-count="resultCount"
    @update:active-tab="activeTab = $event"
    @update:active-category="activeCategory = $event"
    @update:search="search = $event"
  />

  <main>
    <ProductSection :groups="groups" />
  </main>

  <InfoSection />
</template>
