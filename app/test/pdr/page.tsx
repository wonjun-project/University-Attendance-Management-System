'use client'

/**
 * PDR 시스템 E2E 테스트 페이지
 */

import { useState, useEffect } from 'react'
import { EnhancedLocationTracker, type EnhancedLocationData } from '@/lib/location/enhanced-location-tracker'
import { ZUPTDetector, type ZUPTInfo } from '@/lib/optimization/zupt-detector'
import { BatteryOptimizer, type OptimizationRecommendation } from '@/lib/optimization/battery-optimizer'
import { AnomalyDetector, type AnomalyDetection } from '@/lib/optimization/anomaly-detector'
import { PerformanceMonitor } from '@/lib/optimization/performance-monitor'
import type { EnvironmentType } from '@/lib/fusion/environment-detector'
import type { TrackingMode } from '@/lib/location/enhanced-location-tracker'

export default function PDRTestPage() {
  const [tracker, setTracker] = useState<EnhancedLocationTracker | null>(null)
  const [isTracking, setIsTracking] = useState(false)

  // 위치 데이터
  const [locationData, setLocationData] = useState<EnhancedLocationData | null>(null)
  const [locationHistory, setLocationHistory] = useState<EnhancedLocationData[]>([])

  // 추적 모드
  const [currentMode, setCurrentMode] = useState<TrackingMode>('fusion')
  const [environment, setEnvironment] = useState<EnvironmentType>('unknown')

  // 통계
  const [statistics, setStatistics] = useState<any>(null)

  // 최적화 도구
  const [batteryOptimizer, setBatteryOptimizer] = useState<BatteryOptimizer | null>(null)
  const [anomalyDetector, setAnomalyDetector] = useState<AnomalyDetector | null>(null)
  const [performanceMonitor, setPerformanceMonitor] = useState<PerformanceMonitor | null>(null)

  // 상태
  const [batteryLevel, setBatteryLevel] = useState<number>(1.0)
  const [anomalies, setAnomalies] = useState<AnomalyDetection[]>([])
  const [performanceScore, setPerformanceScore] = useState<number>(0)

  // 로그
  const [logs, setLogs] = useState<string[]>([])

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev.slice(-50), `[${timestamp}] ${message}`])
  }

  // 추적 시작
  const handleStartTracking = async () => {
    addLog('추적 시작 중...')

    // Enhanced Location Tracker 생성
    const newTracker = new EnhancedLocationTracker({
      mode: currentMode,
      autoModeSwitch: true,
      gpsUpdateInterval: 5000,
      enableHighAccuracy: true
    })

    // 콜백 등록
    newTracker.onLocationUpdate((location) => {
      setLocationData(location)
      setLocationHistory(prev => [...prev.slice(-20), location])
      addLog(`위치 업데이트: (${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}) [${location.trackingMode}/${location.environment}]`)

      // 이상 감지
      if (anomalyDetector) {
        const anomaly = anomalyDetector.check({
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          timestamp: location.timestamp
        }, location.confidence)

        if (anomaly.isAnomaly) {
          setAnomalies(prev => [...prev.slice(-5), anomaly])
          addLog(`⚠️ 이상 감지: ${anomaly.description}`)
        }
      }

      // 성능 모니터 업데이트
      if (performanceMonitor && location.gpsWeight !== undefined) {
        performanceMonitor.recordFusion({
          gpsWeight: location.gpsWeight,
          pdrWeight: location.pdrWeight ?? 0
        })
      }
    })

    newTracker.onModeChange((newMode, reason) => {
      setCurrentMode(newMode)
      addLog(`모드 변경: ${newMode} (${reason})`)
    })

    newTracker.onEnvironmentChange((env) => {
      setEnvironment(env)
      addLog(`환경 변경: ${env}`)
    })

    newTracker.onError((error) => {
      addLog(`❌ 에러: ${error}`)
    })

    // 배터리 최적화 초기화
    const battery = new BatteryOptimizer({ mode: 'balanced' })
    const batteryInit = await battery.initialize()
    if (batteryInit) {
      battery.startMonitoring()
      battery.onModeChange((mode, reason) => {
        addLog(`배터리 모드 변경: ${mode} (${reason})`)
      })
      setBatteryOptimizer(battery)

      const status = await battery.getBatteryStatus()
      if (status) {
        setBatteryLevel(status.level)
      }
    }

    // 이상 감지기 초기화
    const anomaly = new AnomalyDetector()
    anomaly.onAnomaly((detection) => {
      addLog(`⚠️ 이상: ${detection.description}`)
    })
    setAnomalyDetector(anomaly)

    // 성능 모니터 초기화
    const perf = new PerformanceMonitor()
    perf.start()
    setPerformanceMonitor(perf)

    // 추적 시작
    const started = await newTracker.startTracking()

    if (started) {
      setTracker(newTracker)
      setIsTracking(true)
      addLog('✅ 추적 시작 성공')
    } else {
      addLog('❌ 추적 시작 실패')
    }
  }

  // 추적 중지
  const handleStopTracking = () => {
    if (tracker) {
      tracker.stopTracking()
      tracker.destroy()
      setTracker(null)
      setIsTracking(false)
      addLog('⏸️ 추적 중지')
    }

    if (batteryOptimizer) {
      batteryOptimizer.stopMonitoring()
      batteryOptimizer.destroy()
      setBatteryOptimizer(null)
    }

    if (performanceMonitor) {
      const report = performanceMonitor.generateReport()
      setPerformanceScore(report.overallScore)
      performanceMonitor.stop()
      performanceMonitor.destroy()
      setPerformanceMonitor(null)
      addLog(`📊 성능 점수: ${report.overallScore.toFixed(0)}/100`)
    }
  }

  // 모드 전환
  const handleSwitchMode = (newMode: TrackingMode) => {
    if (tracker) {
      tracker.switchMode(newMode)
      addLog(`모드 전환 요청: ${newMode}`)
    }
  }

  // 통계 업데이트
  useEffect(() => {
    if (isTracking && tracker) {
      const interval = setInterval(() => {
        const stats = tracker.getStatistics()
        setStatistics(stats)
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [isTracking, tracker])

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            PDR 시스템 E2E 테스트
          </h1>
          <p className="text-gray-600">
            GPS + PDR 융합 추적 시스템 통합 테스트
          </p>
        </div>

        {/* 제어 패널 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">제어 패널</h2>

          <div className="space-y-4">
            {/* 추적 버튼 */}
            <div className="flex gap-3">
              {!isTracking ? (
                <button
                  data-testid="start-tracking"
                  onClick={handleStartTracking}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                >
                  ▶ 추적 시작
                </button>
              ) : (
                <button
                  data-testid="stop-tracking"
                  onClick={handleStopTracking}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                >
                  ⏹ 추적 중지
                </button>
              )}
            </div>

            {/* 모드 전환 */}
            {isTracking && (
              <div className="flex gap-2">
                <button
                  data-testid="mode-gps-only"
                  onClick={() => handleSwitchMode('gps-only')}
                  className={`px-4 py-2 rounded ${currentMode === 'gps-only' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                >
                  GPS 전용
                </button>
                <button
                  data-testid="mode-pdr-only"
                  onClick={() => handleSwitchMode('pdr-only')}
                  className={`px-4 py-2 rounded ${currentMode === 'pdr-only' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                >
                  PDR 전용
                </button>
                <button
                  data-testid="mode-fusion"
                  onClick={() => handleSwitchMode('fusion')}
                  className={`px-4 py-2 rounded ${currentMode === 'fusion' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                >
                  융합 모드
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 현재 상태 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4" data-testid="status-mode">
            <div className="text-sm text-gray-500">추적 모드</div>
            <div className="text-2xl font-bold text-blue-600">{currentMode}</div>
          </div>

          <div className="bg-white rounded-lg shadow p-4" data-testid="status-environment">
            <div className="text-sm text-gray-500">환경</div>
            <div className="text-2xl font-bold text-green-600">{environment}</div>
          </div>

          <div className="bg-white rounded-lg shadow p-4" data-testid="status-battery">
            <div className="text-sm text-gray-500">배터리</div>
            <div className="text-2xl font-bold text-yellow-600">{(batteryLevel * 100).toFixed(0)}%</div>
          </div>

          <div className="bg-white rounded-lg shadow p-4" data-testid="status-performance">
            <div className="text-sm text-gray-500">성능 점수</div>
            <div className="text-2xl font-bold text-purple-600">{performanceScore.toFixed(0)}/100</div>
          </div>
        </div>

        {/* 위치 데이터 */}
        {locationData && (
          <div className="bg-white rounded-lg shadow p-6" data-testid="location-data">
            <h2 className="text-xl font-bold mb-4">현재 위치</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">위도:</span>
                <span className="ml-2 font-mono">{locationData.latitude.toFixed(6)}</span>
              </div>
              <div>
                <span className="text-gray-500">경도:</span>
                <span className="ml-2 font-mono">{locationData.longitude.toFixed(6)}</span>
              </div>
              <div>
                <span className="text-gray-500">정확도:</span>
                <span className="ml-2 font-mono">{locationData.accuracy.toFixed(1)}m</span>
              </div>
              <div>
                <span className="text-gray-500">신뢰도:</span>
                <span className="ml-2 font-mono">{(locationData.confidence * 100).toFixed(0)}%</span>
              </div>
              {locationData.gpsWeight !== undefined && (
                <>
                  <div>
                    <span className="text-gray-500">GPS 가중치:</span>
                    <span className="ml-2 font-mono">{(locationData.gpsWeight * 100).toFixed(0)}%</span>
                  </div>
                  <div>
                    <span className="text-gray-500">PDR 가중치:</span>
                    <span className="ml-2 font-mono">{(locationData.pdrWeight! * 100).toFixed(0)}%</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* 통계 */}
        {statistics && (
          <div className="bg-white rounded-lg shadow p-6" data-testid="statistics">
            <h2 className="text-xl font-bold mb-4">통계</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-gray-500">GPS 업데이트</div>
                <div className="text-lg font-bold">{statistics.gpsUpdateCount}</div>
              </div>
              <div>
                <div className="text-gray-500">PDR 업데이트</div>
                <div className="text-lg font-bold">{statistics.pdrUpdateCount}</div>
              </div>
              <div>
                <div className="text-gray-500">융합 횟수</div>
                <div className="text-lg font-bold">{statistics.fusionCount}</div>
              </div>
              <div>
                <div className="text-gray-500">재보정 횟수</div>
                <div className="text-lg font-bold">{statistics.recalibrationCount}</div>
              </div>
            </div>
          </div>
        )}

        {/* 이상 감지 */}
        {anomalies.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6" data-testid="anomalies">
            <h2 className="text-xl font-bold mb-4">이상 감지</h2>
            <div className="space-y-2">
              {anomalies.map((anomaly, index) => (
                <div key={index} className="p-3 bg-red-50 border border-red-200 rounded">
                  <div className="font-medium text-red-700">{anomaly.type}</div>
                  <div className="text-sm text-red-600">{anomaly.description}</div>
                  <div className="text-xs text-gray-500">심각도: {(anomaly.severity * 100).toFixed(0)}%</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 로그 */}
        <div className="bg-white rounded-lg shadow p-6" data-testid="logs">
          <h2 className="text-xl font-bold mb-4">로그</h2>
          <div className="bg-gray-50 rounded p-4 h-64 overflow-y-auto font-mono text-xs">
            {logs.map((log, index) => (
              <div key={index} className="mb-1">{log}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
