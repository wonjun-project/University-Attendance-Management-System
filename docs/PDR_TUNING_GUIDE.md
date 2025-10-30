# PDR 시스템 파라미터 튜닝 가이드

## 개요

이 문서는 GPS-PDR 융합 시스템의 파라미터를 실제 환경에서 최적화하는 방법을 설명합니다.

모든 파라미터는 `lib/config/pdr-config.ts`에서 중앙 관리됩니다.

## 1. 파라미터 카테고리

### 1.1 Step Detector (걸음 감지기)
- **threshold**: 걸음 감지 민감도
- **minStepInterval**: 최소 걸음 간격
- **bufferSize**: 가속도 버퍼 크기
- **adaptiveThreshold**: 적응형 임계값 사용 여부

### 1.2 Weinberg (걸음 길이 추정)
- **K**: Weinberg 계수
- **defaultHeight**: 사용자 평균 키
- **fixedStepLength**: 고정 걸음 길이 (fallback)

### 1.3 Recalibration (GPS 재보정)
- **periodicInterval**: 주기적 재보정 간격
- **errorThreshold**: GPS-PDR 오차 허용 임계값
- **minGpsAccuracy**: 재보정에 필요한 최소 GPS 정확도

### 1.4 Fusion (GPS-PDR 융합)
- **defaultGpsWeight**: 기본 GPS 가중치
- **minGpsAccuracy**: 최소 GPS 정확도
- **pdrDecayRate**: PDR 신뢰도 감쇠율
- **positionDifferenceThreshold**: 위치 차이 이상치 임계값

### 1.5 Environment (환경 감지)
- **outdoorAccuracyThreshold**: 실외 판단 GPS 정확도
- **indoorAccuracyThreshold**: 실내 판단 GPS 정확도
- **hysteresisTime**: 환경 전환 지연 시간

## 2. 파라미터 튜닝 프로세스

### 2.1 Step Detector Threshold 튜닝

**목적**: 거짓 양성/음성을 최소화하여 정확한 걸음 감지

**절차**:

1. **초기 테스트** (threshold = 1.5G)
   ```bash
   # PDR 테스트 페이지에서 추적 시작
   # 일반 속도로 10m 걷기
   # 실제 걸음 수 vs 감지된 걸음 수 비교
   ```

2. **거짓 양성 확인**
   - 제자리에서 서 있을 때 걸음이 감지되는가?
   - 앉거나 손 흔들기 시 걸음이 감지되는가?
   - **증상**: 감지되면 threshold가 너무 낮음
   - **조치**: threshold를 0.1~0.2 증가 (예: 1.5 → 1.7)

3. **거짓 음성 확인**
   - 천천히 걸을 때 걸음이 놓치는가?
   - 정상 걷기 시 실제 걸음 수보다 적게 감지되는가?
   - **증상**: 놓치면 threshold가 너무 높음
   - **조치**: threshold를 0.1~0.2 감소 (예: 1.5 → 1.3)

4. **최적값 결정**
   - 거짓 양성률 < 5%
   - 거짓 음성률 < 5%
   - 실제 걸음 수와 ±2 이내 차이

**권장값**:
- 일반 환경: 1.5 ~ 1.8G
- 실내(조용한 환경): 1.3 ~ 1.5G
- 실외(활동적): 1.8 ~ 2.0G

---

### 2.2 Weinberg K 계수 튜닝

**목적**: 실제 이동 거리와 PDR 추정 거리의 오차 최소화

**절차**:

1. **거리 측정 테스트**
   ```bash
   # 사전에 정확한 거리를 알고 있는 경로 준비
   # 예: 교실 복도 20m, 건물 외곽 50m
   ```

2. **초기 테스트** (K = 0.43)
   - 20m 경로를 일정한 속도로 걷기
   - PDR 통계에서 총 이동 거리 확인
   - 오차율 계산: `(추정 거리 - 실제 거리) / 실제 거리 × 100%`

