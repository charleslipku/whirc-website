# WHIRC 官方网站开发文档

**项目名称**：Women's Health Interdisciplinary Research Collaborative (WHIRC) 官方网站
**文档版本**：v1.0（2026-07-07）
**负责人**：Ang Li（PI, ECE, UMD）

---

## 1. 项目概述

为 UMD Grand Challenges Institutional Award 项目 WHIRC 建设官方网站，用于：

- 展示项目使命、研究方向、团队成员（PI: Marie Thoma；Co-PI: Jioni Lewis, Alisa Clyne, Ang Li，以及近百名参与教师/学生）
- 发布项目动态、活动、资源
- **自动聚合** UMD 官方新闻中与 women's health 相关的报道（关键词可配置）
- 先通过 GitHub Pages 部署，后期迁移至 UMD 子域名（如 `whirc.umd.edu`）

### 1.1 核心需求清单

| # | 需求 | 优先级 |
|---|------|--------|
| R1 | 整体风格仿照 [mdi.umd.edu](https://mdi.umd.edu)（Maryland Democracy Initiative） | P0 |
| R2 | GitHub Pages 部署，预留自定义域名迁移能力 | P0 |
| R3 | 基于 Markdown 的内容管理（增删改文字/图片/视频） | P0 |
| R4 | 仿照 [aim.umd.edu](https://aim.umd.edu) 的 News 功能：自动抓取带预设关键词（如 "women's health"）的 UMD 官方新闻，关键词可自定义 | P0 |
| R5 | 使用已提供的 WHIRC Logo | P0 |
| R6 | 响应式设计（桌面/平板/手机） | P1 |
| R7 | 无障碍访问（UMD 要求 WCAG 2.1 AA） | P1 |

---

## 2. 参考网站分析

### 2.1 mdi.umd.edu（设计风格参照）

- **页头**：左侧 Logo + 横向主导航（About / Directory / News / Our Work / Partners / Events / Support），About 与 News 有二级下拉菜单
- **Hero 区**：全宽校园背景大图 + 主标语（我们对应为 *"Bridging Disciplines. Advancing Research and Education. Elevating Women's Health."*）
- **首页板块顺序**：Hero → 三张卡片（Who We Are / What We Do / Where We Begin，图+文+Learn More 链接）→ 名人引言区块 → Grand Challenges Award 徽章
- **页脚**：联系方式（电话/邮箱）、社交媒体（Instagram/LinkedIn）、Web Accessibility 与 Privacy 链接
- **视觉模式**：卡片式模块、图文组合、清晰的标题层级、学术机构式简洁配色

### 2.2 aim.umd.edu（News 功能参照）

- News 以**卡片网格**呈现：左侧缩略图 + 标题 + 日期（Month DD, YYYY）
- 首页展示约 8 条最新新闻，倒序排列，底部 "View More News" 进入完整归档页
- 新闻来源为 UMD 官方渠道（Maryland Today 等），主题与项目使命对齐

### 2.3 内容来源

- WHIRC 官方项目页：https://research.umd.edu/grand-challenges-grants/grand-challenges-2/institutional-grants-2.0/whirc
- Grand Challenges 提案 PDF（已有）
- 三大支柱内容：**Translational Research（转化研究）/ Workforce Pipeline（人才培养）/ Community Partnerships（社区合作）**

---

## 3. 技术选型

### 3.1 推荐方案：Astro + GitHub Actions + GitHub Pages

| 组件 | 选型 | 理由 |
|------|------|------|
| 静态站点生成器 | **Astro**（Content Collections） | 原生 Markdown/MDX 支持、frontmatter 校验（schema）、零 JS 默认输出、构建快、生态活跃 |
| 托管 | **GitHub Pages** | 免费、需求 R2 指定；通过 GitHub Actions 构建部署（不受 Jekyll 限制） |
| News 抓取 | **GitHub Actions 定时任务**（Node 脚本） | 每日定时拉取 UMD RSS 源 → 关键词过滤 → 生成新闻数据 → 自动 commit 触发重建 |
| 内容编辑 | Markdown 文件 + GitHub 网页编辑器（github.dev） | 团队成员无需本地环境即可改内容；后期可选接入 CMS（见 §6.4） |
| 样式 | 原生 CSS（design tokens）或 Tailwind CSS | 复刻 mdi.umd.edu 风格 + UMD 品牌色 |

**备选方案对比**（供决策记录）：

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| Jekyll | GitHub Pages 原生支持 | Ruby 生态老旧、抓取脚本集成别扭 | 不选 |
| Hugo | 构建极快 | Go 模板对协作者不友好、组件化弱 | 备选 |
| Next.js 静态导出 | 生态大 | 对纯内容站过重、维护成本高 | 不选 |
| **Astro** | Markdown 一等公民、schema 校验、轻量 | 团队需学习基本目录约定 | ✅ **推荐** |

### 3.2 依赖环境

- Node.js ≥ 20（本地开发与 CI）
- 包管理：npm 或 pnpm
- 仓库：GitHub（建议建在课题组 organization 下，便于多人协作与后期交接）

---

## 4. 信息架构（Sitemap）

```
Home（首页）
├── About
│   ├── Who We Are（使命、Grand Challenges 背景）
│   └── What We Do（三大支柱：Research / Education / Community）
├── People
│   ├── Leadership（PI / Co-PIs）
│   ├── Affiliated Faculty（参与教师，按学院分组）
│   └── Students & Trainees
├── Research（研究方向 / 项目 / 发表成果）
├── News
│   ├── WHIRC News（手动发布的项目新闻）
│   └── In The News（自动抓取的 UMD 官方相关报道）★ R4
├── Events（活动/研讨会，含过往归档）
├── Resources / Get Involved（加入方式、合作、资助机会）
└── Contact
```

**首页板块**（仿 mdi.umd.edu）：

1. Hero：全宽背景图 + WHIRC Logo/标语 + CTA 按钮（Learn More / Get Involved）
2. 三卡片区：Who We Are / What We Do / Get Involved
3. Latest News：最新 4–8 条新闻卡片（自动 + 手动混合，见 §7）
4. 数据亮点条：如 "100+ Faculty & Trainees" "3 Schools" "Grand Challenges Institutional Award"
5. Upcoming Events（可选）
6. Grand Challenges Award 徽章 + 页脚

---

## 5. 设计规范

### 5.1 品牌色（UMD 官方色板）

| 用途 | 颜色 | 色值 |
|------|------|------|
| 主色 | Maryland Red | `#E21833` |
| 强调色 | Maryland Gold | `#FFD200` |
| 文字主色 | 近黑 | `#231F20` |
| 辅助灰 | 深灰/浅灰 | `#54585A` / `#F1F1F1` |

Logo 本身即为红/金/深灰配色，与 UMD 色板天然一致。

### 5.2 字体

- 标题：衬线体（如 Crimson Pro / Source Serif，呼应 Logo 字体风格）
- 正文：无衬线体（如 Source Sans 3 / Interstate 替代品）
- 全部使用可自托管的开源字体（避免外链依赖，兼顾隐私与加载速度）

### 5.3 Logo 使用

- 已提供横版 Logo（图形 + "Women's Health Interdisciplinary Collaborative + M + University of Maryland"）
- 需准备的衍生版本：
  - `logo-full.png/svg`（页头用横版）
  - `logo-mark.png/svg`（仅圆形图形部分，用于 favicon、社交分享图标）
  - 深色背景反白版（页脚为深色时使用）
- **注意**：使用 UMD "M" 标识的子品牌需符合 [UMD Brand Guidelines](https://brand.umd.edu)，上线前建议与学校 Strategic Communications 确认（申请 umd.edu 子域名时通常会一并审核）

### 5.4 无障碍

- 色彩对比度 ≥ 4.5:1；所有图片带 `alt`；键盘可导航；语义化 HTML
- UMD 对 umd.edu 域名下网站有 IT Accessibility 政策要求，迁移域名前需自查（可用 axe / Lighthouse）

---

## 6. 内容管理方案（R3）

### 6.1 目录结构

```
whirc-website/
├── src/
│   ├── content/                 # ★ 所有可编辑内容（Markdown）
│   │   ├── pages/               # About、Research 等静态页面正文
│   │   ├── people/              # 每人一个 .md（姓名、头衔、照片、链接）
│   │   ├── news/                # 手动发布的 WHIRC 新闻
│   │   ├── events/              # 活动
│   │   └── config/
│   │       ├── site.yaml        # 站点标题、联系方式、社交链接
│   │       └── news-tags.yaml   # ★ News 抓取关键词配置（R4）
│   ├── data/
│   │   └── external-news.json   # 自动抓取的新闻（脚本生成，勿手改）
│   ├── components/              # 页头/页脚/卡片等组件
│   ├── layouts/
│   ├── styles/
│   └── pages/                   # 路由
├── public/
│   ├── images/                  # 图片资源（logo、照片）
│   └── videos/                  # 小体积视频；大视频用 YouTube 嵌入
├── scripts/
│   └── fetch-news.mjs           # ★ News 抓取脚本
├── .github/workflows/
│   ├── deploy.yml               # 构建 + 部署到 GitHub Pages
│   └── fetch-news.yml           # 定时抓取新闻
├── docs/DEVELOPMENT.md          # 本文档
└── astro.config.mjs
```

### 6.2 Markdown 内容示例

新闻（`src/content/news/2026-09-01-kickoff.md`）：

```markdown
---
title: "WHIRC Kickoff Symposium Announced"
date: 2026-09-01
image: /images/news/kickoff.jpg
tags: [event, symposium]
featured: true
---

正文支持完整 Markdown：**加粗**、列表、链接、图片：

![Symposium venue](/images/news/venue.jpg)

视频用 YouTube 嵌入：

<YouTube id="xxxxxxx" />
```

人员（`src/content/people/ang-li.md`）：

```markdown
---
name: "Ang Li"
role: "Principal Investigator"
title: "Assistant Professor, Electrical and Computer Engineering"
school: "A. James Clark School of Engineering"
photo: /images/people/ang-li.jpg
website: https://...
order: 4
---

（可选的个人简介段落）
```

### 6.3 日常内容操作流程（面向非技术协作者）

1. 打开 GitHub 仓库 → 进入 `src/content/` 对应目录
2. 网页端直接新建/编辑 `.md` 文件（或按 `.` 进入 github.dev 全功能编辑器）
3. 图片上传到 `public/images/` 对应子目录，在 Markdown 中引用
4. Commit 后 GitHub Actions 自动构建部署，约 1–2 分钟生效

计划提供一份一页纸的《内容编辑手册》（`docs/CONTENT-GUIDE.md`）给团队成员。

### 6.4 可选增强：可视化 CMS（Phase 3）

如后期团队希望完全脱离 GitHub 界面，可接入 **Sveltia CMS / Decap CMS**（开源、Git-based，编辑界面直接读写仓库中的 Markdown）。GitHub Pages 场景下需一个免费的 Cloudflare Worker 做 OAuth 代理。此项不阻塞上线，列为后期增强。

---

## 7. News 自动聚合系统（R4，核心功能）

### 7.1 架构

```
UMD 官方 RSS 源 ──┐
                  ├─► scripts/fetch-news.mjs ─► 关键词过滤/去重 ─► src/data/external-news.json
（每日定时触发）──┘                                                        │
                                                       git commit ─► 触发站点重建部署
```

### 7.2 数据源（初始清单，实施时验证可用性）

| 来源 | 说明 |
|------|------|
| Maryland Today（today.umd.edu）RSS | UMD 主新闻源，覆盖全校 |
| School of Public Health 新闻页/RSS | Marie Thoma、Jioni Lewis 相关报道多 |
| Clark School of Engineering（eng.umd.edu）RSS | Clyne / Li 相关 |
| College of Education 新闻 | Lewis 相关 |
| UMD Research（research.umd.edu）新闻 | Grand Challenges 相关 |

若某来源无 RSS，脚本降级为 HTML 列表页解析（保留 CSS selector 配置项）。

### 7.3 关键词配置（可自定义，R4 核心）

`src/content/config/news-tags.yaml` —— 团队成员直接在 GitHub 网页上编辑即可生效：

```yaml
# News 抓取关键词配置
# match: 标题或摘要命中任一 include 关键词（不区分大小写）即收录
include:
  - "women's health"
  - "women health"
  - "maternal health"
  - "maternal mortality"
  - "reproductive health"
  - "menopause"
  - "WHIRC"
  - "Marie Thoma"
  - "Jioni Lewis"
  - "Alisa Clyne"
  - "Ang Li"
exclude: []          # 命中则剔除（处理误报）
sources:             # 数据源开关，可增删
  - id: maryland-today
    type: rss
    url: https://today.umd.edu/rss.xml
    enabled: true
max_items: 100       # 归档保留条数
```

### 7.4 抓取脚本行为

1. 读取 `news-tags.yaml`，逐源拉取条目（标题、链接、日期、摘要、缩略图）
2. 关键词过滤（include/exclude，大小写不敏感，支持词组）
3. 与现有 `external-news.json` 按 URL 去重合并，按日期倒序
4. 有新增才 commit（避免空提交刷屏）
5. 抓取失败仅告警不中断（单源故障不影响其余源）

**定时策略**：GitHub Actions cron，每天 1 次（如 UTC 11:00 ≈ 美东早上 6/7 点）；也可手动触发（`workflow_dispatch`）。

**呈现（仿 aim.umd.edu）**：News 页两个分区/Tab——"WHIRC News"（手动）与 "In The News"（自动，卡片：缩略图 + 标题 + 日期 + 来源，点击跳转原文）；首页 Latest News 混合展示最新条目。

**可选审核模式**：抓取结果先进 `pending` 状态，人工在 JSON/PR 中确认后再展示（初期建议关闭，观察误报率后决定）。

---

## 8. 部署方案（R2）

### 8.1 Phase 1：GitHub Pages

- 仓库 → Settings → Pages → Source: **GitHub Actions**
- `deploy.yml`：push 到 `main` 时 `astro build` → 上传 artifact → 部署
- 临时地址：`https://<org>.github.io/whirc-website/`
- Astro 配置 `site` + `base`，确保子路径下资源路径正确（迁移自定义域名时只需改这两项）

### 8.2 Phase 2：迁移 UMD 子域名

1. 向 UMD DIT 申请子域名（如 `whirc.umd.edu`），提交网站用途与无障碍合规说明
2. DIT 将子域名 CNAME 指向 `<org>.github.io`
3. 仓库 Pages 设置中填写 Custom domain → 自动签发 HTTPS 证书 → 勾选 Enforce HTTPS
4. 更新 `astro.config.mjs`（`site: 'https://whirc.umd.edu'`，`base: '/'`），重新部署
5. 旧 github.io 地址自动 301 到新域名

> 迁移零停机、无需改动任何内容文件，是 GitHub Pages 的标准流程。

---

## 9. 开发计划与里程碑

| 阶段 | 内容 | 预估工作量 |
|------|------|-----------|
| **M1 脚手架** | Astro 项目初始化、设计 tokens（UMD 色板/字体）、页头页脚、Logo 集成、部署管线打通（GitHub Pages 可访问） | 1 天 |
| **M2 核心页面** | 首页（Hero + 卡片 + 数据条）、About、People、Contact；内容从提案 PDF 与官方项目页迁移 | 1–2 天 |
| **M3 News 系统** | 抓取脚本 + 关键词配置 + 定时 workflow + News 页（双分区）+ 首页 Latest News | 1–2 天 |
| **M4 完善** | Events、Research、Resources 页；响应式与无障碍自查（Lighthouse ≥ 90）；《内容编辑手册》 | 1 天 |
| **M5 上线** | 团队评审、内容校对、正式发布 github.io；启动子域名申请 | — |
| **M6（后期）** | 域名迁移；可选接入可视化 CMS；Google Analytics（UMD 常用 GA4） | — |

---

## 10. 风险与注意事项

| 风险 | 影响 | 缓解 |
|------|------|------|
| UMD 各新闻源 RSS 地址变动或不存在 | 抓取失败 | 实施时逐一验证；脚本支持 HTML 解析降级；多源冗余 |
| 关键词误报/漏报 | News 区内容质量 | exclude 列表 + 可选人工审核模式；上线初期每周人工检查一次 |
| UMD 品牌合规（M 标识、子域名审核） | 上线受阻 | 提前对照 brand.umd.edu 自查；申请域名时同步提交 |
| 无障碍不达标 | 域名申请被拒 | 开发期持续跑 axe/Lighthouse，M4 专项自查 |
| 团队成员不熟悉 Git | 内容更新停滞 | 网页端编辑流程 +《内容编辑手册》；后期可上 CMS |
| 转载新闻的图片版权 | 合规风险 | "In The News" 只展示缩略图+摘要并跳转原文，不全文转载 |

---

## 11. 待确认事项（需项目组决策）

1. **仓库位置**：建在个人账号还是新建 WHIRC organization？（建议 org，便于交接）
2. **子域名意向**：`whirc.umd.edu`？需提前和 DIT/Research 办公室沟通
3. **首页 Hero 图**：是否有项目自己的照片素材，或暂用 UMD 校园图库
4. **News 初始关键词清单**：§7.3 的草案请团队确认增删
5. **社交媒体账号**：页脚需要放哪些（Instagram/LinkedIn/X）？
6. **Logo 源文件**：是否有 SVG/AI 矢量版？（当前 PNG 可用，矢量版清晰度更佳）
