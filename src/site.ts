import { parse } from 'yaml';
import raw from './content/config/site.yaml?raw';

export interface SiteConfig {
  title: string;
  shortName: string;
  tagline: string;
  description: string;
  contact: { email: string; address: string };
  social: { linkedin?: string; instagram?: string; twitter?: string };
  links: { grandChallenges: string; accessibility: string; privacy: string };
}

export const site: SiteConfig = parse(raw);