3. **K 값 조정**
   - **과대 추정** (추정 > 실제, +10% 이상)
     - K를 5~10% 감소 (예: 0.43 → 0.40)
   - **과소 추정** (추정 < 실제, -10% 이상)
     - K를 5~10% 증가 (예: 0.43 → 0.46)

4. **다양한 경로에서 검증**
   - 짧은 거리 (5~10m)
   - 중간 거리 (20~30m)
   - 긴 거리 (50~100m)
   - 모든 경로에서 오차율 < ±10% 목표

5. **사용자 키 기반 조정**
   - 평균 키가 170cm와 크게 다른 경우 `defaultHeight` 조정
   - 공식: K = 0.37 + (height - 170) × 0.0003

**권장값**:
- 짧은 걸음(여성/청소년): K = 0.38 ~ 0.42
- 평균 걸음(성인): K = 0.41 ~ 0.45
- 긴 걸음(남성/운동선수): K = 0.45 ~ 0.50

---

### 2.3 Recalibration 파라미터 튜닝

**목적**: PDR drift를 최소화하면서 배터리 효율 유지

**절차**:

1. **Periodic Interval 테스트**

   **초기값**: 30초

   - **테스트 A** (20초 간격):
     ```
     periodicInterval: 20000
     ```
     - 1분간 추적
     - 재보정 횟수 확인 (예상: 3회)
     - 총 이동 거리 정확도 측정

   - **테스트 B** (30초 간격 - 기본값):
     - 동일 경로 테스트
     - 재보정 횟수 확인 (예상: 2회)

   - **테스트 C** (60초 간격):
     ```
     periodicInterval: 60000
     ```
     - 동일 경로 테스트
     - 재보정 횟수 확인 (예상: 1회)

   **평가 기준**:
   - Drift 누적: 최종 위치 오차 < 5m
   - 배터리 효율: 간격 길수록 유리
   - **권장**: Heartbeat 간격과 동일하게 설정 (30초)

2. **Error Threshold 테스트**

   **초기값**: 15m

   - **실내 환경** (GPS 신호 약함):
     ```
     errorThreshold: 10
     ```
     - GPS 정확도가 나빠 자주 재보정되는지 확인
     - 너무 자주 재보정되면 증가 (15m)

   - **실외 환경** (GPS 신호 양호):
     ```
     errorThreshold: 15
     ```
     - 충분히 재보정되는지 확인
     - PDR drift > 15m이면 즉시 재보정 확인

   **권장값**:
   - 실내/교실: 10 ~ 15m
   - 실외/캠퍼스: 15 ~ 20m

3. **Min GPS Accuracy 테스트**

   **초기값**: 30m

   - **엄격 모드** (20m):
     - 실내에서 재보정이 거의 안 됨 → PDR drift 증가
   - **완화 모드** (40m):
     - 실내에서도 재보정됨 → 부정확한 GPS로 재보정 위험

   **평가**:
   - 실내에서 1분 추적 후 재보정 횟수
   - 재보정 시 GPS 정확도 로그 확인
   - GPS 정확도 < 30m인 경우만 재보정되도록

   **권장값**: 25 ~ 35m

---

### 2.4 Fusion Weight 튜닝

**목적**: GPS와 PDR의 최적 융합 비율 결정

**절차**:

1. **환경별 GPS 가중치 테스트**

   **실외 (GPS 정확도 10~20m)**:
   ```typescript
   defaultGpsWeight: 0.8
   ```
   - GPS를 더 신뢰
   - PDR은 GPS 보조 역할

   **실내 (GPS 정확도 50~100m)**:
   ```typescript
   defaultGpsWeight: 0.5
   ```
   - GPS와 PDR 균형
   - PDR drift vs GPS 부정확도 trade-off

2. **검증 방법**:
   - 알려진 경로 (예: 교실 A → B)
   - 융합 위치 정확도 측정
   - GPS only vs PDR only vs Fusion 비교

