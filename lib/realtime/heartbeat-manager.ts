/**
 * Heartbeat Manager - 백그라운드에서도 지속적인 GPS+PDR 융합 추적을 위한 클라이언트 측 관리자
 *
 * 기능:
 * - GPS + PDR Fusion을 사용한 정확한 위치 추적
 * - Page Visibility API를 사용한 백그라운드/포그라운드 감지
 * - 30초마다 서버에 위치 정보와 heartbeat 전송
 * - 네트워크 끊김 시 자동 재연결
 * - 브라우저 탭이 백그라운드로 가도 추적 지속
 * - 실내/실외 환경 자동 감지 및 모드 전환
 */

import { GPSPDRFusionManager, type FusedPosition } from '@/lib/fusion/gps-pdr-fusion'
import { EnvironmentDetector, type EnvironmentType } from '@/lib/fusion/environment-detector'

export interface HeartbeatLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  // PDR 융합 정보
  trackingMode?: 'gps-only' | 'pdr-only' | 'fusion';
  environment?: 'outdoor' | 'indoor' | 'unknown';
  confidence?: number;
  gpsWeight?: number;
  pdrWeight?: number;
}

export interface HeartbeatResponse {
  success: boolean;
  locationValid: boolean;
  distance?: number;
  allowedRadius?: number;
  sessionEnded?: boolean;
  statusChanged?: boolean;
  newStatus?: 'present' | 'late' | 'left_early' | 'absent';
  message?: string;
  error?: string;
  lowAccuracy?: boolean;
  accuracy?: number;
}

export interface HeartbeatOptions {
  interval: number; // heartbeat 간격 (밀리초)
  backgroundInterval: number; // 백그라운드 시 간격 (밀리초)
  maxRetries: number; // 최대 재시도 횟수
  retryDelay: number; // 재시도 지연 시간 (밀리초)
  enableHighAccuracy: boolean; // GPS 고정밀도 모드
  usePDRFusion: boolean; // GPS + PDR 융합 시스템 사용 여부
}

export type HeartbeatCallback = (data: {
  success: boolean;
  location?: HeartbeatLocation;
  response?: HeartbeatResponse;
  error?: string;
  isBackground?: boolean;
}) => void;

export class HeartbeatManager {
  private attendanceId: string | null = null;
  private sessionId: string | null = null;
  private isActive = false;
  private isBackground = false;
  private intervalId: NodeJS.Timeout | null = null;
  private retryCount = 0;
  private lastSuccessfulHeartbeat: number | null = null;

  // GPS + PDR Fusion Manager
  private fusionManager: GPSPDRFusionManager | null = null;
  private usePDRFusion = true; // PDR 융합 사용 여부

  // Environment Detector
  private environmentDetector: EnvironmentDetector | null = null;

  private options: HeartbeatOptions = {
    interval: 30000, // 30초 (포그라운드)
    backgroundInterval: 60000, // 1분 (백그라운드)
    maxRetries: 3,
    retryDelay: 5000, // 5초
    enableHighAccuracy: true,
    usePDRFusion: true // GPS + PDR 융합 시스템 기본 활성화
  };

  constructor(
    private onHeartbeat: HeartbeatCallback,
    options?: Partial<HeartbeatOptions>
  ) {
    this.options = { ...this.options, ...options };
    this.usePDRFusion = this.options.usePDRFusion;
    this.setupVisibilityHandlers();
    this.setupUnloadHandlers();
  }

