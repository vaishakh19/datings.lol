// Generate public/sitemap.xml from the hard-coded marketing routes and the
// articles defined in src/data/articles.ts. Run at build time.
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SITE = 'https://datings.lol';

// Legal docs from src/data/legal.ts.
const legalModule = await import(resolve(ROOT, 'src/data/legal.ts'));
const legalDocs = legalModule.LEGAL_DOCS || [];

// Static marketing/legal routes. App/auth/admin/api routes are NOT included.
const staticRoutes = [
  '/',
  '/about',
  '/pricing',
  '/blog',
  ...legalDocs.map((d) => `/${d.slug}`),
];

// Load articles dynamically from data file.
const articlesModule = await import(resolve(ROOT, 'src/data/articles.ts'));
const articles = articlesModule.ARTICLES || articlesModule.articles || [];

const urls = [
  ...staticRoutes.map((path) => ({ path, changefreq: 'weekly', priority: path === '/' ? 1.0 : 0.7 })),
  ...(Array.isArray(articles)
    ? articles.map((a) => ({
        path: `/blog/${a.slug}`,
        changefreq: 'monthly',
        priority: 0.6,
        lastmod: a.date ? a.date.slice(0, 10) : undefined,
      }))
    : []),
];

const lastmod = new Date().toISOString().slice(0, 10);
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url><loc>${SITE}${u.path}</loc><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : `<lastmod>${lastmod}</lastmod>`}</url>`,
  )
  .join('\n')}
</urlset>
`;

const outDir = resolve(ROOT, 'public');
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'sitemap.xml'), xml, 'utf8');
console.log(`sitemap.xml: ${urls.length} URLs`);
