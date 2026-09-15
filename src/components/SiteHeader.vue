<script setup>
defineProps({
  updateInfo: { type: Object, default: () => ({}) },
  search: { type: String, default: '' },
  resultCount: { type: Number, default: 0 },
  keywords: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:search'])
</script>

<template>
  <header class="header">
    <div class="header-inner">
      <div class="brand">
        <span class="logo">京东</span>
        <div class="titles">
          <h1>送家政商品汇总</h1>
          <p class="sub">
            <span v-if="updateInfo.total">共 {{ updateInfo.total }} 件</span>
            <span v-if="updateInfo.updatedAt"> · {{ updateInfo.updatedAt }} 更新</span>
          </p>
        </div>
      </div>

      <label class="search">
        <input
          :value="search"
          type="search"
          placeholder="搜索商品名称"
          @input="emit('update:search', $event.target.value)"
        />
        <span class="search-btn">搜索</span>
      </label>

      <div class="side">
        <span class="hit">当前 {{ resultCount }} 件</span>
      </div>
    </div>

    <div v-if="keywords.length" class="hots">
      <span class="hots-label">热搜</span>
      <button
        v-for="word in keywords"
        :key="word"
        type="button"
        class="hot"
        :class="{ on: search === word }"
        @click="emit('update:search', search === word ? '' : word)"
      >
        {{ word }}
      </button>
    </div>
  </header>
</template>

<style scoped>
.header {
  background: var(--jd);
  color: #fff;
  padding: 10px 8px 12px;
}

.header-inner {
  max-width: 1200px;
  margin: 0 auto;
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.logo {
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: #fff;
  color: var(--jd);
  font-size: 12px;
  font-weight: 800;
  display: grid;
  place-items: center;
}

.titles h1 {
  font-size: 16px;
  font-weight: 700;
  line-height: 1.2;
}

.sub {
  font-size: 11px;
  opacity: 0.85;
  margin-top: 2px;
}

.search {
  display: flex;
  align-items: stretch;
  height: 36px;
  background: #fff;
  border-radius: 18px;
  overflow: hidden;
}

.search input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  padding: 0 14px;
  font-size: 13px;
  color: var(--text);
  background: transparent;
}

.search input::placeholder {
  color: #bbb;
}

.search input[type='search']::-webkit-search-cancel-button {
  appearance: none;
}

.search-btn {
  display: none;
}

.side {
  display: none;
}

.hots {
  display: none;
}

@media (min-width: 960px) {
  .header {
    background: #fff;
    color: var(--text);
    border-bottom: 1px solid var(--border);
    padding: 16px;
  }

  .header-inner {
    display: grid;
    grid-template-columns: 220px 1fr 160px;
    align-items: center;
    gap: 24px;
  }

  .brand {
    margin-bottom: 0;
  }

  .logo {
    width: 44px;
    height: 44px;
    font-size: 14px;
    background: var(--jd);
    color: #fff;
  }

  .titles h1 {
    font-size: 20px;
  }

  .sub {
    color: var(--text-muted);
    opacity: 1;
    font-size: 12px;
  }

  .search {
    height: 40px;
    border-radius: 0;
    border: 2px solid var(--jd);
    background: #fff;
  }

  .search-btn {
    display: grid;
    place-items: center;
    width: 82px;
    background: var(--jd);
    color: #fff;
    font-size: 16px;
    font-weight: 700;
  }

  .side {
    display: block;
    text-align: right;
    font-size: 13px;
    color: var(--text-muted);
  }

  .hit {
    color: var(--jd);
    font-weight: 700;
  }

  .hots {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px 12px;
    max-width: 1200px;
    margin: 10px auto 0;
    padding-left: 244px;
  }

  .hots-label {
    font-size: 12px;
    color: #bbb;
  }

  .hot {
    font-size: 12px;
    color: #666;
  }

  .hot:hover,
  .hot.on {
    color: var(--jd);
  }
}
</style>
