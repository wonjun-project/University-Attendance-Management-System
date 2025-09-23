'use client'

import dynamic from 'next/dynamic'

// SSR을 비활성화하고 클라이언트에서만 렌더링
const QRCodePage = dynamic(
  () => import('./QRCodePageContent'),
  {
    ssr: false,
    loading: () => <div className="min-h-screen bg-gray-50" />
  }
)

export default QRCodePage