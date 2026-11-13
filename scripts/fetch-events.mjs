#!/usr/bin/env node
/**
 * fetch-events.mjs — 从 Google Calendar（或任何公开 iCal 地址）同步活动，
 * 写入 src/data/calendar-events.json（Events 页与 src/content/events/ 的手写活动合并显示）。
 *
 * 配置：src/content/config/site.yaml → calendar.ical（留空则跳过，并清空数据文件）
 * 运行：npm run fetch-events（GitHub Actions 每日定时执行）
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_PATH = path.join(root, 'src/content/config/site.yaml');
const OUTPUT_PATH = path.join(root, 'src/data/calendar-events.json');
const DEFAULT_TZ = 'America/New_York';
const KEEP_PAST_DAYS = 400; // 往期活动保留约一年

/** iCal 文本：先把折行（CRLF + 空格/Tab）展开 */
function unfold(ics) {
  return ics.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
}

/** 解析一行 "NAME;PARAM=x;PARAM2=y:value" */
function parseLine(line) {
  const i = line.indexOf(':');
  if (i < 0) return null;
  const [name, ...paramParts] = line.slice(0, i).split(';');
  const params = Object.fromEntries(
    paramParts.map((p) => {
      const j = p.indexOf('=');
      return [p.slice(0, j).toUpperCase(), p.slice(j + 1).replace(/^"|"$/g, '')];
    })
  );
  return { name: name.toUpperCase(), params, value: line.slice(i + 1) };
}

function unescapeText(v = '') {
  return v
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\;/g, ';')
    .replace(/\\\\/g, '\\')
    .replace(/<[^>]+>/g, ' ') // Google 有时塞 HTML
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 某时区的本地钟面时间 → UTC Date（不依赖第三方库） */
function zonedToUtc(y, mo, d, h, mi, s, tz) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const want = Date.UTC(y, mo - 1, d, h, mi, s);
  let guess = want;
  for (let k = 0; k < 2; k += 1) {
    const p = Object.fromEntries(fmt.formatToParts(new Date(guess)).map((x) => [x.type, x.value]));
    const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    guess += want - asUtc;
  }
  return new Date(guess);
}

/** DTSTART/DTEND → { iso, allDay } */
function parseDate(prop) {
  if (!prop) return null;
  const v = prop.value.trim();
  if (prop.params.VALUE === 'DATE' || /^\d{8}$/.test(v)) {
    return { iso: `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`, allDay: true };
  }
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s = '00', z] = m;
  const date = z
    ? new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s))
    : zonedToUtc(+y, +mo, +d, +h, +mi, +s, prop.params.TZID || DEFAULT_TZ);
  return { iso: date.toISOString(), allDay: false };
}

function parseIcs(ics) {
  const events = [];
  const blocks = unfold(ics).split('BEGIN:VEVENT').slice(1);
  for (const block of blocks) {
    const body = block.slice(0, block.indexOf('END:VEVENT'));
    const props = {};
    for (const line of body.split('\n')) {
      const p = parseLine(line);
      if (p) props[p.name] = p;
    }
    if (props.STATUS?.value?.toUpperCase() === 'CANCELLED') continue;
    const start = parseDate(props.DTSTART);
    if (!start || !props.SUMMARY) continue;
    const end = parseDate(props.DTEND);
    const ev = {
      id: `cal-${(props.UID?.value || props.SUMMARY.value).replace(/[^A-Za-z0-9]+/g, '-').slice(0, 60)}`,
      title: unescapeText(props.SUMMARY.value),
      date: start.iso,
      allDay: start.allDay,
      location: unescapeText(props.LOCATION?.value || '') || null,
      description: unescapeText(props.DESCRIPTION?.value || '') || null,
      url: props.URL?.value?.trim() || null,
    };
    // 全天活动的 DTEND 是「次日」（不含）；只有多天活动才记录 endDate
    if (end) {
      if (start.allDay) {
        const endD = new Date(end.iso); endD.setUTCDate(endD.getUTCDate() - 1);
        const endIso = endD.toISOString().slice(0, 10);
        if (endIso > start.iso) ev.endDate = endIso;
      } else if (end.iso !== start.iso) {
        ev.endDate = end.iso;
      }
    }
    if (props.RRULE) ev.recurring = true; // 暂不展开重复规则，只保留首场
    events.push(ev);
  }
  return events;
}

async function main() {
  const config = parseYaml(await readFile(CONFIG_PATH, 'utf8'));
  const ical = config?.calendar?.ical?.trim();
  if (!ical) {
    console.log('site.yaml 未配置 calendar.ical，跳过同步（calendar-events.json 置空）。');
    await writeFile(OUTPUT_PATH, '[]\n');
    return;
  }
  const res = await fetch(ical, {
    headers: { 'user-agent': 'WHIRC-events-bot (womenshealth.umd.edu; academic site)' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${ical}`);
  const ics = await res.text();
  if (!/BEGIN:VCALENDAR/i.test(ics)) throw new Error('返回内容不是 iCal（检查地址是否为「公开地址（iCal 格式）」）');

  const cutoff = new Date(Date.now() - KEEP_PAST_DAYS * 86400_000).toISOString();
  const events = parseIcs(ics)
    .filter((e) => (e.endDate ?? e.date) >= cutoff)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  await writeFile(OUTPUT_PATH, `${JSON.stringify(events, null, 2)}\n`);
  const upcoming = events.filter((e) => (e.endDate ?? e.date) >= new Date().toISOString()).length;
  console.log(`同步 ${events.length} 条活动（即将举行 ${upcoming} 条）→ ${path.relative(root, OUTPUT_PATH)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
