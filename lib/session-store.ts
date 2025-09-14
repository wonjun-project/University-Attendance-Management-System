// 세션 저장소 - Vercel KV 대신 임시로 전역 Map 사용하되 더 안정적으로 구현
interface SessionData {
  id: string
  courseId: string
  courseName: string
  courseCode: string
  location: {
    lat: number
    lng: number
    address: string
    radius: number
  }
  qrCode: string
  expiresAt: string
  isActive: boolean
  createdAt: string
}

// 전역 세션 저장소 - 여러 API가 공유
class SessionStore {
  private static instance: SessionStore
  private sessions: Map<string, SessionData>

  private constructor() {
    this.sessions = new Map()
  }

  public static getInstance(): SessionStore {
    if (!SessionStore.instance) {
      SessionStore.instance = new SessionStore()
    }
    return SessionStore.instance
  }

  public set(sessionId: string, session: SessionData): void {
    this.sessions.set(sessionId, session)
    console.log(`세션 저장: ${sessionId}, 현재 총 ${this.sessions.size}개 세션`)
  }

  public get(sessionId: string): SessionData | undefined {
    const session = this.sessions.get(sessionId)
    console.log(`세션 조회: ${sessionId} → ${session ? '찾음' : '없음'}, 현재 총 ${this.sessions.size}개 세션`)
    return session
  }

  public delete(sessionId: string): boolean {
    const result = this.sessions.delete(sessionId)
    console.log(`세션 삭제: ${sessionId} → ${result ? '성공' : '실패'}, 현재 총 ${this.sessions.size}개 세션`)
    return result
  }

  public has(sessionId: string): boolean {
    return this.sessions.has(sessionId)
  }

  public getAllSessions(): SessionData[] {
    return Array.from(this.sessions.values())
  }

  public clearExpired(): number {
    const now = new Date()
    let cleared = 0
    const expiredSessions: string[] = []

    // 만료된 세션 ID 수집
    this.sessions.forEach((session, sessionId) => {
      if (new Date(session.expiresAt) < now) {
        expiredSessions.push(sessionId)
      }
    })

    // 만료된 세션 삭제
    expiredSessions.forEach(sessionId => {
      this.sessions.delete(sessionId)
      cleared++
    })

    console.log(`만료된 세션 ${cleared}개 정리됨, 현재 ${this.sessions.size}개 세션`)
    return cleared
  }
}

// 전역 세션 저장소 인스턴스
export const sessionStore = SessionStore.getInstance()
export type { SessionData }