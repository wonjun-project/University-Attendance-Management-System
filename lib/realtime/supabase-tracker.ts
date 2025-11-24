/**
 * Supabase Realtime 추적 시스템
 *
 * 기능:
 * - 실시간 출석 상태 변화 감지
 * - 세션 종료 감지 및 자동 처리
 * - 위치 로그 실시간 모니터링
 * - 교수/학생별 맞춤형 실시간 구독
 */

import { supabase } from '@/lib/supabase'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

export interface AttendanceUpdate {
  id: string;
  student_id: string;
  session_id: string;
  status: 'present' | 'absent' | 'late' | 'left_early';
  check_in_time?: string;
  check_out_time?: string;
  location_verified: boolean;
  updated_at: string;
}

export interface SessionUpdate {
  id: string;
  course_id: string;
  status: 'scheduled' | 'active' | 'ended';
  updated_at: string;
}

export interface LocationLogUpdate {
  id: string;
  attendance_id: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string;
  is_valid: boolean;
}

export type AttendanceCallback = (payload: RealtimePostgresChangesPayload<AttendanceUpdate>) => void;
export type SessionCallback = (payload: RealtimePostgresChangesPayload<SessionUpdate>) => void;
export type LocationCallback = (payload: RealtimePostgresChangesPayload<LocationLogUpdate>) => void;

export class SupabaseRealtimeTracker {
  private channels: Map<string, RealtimeChannel> = new Map();
  private isConnected = false;

  /**
   * 교수용 - 특정 세션의 모든 출석 상태 실시간 구독
   */
  subscribeToSessionAttendance(
    sessionId: string,
    onAttendanceUpdate: AttendanceCallback,
    onError?: (error: unknown) => void
  ): string {
    const channelName = `session-attendance-${sessionId}`;

    // 기존 채널이 이미 구독 중이라면 재사용
    if (this.channels.has(channelName)) {
      console.log('⚠️ 이미 구독 중인 채널:', channelName);
      return channelName;
    }

    console.log('🔔 세션 출석 상태 실시간 구독 시작:', { sessionId, channelName });

    const channel = supabase
      .channel(channelName, {
        config: {
          broadcast: { self: true },
          presence: { key: '' },
        },
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendances',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          console.log('📊 출석 상태 변화 감지:', { sessionId, event: payload.eventType, new: payload.new });
          onAttendanceUpdate(payload as RealtimePostgresChangesPayload<AttendanceUpdate>);
        }
      )
      .subscribe((status, err) => {
        console.log('📡 Realtime 구독 상태 변경:', { channelName, status, error: err });

        if (status === 'SUBSCRIBED') {
          console.log('✅ 세션 출석 구독 성공:', { sessionId, channelName });
          this.isConnected = true;
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ 세션 출석 구독 오류:', { sessionId, channelName, error: err });
          if (onError) {
            onError(err || 'Channel subscription error');
          }
          // 에러 발생 시 채널 제거
          this.unsubscribe(channelName);
        } else if (status === 'TIMED_OUT') {
          console.error('⏱️ 세션 출석 구독 타임아웃:', { sessionId, channelName });
          if (onError) {
            onError('Channel subscription timed out');
          }
          // 타임아웃 시 채널 제거
          this.unsubscribe(channelName);
        } else if (status === 'CLOSED') {
          console.log('🔒 세션 출석 구독 종료:', { sessionId, channelName });
        }
      });

    this.channels.set(channelName, channel);
    return channelName;
  }