3. **최적 가중치 결정**:
   - Fusion이 GPS only와 PDR only보다 정확해야 함
   - 일반적으로 GPS weight = 0.6 ~ 0.8

**권장값**:
- 실외 위주: 0.75 ~ 0.85
- 균형 (기본): 0.65 ~ 0.75
- 실내 위주: 0.50 ~ 0.65

---

## 3. 프리셋 선택 가이드

### 3.1 Default (기본값)
**사용 시기**:
- 실내/실외 혼합 환경
- 일반적인 출석 체크 시나리오
- 균형잡힌 정확도와 배터리 효율

**특징**:
- Step threshold: 1.5G (보통)
- Recalibration: 30초마다
- GPS weight: 0.7 (GPS 약간 선호)

### 3.2 High Precision (고정밀)
**사용 시기**:
- 정확도가 매우 중요한 경우
- 짧은 시간 사용 (배터리 충분)
- 실외 환경에서 정밀 추적

**특징**:
- Step threshold: 1.8G (엄격)
- Recalibration: 20초마다 (자주)
- Error threshold: 10m (엄격)
- GPS weight: 0.8 (GPS 선호)

**Trade-off**: 배터리 소모 약 20% 증가

### 3.3 Battery Saver (배터리 절약)
**사용 시기**:
- 배터리가 부족한 경우
- 장시간 추적 필요
- 정확도보다 지속 시간 중요

**특징**:
- Recalibration: 60초마다 (드물게)
- Error threshold: 20m (완화)
- GPS weight: 0.6 (PDR 더 사용)

**Trade-off**: 정확도 약 10~15% 감소

### 3.4 Indoor (실내 위주)
**사용 시기**:
- 주로 건물 내부에서 사용
- GPS 신호가 약한 환경
- PDR 성능이 중요

**특징**:
- Step threshold: 1.4G (민감)
- Recalibration: 45초마다
- GPS weight: 0.5 (균형)
- Min GPS accuracy: 50m (완화)

### 3.5 Outdoor (실외 위주)
**사용 시기**:
- 주로 야외/캠퍼스에서 사용
- GPS 신호가 양호한 환경
- GPS 정확도가 높음

**특징**:
- GPS weight: 0.85 (GPS 매우 선호)
- Error threshold: 12m (엄격)
- Outdoor threshold: 40m (쉬운 실외 판단)

---

## 4. 실전 튜닝 시나리오

### 시나리오 1: 실내 교실 출석 체크

**환경**:
- 건물 2~3층
- GPS 정확도: 50~100m
- 이동 거리: 10~20m

**권장 설정**:
```typescript
ACTIVE_PRESET = 'indoor'
```

**추가 튜닝**:
- 교실이 작으면 errorThreshold: 8~10m
- GPS 신호가 매우 약하면 defaultGpsWeight: 0.4~0.5

### 시나리오 2: 야외 캠퍼스 출석 체크

**환경**:
- 야외 운동장/광장
- GPS 정확도: 5~15m
- 이동 거리: 50~100m

**권장 설정**:
```typescript
ACTIVE_PRESET = 'outdoor'
```

**추가 튜닝**:
- GPS 신호 매우 좋으면 defaultGpsWeight: 0.9
- 장시간 사용 시 periodicInterval: 40초

### 시나리오 3: 혼합 환경 (건물 진입/퇴장)

**환경**:
- 건물 밖 → 안 → 밖 이동
- GPS 정확도 급변 (10m → 80m → 10m)

**권장 설정**:
```typescript
ACTIVE_PRESET = 'default'
```

**추가 튜닝**:
- Environment detector 활성화 (기본값)
- Hysteresis time: 7~10초 (전환 안정화)
- Adaptive threshold: true (환경 적응)

---

## 5. 성능 평가 지표

