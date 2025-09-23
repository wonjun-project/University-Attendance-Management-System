import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      error: '이 엔드포인트는 더 이상 사용되지 않습니다. 새로운 출석 흐름은 /api/attendance/checkin 을 이용하세요.'
    },
    { status: 410 }
  )
}
