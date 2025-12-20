import { defineConfig } from 'vite';
import yaml from '@modyfi/vite-plugin-yaml';

export default defineConfig({
  base: '/fluid-wars/',  // GitHub Pages subdirectory
  plugins: [yaml()],
  build: {
    target: 'esnext',  // Support top-level await
  },
  esbuild: {
    target: 'esnext',
  },
});