### 5.1 위치 정확도
- **목표**: 실제 위치와 ±5m 이내
- **측정**: 알려진 경로에서 최종 위치 오차
- **평가**:
  - 우수: < 3m
  - 양호: 3~5m
  - 보통: 5~10m
  - 불량: > 10m

### 5.2 걸음 감지 정확도
- **목표**: 실제 걸음 수의 ±5% 이내
- **측정**: 20걸음 테스트에서 감지된 걸음 수
- **평가**:
  - 우수: 19~21 걸음
  - 양호: 18~22 걸음
  - 보통: 17~23 걸음
  - 불량: < 17 또는 > 23

### 5.3 거리 추정 정확도
- **목표**: 실제 거리의 ±10% 이내
- **측정**: 정확히 측정된 경로 (예: 20m)에서 PDR 추정 거리
- **평가**:
  - 우수: 18~22m (±10%)
  - 양호: 17~23m (±15%)
  - 보통: 16~24m (±20%)
  - 불량: < 16m 또는 > 24m

### 5.4 재보정 효율
- **목표**: 적절한 재보정 빈도
- **측정**: 1분당 재보정 횟수
- **평가**:
  - 너무 자주: > 4회/분 (배터리 소모)
  - 적절: 2~3회/분
  - 너무 드물: < 1회/분 (drift 증가)

### 5.5 배터리 효율
- **목표**: 30분 추적 시 < 10% 배터리 소모
- **측정**: 배터리 API로 소모량 추적
- **평가**:
  - 우수: < 8%
  - 양호: 8~10%
  - 보통: 10~15%
  - 불량: > 15%

---

## 6. 튜닝 체크리스트

### Phase 1: 초기 테스트 (기본값)
- [ ] Step detector: 10m 걷기 테스트
- [ ] Weinberg: 20m 거리 추정 테스트
- [ ] Recalibration: 1분 추적 후 재보정 횟수 확인
- [ ] Fusion: 실내/실외 전환 시 동작 확인
- [ ] Environment: GPS 정확도에 따른 환경 감지 확인

### Phase 2: 문제점 식별
- [ ] 거짓 양성/음성 걸음 감지 확인
- [ ] 거리 추정 오차율 계산 (> ±15%?)
- [ ] PDR drift 누적 확인 (> 10m?)
- [ ] GPS-PDR 융합 이상치 확인
- [ ] 배터리 소모율 측정 (> 15%/30분?)

### Phase 3: 파라미터 조정
- [ ] Step threshold 조정 (필요 시)
- [ ] Weinberg K 조정 (필요 시)
- [ ] Recalibration interval 조정 (필요 시)
- [ ] Fusion weight 조정 (필요 시)

### Phase 4: 재검증
- [ ] 모든 테스트 재수행
- [ ] 성능 지표 목표 달성 확인
- [ ] 다양한 환경에서 안정성 확인
- [ ] 최종 설정 문서화

---

## 7. 트러블슈팅

### 문제 1: 걸음이 너무 많이 감지됨
**증상**: 제자리에서도 걸음 증가, 손 흔들기에 반응

**원인**: threshold가 너무 낮음

**해결**:
1. `threshold`를 0.2 증가 (1.5 → 1.7)
2. `minStepInterval`을 증가 (200 → 250ms)
3. `adaptiveThreshold: true` 확인

### 문제 2: 걸음이 놓침
**증상**: 실제 걸음보다 적게 감지됨

**원인**: threshold가 너무 높음 또는 센서 문제

**해결**:
1. `threshold`를 0.2 감소 (1.5 → 1.3)
2. 센서 권한 확인
3. 센서 샘플링 주파수 확인

### 문제 3: 거리가 과대 추정됨
**증상**: 20m 걸었는데 25~30m로 추정됨

**원인**: Weinberg K가 너무 높음

**해결**:
1. `weinbergK`를 5~10% 감소 (0.43 → 0.40)
2. 사용자 키 확인 (`defaultHeight`)
3. `fixedStepLength` 조정 (0.65 → 0.60m)

