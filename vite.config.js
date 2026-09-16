import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: './',
  plugins: [tailwindcss()],
  build: {
    target: 'chrome134',
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        pet: resolve(import.meta.dirname, 'pet.html'),
        settings: resolve(import.meta.dirname, 'settings.html'),
        'live-widget': resolve(import.meta.dirname, 'live-widget.html')
      }
    }
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js']
  }
})
