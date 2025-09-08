import express from 'express';
import { supabase } from '../config/supabase';
import { authenticateToken, requireProfessor, requireStudent } from '../middleware/auth';

const router = express.Router();

/**
 * GET /api/courses
 * 강의 목록 조회
 * - 교수: 본인이 담당하는 강의 목록
 * - 학생: 수강 중인 강의 목록
 */
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { userId, role } = req.user!;

    if (role === 'professor') {
      // 교수의 담당 강의 목록
      const { data: courses, error } = await supabase
        .from('courses')
        .select(`
          id,
          course_code,
          name,
          semester,
          room,
          day_of_week,
          start_time,
          end_time,
          gps_latitude,
          gps_longitude,
          gps_radius,
          created_at
        `)
        .eq('professor_id', userId)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;

      res.status(200).json({
        success: true,
        data: { courses },
        message: '담당 강의 목록을 조회했습니다.',
        timestamp: new Date().toISOString(),
      });

    } else if (role === 'student') {
      // 학생의 수강 강의 목록
      const { data: courses, error } = await supabase
        .from('enrollments')
        .select(`
          course_id,
          courses (
            id,
            course_code,
            name,
            semester,
            room,
            day_of_week,
            start_time,
            end_time,
            users (
              name
            )
          )
        `)
        .eq('student_id', userId);

      if (error) throw error;

      const formattedCourses = courses.map(enrollment => ({
        ...enrollment.courses,
        professorName: enrollment.courses.users?.name
      }));

      res.status(200).json({
        success: true,
        data: { courses: formattedCourses },
        message: '수강 중인 강의 목록을 조회했습니다.',
        timestamp: new Date().toISOString(),
      });
    }

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/courses
 * 새 강의 생성 (교수 전용)
 */
