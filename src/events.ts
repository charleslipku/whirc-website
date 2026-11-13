/** 合并手写活动（src/content/events/）与日历同步活动（src/data/calendar-events.json） */
import { getCollection, render } from 'astro:content';
import calendarEvents from './data/calendar-events.json';

export interface SiteEvent {
  id: string;
  title: string;
  date: Date;
  endDate?: Date;
  allDay: boolean;
  location?: string;
  /** 外部链接：报名页或日历条目里的 URL */
  link?: string;
  /** 纯文本描述（日历活动） */
  description?: string;
  /** Markdown 正文组件（手写活动） */
  Content?: Awaited<ReturnType<typeof render>>['Content'];
  source: 'site' | 'calendar';
}

const key = (title: string, date: Date) =>
  `${title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}|${date.toISOString().slice(0, 10)}`;

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
      Content: e.body?.trim() ? (await render(e)).Content : undefined,
      source: 'site' as const,
    }))
  );
  const seen = new Set(site.map((e) => key(e.title, e.date)));
  const cal: SiteEvent[] = (calendarEvents as any[])
    .map((e) => ({
      id: e.id,
      title: e.title,
      date: new Date(e.date),
      endDate: e.endDate ? new Date(e.endDate) : undefined,
      allDay: !!e.allDay,
      location: e.location ?? undefined,
      link: e.url ?? undefined,
      description: e.description ?? undefined,
      source: 'calendar' as const,
    }))
    .filter((e) => !seen.has(key(e.title, e.date))); // 同名同日：手写版本优先
  return [...site, ...cal].sort((a, b) => +a.date - +b.date);
}

export const isUpcoming = (e: SiteEvent, now = new Date()) => {
  const end = e.endDate ?? e.date;
  // 全天活动：当天结束前都算即将举行
  return e.allDay ? end.toISOString().slice(0, 10) >= now.toISOString().slice(0, 10) : end >= now;
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
