// 거리 계산 및 위치 검증 테스트

// Haversine 공식으로 두 좌표 간 거리 계산 (미터)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lon2 - lon1) * Math.PI / 180

  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

// 수정된 위치 검증 로직
function evaluateLocationNew(studentLat, studentLon, accuracy, classroomLat, classroomLon, allowedRadius) {
  const distance = calculateDistance(studentLat, studentLon, classroomLat, classroomLon)
  // GPS 정확도에 관계없이 실제 거리만으로 검증
  const effectiveDistance = distance
  const isLocationValid = effectiveDistance <= allowedRadius

  return {
    distance,
    effectiveDistance,
    allowedRadius,
    isLocationValid
  }
}

// 이전 버그 있는 로직
function evaluateLocationOld(studentLat, studentLon, accuracy, classroomLat, classroomLon, allowedRadius) {
  const distance = calculateDistance(studentLat, studentLon, classroomLat, classroomLon)
  // 버그: accuracy를 빼서 거리가 줄어듦
  const effectiveDistance = Math.max(0, distance - accuracy)
  const isLocationValid = effectiveDistance <= allowedRadius

  return {
    distance,
    effectiveDistance,
    allowedRadius,
    isLocationValid
  }
}

console.log('\n=== 거리 계산 및 위치 검증 테스트 ===\n')

const CLASSROOM_LAT = 37.4607
const CLASSROOM_LON = 126.9524
const ALLOWED_RADIUS = 100

const testCases = [
  {
    name: '정확한 강의실 위치 (0m)',
    studentLat: CLASSROOM_LAT,
    studentLon: CLASSROOM_LON,
    accuracy: 10,
    expectedDistance: 0,
    shouldPass: true
  },
  {
    name: '강의실에서 약 50m 떨어진 위치',
    studentLat: CLASSROOM_LAT + 0.00045,
    studentLon: CLASSROOM_LON,
    accuracy: 10,
    expectedDistance: 50,
    shouldPass: true
  },
  {
    name: '강의실에서 약 95m 떨어진 위치',
    studentLat: CLASSROOM_LAT + 0.00085,
    studentLon: CLASSROOM_LON,
    accuracy: 10,
    expectedDistance: 95,
    shouldPass: true
  },
  {
    name: '강의실에서 약 120m 떨어진 위치 (허용 범위 초과)',
    studentLat: CLASSROOM_LAT + 0.00108,
    studentLon: CLASSROOM_LON,
    accuracy: 10,
    expectedDistance: 120,
    shouldPass: false
  },
  {
    name: '강의실에서 약 80m, GPS 정확도 50m (이전 로직 버그 케이스)',
    studentLat: CLASSROOM_LAT + 0.00072,
    studentLon: CLASSROOM_LON,
    accuracy: 50,
    expectedDistance: 80,
    shouldPass: true
  },
  {
    name: '강의실에서 약 120m, GPS 정확도 50m (이전 로직 버그 케이스)',
    studentLat: CLASSROOM_LAT + 0.00108,
    studentLon: CLASSROOM_LON,
    accuracy: 50,
    expectedDistance: 120,
    shouldPass: false
  }
]

console.log('📍 강의실 위치:', CLASSROOM_LAT, CLASSROOM_LON)
console.log('📏 허용 반경:', ALLOWED_RADIUS, 'm\n')

let passCount = 0
let failCount = 0

for (const testCase of testCases) {
  console.log(`\n📋 테스트: ${testCase.name}`)
  console.log(`   예상 거리: 약 ${testCase.expectedDistance}m`)
  console.log(`   GPS 정확도: ${testCase.accuracy}m`)

  // 이전 로직 테스트
  const oldResult = evaluateLocationOld(
    testCase.studentLat,
    testCase.studentLon,
    testCase.accuracy,
    CLASSROOM_LAT,
    CLASSROOM_LON,
    ALLOWED_RADIUS
  )

  // 새 로직 테스트
  const newResult = evaluateLocationNew(
    testCase.studentLat,
    testCase.studentLon,
    testCase.accuracy,
    CLASSROOM_LAT,
    CLASSROOM_LON,
    ALLOWED_RADIUS
  )

  console.log(`\n   [이전 로직]`)
  console.log(`   - 실제 거리: ${oldResult.distance.toFixed(2)}m`)
  console.log(`   - 유효 거리: ${oldResult.effectiveDistance.toFixed(2)}m (distance - accuracy)`)
  console.log(`   - 검증 결과: ${oldResult.isLocationValid ? '✅ 통과' : '❌ 실패'}`)

  console.log(`\n   [수정된 로직]`)
  console.log(`   - 실제 거리: ${newResult.distance.toFixed(2)}m`)
  console.log(`   - 유효 거리: ${newResult.effectiveDistance.toFixed(2)}m (distance만 사용)`)
  console.log(`   - 검증 결과: ${newResult.isLocationValid ? '✅ 통과' : '❌ 실패'}`)

  // 결과 검증
  const isCorrect = newResult.isLocationValid === testCase.shouldPass
  if (isCorrect) {
    console.log(`\n   ✅ 테스트 통과: 예상대로 ${testCase.shouldPass ? '허용' : '거부'}됨`)
    passCount++
  } else {
    console.log(`\n   ❌ 테스트 실패: ${testCase.shouldPass ? '허용되어야 하는데 거부' : '거부되어야 하는데 허용'}됨`)
    failCount++
  }

  // 버그 케이스 강조
  if (oldResult.isLocationValid !== newResult.isLocationValid) {
    console.log(`\n   ⚠️  버그 수정됨: 이전 로직과 다른 결과`)
  }
}

console.log('\n\n=== 테스트 결과 요약 ===')
console.log(`✅ 통과: ${passCount}개`)
console.log(`❌ 실패: ${failCount}개`)
console.log(`\n총 ${passCount + failCount}개 테스트 중 ${passCount}개 성공\n`)

if (failCount === 0) {
  console.log('🎉 모든 테스트 통과! 거리 검증 로직이 올바르게 작동합니다.\n')
  process.exit(0)
} else {
  console.log('⚠️  일부 테스트 실패. 로직을 다시 확인해주세요.\n')
  process.exit(1)
}
