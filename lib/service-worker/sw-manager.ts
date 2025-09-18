export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  locationValid: boolean;
  distance?: number;
  allowedRadius?: number;
  timestamp: string;
}

export interface ServiceWorkerMessage {
  type: string;
  data: any;
  timestamp: string;
}

export class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private isRegistered = false;
  private messageCallbacks: Map<string, (data: any) => void> = new Map();

  async register(): Promise<boolean> {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker not supported');
      return false;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js');
      console.log('✅ Service Worker 등록 성공');

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', this.handleMessage.bind(this));

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;
      this.isRegistered = true;

      return true;
    } catch (error) {
      console.error('❌ Service Worker 등록 실패:', error);
      return false;
    }
  }

  async startTracking(attendanceId: string, sessionData: any): Promise<boolean> {
    if (!this.isRegistered || !this.registration) {
      console.error('Service Worker가 등록되지 않았습니다');
      return false;
    }

    try {
      // Request background sync permission if available
      if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
        await (this.registration as any).sync.register('location-sync');
      }

      // Request periodic background sync if available
      if ('periodicSync' in window.ServiceWorkerRegistration.prototype) {
        // @ts-ignore - periodicSync is experimental
        await this.registration.periodicSync.register('location-periodic', {
          minInterval: 30000 // 30 seconds
        });
      }

      // Send start tracking message
      this.sendMessage('START_TRACKING', {
        attendanceId,
        sessionData
      });

      console.log('🎯 Service Worker GPS 추적 시작 요청');
      return true;
    } catch (error) {
      console.error('❌ Service Worker 추적 시작 실패:', error);
      return false;
    }
  }

  stopTracking(): void {
    if (!this.isRegistered) return;

    this.sendMessage('STOP_TRACKING');
    console.log('🛑 Service Worker GPS 추적 중지 요청');
  }

  async getStatus(): Promise<any> {
    if (!this.isRegistered) return null;

    return new Promise((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => {
        resolve(event.data);
      };

      this.sendMessage('GET_STATUS', {}, [channel.port2]);
    });
  }

  onLocationUpdate(callback: (data: LocationData) => void): void {
    this.messageCallbacks.set('LOCATION_UPDATE', callback);
  }

  onTrackingStarted(callback: (data: any) => void): void {
    this.messageCallbacks.set('TRACKING_STARTED', callback);
  }

  onTrackingstopped(callback: () => void): void {
    this.messageCallbacks.set('TRACKING_STOPPED', callback);
  }

  onTrackingError(callback: (error: string) => void): void {
    this.messageCallbacks.set('TRACKING_ERROR', callback);
  }

  private sendMessage(type: string, data: any = {}, ports?: MessagePort[]): void {
    if (!this.registration?.active) return;

    this.registration.active.postMessage({
      type,
      data
    }, ports ? { transfer: ports } : undefined);
  }

  private handleMessage(event: MessageEvent<ServiceWorkerMessage>): void {
    const { type, data } = event.data;
    const callback = this.messageCallbacks.get(type);

    if (callback) {
      callback(data);
    }

    console.log('📨 Service Worker 메시지:', type, data);
  }

  async unregister(): Promise<boolean> {
    if (!this.registration) return false;

    try {
      const result = await this.registration.unregister();
      this.isRegistered = false;
      this.registration = null;
      console.log('Service Worker 등록 해제:', result);
      return result;
    } catch (error) {
      console.error('Service Worker 등록 해제 실패:', error);
      return false;
    }
  }

  isServiceWorkerSupported(): boolean {
    return 'serviceWorker' in navigator;
  }

  isBackgroundSyncSupported(): boolean {
    return 'serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype;
  }

  isPeriodicSyncSupported(): boolean {
    return 'serviceWorker' in navigator && 'periodicSync' in window.ServiceWorkerRegistration.prototype;
  }
}

// Singleton instance
export const swManager = new ServiceWorkerManager();