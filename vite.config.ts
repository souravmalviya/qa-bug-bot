import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      // NOTE: The proxy below is ONLY used by Vite's dev server (npm run dev).
      // It is completely ignored in production builds (npm run build).
      // On AWS Amplify, the frontend calls the real API Gateway URL from amplify_outputs.json.
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3005',
          changeOrigin: true
        }
      }
    },
    plugins: [react(), tailwindcss()],
    resolve: {

      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
