import { defineConfig } from 'astro/config';

// Phase 1: GitHub Pages project site.
// Phase 2 (custom domain): change site to 'https://whirc.umd.edu' and base to '/'.
export default defineConfig({
  // 账号级 Pages 已绑定 www.ang-li.com，项目站点发布于该域名下
  site: 'https://www.ang-li.com',
  base: '/whirc-website',
  trailingSlash: 'ignore',
});
