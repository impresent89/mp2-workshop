import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/mp2-workshop/',
  plugins: [react()],
})
