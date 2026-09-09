import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          // Split heavy vendor libraries out of the main entry so the initial bundle stays
          // within the P13 guardrail (<700 kB raw / <210 kB gzip). Behavior-preserving: these
          // remain shared chunks lazily referenced by the entry and by lazy() views.
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('@aws-sdk') || id.includes('@smithy')) return 'vendor-aws';
            if (id.includes('jspdf') || id.includes('canvg') || id.includes('html2canvas')) return 'vendor-pdf';
            if (id.includes('@google/genai')) return 'vendor-ai';
            if (id.includes('motion')) return 'vendor-motion';
            if (id.includes('react') || id.includes('scheduler')) return 'vendor-react';
            if (id.includes('@supabase')) return 'vendor-supabase';
            return 'vendor';
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify — file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      allowedHosts: true as const,
    },
  };
});
