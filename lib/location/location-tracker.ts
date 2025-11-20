import { calculateDistance, isWithinRadius } from '@/lib/utils/geo'
import { GPSPDRFusionManager, type FusedPosition, type Position2D } from '@/lib/fusion/gps-pdr-fusion'

export interface LocationData {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: number
  source?: 'gps' | 'pdr' | 'fused'
}

export interface LocationTrackingOptions {
  enableHighAccuracy?: boolean
  timeout?: number
  maximumAge?: number
  trackingInterval?: number // milliseconds
}

export class LocationTracker {
  private watchId: number | null = null
  private intervalId: NodeJS.Timeout | null = null
  private isTracking = false
  private currentPosition: LocationData | null = null
  private options: Required<LocationTrackingOptions>
  
  // Fusion Engine
  private fusionManager: GPSPDRFusionManager

  constructor(
    private onLocationUpdate: (location: LocationData) => void,
    private onError: (error: string) => void,
    options: LocationTrackingOptions = {}
  ) {
    this.options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000,
      trackingInterval: 5 * 60 * 1000, // 5 minutes
      ...options
    }

    // Initialize Fusion Manager
    this.fusionManager = new GPSPDRFusionManager({
      pdrConfig: {
        sensorFrequency: 60,
        userHeight: 170 // Default height
      },
      recalibration: {
        minGpsAccuracy: 40 // 40m
      }
    })

    // Subscribe to Fusion Updates
    this.fusionManager.onPositionUpdate((fusedPos: FusedPosition) => {
      this.handleFusedUpdate(fusedPos)
    })
  }

  async startTracking(): Promise<void> {
    if (this.isTracking) {
      return
    }

    if (!navigator.geolocation) {
      this.onError('이 브라우저는 위치 서비스를 지원하지 않습니다.')
      return
    }

    try {
      // Get initial position to start the Fusion Manager
      const initialPosition = await this.getCurrentPositionRaw()
      
      // Start Fusion Manager (PDR sensors might fail if permission is needed, but we continue)
      await this.fusionManager.startTracking({
        lat: initialPosition.latitude,
        lng: initialPosition.longitude,
        accuracy: initialPosition.accuracy,
        timestamp: initialPosition.timestamp
      })
      
      this.isTracking = true

      // Start continuous GPS tracking
      this.watchId = navigator.geolocation.watchPosition(
        this.handleLocationSuccess.bind(this),
        this.handleLocationError.bind(this),
        {
          enableHighAccuracy: this.options.enableHighAccuracy,
          timeout: this.options.timeout,
          maximumAge: this.options.maximumAge
        }
      )

      // Set up interval for periodic updates (fallback)
      this.intervalId = setInterval(() => {
        this.getCurrentPositionRaw().catch(() => {
          // Ignore errors from periodic updates
        })
      }, this.options.trackingInterval)

    } catch (error: unknown) {
      this.handleLocationError(error)
    }
  }

  stopTracking(): void {
    this.isTracking = false
    this.fusionManager.stopTracking()

    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId)
      this.watchId = null
    }

    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  /**
   * Raw GPS update handler
   * Feeds data into Fusion Manager
   */
  private handleLocationSuccess(position: GeolocationPosition): void {
    const rawPosition: Position2D = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: Date.now()
    }

    // Feed to Fusion Manager
    this.fusionManager.updateGPS(rawPosition)
  }

  /**
   * Fused position update handler
   * Called by Fusion Manager, propagates to UI
   */
  private handleFusedUpdate(fusedPos: FusedPosition): void {
    const locationData: LocationData = {
      latitude: fusedPos.lat,
      longitude: fusedPos.lng,
      accuracy: fusedPos.accuracy ?? 0,
      timestamp: fusedPos.timestamp,
      source: fusedPos.source
    }

    this.currentPosition = locationData
    this.onLocationUpdate(locationData)
  }

  private async getCurrentPositionRaw(): Promise<LocationData> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const locationData: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: Date.now()
          }
          // If not tracking yet, resolve immediately. 
          // If tracking, feed it to fusion manager too.
          if (this.isTracking) {
            this.handleLocationSuccess(position)
          }
          resolve(locationData)
        },
        reject,
        {
          enableHighAccuracy: this.options.enableHighAccuracy,
          timeout: this.options.timeout,
          maximumAge: this.options.maximumAge
        }
      )
    })
  }

  private handleLocationError(error: unknown): void {
    let errorMessage = '위치 확인 중 오류가 발생했습니다.'

    if (typeof error === 'object' && error !== null && 'code' in error) {
      const geoError = error as GeolocationPositionError
      switch (geoError.code) {
        case geoError.PERMISSION_DENIED:
          errorMessage = '위치 접근이 거부되었습니다. 브라우저 설정에서 위치 접근을 허용해주세요.'
          break
        case geoError.POSITION_UNAVAILABLE:
          errorMessage = '현재 위치 정보를 사용할 수 없습니다. GPS가 켜져있는지 확인해주세요.'
          break
        case geoError.TIMEOUT:
          errorMessage = '위치 확인 시간이 초과되었습니다. 다시 시도해주세요.'
          break
        default:
          errorMessage = '위치 확인 중 오류가 발생했습니다.'
          break
      }
    } else if (error instanceof Error && error.message) {
      errorMessage = error.message
    }

    this.onError(errorMessage)
  }

  getCurrentLocationData(): LocationData | null {
    return this.currentPosition
  }

  isCurrentlyTracking(): boolean {
    return this.isTracking
  }

  // Calculate distance between two points in meters (delegated to shared utility)
  static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    return calculateDistance(lat1, lon1, lat2, lon2)
  }

  // Check if current location is within allowed area (delegated to shared utility)
  static isLocationValid(
    currentLat: number,
    currentLon: number,
    allowedLat: number,
    allowedLon: number,
    allowedRadius: number
  ): boolean {
    return isWithinRadius(
      { latitude: currentLat, longitude: currentLon },
      { latitude: allowedLat, longitude: allowedLon },
      allowedRadius
    )
  }
}
