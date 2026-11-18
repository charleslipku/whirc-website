import type { APIRoute, GetStaticPaths } from 'astro';
import { getAllEvents, eventEnd, type SiteEvent } from '../../events';

/** 每个活动一个 .ics 文件（"Apple / Outlook" 按钮）；Google 用户走 googleCalendarUrl() */
export const getStaticPaths: GetStaticPaths = async () =>
  (await getAllEvents()).map((e) => ({ params: { id: e.id }, props: { event: e } }));

const esc = (s = '') => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');

export const GET: APIRoute = ({ props, site }) => {
  const e = props.event as SiteEvent;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//WHIRC//womenshealth.umd.edu//EN', 'BEGIN:VEVENT'];
  lines.push(`UID:${e.id}@womenshealth.umd.edu`, `DTSTAMP:${stamp(new Date())}`);
  if (e.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${ymd(e.date)}`, `DTEND;VALUE=DATE:${ymd(eventEnd(e))}`);
  } else {
    lines.push(`DTSTART:${stamp(e.date)}`, `DTEND:${stamp(eventEnd(e))}`);
  }
  lines.push(`SUMMARY:${esc(e.title)}`);
  if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
  const pageUrl = new URL(`/events/#${e.id}`, site).href;
  lines.push(`URL:${e.link ?? pageUrl}`, `DESCRIPTION:${esc((e.description ? e.description + '\n\n' : '') + pageUrl)}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return new Response(lines.join('\r\n') + '\r\n', {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8' },
  });
};
