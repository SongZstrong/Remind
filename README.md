# Remind

Remind is a local-first, encrypted Markdown notes app for reflection and repentance. Your data stays on your device.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## SEO

SEO baseline files are included:

- `app/robots.ts` -> `/robots.txt`
- `app/sitemap.ts` -> `/sitemap.xml`
- `app/manifest.ts` -> `/manifest.webmanifest`
- `app/opengraph-image.tsx` -> `/opengraph-image`
- `app/twitter-image.tsx` -> `/twitter-image`

Set this environment variable in production:

```bash
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

See [docs/SEO.md](docs/SEO.md) for details and deployment checklist.
