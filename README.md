# WHIRC Website

Official website of the **Women's Health Interdisciplinary Research Collaborative (WHIRC)**,
a University of Maryland [Grand Challenges Institutional Grant](https://research.umd.edu/grand-challenges-grants/grand-challenges-2/institutional-grants-2.0/whirc).

*Bridging Disciplines. Advancing Research and Education. Elevating Women's Health.*

## Tech Stack

- [Astro](https://astro.build) static site, deployed to **GitHub Pages** via GitHub Actions
- All content lives in Markdown/YAML under `src/content/` — see **[docs/CONTENT-GUIDE.md](docs/CONTENT-GUIDE.md)** (编辑内容请看这里)
- "In The News" is auto-curated daily from official UMD RSS feeds by
  `scripts/fetch-news.mjs`, filtered by keywords in
  `src/content/config/news-tags.yaml`
- Full design & architecture: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)

## Local Development

```bash
npm install
npm run dev        # http://localhost:4321/
npm run build      # production build → dist/
npm run fetch-news # manually run the news fetcher
```

## Deployment

Every push to `main` triggers `.github/workflows/deploy.yml` → GitHub Pages.
The news fetcher (`.github/workflows/fetch-news.yml`) runs daily at 11:00 UTC
and commits updates to `src/data/external-news.json` when new stories match.

### Custom domain

Live at **https://womenshealth.umd.edu** (migrated 2026-07; see
[docs/DOMAIN-SETUP.md](docs/DOMAIN-SETUP.md) for how it was set up).
