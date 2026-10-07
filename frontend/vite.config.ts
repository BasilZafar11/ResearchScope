import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({ plugins: [react(), tailwindcss()], server: { proxy: {'/api':'http://127.0.0.1:8000','/health':'http://127.0.0.1:8000'} }, build:{rollupOptions:{output:{manualChunks(id){if(id.includes('/node_modules/recharts/')||id.includes('/node_modules/d3-'))return 'charts';if(id.includes('/node_modules/leaflet/')||id.includes('/node_modules/react-leaflet/'))return 'map';}}}}, test: { environment: 'jsdom', setupFiles: ['./src/test-setup.ts'] } });
