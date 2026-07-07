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
    registration: z.string().url().optional(),
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
