import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const news = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/news' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    image: z.string().optional(),
    tags: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    excerpt: z.string().optional(),
  }),
});

const people = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/people' }),
  schema: z.object({
    name: z.string(),
    role: z.string(),
    title: z.string(),
    school: z.string().optional(),
    photo: z.string().optional(),
    website: z.string().url().optional(),
    email: z.string().email().optional(),
    group: z.enum(['leadership', 'faculty', 'students']).default('faculty'),
    order: z.number().default(99),
  }),
});

const events = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/events' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    endDate: z.coerce.date().optional(),
    location: z.string().optional(),
    image: z.string().optional(),
    /** 主报名链接（Zoom 注册页等），按钮文字由 registrationLabel 决定 */
    registration: z.string().url().optional(),
    registrationLabel: z.string().default('Register'),
    /** 额外按钮，例如混合场次的线下 RSVP：- { label: "RSVP (In Person)", url: "https://..." } */
    extraLinks: z.array(z.object({ label: z.string(), url: z.string().url() })).default([]),
    /** 全天活动（只写日期）为 true；写了具体时间请设为 false，并把 date 写成 2027-02-09T12:00:00-05:00 */
    allDay: z.boolean().default(true),
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
  }),
});

export const collections = { news, people, events, pages };
