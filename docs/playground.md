---
layout: home
---

<MonacoEditor />

<script setup>
import { defineAsyncComponent } from 'vue';
import { inBrowser } from 'vitepress';

const MonacoEditor = inBrowser
  ? defineAsyncComponent(() => import('./components/editor.vue'))
  : () => null;
</script>
