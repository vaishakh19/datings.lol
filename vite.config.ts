/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

// Vite config for datings.lol.
//
// Dev HMR is enabled by default. The DISABLE_HMR env var is a local-only toggle
// used by tooling that prefers no live reload during automated edits.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    globals: false,
    // Tests spin up real HTTP servers on ephemeral ports; running them in
    // parallel can exhaust fds and occasionally cause port rebind flakes on
    // resource-constrained sandboxes. Serial execution keeps the suite
    // deterministic.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['server.ts', 'server/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.d.ts', 'dist/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          motion: ['motion'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
  server: {
    hmr: process.env.DISABLE_HMR === 'true' ? false : { port: 24679 },
    watch: process.env.DISABLE_HMR === 'true' ? null : undefined,
  },
});
