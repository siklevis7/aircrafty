import { defineConfig } from 'vite';

// Relative base so the build works on GitHub Pages under any repository name
// (https://<user>.github.io/<repo>/) as well as on a custom domain.
export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 800, // three.js is one large chunk by design
  },
});
