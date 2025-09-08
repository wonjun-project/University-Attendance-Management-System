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
import {
  validateStudentLocation,
  createLocationLogMetadata,
  getLocationRecommendation
} from '../utils/gps';

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

/**
 * POST /api/attendance/verify-location
 * GPS 위치 검증 (2단계: GPS 인증) (학생 전용)
 */
router.post('/verify-location', authenticateToken, requireStudent, async (req, res, next) => {
  try {
    const { recordId, studentLatitude, studentLongitude, accuracy } = req.body;
    const studentId = req.user!.userId;

    // 기본 입력 검증
    if (!recordId || studentLatitude === undefined || studentLongitude === undefined) {
      return res.status(400).json({
        success: false,
        error: {
          message: '출석 기록 ID와 GPS 좌표가 필요합니다.',
          statusCode: 400,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // 출석 기록 조회
    const { data: record, error: recordError } = await supabase
      .from('attendance_records')
      .select(`
        *,
        attendance_sessions (
          *,
          courses (
            id,
            name,
            gps_latitude,
            gps_longitude,
            gps_radius
          )
        )
      `)
      .eq('id', recordId)
      .eq('student_id', studentId)
      .single();

    if (recordError || !record) {
      return res.status(404).json({
        success: false,
        error: {
          message: '출석 기록을 찾을 수 없습니다.',
          statusCode: 404,
        },
        timestamp: new Date().toISOString(),
      });
    }

    const session = record.attendance_sessions;
    const course = session.courses;

    // 강의실 GPS 좌표 확인
    if (!course.gps_latitude || !course.gps_longitude) {
      return res.status(400).json({
        success: false,
        error: {
          message: '강의실의 GPS 좌표가 설정되지 않았습니다.',
          statusCode: 400,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // GPS 위치 검증
    const validation = validateStudentLocation(
      { latitude: studentLatitude, longitude: studentLongitude },
      { latitude: course.gps_latitude, longitude: course.gps_longitude },
      course.gps_radius || 50,
      accuracy
    );

    // 로그 메타데이터 생성
    const logMetadata = createLocationLogMetadata(
      validation,
      { latitude: studentLatitude, longitude: studentLongitude },
      { latitude: course.gps_latitude, longitude: course.gps_longitude }
    );

    // 시스템 로그 기록
    await supabase
      .from('system_logs')
      .insert([
        {
          user_id: studentId,
          action: 'GPS_VERIFICATION',
          description: `GPS 위치 검증 ${validation.isValid ? '성공' : '실패'}`,
          ip_address: req.ip,
          user_agent: req.get('User-Agent'),
          metadata: logMetadata
        }
      ]);

    if (!validation.isValid) {
      return res.status(403).json({
        success: false,
        error: {
          message: `강의실에서 너무 멀리 떨어져 있습니다. (${validation.distance.toFixed(1)}m, 허용: ${validation.allowedRadius}m)`,
          statusCode: 403,
        },
        data: {
          distance: validation.distance,
          allowedRadius: validation.allowedRadius,
          accuracy: validation.accuracy,
          recommendation: getLocationRecommendation(validation.accuracy)
        },
        timestamp: new Date().toISOString(),
      });
    }

    // GPS 검증 성공 - 출석 기록 업데이트
    const { data: updatedRecord, error: updateError } = await supabase
      .from('attendance_records')
      .update({
        gps_verified_at: new Date().toISOString(),
        gps_latitude: studentLatitude,
        gps_longitude: studentLongitude,
        status: 'present' // GPS까지 통과하면 일단 출석으로 처리
      })
      .eq('id', recordId)
      .select()
      .single();

    if (updateError) throw updateError;

    res.status(200).json({
      success: true,
      data: {
        recordId: updatedRecord.id,
        sessionId: session.id,
        courseInfo: {
          id: course.id,
          name: course.name
        },
        locationVerification: {
          distance: validation.distance,
          allowedRadius: validation.allowedRadius,
          accuracy: validation.accuracy,
          recommendation: getLocationRecommendation(validation.accuracy)
        },
        authCode: session.auth_code,
        authExpiresAt: session.auth_expires_at,
        nextStep: 'auth_code_verification'
      },
      message: 'GPS 위치 인증이 완료되었습니다. 인증 코드를 입력해주세요.',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/attendance/verify-auth-code
 * 인증 코드 검증 (3단계: 최종 인증) (학생 전용)
 */
router.post('/verify-auth-code', authenticateToken, requireStudent, async (req, res, next) => {
  try {
    const { recordId, authCode } = req.body;
    const studentId = req.user!.userId;

    // 기본 입력 검증
    if (!recordId || !authCode) {
      return res.status(400).json({
        success: false,
        error: {
          message: '출석 기록 ID와 인증 코드가 필요합니다.',
          statusCode: 400,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // 출석 기록 조회
    const { data: record, error: recordError } = await supabase
      .from('attendance_records')
      .select(`
        *,
        attendance_sessions (
          *,
          courses (
            id,
            name
          )
        )
      `)
      .eq('id', recordId)
      .eq('student_id', studentId)
      .single();

    if (recordError || !record) {
      return res.status(404).json({
        success: false,
        error: {
          message: '출석 기록을 찾을 수 없습니다.',
          statusCode: 404,
        },
        timestamp: new Date().toISOString(),
      });
    }

    const session = record.attendance_sessions;

    // GPS 인증이 완료되지 않은 경우
    if (!record.gps_verified_at) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'GPS 위치 인증이 먼저 완료되어야 합니다.',
          statusCode: 400,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // 인증 코드 만료 시간 확인
    if (new Date() > new Date(session.auth_expires_at)) {
      return res.status(410).json({
        success: false,
        error: {
          message: '인증 코드가 만료되었습니다.',
          statusCode: 410,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // 인증 코드 확인
    if (authCode.toString() !== session.auth_code) {
      // 시스템 로그 기록
      await supabase
        .from('system_logs')
        .insert([
          {
            user_id: studentId,
            action: 'AUTH_CODE_FAILED',
            description: `잘못된 인증 코드 입력: ${authCode}`,
            ip_address: req.ip,
            user_agent: req.get('User-Agent'),
            metadata: {
              recordId,
              sessionId: session.id,
              providedCode: authCode,
              expectedCode: session.auth_code,
              timestamp: new Date().toISOString()
            }
          }
        ]);

      return res.status(400).json({
        success: false,
        error: {
          message: '잘못된 인증 코드입니다.',
          statusCode: 400,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // 출석 시간 확인하여 지각 여부 결정
    const now = new Date();
    const sessionDate = new Date(session.session_date);
    
    // 수업 시작 후 10분까지는 출석, 그 이후는 지각으로 처리
    // (실제로는 강의 시간표 정보를 활용해야 하지만 여기서는 간단히 처리)
    const isLate = (now.getTime() - sessionDate.getTime()) > (10 * 60 * 1000);
    const finalStatus = isLate ? 'late' : 'present';

    // 최종 출석 기록 업데이트
    const { data: finalRecord, error: updateError } = await supabase
      .from('attendance_records')
      .update({
        auth_verified_at: now.toISOString(),
        status: finalStatus
      })
      .eq('id', recordId)
      .select()
      .single();

    if (updateError) throw updateError;

    // 성공 로그 기록
    await supabase
      .from('system_logs')
      .insert([
        {
          user_id: studentId,
          action: 'ATTENDANCE_COMPLETED',
          description: `출석 완료: ${finalStatus}`,
          ip_address: req.ip,
          user_agent: req.get('User-Agent'),
          metadata: {
            recordId,
            sessionId: session.id,
            courseId: session.courses.id,
            courseName: session.courses.name,
            status: finalStatus,
            completedAt: now.toISOString()
          }
        }
      ]);

    res.status(200).json({
      success: true,
      data: {
        recordId: finalRecord.id,
        status: finalStatus,
        courseInfo: {
          id: session.courses.id,
          name: session.courses.name
        },
        completedAt: finalRecord.auth_verified_at,
        isLate: isLate
      },
      message: `출석 체크가 완료되었습니다! (${finalStatus === 'present' ? '출석' : '지각'})`,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/attendance/my-records
 * 학생의 출석 기록 조회 (본인 기록만)
 */
router.get('/my-records', authenticateToken, requireStudent, async (req, res, next) => {
  try {
    const { userId } = req.user!;
    const { courseId, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('attendance_records')
      .select(`
        id,
        status,
        qr_scanned_at,
        gps_verified_at,
        auth_verified_at,
        created_at,
        attendance_sessions (
          id,
          session_date,
          auth_code,
          courses (
            id,
            name,
            course_code
          )
        )
      `)
      .eq('student_id', userId)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    // 특정 강의 필터링
    if (courseId) {
      query = query.eq('attendance_sessions.course_id', courseId);
    }

    const { data: records, error } = await query;

    if (error) throw error;

    // 출석 통계 계산
    const stats = {
      totalSessions: records?.length || 0,
      presentCount: records?.filter(r => r.status === 'present').length || 0,
      lateCount: records?.filter(r => r.status === 'late').length || 0,
      absentCount: records?.filter(r => r.status === 'absent').length || 0,
    };

    stats.attendanceRate = stats.totalSessions > 0 
      ? Math.round(((stats.presentCount + stats.lateCount) / stats.totalSessions) * 100 * 10) / 10 
      : 0;

    res.status(200).json({
      success: true,
      data: {
        records: records || [],
        stats,
        pagination: {
          limit: Number(limit),
          offset: Number(offset),
          total: records?.length || 0
        }
      },
      message: '출석 기록을 성공적으로 조회했습니다.',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/attendance/my-stats
 * 학생의 출석 통계 조회 (과목별)
 */
router.get('/my-stats', authenticateToken, requireStudent, async (req, res, next) => {
  try {
    const { userId } = req.user!;

    // 과목별 출석 통계
    const { data: courseStats, error } = await supabase
      .from('attendance_records')
      .select(`
        attendance_sessions (
          courses (
            id,
            name,
            course_code
          )
        ),
        status
      `)
      .eq('student_id', userId);

    if (error) throw error;

    // 과목별 통계 집계
    const statsByCourse = courseStats?.reduce((acc: any, record: any) => {
      const course = record.attendance_sessions.courses;
      const courseId = course.id;

      if (!acc[courseId]) {
        acc[courseId] = {
          courseId,
          courseName: course.name,
          courseCode: course.course_code,
          totalSessions: 0,
          presentCount: 0,
          lateCount: 0,
          absentCount: 0,
          attendanceRate: 0
        };
      }

      acc[courseId].totalSessions++;

      switch (record.status) {
        case 'present':
          acc[courseId].presentCount++;
          break;
        case 'late':
          acc[courseId].lateCount++;
          break;
        case 'absent':
          acc[courseId].absentCount++;
          break;
      }

      // 출석률 계산
      acc[courseId].attendanceRate = acc[courseId].totalSessions > 0
        ? Math.round(((acc[courseId].presentCount + acc[courseId].lateCount) / acc[courseId].totalSessions) * 100 * 10) / 10
        : 0;

      return acc;
    }, {}) || {};

    // 전체 통계
    const totalStats = Object.values(statsByCourse).reduce((acc: any, course: any) => {
      acc.totalSessions += course.totalSessions;
      acc.presentCount += course.presentCount;
      acc.lateCount += course.lateCount;
      acc.absentCount += course.absentCount;
      return acc;
    }, { totalSessions: 0, presentCount: 0, lateCount: 0, absentCount: 0 });

    totalStats.attendanceRate = totalStats.totalSessions > 0
      ? Math.round(((totalStats.presentCount + totalStats.lateCount) / totalStats.totalSessions) * 100 * 10) / 10
      : 0;

    res.status(200).json({
      success: true,
      data: {
        courseStats: Object.values(statsByCourse),
        totalStats
      },
      message: '출석 통계를 성공적으로 조회했습니다.',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/attendance/professor/sessions
 * 교수의 모든 출석 세션 조회 (교수 전용)
 */
router.get('/professor/sessions', authenticateToken, requireProfessor, async (req, res, next) => {
  try {
    const { userId } = req.user!;
    const { limit = 20, offset = 0, courseId } = req.query;

    let query = supabase
      .from('attendance_sessions')
      .select(`
        *,
        courses (
          id,
          name,
          course_code
        ),
        attendance_records (
          id,
          student_id,
          status,
          qr_scanned_at,
          gps_verified_at,
          auth_verified_at,
          users (
            id,
            name,
            email,
            student_id
          )
        )
      `)
      .eq('courses.professor_id', userId)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (courseId) {
      query = query.eq('course_id', courseId);
    }

    const { data: sessions, error } = await query;
    if (error) throw error;

    // 세션별 출석 통계 계산
    const sessionsWithStats = sessions?.map((session: any) => {
      const records = session.attendance_records || [];
      const stats = {
        totalStudents: records.length,
        presentCount: records.filter((r: any) => r.status === 'present').length,
        lateCount: records.filter((r: any) => r.status === 'late').length,
        absentCount: records.filter((r: any) => r.status === 'absent').length,
      };

      return {
        ...session,
        attendanceStats: stats
      };
    }) || [];

    res.status(200).json({
      success: true,
      data: {
        sessions: sessionsWithStats,
        pagination: {
          limit: Number(limit),
          offset: Number(offset),
          total: sessionsWithStats.length
        }
      },
      message: '출석 세션 목록을 성공적으로 조회했습니다.',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/attendance/professor/course-stats/:courseId
 * 특정 강의의 출석 통계 조회 (교수 전용)
 */
router.get('/professor/course-stats/:courseId', authenticateToken, requireProfessor, async (req, res, next) => {
  try {
    const { userId } = req.user!;
    const { courseId } = req.params;

    // 교수 권한 확인
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .eq('professor_id', userId)
      .single();

    if (courseError || !course) {
      return res.status(403).json({
        success: false,
        error: {
          message: '해당 강의에 대한 접근 권한이 없습니다.',
          statusCode: 403,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // 출석 세션 및 기록 조회
    const { data: sessions, error } = await supabase
      .from('attendance_sessions')
      .select(`
        id,
        session_date,
        attendance_records (
          id,
          student_id,
          status,
          users (
            id,
            name,
            email,
            student_id
          )
        )
      `)
      .eq('course_id', courseId)
      .order('session_date', { ascending: false });

    if (error) throw error;

    // 학생별 출석 통계 계산
    const studentStats: { [key: string]: any } = {};
    let totalSessions = sessions?.length || 0;

    sessions?.forEach((session: any) => {
      session.attendance_records.forEach((record: any) => {
        const studentId = record.student_id;
        
        if (!studentStats[studentId]) {
          studentStats[studentId] = {
            studentInfo: record.users,
            totalSessions: 0,
            presentCount: 0,
            lateCount: 0,
            absentCount: 0,
            attendanceRate: 0
          };
        }

        studentStats[studentId].totalSessions++;
        
        switch (record.status) {
          case 'present':
            studentStats[studentId].presentCount++;
            break;
          case 'late':
            studentStats[studentId].lateCount++;
            break;
          case 'absent':
            studentStats[studentId].absentCount++;
            break;
        }

        // 출석률 계산
        const stats = studentStats[studentId];
        stats.attendanceRate = stats.totalSessions > 0
          ? Math.round(((stats.presentCount + stats.lateCount) / stats.totalSessions) * 100 * 10) / 10
          : 0;
      });
    });

    // 전체 통계 계산
    const overallStats = Object.values(studentStats).reduce((acc: any, student: any) => {
      acc.totalStudents = Object.keys(studentStats).length;
      acc.totalRecords += student.totalSessions;
      acc.presentCount += student.presentCount;
      acc.lateCount += student.lateCount;
      acc.absentCount += student.absentCount;
      return acc;
    }, { totalStudents: 0, totalRecords: 0, presentCount: 0, lateCount: 0, absentCount: 0 });

    overallStats.attendanceRate = overallStats.totalRecords > 0
      ? Math.round(((overallStats.presentCount + overallStats.lateCount) / overallStats.totalRecords) * 100 * 10) / 10
      : 0;

    res.status(200).json({
      success: true,
      data: {
        courseInfo: course,
        overallStats,
        studentStats: Object.values(studentStats),
        sessionStats: sessions?.map((s: any) => ({
          sessionId: s.id,
          sessionDate: s.session_date,
          totalRecords: s.attendance_records.length,
          presentCount: s.attendance_records.filter((r: any) => r.status === 'present').length,
          lateCount: s.attendance_records.filter((r: any) => r.status === 'late').length,
          absentCount: s.attendance_records.filter((r: any) => r.status === 'absent').length,
        })) || []
      },
      message: '강의 출석 통계를 성공적으로 조회했습니다.',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/attendance/professor/manual-attendance
 * 수동 출석 처리 (교수 전용)
 */
router.put('/professor/manual-attendance', authenticateToken, requireProfessor, async (req, res, next) => {
  try {
    const { userId } = req.user!;
    const { sessionId, studentId, status, reason } = req.body;

    if (!sessionId || !studentId || !status) {
      return res.status(400).json({
        success: false,
        error: {
          message: '세션 ID, 학생 ID, 상태가 필요합니다.',
          statusCode: 400,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // 교수 권한 확인
    const { data: session, error: sessionError } = await supabase
      .from('attendance_sessions')
      .select(`
        id,
        courses (
          professor_id
        )
      `)
      .eq('id', sessionId)
      .single();

    if (sessionError || !session || session.courses.professor_id !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          message: '해당 세션에 대한 접근 권한이 없습니다.',
          statusCode: 403,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // 출석 기록 업데이트 또는 생성
    const { data: existingRecord, error: fetchError } = await supabase
      .from('attendance_records')
      .select('id')
      .eq('session_id', sessionId)
      .eq('student_id', studentId)
      .single();

    let result;
    const now = new Date().toISOString();

    if (existingRecord) {
      // 기존 기록 업데이트
      const { data, error } = await supabase
        .from('attendance_records')
        .update({
          status,
          auth_verified_at: now,
          manual_override: true,
          manual_reason: reason
        })
        .eq('id', existingRecord.id)
        .select()
        .single();
      
      if (error) throw error;
      result = data;
    } else {
      // 새 기록 생성
      const { data, error } = await supabase
        .from('attendance_records')
        .insert([
          {
            session_id: sessionId,
            student_id: studentId,
            status,
            qr_scanned_at: now,
            gps_verified_at: now,
            auth_verified_at: now,
            manual_override: true,
            manual_reason: reason
          }
        ])
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    // 로그 기록
    await supabase
      .from('system_logs')
      .insert([
        {
          user_id: userId,
          action: 'MANUAL_ATTENDANCE',
          description: `수동 출석 처리: ${status}`,
          ip_address: req.ip,
          user_agent: req.get('User-Agent'),
          metadata: {
            sessionId,
            studentId,
            status,
            reason,
            recordId: result.id,
            timestamp: now
          }
        }
      ]);

    res.status(200).json({
      success: true,
      data: {
        recordId: result.id,
        status,
        manualOverride: true,
        reason
      },
      message: '수동 출석 처리가 완료되었습니다.',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/attendance/test-location
 * GPS 위치 테스트 (학생 전용)
 */
router.get('/test-location', authenticateToken, requireStudent, async (req, res, next) => {
  try {
    const { latitude, longitude, accuracy } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error: {
          message: '위도와 경도가 필요합니다.',
          statusCode: 400,
        },
        timestamp: new Date().toISOString(),
      });
    }

    const studentLocation = {
      latitude: parseFloat(latitude as string),
      longitude: parseFloat(longitude as string)
    };

    const testAccuracy = accuracy ? parseFloat(accuracy as string) : undefined;

    res.status(200).json({
      success: true,
      data: {
        location: studentLocation,
        accuracy: testAccuracy,
        recommendation: getLocationRecommendation(testAccuracy),
        timestamp: new Date().toISOString()
      },
      message: 'GPS 위치 테스트가 완료되었습니다.',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    next(error);
  }
});

export default router;