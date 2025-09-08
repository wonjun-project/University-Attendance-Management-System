import express from 'express';
import { supabase } from '../config/supabase';
import { authenticateToken, requireProfessor, requireStudent } from '../middleware/auth';
import { 
  generateQRCodeString, 
  generateQRCodeImage, 
  validateQRCode,
  calculateExpirationTime,
  isQRCodeExpired 
} from '../utils/qrCode';

const router = express.Router();

/**
 * GET /api/attendance/sessions/:courseId
 * 특정 강의의 출석 세션 목록 조회
 */
router.get('/sessions/:courseId', authenticateToken, async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { userId, role } = req.user!;

    // 접근 권한 확인
    if (role === 'professor') {
      // 교수의 경우 본인 강의인지 확인
      const { data: course } = await supabase
        .from('courses')
        .select('professor_id')
        .eq('id', courseId)
        .single();

      if (!course || course.professor_id !== userId) {
        return res.status(403).json({
          success: false,
          error: {
            message: '접근 권한이 없습니다.',
            statusCode: 403,
          },
          timestamp: new Date().toISOString(),
        });
      }
    } else {
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

    // 출석 세션 목록 조회
    const { data: sessions, error } = await supabase
      .from('attendance_sessions')
      .select('*')
      .eq('course_id', courseId)
      .order('session_date', { ascending: false });

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: { sessions },
      message: '출석 세션 목록을 조회했습니다.',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/attendance/sessions
 * 새 출석 세션 생성 (교수 전용)
 */
router.post('/sessions', authenticateToken, requireProfessor, async (req, res, next) => {
  try {
    const professorId = req.user!.userId;
    const { courseId, sessionDate, authCode } = req.body;

    // 기본 입력 검증
    if (!courseId || !sessionDate) {
      return res.status(400).json({
        success: false,
        error: {
          message: '강의 ID와 날짜는 필수입니다.',
          statusCode: 400,
        },
        timestamp: new Date().toISOString(),
      });
    }

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
          message: '해당 강의에 대한 권한이 없습니다.',
          statusCode: 403,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // 같은 날짜 세션 존재 확인
    const { data: existingSession } = await supabase
      .from('attendance_sessions')
      .select('id')
      .eq('course_id', courseId)
      .eq('session_date', sessionDate)
      .single();

    if (existingSession) {
      return res.status(409).json({
        success: false,
        error: {
          message: '해당 날짜에 이미 출석 세션이 존재합니다.',
          statusCode: 409,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // 고품질 QR 코드 생성
    const qrCodeString = generateQRCodeString(courseId, sessionDate);
    
    // 인증 코드가 없으면 랜덤 생성
    const finalAuthCode = authCode || Math.floor(1000 + Math.random() * 9000).toString();

    // QR 코드와 인증 코드 만료 시간 설정
    const now = new Date();
    const qrExpiresAt = calculateExpirationTime(now, 40); // 40분
    const authExpiresAt = calculateExpirationTime(now, 70); // 70분

    // 출석 세션 생성
    const { data: newSession, error } = await supabase
      .from('attendance_sessions')
      .insert([{
        course_id: courseId,
        session_date: sessionDate,
        qr_code: qrCodeString,
        auth_code: finalAuthCode,
        qr_expires_at: qrExpiresAt.toISOString(),
        auth_expires_at: authExpiresAt.toISOString(),
        is_active: false
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data: { session: newSession },
      message: '출석 세션이 생성되었습니다.',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/attendance/sessions/:sessionId/generate-qr
 * QR 코드 이미지 생성 (교수 전용)
 */
router.post('/sessions/:sessionId/generate-qr', authenticateToken, requireProfessor, async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const professorId = req.user!.userId;
    const { width = 300, height = 300 } = req.body;

    // 세션 소유권 확인
    const { data: session, error: sessionError } = await supabase
      .from('attendance_sessions')
      .select(`
        *,
        courses (
          professor_id,
          name
        )
      `)
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({
        success: false,
        error: {
          message: '출석 세션을 찾을 수 없습니다.',
          statusCode: 404,
        },
        timestamp: new Date().toISOString(),
      });
    }

    if (session.courses.professor_id !== professorId) {
      return res.status(403).json({
        success: false,
        error: {
          message: '해당 세션에 대한 권한이 없습니다.',
          statusCode: 403,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // QR 코드 만료 확인
    if (isQRCodeExpired(new Date(session.qr_expires_at))) {
      return res.status(410).json({
        success: false,
        error: {
          message: 'QR 코드가 만료되었습니다. 새로운 세션을 생성해주세요.',
          statusCode: 410,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // QR 코드 이미지 생성
    const qrCodeImage = await generateQRCodeImage(session.qr_code, {
      width: width,
      height: height,
      margin: 2,
      errorCorrectionLevel: 'M'
    });

    res.status(200).json({
      success: true,
      data: {
        qrCodeImage,
        sessionInfo: {
          id: session.id,
          courseName: session.courses.name,
          sessionDate: session.session_date,
          authCode: session.auth_code,
          expiresAt: session.qr_expires_at,
          isActive: session.is_active
        }
      },
      message: 'QR 코드가 생성되었습니다.',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('QR 코드 생성 오류:', error);
    next(error);
  }
});

/**
 * PUT /api/attendance/sessions/:sessionId/activate
 * 출석 세션 활성화/비활성화 (교수 전용)
 */
router.put('/sessions/:sessionId/activate', authenticateToken, requireProfessor, async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { isActive } = req.body;
    const professorId = req.user!.userId;

    // 세션 소유권 확인
    const { data: session, error: sessionError } = await supabase
      .from('attendance_sessions')
      .select(`
        *,
        courses (
          professor_id
        )
      `)
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({
        success: false,
        error: {
          message: '출석 세션을 찾을 수 없습니다.',
          statusCode: 404,
        },
        timestamp: new Date().toISOString(),
      });
    }

    if (session.courses.professor_id !== professorId) {
      return res.status(403).json({
        success: false,
        error: {
          message: '해당 세션에 대한 권한이 없습니다.',
          statusCode: 403,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // 세션 활성화 상태 업데이트
    const { data: updatedSession, error } = await supabase
      .from('attendance_sessions')
      .update({ is_active: isActive })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: { session: updatedSession },
      message: `출석 세션이 ${isActive ? '활성화' : '비활성화'}되었습니다.`,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/attendance/records/:courseId
 * 특정 강의의 출석 기록 조회
 */
router.get('/records/:courseId', authenticateToken, async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { userId, role } = req.user!;

    if (role === 'professor') {
      // 교수: 해당 강의의 모든 학생 출석 기록
      const { data: course } = await supabase
        .from('courses')
        .select('professor_id')
        .eq('id', courseId)
        .single();

      if (!course || course.professor_id !== userId) {
        return res.status(403).json({
          success: false,
          error: {
            message: '접근 권한이 없습니다.',
            statusCode: 403,
          },
          timestamp: new Date().toISOString(),
        });
      }

      const { data: records, error } = await supabase
        .from('attendance_records')
        .select(`
          *,
          users (
            name,
            student_id
          ),
          attendance_sessions (
            session_date
          )
        `)
        .eq('attendance_sessions.course_id', courseId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      res.status(200).json({
        success: true,
        data: { records },
        message: '출석 기록을 조회했습니다.',
        timestamp: new Date().toISOString(),
      });

    } else {
      // 학생: 본인의 출석 기록만
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

      const { data: records, error } = await supabase
        .from('attendance_records')
        .select(`
          *,
          attendance_sessions (
            session_date,
            course_id
          )
        `)
        .eq('student_id', userId)
        .eq('attendance_sessions.course_id', courseId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      res.status(200).json({
        success: true,
        data: { records },
        message: '출석 기록을 조회했습니다.',
        timestamp: new Date().toISOString(),
      });
    }

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/attendance/check
 * 출석 체크 (1단계: QR 스캔) (학생 전용)
 */
router.post('/check', authenticateToken, requireStudent, async (req, res, next) => {
  try {
    const { qrCode } = req.body;
    const studentId = req.user!.userId;

    if (!qrCode) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'QR 코드가 필요합니다.',
          statusCode: 400,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // QR 코드 형식 검증
    const validation = validateQRCode(qrCode);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: {
          message: validation.error || '잘못된 QR 코드입니다.',
          statusCode: 400,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // QR 코드로 세션 찾기
    const { data: session, error: sessionError } = await supabase
      .from('attendance_sessions')
      .select(`
        *,
        courses (
          id,
          name,
          gps_latitude,
          gps_longitude,
          gps_radius
        )
      `)
      .eq('qr_code', qrCode)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({
        success: false,
        error: {
          message: '유효하지 않은 QR 코드입니다.',
          statusCode: 404,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // 세션 활성 상태 확인
    if (!session.is_active) {
      return res.status(403).json({
        success: false,
        error: {
          message: '출석 체크가 비활성화 상태입니다.',
          statusCode: 403,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // QR 코드 만료 시간 확인
    if (isQRCodeExpired(new Date(session.qr_expires_at))) {
      return res.status(410).json({
        success: false,
        error: {
          message: 'QR 코드가 만료되었습니다.',
          statusCode: 410,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // 수강 중인지 확인
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id')
      .eq('student_id', studentId)
      .eq('course_id', session.courses.id)
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

    // 이미 출석 체크했는지 확인
    const { data: existingRecord } = await supabase
      .from('attendance_records')
      .select('id, status')
      .eq('session_id', session.id)
      .eq('student_id', studentId)
      .single();

    if (existingRecord) {
      return res.status(409).json({
        success: false,
        error: {
          message: '이미 출석 체크를 완료했습니다.',
          statusCode: 409,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // 출석 기록 생성 (1단계: QR 스캔 완료)
    const { data: newRecord, error } = await supabase
      .from('attendance_records')
      .insert([{
        session_id: session.id,
        student_id: studentId,
        status: 'absent', // 아직 완전한 출석이 아님
        qr_scanned_at: new Date().toISOString(),
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: { 
        recordId: newRecord.id,
        sessionId: session.id,
        courseInfo: {
          id: session.courses.id,
          name: session.courses.name,
          gpsLocation: {
            latitude: session.courses.gps_latitude,
            longitude: session.courses.gps_longitude,
            radius: session.courses.gps_radius
          }
        },
        authCode: session.auth_code,
        authExpiresAt: session.auth_expires_at,
        nextStep: 'gps_verification'
      },
      message: 'QR 코드 스캔이 완료되었습니다. GPS 인증을 진행해주세요.',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/attendance/stats/:courseId
 * 강의별 출석 통계 조회
 */
router.get('/stats/:courseId', authenticateToken, async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { userId, role } = req.user!;

    // 권한 확인 로직 (이전과 동일)
    if (role === 'professor') {
      const { data: course } = await supabase
        .from('courses')
        .select('professor_id')
        .eq('id', courseId)
        .single();

      if (!course || course.professor_id !== userId) {
        return res.status(403).json({
          success: false,
          error: { message: '접근 권한이 없습니다.', statusCode: 403 },
          timestamp: new Date().toISOString(),
        });
      }
    }

    // 출석 통계 뷰에서 조회
    const { data: stats, error } = await supabase
      .from('attendance_statistics')
      .select('*')
      .eq('course_id', courseId)
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: { stats },
      message: '출석 통계를 조회했습니다.',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    next(error);
  }
});

export default router;