  /**
   * Heartbeat 추적 시작
   */
  async startHeartbeat(attendanceId: string, sessionId: string): Promise<boolean> {
    if (this.isActive) {
      console.log('🎯 Heartbeat이 이미 활성화되어 있습니다');
      return true;
    }

    this.attendanceId = attendanceId;
    this.sessionId = sessionId;

    try {
      // Environment Detector 초기화
      this.environmentDetector = new EnvironmentDetector();

      // GPS+PDR Fusion Manager 초기화
      if (this.usePDRFusion) {
        console.log('🔄 GPS+PDR Fusion Manager 초기화 중...');

        // 초기 GPS 위치 획득
        const initialGPS = await this.getCurrentLocationGPS();

        // Fusion Manager 생성
        this.fusionManager = new GPSPDRFusionManager({
          recalibration: {
            periodicInterval: this.options.interval, // Heartbeat 주기와 동일 (30초)
            errorThreshold: 15, // GPS-PDR 오차 15m 초과 시 재보정
            minGpsAccuracy: 30 // GPS 정확도 30m 이하일 때만 재보정
          }
        });

        // Fusion 추적 시작
        await this.fusionManager.startTracking({
          lat: initialGPS.latitude,
          lng: initialGPS.longitude,
          accuracy: initialGPS.accuracy,
          timestamp: initialGPS.timestamp
        });

        console.log('✅ GPS+PDR Fusion 초기화 완료:', {
          initialPosition: { lat: initialGPS.latitude, lng: initialGPS.longitude },
          accuracy: initialGPS.accuracy
        });
      }

      // 초기 heartbeat 전송
      await this.sendHeartbeat();

      // 정기적인 heartbeat 시작
      this.startInterval();
      this.isActive = true;

      console.log('🎯 Heartbeat 추적 시작:', {
        attendanceId,
        sessionId,
        interval: this.getCurrentInterval(),
        highAccuracy: this.options.enableHighAccuracy,
        usePDRFusion: this.usePDRFusion
      });

      return true;
    } catch (error) {
      console.error('❌ Heartbeat 시작 실패:', error);

      // Fusion Manager cleanup
      if (this.fusionManager) {
        this.fusionManager.stopTracking();
        this.fusionManager = null;
      }

      this.onHeartbeat({
        success: false,
        error: error instanceof Error ? error.message : 'Heartbeat 시작 실패'
      });
      return false;
    }
  }

  /**
   * Heartbeat 추적 중지
   */
  stopHeartbeat(): void {
    if (!this.isActive) return;

    console.log('🛑 Heartbeat 추적 중지');

    this.isActive = false;
    this.attendanceId = null;
    this.sessionId = null;
    this.lastSuccessfulHeartbeat = null;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // GPS+PDR Fusion Manager 정리
    if (this.fusionManager) {
      console.log('🧹 GPS+PDR Fusion Manager 정리');
      this.fusionManager.stopTracking();
      this.fusionManager = null;
    }

    // Environment Detector 정리
    this.environmentDetector = null;
  }

  /**
   * 현재 상태 반환
   */
  getStatus() {
    return {
      isActive: this.isActive,
      isBackground: this.isBackground,
      attendanceId: this.attendanceId,
      sessionId: this.sessionId,
      lastHeartbeat: this.lastSuccessfulHeartbeat,
      retryCount: this.retryCount,
      currentInterval: this.getCurrentInterval()
    };
  }

  /**
   * Page Visibility API 핸들러 설정
   */
  private setupVisibilityHandlers(): void {
    // 페이지가 숨겨지거나 보일 때
    document.addEventListener('visibilitychange', () => {
      const wasBackground = this.isBackground;
      this.isBackground = document.hidden;

      if (this.isActive) {
        if (this.isBackground && !wasBackground) {
          console.log('📱 페이지가 백그라운드로 전환됨 - Heartbeat 간격 조정');
          this.adjustIntervalForBackground();
        } else if (!this.isBackground && wasBackground) {
          console.log('📱 페이지가 포그라운드로 전환됨 - Heartbeat 간격 복원');
          this.adjustIntervalForForeground();
        }
      }
    });

    // 포커스 이벤트 (추가 보완)
    window.addEventListener('focus', () => {
      if (this.isActive && this.isBackground) {
        this.adjustIntervalForForeground();
      }
    });

    window.addEventListener('blur', () => {
      if (this.isActive && !this.isBackground) {
        this.adjustIntervalForBackground();
      }
    });
  }

