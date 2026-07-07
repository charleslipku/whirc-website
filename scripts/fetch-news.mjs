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

async function main() {
  const config = parseYaml(await readFile(CONFIG_PATH, 'utf8'));
  const include = config.include ?? [];
  const exclude = config.exclude ?? [];
  const maxItems = config.max_items ?? 100;
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
      const items = await fetchSource(source);
      const matched = items.filter((n) =>
        matchesKeywords(`${n.title} ${n.excerpt}`, include, exclude)
      );
      console.log(`[${source.id}] ${items.length} 条，命中 ${matched.length} 条`);
      collected.push(...matched);
    } catch (err) {
      // 单源故障不中断整体抓取
      console.error(`[${source.id}] 抓取失败：${err.message}`);
    }
  }

  // 按 link 去重合并（保留已有条目，新条目追加）
  const byLink = new Map(existing.map((n) => [n.link, n]));
  let added = 0;
  for (const item of collected) {
    if (!byLink.has(item.link)) {
      byLink.set(item.link, item);
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
