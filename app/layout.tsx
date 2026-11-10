export const metadata = {
  title: 'Amy 2.0 — AI-маркетинг для бизнеса',
  description: 'Amy 2.0 помогает находить аудиторию, создавать контент, автоматизировать коммуникацию и измерять результат маркетинга.',
  metadataBase: new URL('https://amy-threads-bot.vercel.app'),
  openGraph: {
    title: 'Amy 2.0 — маркетинг, который работает',
    description: 'AI-система для поиска аудитории, контента, коммуникации и аналитики.',
    type: 'website',
    locale: 'ru_RU',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
