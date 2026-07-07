import { defineConfig } from 'astro/config';

// Phase 1: GitHub Pages project site.
// Phase 2 (custom domain): change site to 'https://whirc.umd.edu' and base to '/'.
export default defineConfig({
  site: 'https://charleslipku.github.io',
  base: '/whirc-website',
  trailingSlash: 'ignore',
});
