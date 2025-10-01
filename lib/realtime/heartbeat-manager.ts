/**
 * Heartbeat Manager - 백그라운드에서도 지속적인 GPS 추적을 위한 클라이언트 측 관리자
 *
 * 기능:
 * - Page Visibility API를 사용한 백그라운드/포그라운드 감지
 * - 30초마다 서버에 위치 정보와 heartbeat 전송
 * - 네트워크 끊김 시 자동 재연결
 * - 브라우저 탭이 백그라운드로 가도 추적 지속
 */

export interface HeartbeatLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
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
}

export interface HeartbeatOptions {
  interval: number; // heartbeat 간격 (밀리초)
  backgroundInterval: number; // 백그라운드 시 간격 (밀리초)
  maxRetries: number; // 최대 재시도 횟수
  retryDelay: number; // 재시도 지연 시간 (밀리초)
  enableHighAccuracy: boolean; // GPS 고정밀도 모드
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

  private options: HeartbeatOptions = {
    interval: 30000, // 30초 (포그라운드)
    backgroundInterval: 60000, // 1분 (백그라운드)
    maxRetries: 3,
    retryDelay: 5000, // 5초
    enableHighAccuracy: true
  };

  constructor(
    private onHeartbeat: HeartbeatCallback,
    options?: Partial<HeartbeatOptions>
  ) {
    this.options = { ...this.options, ...options };
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
      // 초기 heartbeat 전송
      await this.sendHeartbeat();

      // 정기적인 heartbeat 시작
      this.startInterval();
      this.isActive = true;

      console.log('🎯 Heartbeat 추적 시작:', {
        attendanceId,
        sessionId,
        interval: this.getCurrentInterval(),
        highAccuracy: this.options.enableHighAccuracy
      });

      return true;
    } catch (error) {
      console.error('❌ Heartbeat 시작 실패:', error);
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
      // GPS 위치 획득
      const location = await this.getCurrentLocation();

      // 서버에 heartbeat 전송
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
          source: this.isBackground ? 'background' : 'foreground'
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
          sessionEnded: result.sessionEnded
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
   * 현재 GPS 위치 획득
   */
  private async getCurrentLocation(): Promise<HeartbeatLocation> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('이 브라우저는 위치 서비스를 지원하지 않습니다.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
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