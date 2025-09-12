import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Create supabase client inside the function to avoid build-time errors
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    // Get current user
    const user = getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.userType !== 'professor') {
      return NextResponse.json({ error: 'Only professors can view attendance statistics' }, { status: 403 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const courseId = searchParams.get('courseId')
    const period = searchParams.get('period') || 'all' // week, month, semester, all
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Base query for professor's courses
    let coursesQuery = supabase
      .from('courses')
      .select(`
        id,
        name,
        course_code,
        class_sessions!inner (
          id,
          date,
          status,
          attendances (
            id,
            student_id,
            status,
            check_in_time,
            location_verified,
            students (
              student_id,
              name
            )
          )
        )
      `)
      .eq('professor_id', user.userId)

    // Apply course filter if specified
    if (courseId) {
      coursesQuery = coursesQuery.eq('id', courseId)
    }

    // Apply date filters
    if (startDate && endDate) {
      coursesQuery = coursesQuery
        .gte('class_sessions.date', startDate)
        .lte('class_sessions.date', endDate)
    } else if (period === 'week') {
      const oneWeekAgo = new Date()
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
      coursesQuery = coursesQuery.gte('class_sessions.date', oneWeekAgo.toISOString().split('T')[0])
    } else if (period === 'month') {
      const oneMonthAgo = new Date()
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
      coursesQuery = coursesQuery.gte('class_sessions.date', oneMonthAgo.toISOString().split('T')[0])
    }

    const { data: courses, error: coursesError } = await coursesQuery.order('name')

    if (coursesError) {
      console.error('Database error:', coursesError)
      return NextResponse.json({ error: 'Failed to fetch statistics' }, { status: 500 })
    }

    // Process statistics
    const statistics = {
      overview: {
        totalCourses: courses?.length || 0,
        totalSessions: 0,
        totalStudents: 0,
        overallAttendanceRate: 0
      },
      courseStats: [] as any[],
      studentStats: [] as any[],
      timePatterns: {
        byHour: [] as any[],
        byDayOfWeek: [] as any[],
        byDate: [] as any[]
      },
      trends: {
        attendanceByDate: [] as any[],
        attendanceRateByWeek: [] as any[]
      }
    }

    let totalAttendanceRecords = 0
    let totalPresentRecords = 0
    const studentAttendanceMap = new Map()
    const hourlyAttendance = new Map()
    const dailyAttendance = new Map()
    const dateAttendance = new Map()

    // Process each course
    courses?.forEach(course => {
      const sessions = course.class_sessions || []
      let courseAttendanceTotal = 0
      let coursePresentTotal = 0
      let courseStudents = new Set()

      sessions.forEach((session: any) => {
        statistics.overview.totalSessions++
        const attendances = session.attendances || []
        
        attendances.forEach((attendance: any) => {
          courseAttendanceTotal++
          totalAttendanceRecords++
          courseStudents.add(attendance.student_id)
          
          if (attendance.status === 'present') {
            coursePresentTotal++
            totalPresentRecords++
          }

          // Student-level statistics
          const studentId = attendance.student_id
          if (!studentAttendanceMap.has(studentId)) {
            studentAttendanceMap.set(studentId, {
              studentId,
              name: attendance.students?.name,
              total: 0,
              present: 0,
              late: 0,
              absent: 0
            })
          }
          const studentStat = studentAttendanceMap.get(studentId)
          studentStat.total++
          studentStat[attendance.status]++

          // Time pattern analysis
          if (attendance.check_in_time) {
            const checkInHour = new Date(attendance.check_in_time).getHours()
            hourlyAttendance.set(checkInHour, (hourlyAttendance.get(checkInHour) || 0) + 1)
          }

          // Date pattern analysis
          const sessionDate = new Date(session.date)
          const dayOfWeek = sessionDate.getDay()
          dailyAttendance.set(dayOfWeek, (dailyAttendance.get(dayOfWeek) || 0) + 1)
          
          const dateKey = session.date
          if (!dateAttendance.has(dateKey)) {
            dateAttendance.set(dateKey, { total: 0, present: 0 })
          }
          const dateEntry = dateAttendance.get(dateKey)
          dateEntry.total++
          if (attendance.status === 'present') {
            dateEntry.present++
          }
        })
      })

      // Course statistics
      const courseAttendanceRate = courseAttendanceTotal > 0 ? (coursePresentTotal / courseAttendanceTotal * 100) : 0
      statistics.courseStats.push({
        courseId: course.id,
        courseName: course.name,
        courseCode: course.course_code,
        totalSessions: sessions.length,
        totalStudents: courseStudents.size,
        totalAttendance: courseAttendanceTotal,
        presentCount: coursePresentTotal,
        attendanceRate: Math.round(courseAttendanceRate * 10) / 10
      })
    })

    // Student statistics
    statistics.studentStats = Array.from(studentAttendanceMap.values())
      .map(student => ({
        ...student,
        attendanceRate: student.total > 0 ? Math.round((student.present / student.total * 100) * 10) / 10 : 0
      }))
      .sort((a, b) => b.attendanceRate - a.attendanceRate)

    // Time patterns
    const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']
    statistics.timePatterns.byDayOfWeek = Array.from({ length: 7 }, (_, i) => ({
      day: dayNames[i],
      dayNumber: i,
      count: dailyAttendance.get(i) || 0
    }))

    statistics.timePatterns.byHour = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      count: hourlyAttendance.get(i) || 0
    }))

    // Date trends
    statistics.trends.attendanceByDate = Array.from(dateAttendance.entries())
      .map(([date, data]) => ({
        date,
        attendanceRate: data.total > 0 ? Math.round((data.present / data.total * 100) * 10) / 10 : 0,
        totalStudents: data.total,
        presentStudents: data.present
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Overall statistics
    statistics.overview.totalStudents = studentAttendanceMap.size
    statistics.overview.overallAttendanceRate = totalAttendanceRecords > 0 
      ? Math.round((totalPresentRecords / totalAttendanceRecords * 100) * 10) / 10 
      : 0

    // Weekly trends (group by week)
    const weeklyData = new Map()
    statistics.trends.attendanceByDate.forEach(entry => {
      const date = new Date(entry.date)
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay()) // Start of week (Sunday)
      const weekKey = weekStart.toISOString().split('T')[0]
      
      if (!weeklyData.has(weekKey)) {
        weeklyData.set(weekKey, { total: 0, present: 0 })
      }
      const weekEntry = weeklyData.get(weekKey)
      weekEntry.total += entry.totalStudents
      weekEntry.present += entry.presentStudents
    })

    statistics.trends.attendanceRateByWeek = Array.from(weeklyData.entries())
      .map(([weekStart, data]) => ({
        weekStart,
        attendanceRate: data.total > 0 ? Math.round((data.present / data.total * 100) * 10) / 10 : 0,
        totalStudents: data.total,
        presentStudents: data.present
      }))
      .sort((a, b) => new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime())

    return NextResponse.json({
      success: true,
      statistics,
      period,
      courseId
    })

  } catch (error: any) {
    console.error('Get professor statistics error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}