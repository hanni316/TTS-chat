import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'TTS-chat',
        short_name: 'TTS-chat',
        description: '메시지를 보내면 상대방의 귀로 전달되는, 듣는 채팅',
        theme_color: '#7C5CFF',
        background_color: '#0F1115',
        display: 'standalone',
        start_url: '/',
        lang: 'ko',
        // SVG 아이콘은 maskable 안전 영역(safe zone)을 보장하지 못하므로 purpose는 'any'만 사용한다.
        // maskable 지원을 위해서는 안전 영역 패딩이 적용된 별도의 'maskable' 전용 PNG 아이콘
        // (예: pwa-192-maskable.png, pwa-512-maskable.png)을 추가하고 purpose: 'maskable' 항목으로 등록해야 한다.
        // (PNG 파일 생성은 이 작업 범위 밖이다.)
        icons: [
          {
            src: 'pwa-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'pwa-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
