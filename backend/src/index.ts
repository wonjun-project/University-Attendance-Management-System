import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';

// 환경변수 로드 (개발 환경 고려)
const nodeEnv = process.env.NODE_ENV || 'development';

// 개발 환경에서 .env.development 파일 먼저 확인
if (nodeEnv === 'development') {
  const devEnvPath = path.join(__dirname, '..', '.env.development');
  const regularEnvPath = path.join(__dirname, '..', '.env');
  
  if (fs.existsSync(devEnvPath)) {
    dotenv.config({ path: devEnvPath });
    console.log('📝 개발 환경 변수 파일(.env.development)을 로드했습니다.');
  } else if (fs.existsSync(regularEnvPath)) {
    dotenv.config({ path: regularEnvPath });
    console.log('📝 환경 변수 파일(.env)을 로드했습니다.');
  } else {
    console.log('⚠️ 환경 변수 파일이 없습니다. 시스템 환경 변수를 사용합니다.');
    console.log('💡 개발을 위해 .env.development 파일을 생성하세요.');
  }
} else {
  dotenv.config();
}

// 라우터 임포트
import authRoutes from './routes/auth';
import courseRoutes from './routes/courses';
import attendanceRoutes from './routes/attendance';

// 미들웨어 임포트
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';

const app = express();
const PORT = process.env.PORT || 5000;

// Rate Limiting 설정
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15분
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // 최대 100회
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 기본 미들웨어
app.use(helmet());

// 개발 환경에서는 여러 포트와 IP 주소 허용, 프로덕션에서는 특정 URL만 허용
const corsOrigin = nodeEnv === 'development' 
  ? [
      'http://localhost:3000',
      'http://localhost:3001', 
      'http://localhost:3002',
      'http://localhost:3003',
      'http://localhost:3004',
      'http://localhost:3005',
      'http://localhost:3006',
      'http://localhost:3007',
      'http://localhost:3008',
      'http://localhost:3009',
      'http://192.168.0.111:3000',
      'http://192.168.0.111:3001',
      'http://192.168.0.111:3002',
      'http://192.168.0.111:3003',
      'http://192.168.0.111:3004',
      'http://192.168.0.111:3005',
      'http://192.168.0.111:3006',
      'http://192.168.0.111:3007',
      'http://192.168.0.111:3008',
      'http://192.168.0.111:3009'
    ]
  : process.env.FRONTEND_URL || 'http://localhost:3000';

app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(limiter);

// Health Check 엔드포인트
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API 라우트
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/attendance', attendanceRoutes);

// 404 처리
app.use(notFound);

// 에러 처리 미들웨어
app.use(errorHandler);

// 서버 시작
const server = app.listen(PORT, () => {
  console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`📊 환경: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 CORS 허용: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM 신호를 받았습니다. 서버를 종료합니다...');
  server.close(() => {
    console.log('✅ 서버가 정상적으로 종료되었습니다.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('👋 SIGINT 신호를 받았습니다. 서버를 종료합니다...');
  server.close(() => {
    console.log('✅ 서버가 정상적으로 종료되었습니다.');
    process.exit(0);
  });
});

export default app;