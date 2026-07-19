<script setup>
import { footer } from '../data/info.js'
</script>

<template>
  <footer class="footer">
    <p class="slogan">{{ footer.slogan }}</p>
    <p class="copyright">{{ footer.copyright }}</p>
  </footer>
</template>

<style scoped>
.footer {
  margin-top: 40px;
  padding: 24px 4px;
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
  border-top: 1px solid var(--border);
}
.slogan {
  font-weight: 700;
  color: var(--text);
  margin-bottom: 6px;
}
</style>
