import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://womenshealth.umd.edu',
  base: '/',
  trailingSlash: 'ignore',
  redirects: {
    // 2026-09：Focus Areas 更名为 Affinity Research Teams（沿用申请书用语）
    '/research/focus-areas': '/research/affinity-research-teams',
  },
});
