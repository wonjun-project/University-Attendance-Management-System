import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

interface User {
  id: string
  name: string
  type: 'student' | 'professor'
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    checkSession()
  }, [])

  const checkSession = async () => {
    try {
      const response = await fetch('/api/auth/session', {
        credentials: 'include'
      })

      if (!response.ok) {
        // 세션이 없거나 만료된 경우 로그인 페이지로 리다이렉트
        router.replace('/login')
        return
      }

      const data = await response.json()
      setUser(data.user)
    } catch (err) {
      console.error('세션 체크 오류:', err)
      router.replace('/login')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      })

      if (response.ok) {
        console.log('로그아웃 성공')
        setUser(null)
        router.replace('/login')
      } else {
        throw new Error('로그아웃 실패')
      }
    } catch (err) {
      console.error('로그아웃 오류:', err)
      setError('로그아웃 중 오류가 발생했습니다')
    }
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f5f5'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>로딩 중...</div>
        </div>
      </div>
    )
  }

  if (!user) {
    return null // 리다이렉트 중
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f5f5f5'
    }}>
      {/* 헤더 */}
      <header style={{
        backgroundColor: 'white',
        padding: '1rem 2rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{ margin: 0, color: '#333' }}>대학 출석 관리 시스템</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: '#666' }}>
            {user.name} ({user.type === 'student' ? '학생' : '교수'})
          </span>
          <button
            onClick={handleLogout}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main style={{
        padding: '2rem',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '2rem',
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          marginBottom: '2rem'
        }}>
          <h2 style={{ marginTop: 0, color: '#333' }}>
            환영합니다, {user.name}님!
          </h2>
          <p style={{ color: '#666', marginBottom: '2rem' }}>
            {user.type === 'student'
              ? '학생 출석 관리 시스템에 접속하셨습니다.'
              : '교수 출석 관리 시스템에 접속하셨습니다.'
            }
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1rem'
          }}>
            {user.type === 'student' ? (
              <>
                <div style={{
                  padding: '1.5rem',
                  backgroundColor: '#e3f2fd',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <h3 style={{ margin: '0 0 0.5rem 0', color: '#1976d2' }}>내 출석 현황</h3>
                  <p style={{ margin: 0, color: '#666' }}>출석률 및 현황을 확인하세요</p>
                </div>
                <div style={{
                  padding: '1.5rem',
                  backgroundColor: '#f3e5f5',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <h3 style={{ margin: '0 0 0.5rem 0', color: '#7b1fa2' }}>수강 과목</h3>
                  <p style={{ margin: 0, color: '#666' }}>등록된 수강 과목을 확인하세요</p>
                </div>
              </>
            ) : (
              <>
                <div style={{
                  padding: '1.5rem',
                  backgroundColor: '#e8f5e8',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <h3 style={{ margin: '0 0 0.5rem 0', color: '#388e3c' }}>출석 체크</h3>
                  <p style={{ margin: 0, color: '#666' }}>학생들의 출석을 체크하세요</p>
                </div>
                <div style={{
                  padding: '1.5rem',
                  backgroundColor: '#fff3e0',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <h3 style={{ margin: '0 0 0.5rem 0', color: '#f57c00' }}>강의 관리</h3>
                  <p style={{ margin: 0, color: '#666' }}>강의 일정 및 출석률을 관리하세요</p>
                </div>
              </>
            )}
          </div>
        </div>

        {error && (
          <div style={{
            backgroundColor: '#fee',
            color: '#c33',
            padding: '1rem',
            borderRadius: '4px',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        {/* 시스템 정보 */}
        <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <h3 style={{ marginTop: 0, color: '#333' }}>시스템 정보</h3>
          <p style={{ color: '#666', margin: '0.5rem 0' }}>
            사용자 ID: {user.id}
          </p>
          <p style={{ color: '#666', margin: '0.5rem 0' }}>
            사용자 유형: {user.type === 'student' ? '학생' : '교수'}
          </p>
          <p style={{ color: '#666', margin: '0.5rem 0' }}>
            로그인 시간: {new Date().toLocaleString('ko-KR')}
          </p>
        </div>
      </main>
    </div>
  )
}