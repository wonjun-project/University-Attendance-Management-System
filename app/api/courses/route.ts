import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

// GET - 교수의 강의 목록 조회
export async function GET() {
  try {
    // Create supabase client inside the function to avoid build-time errors
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const user = getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.userType !== 'professor') {
      return NextResponse.json({ error: 'Only professors can view courses' }, { status: 403 })
    }

    const { data: courses, error } = await supabase
      .from('courses')
      .select(`
        id,
        name,
        course_code,
        classroom_location,
        schedule,
        created_at,
        class_sessions (
          id,
          date,
          status
        )
      `)
      .eq('professor_id', user.userId)
      .order('name')

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to fetch courses' }, { status: 500 })
    }

    // Format the courses data
    const formattedCourses = courses?.map(course => ({
      id: course.id,
      name: course.name,
      courseCode: course.course_code,
      description: null, // No description column in current schema
      schedule: Array.isArray(course.schedule) ? course.schedule.map((s: any) => 
        `${['일','월','화','수','목','금','토'][s.day_of_week]} ${s.start_time}-${s.end_time}`
      ).join(', ') : null,
      location: course.classroom_location?.displayName || '위치 정보 없음',
      locationLatitude: course.classroom_location?.latitude || null,
      locationLongitude: course.classroom_location?.longitude || null,
      locationRadius: course.classroom_location?.radius || 50,
      createdAt: course.created_at,
      totalSessions: course.class_sessions?.length || 0,
      activeSessions: course.class_sessions?.filter(s => s.status === 'active').length || 0
    }))

    return NextResponse.json({
      success: true,
      courses: formattedCourses || []
    })

  } catch (error: any) {
    console.error('Get courses error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

// POST - 새 강의 생성
export async function POST(request: NextRequest) {
  try {
    // Create supabase client inside the function to avoid build-time errors
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const user = getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.userType !== 'professor') {
      return NextResponse.json({ error: 'Only professors can create courses' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, schedule, location, locationLatitude, locationLongitude, locationRadius } = body

    // Validate required fields
    if (!name) {
      return NextResponse.json({ 
        error: 'Course name is required' 
      }, { status: 400 })
    }

    // Generate automatic course code based on course name
    const generateCourseCode = (courseName: string): string => {
      // Remove common Korean words and extract main keywords
      const cleaned = courseName
        .replace(/과학|이론|개론|실습|실험|연구|특론|세미나/g, '')
        .replace(/\s+/g, '')
      
      // Take first 2-3 characters and add random number
      const prefix = cleaned.substring(0, 3).toUpperCase()
      const timestamp = Date.now().toString().slice(-3)
      return `${prefix}${timestamp}`
    }

    let courseCode = generateCourseCode(name)
    
    // Ensure unique course code for this professor
    let attempts = 0
    while (attempts < 5) {
      const { data: existingCourse } = await supabase
        .from('courses')
        .select('id')
        .eq('professor_id', user.userId)
        .eq('course_code', courseCode)
        .single()

      if (!existingCourse) break
      
      // Generate new code if conflict
      courseCode = generateCourseCode(name) + attempts
      attempts++
    }

    // Create new course
    const { data: newCourse, error: createError } = await supabase
      .from('courses')
      .insert({
        professor_id: user.userId,
        name,
        course_code: courseCode,
        classroom_location: locationLatitude && locationLongitude ? {
          latitude: locationLatitude,
          longitude: locationLongitude,
          radius: locationRadius || 50,
          displayName: location || '설정된 위치'
        } : null,
        schedule: schedule && schedule.trim() ? [{
          day_of_week: 2, // Default Tuesday  
          start_time: '09:00',
          end_time: '10:30'
        }] : [{
          day_of_week: 2, // Default Tuesday
          start_time: '09:00', 
          end_time: '10:30'
        }]
      })
      .select()
      .single()

    if (createError) {
      console.error('Create course error:', createError)
      return NextResponse.json({ error: 'Failed to create course' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      course: {
        id: newCourse.id,
        name: newCourse.name,
        courseCode: newCourse.course_code,
        description: null, // No description in current schema
        schedule: Array.isArray(newCourse.schedule) ? newCourse.schedule.map((s: any) => 
          `${['일','월','화','수','목','금','토'][s.day_of_week]} ${s.start_time}-${s.end_time}`
        ).join(', ') : null,
        location: newCourse.classroom_location?.displayName || '설정된 위치',
        locationLatitude: newCourse.classroom_location?.latitude || null,
        locationLongitude: newCourse.classroom_location?.longitude || null,
        locationRadius: newCourse.classroom_location?.radius || 50,
        createdAt: newCourse.created_at
      }
    })

  } catch (error: any) {
    console.error('Create course error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}