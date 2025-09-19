import { SupabaseClient } from '@supabase/supabase-js'

const AUTO_END_AFTER_MS = 2 * 60 * 60 * 1000 // 2시간

export interface SessionRow {
  id: string
  status: string
  created_at?: string | null
  updated_at?: string | null
  course_id: string
}

export interface FinalizeResult {
  stats: {
    total: number
    present: number
    late: number
    absent: number
    left_early: number
    attendance_rate: number
  }
}

export const AUTO_END_AFTER_HOURS = 2

export function calculateAutoEndAt(createdAt?: string | null) {
  if (!createdAt) {
    return { autoEndAt: null, isOverdue: false }
  }

  const createdAtMs = Date.parse(createdAt)
  if (Number.isNaN(createdAtMs)) {
    return { autoEndAt: null, isOverdue: false }
  }

  const autoEndAtMs = createdAtMs + AUTO_END_AFTER_MS
  return {
    autoEndAt: new Date(autoEndAtMs).toISOString(),
    isOverdue: Date.now() >= autoEndAtMs
  }
}

export async function finalizeAttendanceRecords(
  supabase: SupabaseClient,
  sessionId: string
): Promise<FinalizeResult> {
  const { data: attendances } = await supabase
    .from('attendances')
    .select('id, status')
    .eq('session_id', sessionId)

  const attendanceList = Array.isArray(attendances) ? attendances : []

  const stats = {
    total: attendanceList.length,
    present: attendanceList.filter((a) => a.status === 'present').length,
    late: attendanceList.filter((a) => a.status === 'late').length,
    absent: attendanceList.filter((a) => a.status === 'absent').length,
    left_early: attendanceList.filter((a) => a.status === 'left_early').length,
    attendance_rate: 0
  }

  stats.attendance_rate = stats.total > 0
    ? Math.round(((stats.present + stats.late) / stats.total) * 100)
    : 0

  if (stats.present > 0) {
    await supabase
      .from('attendances')
      .update({
        check_out_time: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('session_id', sessionId)
      .eq('status', 'present')
  }

  return { stats }
}

export async function markSessionEnded(
  supabase: SupabaseClient,
  sessionId: string
): Promise<{ endedAt: string | null }> {
  const endedAt = new Date().toISOString()

  await supabase
    .from('class_sessions')
    .update({
      status: 'ended',
      updated_at: endedAt
    })
    .eq('id', sessionId)

  return { endedAt }
}

export async function autoEndSessionIfNeeded<T extends SessionRow>(
  supabase: SupabaseClient,
  session: T
): Promise<{
  session: T
  autoEnded: boolean
  autoEndAt: string | null
  finalizeResult?: FinalizeResult
}> {
  const { autoEndAt, isOverdue } = calculateAutoEndAt(session.created_at)

  if (!isOverdue || session.status === 'ended') {
    return { session, autoEnded: false, autoEndAt }
  }

  await markSessionEnded(supabase, session.id)
  const finalizeResult = await finalizeAttendanceRecords(supabase, session.id)

  const updatedSession = {
    ...session,
    status: 'ended',
    updated_at: new Date().toISOString()
  }

  return {
    session: updatedSession,
    autoEnded: true,
    autoEndAt,
    finalizeResult
  }
}
