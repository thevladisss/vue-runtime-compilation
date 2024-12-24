import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/-wasm/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  assetsInclude: [
    "node_modules/esbuild-wasm/**/*.wasm",
  ],
  resolve: {
    alias: {
      vue: 'vue/dist/vue.esm-bundler.js',
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})
