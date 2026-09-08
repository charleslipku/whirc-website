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

/**
 * Maryland Today 专题页（如 /topic/womens-health）：无专用 RSS，
 * 解析页面中的 <umd-element-article> 条目。专题由编辑人工策划，
 * 条目天然相关，不再做 include 关键词过滤（仍应用 exclude 与 min_date）。
 */
async function fetchUmdTopic(source) {
  const res = await fetch(source.url, {
    headers: { 'user-agent': 'WHIRC-news-bot (whirc.umd.edu; academic site)' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  const results = [];
  for (const block of html.split(/<umd-element-article\b/).slice(1)) {
    const chunk = block.slice(0, block.indexOf('</umd-element-article>'));
    const headline = chunk.match(
      /slot="headline">\s*<a\s+href="([^"]+)"[^>]*>\s*<span[^>]*>([^<]+)<\/span>/s
    );
    const dateM = chunk.match(/slot="date">\s*([^<]+?)\s*</s);
    if (!headline || !dateM) continue;
    const date = new Date(dateM[1]);
    if (Number.isNaN(+date)) continue;
    const text = chunk.match(/slot="text">\s*([^<]+?)\s*</s);
    const img = chunk.match(/<img\s+src="([^"]+)"/);
    results.push({
      title: cleanText(headline[2]),
      link: headline[1],
      date: date.toISOString().slice(0, 10),
      excerpt: cleanText(text?.[1] ?? '').slice(0, 280),
      image: img ? img[1].replace(/&amp;/g, '&') : null,
      source: source.name,
      sourceId: source.id,
    });
  }
  return results;
}

/**
 * UMD Terp（Drupal）新闻列表页（如 sph.umd.edu/news）：无新闻 RSS
 * （站点 rss.xml 只含活动通知），解析 <umd-element-card> 卡片并翻页。
 * 结果按 include / exclude 关键词过滤。
 */
async function fetchUmdTerpNews(source, include, exclude) {
  const origin = new URL(source.url).origin;
  const pages = source.pages ?? 3;
  const results = [];
  for (let page = 0; page < pages; page += 1) {
    const sep = source.url.includes('?') ? '&' : '?';
    const res = await fetch(`${source.url}${sep}page=${page}`, {
      headers: { 'user-agent': 'WHIRC-news-bot (whirc.umd.edu; academic site)' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    let found = 0;
    for (const block of html.split(/<umd-element-card\b/).slice(1)) {
      const chunk = block.slice(0, block.indexOf('</umd-element-card>'));
      const headline = chunk.match(/slot="headline"[^>]*>\s*([^<]+?)\s*</s);
      const link = chunk.match(/<a\s+slot="image"\s+href="([^"]+)"/) ?? chunk.match(/<a\s+href="([^"]+)"/);
      const dateM = chunk.match(/<time\s+datetime="([^"]+)"/);
      if (!headline || !link || !dateM) continue;
      const date = new Date(dateM[1]);
      if (Number.isNaN(+date)) continue;
      const text = chunk.match(/slot="text">\s*([\s\S]*?)\s*<\/div>/);
      const img = chunk.match(/<img\s+src="([^"]+)"/);
      found += 1;
      results.push({
        title: cleanText(headline[1]),
        link: new URL(link[1], origin).href,
        date: date.toISOString().slice(0, 10),
        excerpt: cleanText(text?.[1] ?? '').slice(0, 280),
        image: img ? new URL(img[1].replace(/&amp;/g, '&'), origin).href : null,
        source: source.name,
        sourceId: source.id,
      });
    }
    if (found === 0) break; // 翻到底了
  }
  return results.filter((n) => matchesKeywords(`${n.title} ${n.excerpt}`, include, exclude));
}

/**
 * College of Education 新闻列表页（Drupal teaser 结构）：同样无新闻 RSS。
 * 解析 .node__teaser__title / .node__date / 正文摘要并翻页。
 */
async function fetchDrupalTeaserNews(source, include, exclude) {
  const origin = new URL(source.url).origin;
  const pages = source.pages ?? 3;
  const results = [];
  for (let page = 0; page < pages; page += 1) {
    const sep = source.url.includes('?') ? '&' : '?';
    const res = await fetch(`${source.url}${sep}page=${page}`, {
      headers: { 'user-agent': 'WHIRC-news-bot (whirc.umd.edu; academic site)' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    let found = 0;
    for (const block of html.split(/class="node__teaser__title/).slice(1)) {
      const chunk = block.slice(0, 3000);
      const link = chunk.match(/<a\s+href="([^"]+)"[^>]*>\s*([^<]+?)\s*<\/a>/);
      const dateM = chunk.match(/class="node__date">\s*([^<]+?)\s*</);
      if (!link || !dateM) continue;
      const date = new Date(dateM[1]);
      if (Number.isNaN(+date)) continue;
      const body = chunk.match(/field--name-body[^>]*>\s*([\s\S]*?)\s*<\/div>/);
      found += 1;
      results.push({
        title: cleanText(link[2]),
        link: new URL(link[1], origin).href,
        date: date.toISOString().slice(0, 10),
        excerpt: cleanText(body?.[1] ?? '').slice(0, 280),
        image: null,
        source: source.name,
        sourceId: source.id,
      });
    }
    if (found === 0) break;
  }
  return results.filter((n) => matchesKeywords(`${n.title} ${n.excerpt}`, include, exclude));
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
      if (source.type === 'umd-topic') {
        // 编辑策划的专题页：条目天然相关，只过 exclude
        const items = await fetchUmdTopic(source);
        matched = items.filter(
          (n) => !exclude.some((k) => `${n.title} ${n.excerpt}`.toLowerCase().includes(k.toLowerCase()))
        );
        console.log(`[${source.id}] 专题页解析 ${items.length} 条，收录 ${matched.length} 条`);
      } else if (source.type === 'umd-terp-news') {
        matched = await fetchUmdTerpNews(source, include, exclude);
        console.log(`[${source.id}] 新闻列表页命中 ${matched.length} 条`);
      } else if (source.type === 'drupal-teaser-news') {
        matched = await fetchDrupalTeaserNews(source, include, exclude);
        console.log(`[${source.id}] 新闻列表页命中 ${matched.length} 条`);
      } else if (source.type === 'newsengine') {
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

  // 同一篇报道常被 Maryland Today 与院系站点在相邻日期各发一次（标题相同、日期差一天），
  // 归档内再按标题去重一次，保留较新的一条
  const seenMergedTitle = new Set();
  const merged = [...byLink.values()]
    // 日期相同再按链接排，保证每日运行结果稳定（否则会产生只有顺序变化的空提交）
    .sort((a, b) => (a.date === b.date ? a.link.localeCompare(b.link) : a.date < b.date ? 1 : -1))
    .filter((n) => {
      const key = normalize(n.title).trim();
      if (seenMergedTitle.has(key)) return false;
      seenMergedTitle.add(key);
      return true;
    })
    .slice(0, maxItems);

  await writeFile(OUTPUT_PATH, `${JSON.stringify(merged, null, 2)}\n`);
  console.log(`新增 ${added} 条，归档共 ${merged.length} 条 → ${path.relative(root, OUTPUT_PATH)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
