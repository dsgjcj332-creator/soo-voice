import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = {
    ...loadEnv(mode, '.', ''),
    ...process.env,
  };
  return {
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    define: {
      'import.meta.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL),
      'import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY),
      'import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY),
      'import.meta.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL': JSON.stringify(env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL),
    },
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'disable-vite-hmr-client',
        enforce: 'post',
        transformIndexHtml(html) {
          return html
            .replace(/<script[^>]*@vite\/client[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<script[^>]*src=["'][^"']*vite\/client[^"']*["'][^>]*><\/script>/gi, '')
            .replace(/(?:import|src\s*=)\s*["']?[^"'\s>]*\/@vite\/client[^"'\s>]*["']?;?/gi, '')
            .replace(/\/?@vite\/client/g, '');
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      port: parseInt(process.env.PORT || '3000', 10),
      hmr: false,
      ws: false,
    },
  };
});
