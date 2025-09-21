export interface BackgroundLocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  isBackground: boolean;
  source: 'foreground' | 'background' | 'page-hidden' | 'service-worker';
}

export interface BackgroundTrackingOptions {
  trackingInterval: number; // 추적 간격 (밀리초)
  backgroundInterval: number; // 백그라운드 추적 간격 (밀리초)
  enableWakeLock: boolean; // Wake Lock 사용 여부
  enableBackgroundSync: boolean; // Background Sync 사용 여부
  highAccuracy: boolean; // GPS 고정밀도 사용
}

function hasWakeLock(nav: Navigator): nav is Navigator & { wakeLock: { request: (type: 'screen') => Promise<WakeLockSentinel> } } {
  return 'wakeLock' in nav
}

export class BackgroundLocationTracker {
  private isTracking = false;
  private isBackground = false;
  private foregroundInterval: NodeJS.Timeout | null = null;
  private backgroundInterval: NodeJS.Timeout | null = null;
  private wakeLock: WakeLockSentinel | null = null;
  private attendanceId: string | null = null;

  private options: BackgroundTrackingOptions = {
    trackingInterval: 30000, // 30초 (포그라운드)
    backgroundInterval: 60000, // 1분 (백그라운드)
    enableWakeLock: true,
    enableBackgroundSync: true,
    highAccuracy: true
  };

  constructor(
    private onLocationUpdate: (location: BackgroundLocationData) => void,
    private onError: (error: string) => void,
    options?: Partial<BackgroundTrackingOptions>
  ) {
    this.options = { ...this.options, ...options };
    this.setupVisibilityHandlers();
    this.setupUnloadHandlers();
  }

  async startTracking(attendanceId: string): Promise<boolean> {
    if (this.isTracking) {
      console.log('🎯 이미 추적 중입니다');
      return true;
    }

    this.attendanceId = attendanceId;

    try {
      // 위치 권한 확인
      if (!navigator.geolocation) {
        throw new Error('이 브라우저는 위치 서비스를 지원하지 않습니다.');
      }

      // Wake Lock 활성화 (화면 꺼짐 방지)
      if (this.options.enableWakeLock) {
        await this.requestWakeLock();
      }

      // 초기 위치 확인
      await this.trackLocation('foreground');

      // 포그라운드 추적 시작
      this.startForegroundTracking();

      this.isTracking = true;
      console.log('🎯 백그라운드 GPS 추적 시작:', {
        attendanceId,
        foregroundInterval: this.options.trackingInterval,
        backgroundInterval: this.options.backgroundInterval,
        wakeLockEnabled: !!this.wakeLock
      });

      return true;
    } catch (error) {
      console.error('❌ 백그라운드 추적 시작 실패:', error);
      this.onError(error instanceof Error ? error.message : '추적 시작 실패');
      return false;
    }
  }

  stopTracking(): void {
    if (!this.isTracking) return;

    console.log('🛑 백그라운드 GPS 추적 중지');

    this.isTracking = false;
    this.attendanceId = null;

    // 모든 인터벌 정리
    if (this.foregroundInterval) {
      clearInterval(this.foregroundInterval);
      this.foregroundInterval = null;
    }

    if (this.backgroundInterval) {
      clearInterval(this.backgroundInterval);
      this.backgroundInterval = null;
    }

    // Wake Lock 해제
    this.releaseWakeLock();
  }

  private setupVisibilityHandlers(): void {
    // Page Visibility API - 페이지가 숨겨지거나 보일 때
    document.addEventListener('visibilitychange', () => {
      const wasBackground = this.isBackground;
      this.isBackground = document.hidden;

      if (this.isTracking) {
        if (this.isBackground && !wasBackground) {
          // 백그라운드로 전환
          console.log('📱 페이지가 백그라운드로 전환됨');
          this.switchToBackgroundMode();
        } else if (!this.isBackground && wasBackground) {
          // 포그라운드로 전환
          console.log('📱 페이지가 포그라운드로 전환됨');
          this.switchToForegroundMode();
        }
      }
    });

    // 포커스 이벤트 (추가 보완)
    window.addEventListener('focus', () => {
      if (this.isTracking && this.isBackground) {
        this.switchToForegroundMode();
      }
    });

    window.addEventListener('blur', () => {
      if (this.isTracking && !this.isBackground) {
        this.switchToBackgroundMode();
      }
    });
  }

  private setupUnloadHandlers(): void {
    // 페이지 언로드 방지 (사용자가 실수로 닫는 것 방지)
    window.addEventListener('beforeunload', (event) => {
      if (this.isTracking) {
        const message = '출석 체크가 진행 중입니다. 페이지를 닫으면 출석 추적이 중단됩니다.';
        event.preventDefault();
        event.returnValue = message;
        return message;
      }
    });

    // 페이지 숨김 시 백그라운드 추적 강화
    document.addEventListener('pagehide', () => {
      if (this.isTracking) {
        console.log('📱 페이지가 숨겨짐 - 백그라운드 추적 강화');
        this.enforceBackgroundTracking();
      }
    });
  }

