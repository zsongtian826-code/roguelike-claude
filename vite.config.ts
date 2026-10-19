/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages(https://<user>.github.io/roguelike-claude/)で公開するため base を設定
export default defineConfig({
  base: '/roguelike-claude/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