  /**
   * 페이지 언로드 핸들러 설정
   */
  private setupUnloadHandlers(): void {
    // 페이지 닫기 전 경고
    window.addEventListener('beforeunload', (event) => {
      if (this.isActive) {
        const message = '출석 체크가 진행 중입니다. 페이지를 닫으면 출석 추적이 중단됩니다.';
        event.preventDefault();
        event.returnValue = message;
        return message;
      }
    });

    // 페이지 숨김 시 즉시 heartbeat 전송
    document.addEventListener('pagehide', () => {
      if (this.isActive) {
        console.log('📱 페이지가 숨겨짐 - 즉시 heartbeat 전송');
        this.sendHeartbeat().catch(error => {
          console.warn('페이지 숨김 시 heartbeat 전송 실패:', error);
        });
      }
    });
  }

  /**
   * 정기적인 heartbeat 간격 시작
   */
  private startInterval(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    const interval = this.getCurrentInterval();
    this.intervalId = setInterval(() => {
      this.sendHeartbeat().catch(error => {
        console.error('정기 heartbeat 실패:', error);
      });
    }, interval);
  }

  /**
   * 백그라운드 모드로 간격 조정
   */
  private adjustIntervalForBackground(): void {
    this.isBackground = true;
    this.startInterval(); // 새로운 간격으로 재시작
  }

  /**
   * 포그라운드 모드로 간격 조정
   */
  private adjustIntervalForForeground(): void {
    this.isBackground = false;
    this.startInterval(); // 새로운 간격으로 재시작
  }

  /**
   * 현재 간격 반환
   */
  private getCurrentInterval(): number {
    return this.isBackground ? this.options.backgroundInterval : this.options.interval;
  }

