import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://womenshealth.umd.edu',
  base: '/',
  trailingSlash: 'ignore',
  redirects: {
    // 2026-09：Focus Areas 更名为 Affinity Research Teams（沿用申请书用语）
    '/research/focus-areas': '/research/affinity-research-teams',
    // 2026-09：Projects 页暂时撤下（尚无可公开的项目列表），内容并入 Research 概览
    '/research/projects': '/research',
  },
});
