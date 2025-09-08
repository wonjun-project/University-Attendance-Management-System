import express from 'express';
import bcrypt from 'bcryptjs';
import { supabase } from '../config/supabase';
import { 
  generateTokenPair, 
  verifyRefreshToken, 
  JwtPayload 
} from '../utils/jwt';
import { 
  loginSchema, 
  registerSchema, 
  changePasswordSchema, 
  refreshTokenSchema,
  updateProfileSchema 
} from '../validators/auth';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

/**
 * POST /api/auth/register
 * 회원가입
 */
router.post('/register', async (req, res, next) => {
  try {
    // 입력 데이터 검증
    const validationResult = registerSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          message: '입력 데이터가 올바르지 않습니다.',
          details: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          })),
          statusCode: 400,
        },
        timestamp: new Date().toISOString(),
      });
    }

    const { email, password, name, role, studentId, phone } = validationResult.data;

    // 이메일 중복 확인
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: {
          message: '이미 등록된 이메일입니다.',
          statusCode: 409,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // 학생인 경우 학번 중복 확인
    if (role === 'student' && studentId) {
      const { data: existingStudent } = await supabase
        .from('users')
        .select('id')
        .eq('student_id', studentId)
        .single();

      if (existingStudent) {
        return res.status(409).json({
          success: false,
          error: {
            message: '이미 등록된 학번입니다.',
            statusCode: 409,
          },
          timestamp: new Date().toISOString(),
        });
      }
    }

    // 비밀번호 해싱
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 사용자 생성
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert([
        {
          email,
          password_hash: hashedPassword,
          name,
          role,
          student_id: role === 'student' ? studentId : null,
          phone: phone || null,
        }
      ])
      .select('id, email, name, role, student_id')
      .single();

    if (createError) {
      console.error('❌ 사용자 생성 실패:', createError);
      throw createError;
    }

    // JWT 토큰 생성
    const payload: JwtPayload = {
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role as 'student' | 'professor',
      name: newUser.name,
      studentId: newUser.student_id
    };

    const tokens = generateTokenPair(payload);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
          studentId: newUser.student_id
        },
        tokens
      },
      message: '회원가입이 완료되었습니다.',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/login
 * 로그인
 */
router.post('/login', async (req, res, next) => {
  try {
    // 입력 데이터 검증
    const validationResult = loginSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          message: '입력 데이터가 올바르지 않습니다.',
          details: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          })),
          statusCode: 400,
        },
        timestamp: new Date().toISOString(),
      });
    }

    const { email, password } = validationResult.data;

    // 사용자 조회
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, password_hash, name, role, student_id')
      .eq('email', email)
      .single();

    if (userError || !user) {
      return res.status(401).json({
        success: false,
        error: {
          message: '이메일 또는 비밀번호가 올바르지 않습니다.',
          statusCode: 401,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // 비밀번호 확인
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: {
          message: '이메일 또는 비밀번호가 올바르지 않습니다.',
          statusCode: 401,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // JWT 토큰 생성
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role as 'student' | 'professor',
      name: user.name,
      studentId: user.student_id
    };

    const tokens = generateTokenPair(payload);

    // 로그인 기록
    await supabase
      .from('system_logs')
      .insert([
        {
          user_id: user.id,
          action: 'LOGIN',
          description: '사용자 로그인',
          ip_address: req.ip,
          user_agent: req.get('User-Agent'),
          metadata: {
            loginTime: new Date().toISOString()
          }
        }
      ]);

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          studentId: user.student_id
        },
        tokens
      },
      message: '로그인에 성공했습니다.',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/refresh
 * 토큰 갱신
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const validationResult = refreshTokenSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          message: '리프레시 토큰이 필요합니다.',
          statusCode: 400,
        },
        timestamp: new Date().toISOString(),
      });
    }

    const { refreshToken } = validationResult.data;

    // 리프레시 토큰 검증
    const decoded = verifyRefreshToken(refreshToken);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: {
          message: '유효하지 않은 리프레시 토큰입니다.',
          statusCode: 401,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // 사용자 존재 확인
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, name, role, student_id')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: {
          message: '사용자를 찾을 수 없습니다.',
          statusCode: 401,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // 새 토큰 페어 생성
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role as 'student' | 'professor',
      name: user.name,
      studentId: user.student_id
    };

    const tokens = generateTokenPair(payload);

    res.status(200).json({
      success: true,
      data: {
        tokens
      },
      message: '토큰이 갱신되었습니다.',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/me
 * 현재 사용자 정보 조회
 */
router.get('/me', authenticateToken, async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        user: req.user
      },
      message: '사용자 정보를 조회했습니다.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/auth/profile
 * 프로필 업데이트
 */
router.put('/profile', authenticateToken, async (req, res, next) => {
  try {
    const validationResult = updateProfileSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          message: '입력 데이터가 올바르지 않습니다.',
          details: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          })),
          statusCode: 400,
        },
        timestamp: new Date().toISOString(),
      });
    }

    const updateData = validationResult.data;
    const userId = req.user!.userId;

    // 프로필 업데이트
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select('id, email, name, role, student_id, phone')
      .single();

    if (error) {
      console.error('❌ 프로필 업데이트 실패:', error);
      throw error;
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          role: updatedUser.role,
          studentId: updatedUser.student_id,
          phone: updatedUser.phone
        }
      },
      message: '프로필이 업데이트되었습니다.',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/logout
 * 로그아웃
 */
router.post('/logout', authenticateToken, async (req, res, next) => {
  try {
    // 로그아웃 기록
    await supabase
      .from('system_logs')
      .insert([
        {
          user_id: req.user!.userId,
          action: 'LOGOUT',
          description: '사용자 로그아웃',
          ip_address: req.ip,
          user_agent: req.get('User-Agent'),
          metadata: {
            logoutTime: new Date().toISOString()
          }
        }
      ]);

    res.status(200).json({
      success: true,
      message: '로그아웃되었습니다.',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    next(error);
  }
});

export default router;