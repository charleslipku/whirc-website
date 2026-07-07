#!/usr/bin/env node
/**
 * fetch-news.mjs — 抓取 UMD 官方 RSS 源，按关键词过滤，
 * 合并写入 src/data/external-news.json（供 News 页 "In The News" 使用）。
 *
 * 配置文件：src/content/config/news-tags.yaml（关键词与数据源）
 * 运行方式：npm run fetch-news（GitHub Actions 每日定时执行）
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { XMLParser } from 'fast-xml-parser';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_PATH = path.join(root, 'src/content/config/news-tags.yaml');
const OUTPUT_PATH = path.join(root, 'src/data/external-news.json');

/** Strip HTML tags and decode common entities from RSS descriptions. */
function cleanText(html = '') {
  return String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#0?39;|&rsquo;|&#8217;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;|&#822[01];/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesKeywords(text, include, exclude) {
  const t = text.toLowerCase();
  const hit = include.some((k) => t.includes(k.toLowerCase()));
  if (!hit) return false;
  return !exclude.some((k) => t.includes(k.toLowerCase()));
}

/** 分词匹配：关键词的所有词都出现即命中（兼容 "Alisa Morss Clyne" 匹配 "Alisa Clyne"、
 *  "Women's Health" 匹配 "womens health"）。用于收紧 newsengine 的 OR 式全文搜索结果。 */
function normalize(s) {
  return ` ${s.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
}
function matchesAllTokens(text, include, exclude) {
  const t = normalize(text);
  const hit = include.some((k) =>
    normalize(k).trim().split(/\s+/).every((w) => t.includes(` ${w} `))
  );
  if (!hit) return false;
  return !exclude.some((k) => t.includes(normalize(k).trimEnd()));
}

async function fetchSource(source) {
  const res = await fetch(source.url, {
    headers: { 'user-agent': 'WHIRC-news-bot (whirc.umd.edu; academic site)' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();

  // processEntities: false 避免大 feed 触发实体展开上限；常见实体在 cleanText 中处理
  const parser = new XMLParser({ ignoreAttributes: false, processEntities: false });
  const doc = parser.parse(xml);
  let items = doc?.rss?.channel?.item ?? [];
  if (!Array.isArray(items)) items = [items];

  return items
    .map((item) => {
      const link = cleanText(item.link ?? item.guid?.['#text'] ?? item.guid ?? '');
      const pubDate = item.pubDate ? new Date(item.pubDate) : null;
      // media:content / enclosure 缩略图（Maryland Today 暂无，保留兼容）
      const image =
        item['media:content']?.['@_url'] ??
        item.enclosure?.['@_url'] ??
        null;
      return {
        title: cleanText(item.title),
        link,
        date: pubDate && !Number.isNaN(+pubDate) ? pubDate.toISOString().slice(0, 10) : null,
        excerpt: cleanText(item.description ?? '').slice(0, 280),
        image,
        source: source.name,
        sourceId: source.id,
      };
    })
    .filter((n) => n.title && n.link && n.date); // 无日期的条目（如静态页面）不收录
}

/**
 * Clark School "newsengine" 源（ECE / BIOE 等系）：
 * 无新闻 RSS，但提供全文搜索 API（JSON）。对每个 include 关键词
 * 各查询一次，由引擎在全文范围内匹配（覆盖整个新闻库，优于 RSS 的最新 10 条）。
 */
async function fetchNewsengine(source, include) {
  const results = [];
  for (const keyword of include) {
    const api = `${source.url}/search.xml.dev.jsp?searchText=${encodeURIComponent(keyword)}&useJSON=Y`;
    const res = await fetch(api, {
      headers: { 'user-agent': 'WHIRC-news-bot (whirc.umd.edu; academic site)' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = JSON.parse(await res.text());
    for (const r of data.results ?? []) {
      const date = new Date(r.submitdate);
      if (!r.headline || !r.semanticurl || Number.isNaN(+date)) continue;
      results.push({
        title: cleanText(r.headline),
        link: `${source.article_base}${r.semanticurl}`,
        date: date.toISOString().slice(0, 10),
        excerpt: cleanText(r.blurb ?? '').slice(0, 280),
        image: r.largeimage && r.largeimage !== 'none' ? r.largeimage : null,
        source: source.name,
        sourceId: source.id,
      });
    }
  }
  return results;
}

async function main() {
  const config = parseYaml(await readFile(CONFIG_PATH, 'utf8'));
  const include = config.include ?? [];
  const exclude = config.exclude ?? [];
  const maxItems = config.max_items ?? 100;
  const minDate = config.min_date ?? null;
  const sources = (config.sources ?? []).filter((s) => s.enabled !== false);

  if (include.length === 0) {
    console.error('news-tags.yaml 中 include 关键词为空，跳过抓取。');
    return;
  }

  let existing = [];
  try {
    existing = JSON.parse(await readFile(OUTPUT_PATH, 'utf8'));
  } catch {
    /* 首次运行，文件不存在或为空 */
  }

  const collected = [];
  for (const source of sources) {
    try {
      let matched;
      if (source.type === 'newsengine') {
        // 引擎的全文搜索是 OR 式的（结果过泛），需再用分词匹配收紧：
        // 关键词的所有词都出现在标题/摘要中才收录
        const items = await fetchNewsengine(source, include);
        matched = items.filter((n) =>
          matchesAllTokens(`${n.title} ${n.excerpt}`, include, exclude)
        );
        console.log(`[${source.id}] 引擎返回 ${items.length} 条，精确匹配 ${matched.length} 条`);
      } else {
        const items = await fetchSource(source);
        matched = items.filter((n) =>
          matchesKeywords(`${n.title} ${n.excerpt}`, include, exclude)
        );
        console.log(`[${source.id}] ${items.length} 条，命中 ${matched.length} 条`);
      }
      if (minDate) {
        const before = matched.length;
        matched = matched.filter((n) => n.date >= minDate);
        if (before > matched.length)
          console.log(`[${source.id}] 早于 ${minDate} 的 ${before - matched.length} 条已过滤`);
      }
      collected.push(...matched);
    } catch (err) {
      // 单源故障不中断整体抓取
      console.error(`[${source.id}] 抓取失败：${err.message}`);
    }
  }

  // 去重合并：先按 link，再按「标题+日期」（同一篇 Clark School 新闻
  // 会以不同链接同时出现在 ECE/BIOE/工学院站点上）
  const byLink = new Map(existing.map((n) => [n.link, n]));
  const seenTitle = new Set(existing.map((n) => `${normalize(n.title).trim()}|${n.date}`));
  let added = 0;
  for (const item of collected) {
    const titleKey = `${normalize(item.title).trim()}|${item.date}`;
    if (!byLink.has(item.link) && !seenTitle.has(titleKey)) {
      byLink.set(item.link, item);
      seenTitle.add(titleKey);
      added += 1;
    }
  }

  const merged = [...byLink.values()]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, maxItems);

  await writeFile(OUTPUT_PATH, `${JSON.stringify(merged, null, 2)}\n`);
  console.log(`新增 ${added} 条，归档共 ${merged.length} 条 → ${path.relative(root, OUTPUT_PATH)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