router.post('/', authenticateToken, requireProfessor, async (req, res, next) => {
  try {
    const professorId = req.user!.userId;
    const {
      courseCode,
      name,
      semester,
      room,
      dayOfWeek,
      startTime,
      endTime,
      gpsLatitude,
      gpsLongitude,
      gpsRadius = 50
    } = req.body;

    // 기본 입력 검증
    if (!courseCode || !name || !semester || !dayOfWeek || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        error: {
          message: '필수 필드가 누락되었습니다.',
          statusCode: 400,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // 강의 코드 중복 확인 (같은 학기)
    const { data: existingCourse } = await supabase
      .from('courses')
      .select('id')
      .eq('course_code', courseCode)
      .eq('semester', semester)
      .single();

    if (existingCourse) {
      return res.status(409).json({
        success: false,
        error: {
          message: '같은 학기에 이미 존재하는 강의 코드입니다.',
          statusCode: 409,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // 새 강의 생성
    const { data: newCourse, error } = await supabase
      .from('courses')
      .insert([{
        course_code: courseCode,
        name,
        professor_id: professorId,
        semester,
        room,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        gps_latitude: gpsLatitude,
        gps_longitude: gpsLongitude,
        gps_radius: gpsRadius
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data: { course: newCourse },
      message: '새 강의가 생성되었습니다.',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/courses/:courseId
 * 특정 강의 상세 정보 조회
 */
router.get('/:courseId', authenticateToken, async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { userId, role } = req.user!;

    // 강의 정보 조회
    const { data: course, error } = await supabase
      .from('courses')
      .select(`
        *,
        users (
          name
        )
      `)
      .eq('id', courseId)
      .single();

    if (error || !course) {
      return res.status(404).json({
        success: false,
        error: {
          message: '강의를 찾을 수 없습니다.',
          statusCode: 404,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // 접근 권한 확인
    if (role === 'professor' && course.professor_id !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          message: '접근 권한이 없습니다.',
          statusCode: 403,
        },
        timestamp: new Date().toISOString(),
      });
    }

    if (role === 'student') {
      // 학생의 경우 수강 중인 강의인지 확인
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('id')
        .eq('student_id', userId)
        .eq('course_id', courseId)
        .single();

      if (!enrollment) {
        return res.status(403).json({
          success: false,
          error: {
            message: '수강 중인 강의가 아닙니다.',
            statusCode: 403,
          },
          timestamp: new Date().toISOString(),
        });
      }
    }

    res.status(200).json({
      success: true,
      data: { 
        course: {
          ...course,
          professorName: course.users?.name
        }
      },
      message: '강의 정보를 조회했습니다.',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/courses/:courseId
 * 강의 정보 수정 (교수 전용)
 */
router.put('/:courseId', authenticateToken, requireProfessor, async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const professorId = req.user!.userId;
    const updateData = req.body;

    // 강의 소유권 확인
    const { data: course } = await supabase
      .from('courses')
      .select('professor_id')
      .eq('id', courseId)
      .single();

    if (!course || course.professor_id !== professorId) {
      return res.status(403).json({
        success: false,
        error: {
          message: '수정 권한이 없습니다.',
          statusCode: 403,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // 강의 정보 업데이트
    const { data: updatedCourse, error } = await supabase
      .from('courses')
      .update(updateData)
      .eq('id', courseId)
      .eq('professor_id', professorId)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: { course: updatedCourse },
      message: '강의 정보가 수정되었습니다.',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/courses/:courseId
 * 강의 삭제 (교수 전용)
 */
router.delete('/:courseId', authenticateToken, requireProfessor, async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const professorId = req.user!.userId;

    // 강의 삭제 (CASCADE로 관련 데이터도 함께 삭제됨)
    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', courseId)
      .eq('professor_id', professorId);

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: '강의가 삭제되었습니다.',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/courses/:courseId/students
 * 강의 수강생 목록 조회 (교수 전용)
 */
router.get('/:courseId/students', authenticateToken, requireProfessor, async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const professorId = req.user!.userId;

    // 강의 소유권 확인
    const { data: course } = await supabase
      .from('courses')
      .select('professor_id')
      .eq('id', courseId)
      .single();

    if (!course || course.professor_id !== professorId) {
      return res.status(403).json({
        success: false,
        error: {
          message: '조회 권한이 없습니다.',
          statusCode: 403,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // 수강생 목록 조회
    const { data: enrollments, error } = await supabase
      .from('enrollments')
      .select(`
        enrolled_at,
        users (
          id,
          name,
          student_id,
          email
        )
      `)
      .eq('course_id', courseId);

    if (error) throw error;

    const students = enrollments.map(enrollment => ({
      ...enrollment.users,
      enrolledAt: enrollment.enrolled_at
    }));

    res.status(200).json({
      success: true,
      data: { students },
      message: '수강생 목록을 조회했습니다.',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/courses/:courseId/enroll
 * 수강신청 (학생 전용)
 */
router.post('/:courseId/enroll', authenticateToken, requireStudent, async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const studentId = req.user!.userId;

    // 강의 존재 확인
    const { data: course } = await supabase
      .from('courses')
      .select('id, name')
      .eq('id', courseId)
      .single();

    if (!course) {
      return res.status(404).json({
        success: false,
        error: {
          message: '강의를 찾을 수 없습니다.',
          statusCode: 404,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // 이미 수강신청했는지 확인
    const { data: existingEnrollment } = await supabase
      .from('enrollments')
      .select('id')
      .eq('student_id', studentId)
      .eq('course_id', courseId)
      .single();

    if (existingEnrollment) {
      return res.status(409).json({
        success: false,
        error: {
          message: '이미 수강신청된 강의입니다.',
          statusCode: 409,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // 수강신청 생성
    const { data: newEnrollment, error } = await supabase
      .from('enrollments')
      .insert([{
        student_id: studentId,
        course_id: courseId
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data: { enrollment: newEnrollment },
      message: '수강신청이 완료되었습니다.',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    next(error);
  }
});

export default router;