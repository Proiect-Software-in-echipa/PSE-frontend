import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function setRssHeaders(proxyReq) {
  proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
  proxyReq.setHeader('Accept', 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*');
  proxyReq.setHeader('Accept-Language', 'en-US,en;q=0.9');
  proxyReq.setHeader('Cache-Control', 'no-cache');
  proxyReq.setHeader('Pragma', 'no-cache');
  proxyReq.setHeader('DNT', '1');
  proxyReq.removeHeader('origin');
  proxyReq.removeHeader('referer');
  proxyReq.removeHeader('sec-fetch-dest');
  proxyReq.removeHeader('sec-fetch-mode');
  proxyReq.removeHeader('sec-fetch-site');
}

export default defineConfig(() => {
  return {
    plugins: [react()],
    server: {
      proxy: {
        // ── Football-Data.org API ────────────────────────────────────────────
        '/api/football': {
          target: 'https://api.football-data.org',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/football/, ''),
        },
        // ── PSE Backend (FastAPI, port 8000) ────────────────────────────────
        '/api/pse': {
          target: 'http://localhost:8000',
          changeOrigin: false,
          rewrite: (path) => path.replace(/^\/api\/pse/, ''),
        }
      },
    },
  }
})
