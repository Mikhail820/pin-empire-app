import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, '.', '');
  
  // Try to get API KEY from loaded env OR system process.env (Vercel)
  const apiKey = env.API_KEY || process.env.API_KEY;

  return {
    plugins: [react()],
    base: '/',
    define: {
      // This is critical for Vercel deployment to expose the API Key to the client
      // We use || '' to prevent undefined errors during build replacement
      'process.env.API_KEY': JSON.stringify(apiKey || '')
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
      emptyOutDir: true,
    }
  }
})