import type { APIRoute, GetStaticPaths } from 'astro';
import { getAllEvents, type SiteEvent } from '../../events';

/** 每个活动一个 .ics 文件（"Add to Calendar" 按钮），Apple / Google / Outlook 通用 */
export const getStaticPaths: GetStaticPaths = async () =>
  (await getAllEvents()).map((e) => ({ params: { id: e.id }, props: { event: e } }));

const esc = (s = '') => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');

export const GET: APIRoute = ({ props, site }) => {
  const e = props.event as SiteEvent;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//WHIRC//womenshealth.umd.edu//EN', 'BEGIN:VEVENT'];
  lines.push(`UID:${e.id}@womenshealth.umd.edu`, `DTSTAMP:${stamp(new Date())}`);
  if (e.allDay) {
    const end = new Date(e.endDate ?? e.date); end.setUTCDate(end.getUTCDate() + 1);
    lines.push(`DTSTART;VALUE=DATE:${ymd(e.date)}`, `DTEND;VALUE=DATE:${ymd(end)}`);
  } else {
    lines.push(`DTSTART:${stamp(e.date)}`, `DTEND:${stamp(e.endDate ?? new Date(+e.date + 3600_000))}`);
  }
  lines.push(`SUMMARY:${esc(e.title)}`);
  if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
  const pageUrl = new URL('/events/', site).href;
  lines.push(`URL:${e.link ?? pageUrl}`, `DESCRIPTION:${esc((e.description ? e.description + '\n\n' : '') + pageUrl)}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return new Response(lines.join('\r\n') + '\r\n', {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8' },
  });
};