  /**
   * 교수용 - 특정 세션의 위치 로그 실시간 구독
   */
  subscribeToSessionLocationLogs(
    sessionId: string,
    onLocationUpdate: LocationCallback,
    onError?: (error: unknown) => void
  ): string {
    const channelName = `session-locations-${sessionId}`;

    // 기존 채널이 있다면 제거
    this.unsubscribe(channelName);

    console.log('📍 세션 위치 로그 실시간 구독 시작:', sessionId);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'location_logs',
          // location_logs 테이블에서 session_id로 필터링하려면 JOIN이 필요하므로
          // 일단 모든 INSERT를 감지하고 클라이언트에서 필터링
        },
        async (payload) => {
          // 해당 attendance_id가 이 세션에 속하는지 확인
          const { data: attendance } = await supabase
            .from('attendances')
            .select('session_id')
            .eq('id', payload.new.attendance_id)
            .single();

          if (attendance?.session_id === sessionId) {
            console.log('📍 위치 로그 업데이트 감지:', payload);
            onLocationUpdate(payload as RealtimePostgresChangesPayload<LocationLogUpdate>);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ 세션 위치 로그 구독 성공:', sessionId);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ 세션 위치 로그 구독 오류');
          if (onError) onError('Channel subscription error');
        }
      });

    this.channels.set(channelName, channel);
    return channelName;
  }

  /**
   * 학생용 - 특정 세션 상태 변화 구독 (세션 종료 감지용)
   */
  subscribeToSessionStatus(
    sessionId: string,
    onSessionUpdate: SessionCallback,
    onError?: (error: unknown) => void
  ): string {
    const channelName = `session-status-${sessionId}`;

    // 기존 채널이 있다면 제거
    this.unsubscribe(channelName);

    console.log('🎓 세션 상태 실시간 구독 시작:', sessionId);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'class_sessions',
          filter: `id=eq.${sessionId}`
        },
        (payload) => {
          console.log('🎓 세션 상태 변화 감지:', payload);
          onSessionUpdate(payload as RealtimePostgresChangesPayload<SessionUpdate>);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ 세션 상태 구독 성공:', sessionId);
          this.isConnected = true;
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ 세션 상태 구독 오류');
          if (onError) onError('Channel subscription error');
        }
      });

    this.channels.set(channelName, channel);
    return channelName;
  }

  /**
   * 학생용 - 자신의 출석 상태 변화 구독
   */
  subscribeToMyAttendance(
    attendanceId: string,
    onAttendanceUpdate: AttendanceCallback,
    onError?: (error: unknown) => void
  ): string {
    const channelName = `my-attendance-${attendanceId}`;

    // 기존 채널이 있다면 제거
    this.unsubscribe(channelName);

    console.log('👤 개인 출석 상태 실시간 구독 시작:', attendanceId);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'attendances',
          filter: `id=eq.${attendanceId}`
        },
        (payload) => {
          console.log('👤 개인 출석 상태 변화 감지:', payload);
          onAttendanceUpdate(payload as RealtimePostgresChangesPayload<AttendanceUpdate>);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ 개인 출석 구독 성공:', attendanceId);
          this.isConnected = true;
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ 개인 출석 구독 오류');
          if (onError) onError('Channel subscription error');
        }
      });

    this.channels.set(channelName, channel);
    return channelName;
  }

  /**
   * 교수용 - 실시간 출석 통계 구독
   */
  subscribeToAttendanceStats(
    sessionId: string,
    onStatsUpdate: (stats: {
      total: number;
      present: number;
      late: number;
      absent: number;
      left_early: number;
      attendance_rate: number;
    }) => void,
    onError?: (error: unknown) => void
  ): string {
    const channelName = `attendance-stats-${sessionId}`;

    // 기존 채널이 있다면 제거
    this.unsubscribe(channelName);

    console.log('📈 출석 통계 실시간 구독 시작:', sessionId);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendances',
          filter: `session_id=eq.${sessionId}`
        },
        async (payload) => {
          console.log('📈 출석 통계 업데이트 감지:', payload);

          // 실시간 통계 계산
          const { data: attendances, error } = await supabase
            .from('attendances')
            .select('status')
            .eq('session_id', sessionId);

          if (error) {
            console.error('📈 출석 통계 조회 실패:', error);
            return;
          }

          const stats = {
            total: attendances.length,
            present: attendances.filter(a => a.status === 'present').length,
            late: attendances.filter(a => a.status === 'late').length,
            absent: attendances.filter(a => a.status === 'absent').length,
            left_early: attendances.filter(a => a.status === 'left_early').length,
            attendance_rate: 0
          };

          if (stats.total > 0) {
            stats.attendance_rate = Math.round(
              ((stats.present + stats.late) / stats.total) * 100
            );
          }

          onStatsUpdate(stats);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ 출석 통계 구독 성공:', sessionId);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ 출석 통계 구독 오류');
          if (onError) onError('Channel subscription error');
        }
      });

    this.channels.set(channelName, channel);
    return channelName;
  }

  /**
   * 특정 채널 구독 해제
   */
  unsubscribe(channelName: string): void {
    const channel = this.channels.get(channelName);
    if (channel) {
      console.log('🔕 실시간 구독 해제:', channelName);
      supabase.removeChannel(channel);
      this.channels.delete(channelName);
    }
  }

  /**
   * 모든 채널 구독 해제
   */
  unsubscribeAll(): void {
    console.log('🔕 모든 실시간 구독 해제');

    this.channels.forEach((channel, channelName) => {
      console.log('🔕 채널 해제:', channelName);
      supabase.removeChannel(channel);
    });

    this.channels.clear();
    this.isConnected = false;
  }

  /**
   * 연결 상태 확인
   */
  isRealtimeConnected(): boolean {
    return this.isConnected;
  }

  /**
   * 활성 채널 목록 반환
   */
  getActiveChannels(): string[] {
    return Array.from(this.channels.keys());
  }

  /**
   * 연결 상태 및 채널 정보 반환
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      activeChannels: this.getActiveChannels(),
      channelCount: this.channels.size
    };
  }
}

// Singleton 인스턴스
let realtimeTrackerInstance: SupabaseRealtimeTracker | null = null;

export function getRealtimeTracker(): SupabaseRealtimeTracker {
  if (!realtimeTrackerInstance) {
    realtimeTrackerInstance = new SupabaseRealtimeTracker();
  }
  return realtimeTrackerInstance;
}

/**
 * 컴포넌트 언마운트 시 정리 작업을 위한 훅
 */
export function useRealtimeCleanup() {
  return () => {
    const tracker = getRealtimeTracker();
    tracker.unsubscribeAll();
  };
}