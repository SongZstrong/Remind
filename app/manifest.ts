import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Remind',
    short_name: 'Remind',
    description:
      'Local-first encrypted Markdown notes for reflection and repentance.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#2b2b2b',
    theme_color: '#2b2b2b',
    categories: ['productivity', 'utilities'],
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  };
}
