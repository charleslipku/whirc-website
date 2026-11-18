/** 合并手写活动（src/content/events/）与日历同步活动（src/data/calendar-events.json） */
import { getCollection, render } from 'astro:content';
import calendarEvents from './data/calendar-events.json';

export interface EventLink {
  label: string;
  url: string;
}

export interface SiteEvent {
  id: string;
  title: string;
  date: Date;
  endDate?: Date;
  allDay: boolean;
  location?: string;
  /** 主外部链接：报名页或日历条目里的 URL（写进 .ics 的 URL 字段） */
  link?: string;
  /** 页面上的按钮：报名 / 线下 RSVP / 详情 */
  links: EventLink[];
  /** 纯文本描述（日历活动） */
  description?: string;
  /** Markdown 正文组件（手写活动） */
  Content?: Awaited<ReturnType<typeof render>>['Content'];
  source: 'site' | 'calendar';
}

const tokens = (title: string) =>
  new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter((w) => w.length > 2 && !STOP.has(w))
  );
const STOP = new Set(['the', 'and', 'for', 'with', 'among', 'series', 'seminar', 'spring', 'whirc', 'women', 'health']);
const day = (d: Date) => d.toISOString().slice(0, 10);

/** 同一天、标题明显相似 → 视为同一活动（手写版本优先，避免 Google 日历里的同名条目重复显示） */
function sameEvent(a: { title: string; date: Date }, b: { title: string; date: Date }) {
  if (day(a.date) !== day(b.date)) return false;
  const ta = tokens(a.title);
  const tb = tokens(b.title);
  if (ta.size === 0 || tb.size === 0) return a.title.toLowerCase() === b.title.toLowerCase();
  let shared = 0;
  for (const w of ta) if (tb.has(w)) shared += 1;
  return shared / Math.min(ta.size, tb.size) >= 0.5;
}

export async function getAllEvents(): Promise<SiteEvent[]> {
  const site: SiteEvent[] = await Promise.all(
    (await getCollection('events')).map(async (e) => ({
      id: e.id,
      title: e.data.title,
      date: e.data.date,
      endDate: e.data.endDate,
      allDay: e.data.allDay,
      location: e.data.location,
      link: e.data.registration,
      links: [
        ...(e.data.registration ? [{ label: e.data.registrationLabel, url: e.data.registration }] : []),
        ...e.data.extraLinks,
      ],
      Content: e.body?.trim() ? (await render(e)).Content : undefined,
      source: 'site' as const,
    }))
  );
  const cal: SiteEvent[] = (calendarEvents as any[])
    .map((e) => ({
      id: e.id,
      title: e.title,
      date: new Date(e.date),
      endDate: e.endDate ? new Date(e.endDate) : undefined,
      allDay: !!e.allDay,
      location: e.location ?? undefined,
      link: e.url ?? undefined,
      links: e.url ? [{ label: 'Details', url: e.url }] : [],
      description: e.description ?? undefined,
      source: 'calendar' as const,
    }))
    .filter((c) => !site.some((s) => sameEvent(s, c)));
  return [...site, ...cal].sort((a, b) => +a.date - +b.date);
}

export const isUpcoming = (e: SiteEvent, now = new Date()) => {
  const end = e.endDate ?? e.date;
  // 全天活动：当天结束前都算即将举行
  return e.allDay ? day(end) >= day(now) : end >= now;
};

export function formatEventDate(e: SiteEvent): string {
  const tz = e.allDay ? 'UTC' : 'America/New_York';
  const day = e.date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: tz });
  if (e.allDay) {
    if (e.endDate) {
      const endDay = e.endDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: tz });
      return `${day} – ${endDay}`;
    }
    return day;
  }
  const t = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz });
  return e.endDate ? `${day} · ${t(e.date)} – ${t(e.endDate)} ET` : `${day} · ${t(e.date)} ET`;
}

/** 活动默认时长（未写 endDate 的定时活动） */
const DEFAULT_DURATION_MS = 3600_000;

/** 活动的结束时间：全天活动返回「次日」（iCal / Google 的 exclusive end） */
export function eventEnd(e: SiteEvent): Date {
  if (e.allDay) {
    const end = new Date(e.endDate ?? e.date);
    end.setUTCDate(end.getUTCDate() + 1);
    return end;
  }
  return e.endDate ?? new Date(+e.date + DEFAULT_DURATION_MS);
}

/** "Add to Google Calendar" 链接（无需下载文件，直接在 Google Calendar 中预填活动） */
export function googleCalendarUrl(e: SiteEvent, pageUrl: string): string {
  const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const dates = e.allDay ? `${ymd(e.date)}/${ymd(eventEnd(e))}` : `${stamp(e.date)}/${stamp(eventEnd(e))}`;
  const details = [e.description, e.link, pageUrl].filter(Boolean).join('\n\n');
  const q = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates, details, ctz: 'America/New_York' });
  if (e.location) q.set('location', e.location);
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}
