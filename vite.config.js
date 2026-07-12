import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // GitHub Pages 프로젝트 사이트(/<repo>/) 배포용 — CI에서만 설정되고 로컬 dev/E2E는 '/' 유지
  base: process.env.DEPLOY_BASE || '/',
  plugins: [react(), tailwindcss()],
  server: {
    watch: {
      // .omc는 에이전트 툴링의 상태 파일 — 감시하면 개발 중 무의미한 풀 리로드가 발생
      ignored: ['**/.omc/**'],
    },
  },
})
