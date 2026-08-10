import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages 프로젝트 사이트 경로 (https://<user>.github.io/personal-color-hairstyle-app/)
  base: '/personal-color-hairstyle-app/',
  plugins: [react()],
})
