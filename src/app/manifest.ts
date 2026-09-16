import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Khaali — IILM University Classroom Vacancy',
    short_name: 'Khaali',
    description: 'Find vacant classrooms instantly at IILM University School of Computer Science & Engineering',
    start_url: '/',
    display: 'standalone',
    background_color: '#0E1014',
    theme_color: '#0E1014',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}
