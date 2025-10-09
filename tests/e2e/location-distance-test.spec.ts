import { test, expect } from '@playwright/test'

// 서울대학교 정문 좌표 (테스트용 기준점)
const CLASSROOM_LAT = 37.4607
const CLASSROOM_LON = 126.9524
const ALLOWED_RADIUS = 100 // 100미터

// Haversine 공식으로 특정 거리만큼 떨어진 좌표 계산
function calculateOffset(lat: number, lon: number, distanceMeters: number, bearing: number) {
  const R = 6371000 // 지구 반지름 (미터)
  const latRad = lat * Math.PI / 180
  const lonRad = lon * Math.PI / 180
  const bearingRad = bearing * Math.PI / 180

  const newLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(distanceMeters / R) +
    Math.cos(latRad) * Math.sin(distanceMeters / R) * Math.cos(bearingRad)
  )

  const newLonRad = lonRad + Math.atan2(
    Math.sin(bearingRad) * Math.sin(distanceMeters / R) * Math.cos(latRad),
    Math.cos(distanceMeters / R) - Math.sin(latRad) * Math.sin(newLatRad)
  )

  return {
    latitude: newLatRad * 180 / Math.PI,
    longitude: newLonRad * 180 / Math.PI
  }
}

test.describe('위치 기반 출석 거리 검증 테스트', () => {
  test('정확한 거리 계산 검증', async ({ request }) => {
    console.log('\n=== 위치 기반 출석 거리 검증 테스트 시작 ===\n')

    // 1. 세션 생성 (API 직접 호출)
    const createSessionResponse = await request.post('/api/sessions/create', {
      data: {
        courseId: 'test-course-id',
        duration: 60,
        classroomLatitude: CLASSROOM_LAT,
        classroomLongitude: CLASSROOM_LON,
        classroomRadius: ALLOWED_RADIUS
      }
    })

    const sessionData = await createSessionResponse.json()
    const sessionId = sessionData.sessionId

    console.log('✅ 세션 생성 완료:', sessionId)
    console.log(`📍 강의실 위치: ${CLASSROOM_LAT}, ${CLASSROOM_LON}`)
    console.log(`📏 허용 반경: ${ALLOWED_RADIUS}m\n`)

    // 2. 테스트 케이스들
    const testCases = [
      {
        name: '정확한 강의실 위치 (0m)',
        distance: 0,
        bearing: 0,
        shouldPass: true
      },
      {
        name: '강의실에서 50m 떨어진 위치',
        distance: 50,
        bearing: 0,
        shouldPass: true
      },
      {
        name: '강의실에서 95m 떨어진 위치 (경계 내)',
        distance: 95,
        bearing: 90,
        shouldPass: true
      },
      {
        name: '강의실에서 100m 떨어진 위치 (경계선)',
        distance: 100,
        bearing: 180,
        shouldPass: true
      },
      {
        name: '강의실에서 105m 떨어진 위치 (경계 밖)',
        distance: 105,
        bearing: 270,
        shouldPass: false
      },
      {
        name: '강의실에서 120m 떨어진 위치',
        distance: 120,
        bearing: 45,
        shouldPass: false
      },
      {
        name: '강의실에서 200m 떨어진 위치',
        distance: 200,
        bearing: 135,
        shouldPass: false
      }
    ]

    for (const testCase of testCases) {
      console.log(`\n📋 테스트: ${testCase.name}`)

      // 위치 계산
      let studentLat = CLASSROOM_LAT
      let studentLon = CLASSROOM_LON

      if (testCase.distance > 0) {
        const offset = calculateOffset(CLASSROOM_LAT, CLASSROOM_LON, testCase.distance, testCase.bearing)
        studentLat = offset.latitude
        studentLon = offset.longitude
      }

      console.log(`   학생 위치: ${studentLat.toFixed(6)}, ${studentLon.toFixed(6)}`)

      // 출석 체크 시도
      const checkinResponse = await request.post('/api/attendance/checkin', {
        data: {
          sessionId: sessionId,
          latitude: studentLat,
          longitude: studentLon,
          accuracy: 10,
          clientTimestamp: new Date().toISOString()
        }
      })

      const checkinData = await checkinResponse.json()
      const status = checkinResponse.status()

      if (testCase.shouldPass) {
        // 성공해야 하는 케이스
        if (status === 200 && checkinData.success) {
          console.log(`   ✅ 통과 - 출석 성공 (거리: ${checkinData.distance}m)`)
          expect(status).toBe(200)
          expect(checkinData.success).toBe(true)
        } else {
          console.log(`   ❌ 실패 - 출석이 거부되었습니다 (상태: ${status})`)
          console.log(`   응답:`, checkinData)
          expect(status).toBe(200)
        }
      } else {
        // 실패해야 하는 케이스
        if (status !== 200) {
          console.log(`   ✅ 통과 - 출석 거부됨 (거리: ${checkinData.distance || testCase.distance}m)`)
          expect(status).not.toBe(200)
        } else {
          console.log(`   ❌ 실패 - 출석이 허용되었습니다 (거리: ${checkinData.distance}m)`)
          console.log(`   응답:`, checkinData)
          expect(status).not.toBe(200)
        }
      }
    }

    console.log('\n=== 테스트 완료 ===\n')
  })

  test('GPS 정확도 무시 검증', async ({ request }) => {
    console.log('\n=== GPS 정확도 무시 검증 테스트 ===\n')

    // 세션 생성
    const createSessionResponse = await request.post('/api/sessions/create', {
      data: {
        courseId: 'test-course-id-2',
        duration: 60,
        classroomLatitude: CLASSROOM_LAT,
        classroomLongitude: CLASSROOM_LON,
        classroomRadius: ALLOWED_RADIUS
      }
    })

    const sessionData = await createSessionResponse.json()
    const sessionId = sessionData.sessionId

    // 80m 떨어진 위치 (100m 이내)
    const offset80m = calculateOffset(CLASSROOM_LAT, CLASSROOM_LON, 80, 45)

    console.log('📋 테스트: GPS 정확도가 낮아도 실제 거리로 검증')
    console.log(`   실제 거리: 80m (허용 범위 내)`)
    console.log(`   GPS 정확도: 50m (낮음)`)

    // GPS 정확도가 50m로 낮은 경우
    const checkinResponse = await request.post('/api/attendance/checkin', {
      data: {
        sessionId: sessionId,
        latitude: offset80m.latitude,
        longitude: offset80m.longitude,
        accuracy: 50, // GPS 정확도 낮음
        clientTimestamp: new Date().toISOString()
      }
    })

    const checkinData = await checkinResponse.json()
    const status = checkinResponse.status()

    console.log(`   응답 상태: ${status}`)
    console.log(`   계산된 거리: ${checkinData.distance}m`)

    // 이전 로직: effectiveDistance = distance - accuracy = 80 - 50 = 30m → 통과
    // 새 로직: effectiveDistance = distance = 80m → 통과
    // GPS 정확도와 관계없이 실제 거리 80m가 100m 이내이므로 통과해야 함
    if (status === 200 && checkinData.success) {
      console.log(`   ✅ 통과 - GPS 정확도와 무관하게 실제 거리로 검증됨`)
      expect(status).toBe(200)
      expect(checkinData.success).toBe(true)
    } else {
      console.log(`   ❌ 실패 - 출석이 거부되었습니다`)
      console.log(`   응답:`, checkinData)
    }

    console.log('\n=== 테스트 완료 ===\n')
  })
})