  private startForegroundTracking(): void {
    if (this.foregroundInterval) return;

    this.foregroundInterval = setInterval(() => {
      if (!this.isBackground) {
        this.trackLocation('foreground');
      }
    }, this.options.trackingInterval);
  }

  private startBackgroundTracking(): void {
    if (this.backgroundInterval) return;

    this.backgroundInterval = setInterval(() => {
      if (this.isBackground) {
        this.trackLocation('background');
      }
    }, this.options.backgroundInterval);
  }

  private switchToBackgroundMode(): void {
    console.log('🔄 백그라운드 모드로 전환');
    this.isBackground = true;

    // 백그라운드 추적 시작
    this.startBackgroundTracking();

    // 즉시 한 번 추적
    this.trackLocation('page-hidden');
  }

  private switchToForegroundMode(): void {
    console.log('🔄 포그라운드 모드로 전환');
    this.isBackground = false;

    // 백그라운드 인터벌 정리
    if (this.backgroundInterval) {
      clearInterval(this.backgroundInterval);
      this.backgroundInterval = null;
    }

    // 즉시 한 번 추적
    this.trackLocation('foreground');
  }

  private enforceBackgroundTracking(): void {
    // 페이지가 완전히 숨겨질 때 강제로 백그라운드 추적 시작
    if (!this.backgroundInterval) {
      this.startBackgroundTracking();
    }

    // 즉시 위치 추적
    this.trackLocation('page-hidden');
  }

  private async trackLocation(source: BackgroundLocationData['source']): Promise<void> {
    if (!this.isTracking || !this.attendanceId) return;

    try {
      const position = await this.getCurrentPosition();
      const locationData: BackgroundLocationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: Date.now(),
        isBackground: this.isBackground,
        source
      };

      console.log(`📍 위치 추적 [${source}]:`, {
        lat: locationData.latitude.toFixed(6),
        lng: locationData.longitude.toFixed(6),
        accuracy: locationData.accuracy,
        isBackground: locationData.isBackground
      });

      // 서버로 위치 전송
      await this.sendLocationToServer(locationData);

      // 콜백 호출
      this.onLocationUpdate(locationData);

    } catch (error) {
      console.error(`❌ 위치 추적 실패 [${source}]:`, error);
      this.onError(error instanceof Error ? error.message : '위치 추적 실패');
    }
  }

  private async getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy: this.options.highAccuracy,
          timeout: 15000,
          maximumAge: this.isBackground ? 60000 : 30000 // 백그라운드에서는 더 오래된 위치도 허용
        }
      );
    });
  }

  private async sendLocationToServer(locationData: BackgroundLocationData): Promise<void> {
    try {
      const response = await fetch('/api/location/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          attendanceId: this.attendanceId,
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          accuracy: locationData.accuracy,
          source: locationData.source,
          isBackground: locationData.isBackground,
          timestamp: locationData.timestamp
        }),
      });

      if (!response.ok) {
        throw new Error(`서버 오류: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ 서버 위치 전송 성공:', result);

    } catch (error) {
      console.error('❌ 서버 위치 전송 실패:', error);
      // 네트워크 오류는 무시하고 계속 추적
    }
  }

  private async requestWakeLock(): Promise<void> {
    try {
      if (hasWakeLock(navigator)) {
        const wakeLock = await navigator.wakeLock.request('screen');
        this.wakeLock = wakeLock;
        console.log('🔒 Wake Lock 활성화 - 화면 꺼짐 방지');

        wakeLock.addEventListener('release', () => {
          console.log('🔓 Wake Lock 해제됨');
        });
      }
    } catch (error) {
      console.warn('⚠️ Wake Lock 요청 실패:', error);
      // Wake Lock 실패는 치명적이지 않음
    }
  }

  private releaseWakeLock(): void {
    if (this.wakeLock) {
      this.wakeLock.release();
      this.wakeLock = null;
      console.log('🔓 Wake Lock 해제');
    }
  }

  // 상태 확인 메소드
  getStatus() {
    return {
      isTracking: this.isTracking,
      isBackground: this.isBackground,
      attendanceId: this.attendanceId,
      hasWakeLock: !!this.wakeLock,
      foregroundInterval: !!this.foregroundInterval,
      backgroundInterval: !!this.backgroundInterval
    };
  }

  // 설정 업데이트
  updateOptions(newOptions: Partial<BackgroundTrackingOptions>): void {
    this.options = { ...this.options, ...newOptions };
    console.log('⚙️ 추적 설정 업데이트:', this.options);
  }
}