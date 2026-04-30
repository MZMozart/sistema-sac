import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/auth/login',
    name: 'AtendePro',
    short_name: 'AtendePro',
    description: 'Plataforma premium de atendimento multiempresa com chat, voz, BOT e analytics.',
    start_url: '/auth/login',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui', 'browser'],
    orientation: 'portrait',
    background_color: '#050b17',
    theme_color: '#1d4ed8',
    icons: [
      {
        src: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
      {
        src: '/icon-light-32x32.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/icon-dark-32x32.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    categories: ['business', 'productivity', 'communication'],
    shortcuts: [
      {
        name: 'Abrir chats',
        short_name: 'Chats',
        url: '/dashboard/chats',
      },
      {
        name: 'Abrir ligações',
        short_name: 'Ligações',
        url: '/dashboard/calls',
      },
    ],
  }
}