  /**
   * 서버에 heartbeat 전송
   */
  private async sendHeartbeat(): Promise<void> {
    if (!this.isActive || !this.attendanceId) {
      return;
    }

    try {
      // GPS+PDR 융합 위치 획득
      const location = await this.getCurrentLocation();

      // 서버에 heartbeat 전송 (PDR 정보 포함)
      const response = await fetch('/api/attendance/heartbeat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          attendanceId: this.attendanceId,
          sessionId: this.sessionId,
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          timestamp: location.timestamp,
          isBackground: this.isBackground,
          source: this.isBackground ? 'background' : 'foreground',
          // PDR 융합 정보
          trackingMode: location.trackingMode,
          environment: location.environment,
          confidence: location.confidence,
          gpsWeight: location.gpsWeight,
          pdrWeight: location.pdrWeight
        }),
      });

      const result: HeartbeatResponse = await response.json();

      if (response.ok && result.success) {
        // 성공
        this.lastSuccessfulHeartbeat = Date.now();
        this.retryCount = 0;

        console.log(`✅ Heartbeat 성공 [${this.isBackground ? 'BG' : 'FG'}]:`, {
          distance: result.distance,
          locationValid: result.locationValid,
          sessionEnded: result.sessionEnded,
          trackingMode: location.trackingMode,
          environment: location.environment,
          confidence: location.confidence
        });

        // 수업이 종료되었다면 heartbeat 중지
        if (result.sessionEnded) {
          console.log('🏁 수업이 종료되어 Heartbeat를 중지합니다');
          this.stopHeartbeat();
        }

        // 콜백 호출
        this.onHeartbeat({
          success: true,
          location,
          response: result,
          isBackground: this.isBackground
        });

      } else {
        throw new Error(result.error || '서버 응답 오류');
      }

    } catch (error) {
      console.error(`❌ Heartbeat 실패 [시도 ${this.retryCount + 1}/${this.options.maxRetries}]:`, error);

      this.retryCount++;

      // 최대 재시도 횟수 초과 시
      if (this.retryCount >= this.options.maxRetries) {
        console.error('❌ Heartbeat 최대 재시도 횟수 초과 - 일시 중단');

        this.onHeartbeat({
          success: false,
          error: `연결 실패 (${this.retryCount}번 시도)`,
          isBackground: this.isBackground
        });

        // 재시도 카운터 리셋 (다음 주기에서 다시 시도)
        setTimeout(() => {
          this.retryCount = 0;
        }, this.options.retryDelay);

      } else {
        // 재시도 스케줄링
        setTimeout(() => {
          this.sendHeartbeat().catch(retryError => {
            console.error('재시도 heartbeat 실패:', retryError);
          });
        }, this.options.retryDelay);
      }
    }
  }

  /**
   * GPS 전용 위치 획득 (Fusion 초기화용)
   */
  private async getCurrentLocationGPS(): Promise<HeartbeatLocation> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('이 브라우저는 위치 서비스를 지원하지 않습니다.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          // Environment Detector에 GPS 품질 업데이트
          if (this.environmentDetector) {
            this.environmentDetector.updateGPSQuality({
              accuracy: position.coords.accuracy,
              timestamp: Date.now()
            });
          }

          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: Date.now()
          });
        },
        (error) => {
          let errorMessage = '위치 확인 중 오류가 발생했습니다.';

          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = '위치 접근 권한이 거부되었습니다.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = '현재 위치 정보를 사용할 수 없습니다.';
              break;
            case error.TIMEOUT:
              errorMessage = '위치 확인 시간이 초과되었습니다.';
              break;
          }

          reject(new Error(errorMessage));
        },
        {
          enableHighAccuracy: this.options.enableHighAccuracy,
          timeout: 15000,
          maximumAge: this.isBackground ? 60000 : 30000 // 백그라운드에서는 더 오래된 위치도 허용
        }
      );
    });
  }

  /**
   * GPS+PDR 융합 위치 획득
   */
  private async getCurrentLocation(): Promise<HeartbeatLocation> {
    // PDR Fusion 사용 시
    if (this.usePDRFusion && this.fusionManager) {
      try {
        const fusedPosition: FusedPosition | null = this.fusionManager.getCurrentPosition();

        if (fusedPosition) {
          // source를 trackingMode로 변환
          const trackingMode = this.convertSourceToTrackingMode(fusedPosition.source);

          // Environment Detector로부터 환경 정보 가져오기
          const environment = this.environmentDetector?.getCurrentEnvironment() ?? 'unknown';

          return {
            latitude: fusedPosition.lat,
            longitude: fusedPosition.lng,
            accuracy: fusedPosition.accuracy ?? 20,
            timestamp: fusedPosition.timestamp,
            trackingMode,
            environment,
            confidence: fusedPosition.confidence,
            gpsWeight: fusedPosition.gpsWeight,
            pdrWeight: fusedPosition.pdrWeight
          };
        } else {
          console.warn('⚠️ Fusion position이 null, GPS fallback 사용');
        }
      } catch (error) {
        console.error('❌ Fusion 위치 획득 실패, GPS fallback 사용:', error);
      }
    }

    // Fallback: GPS only
    const gpsPosition = await this.getCurrentLocationGPS();
    const environment = this.environmentDetector?.getCurrentEnvironment() ?? 'unknown';

    return {
      ...gpsPosition,
      trackingMode: 'gps-only',
      environment
    };
  }

  /**
   * FusedPosition.source를 HeartbeatLocation.trackingMode로 변환
   */
  private convertSourceToTrackingMode(source: 'gps' | 'pdr' | 'fused'): 'gps-only' | 'pdr-only' | 'fusion' {
    switch (source) {
      case 'gps':
        return 'gps-only';
      case 'pdr':
        return 'pdr-only';
      case 'fused':
        return 'fusion';
    }
  }
}

// Singleton 인스턴스 생성을 위한 팩토리 함수
let heartbeatManagerInstance: HeartbeatManager | null = null;

export function createHeartbeatManager(
  onHeartbeat: HeartbeatCallback,
  options?: Partial<HeartbeatOptions>
): HeartbeatManager {
  if (heartbeatManagerInstance) {
    heartbeatManagerInstance.stopHeartbeat();
  }

  heartbeatManagerInstance = new HeartbeatManager(onHeartbeat, options);
  return heartbeatManagerInstance;
}

export function getHeartbeatManager(): HeartbeatManager | null {
  return heartbeatManagerInstance;
}