### 문제 4: 거리가 과소 추정됨
**증상**: 20m 걸었는데 15~18m로 추정됨

**원인**: Weinberg K가 너무 낮음

**해결**:
1. `weinbergK`를 5~10% 증가 (0.43 → 0.46)
2. `fixedStepLength` 조정 (0.65 → 0.70m)

### 문제 5: PDR drift가 심함
**증상**: 1분 후 실제 위치와 10m 이상 차이

**원인**: 재보정이 충분하지 않음

**해결**:
1. `periodicInterval`을 감소 (30s → 20s)
2. `errorThreshold`를 감소 (15m → 10m)
3. `minGpsAccuracy`를 증가 (30m → 40m, 더 자주 재보정)

### 문제 6: 배터리 소모가 심함
**증상**: 30분에 15% 이상 소모

**원인**: 재보정이 너무 자주 일어남

**해결**:
1. `periodicInterval`을 증가 (30s → 45s)
2. `ACTIVE_PRESET`을 'batterySaver'로 변경
3. `minGpsAccuracy`를 감소 (30m → 25m, 덜 자주 재보정)

### 문제 7: 실내에서 GPS만 사용됨
**증상**: 실내인데 trackingMode가 'gps-only'

**원인**: GPS 가중치가 너무 높음

**해결**:
1. `defaultGpsWeight`를 감소 (0.7 → 0.6)
2. `outdoorAccuracyThreshold`를 감소 (30m → 20m)
3. `ACTIVE_PRESET`을 'indoor'로 변경

---

## 8. 최종 권장 설정 (대학 출석 시스템)

### 일반 강의실 (실내)
```typescript
export const ACTIVE_PRESET = 'indoor'
```

### 체육관/운동장 (실외)
```typescript
export const ACTIVE_PRESET = 'outdoor'
```

### 혼합 환경 (강의동 + 캠퍼스)
```typescript
export const ACTIVE_PRESET = 'default'
```

### 고정밀 필요 시 (시험/중요 이벤트)
```typescript
export const ACTIVE_PRESET = 'highPrecision'
```

---

## 9. 데이터 수집 및 분석

### 9.1 로깅 활성화
```typescript
// lib/pdr/pdr-tracker.ts
console.log('📊 PDR Stats:', {
  steps: this.stepCount,
  distance: this.totalDistance,
  avgStepLength: this.averageStepLength,
  accuracy: this.estimatedAccuracy
})
```

### 9.2 수집할 데이터
- [ ] 걸음 수 vs 실제 걸음 수
- [ ] 추정 거리 vs 실제 거리
- [ ] 재보정 횟수 및 시간
- [ ] GPS 정확도 분포
- [ ] 배터리 소모율
- [ ] 환경 전환 빈도

### 9.3 분석 도구
- Supabase location_logs 테이블 쿼리
- PDR 메타데이터 (tracking_mode, confidence, gps_weight)
- 시각화: 경로 재현, 오차 그래프

---

## 10. 버전 관리 및 롤백

### 파라미터 변경 시
1. 변경 전 현재 설정 백업
2. `pdr-config.ts`에 변경 이력 주석 추가
3. 성능 저하 시 이전 값으로 롤백

### 예시
```typescript
/**
 * 변경 이력:
 * 2025-10-30: threshold 1.5 → 1.7 (거짓 양성 감소 목적)
 * 2025-10-28: periodicInterval 30s → 20s (drift 감소 목적)
 */
```

---

## 참고 문헌

- Weinberg, H. (2002). "Using the ADXL202 in Pedometer and Personal Navigation Applications"
- ISO/IEC 18305:2016 - Information technology -- Real time locating systems
- PDR 알고리즘 표준 논문 및 벤치마크

---

**마지막 업데이트**: 2025-10-30
**다음 리뷰 예정**: 실제 환경 테스트 후 (TBD)
