import Link from 'next/link'
import { Button, Badge } from '@/components/ui'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold text-gray-900">
                출석 관리 시스템
              </h1>
              <Badge variant="primary">MVP</Badge>
            </div>
            <div className="flex items-center space-x-3">
              <Link href="/auth/signup">
                <Button variant="secondary" size="sm">
                  회원가입
                </Button>
              </Link>
              <Link href="/auth/login">
                <Button variant="primary" size="sm">
                  로그인
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            간편한 출석 관리
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            QR코드와 GPS 위치 인증을 활용하여 대리 출석을 방지하고 
            실시간으로 출석을 관리하는 시스템입니다
          </p>
        </div>


        {/* Features */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-soft p-6">
          <h3 className="text-xl font-bold text-gray-900 text-center mb-6">
            주요 기능
          </h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="p-2 bg-primary-100 rounded-full w-12 h-12 mx-auto mb-3 flex items-center justify-center">
                <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </div>
              <h4 className="font-semibold text-gray-900 mb-2 text-sm">QR코드 인증</h4>
              <p className="text-xs text-gray-600">수업 시작 30분 전부터 QR코드가 생성되며 시간 제한이 적용됩니다</p>
            </div>
            
            <div className="text-center">
              <div className="p-2 bg-success-100 rounded-full w-12 h-12 mx-auto mb-3 flex items-center justify-center">
                <svg className="w-6 h-6 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h4 className="font-semibold text-gray-900 mb-2 text-sm">위치 기반 인증</h4>
              <p className="text-xs text-gray-600">강의실 위치 기반으로 출석을 인증하여 대리 출석을 방지합니다</p>
            </div>
            
            <div className="text-center">
              <div className="p-2 bg-warning-100 rounded-full w-12 h-12 mx-auto mb-3 flex items-center justify-center">
                <svg className="w-6 h-6 text-warning-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h4 className="font-semibold text-gray-900 mb-2 text-sm">지속적 모니터링</h4>
              <p className="text-xs text-gray-600">수업 시간 동안 지속적으로 위치를 추적하여 중간 이탈을 감지합니다</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}