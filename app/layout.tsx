import './globals.css'
import type { Metadata } from 'next'
import { Inter, Noto_Sans_KR } from 'next/font/google'
import { AuthProvider } from '@/lib/auth-context'
import { WebVitalsReporter } from '@/components/web-vitals-reporter'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

const notoSansKR = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-noto-sans-kr',
})

export const metadata: Metadata = {
  title: '출석 관리 시스템',
  description: '대학 강의 출석 관리 시스템',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" className="h-full">
      <body className={`${notoSansKR.className} ${inter.variable} ${notoSansKR.variable} h-full bg-gray-50`}>
        <WebVitalsReporter />
        <AuthProvider>
          <div className="min-h-full">
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  )
}