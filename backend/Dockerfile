# 백엔드 Docker 설정
FROM node:18-alpine AS builder

# 작업 디렉토리 설정
WORKDIR /app

# package.json과 package-lock.json 복사
COPY package*.json ./

# 의존성 설치
RUN npm ci --only=production && npm cache clean --force

# 소스 코드 복사
COPY . .

# TypeScript 빌드
RUN npm run build

# 프로덕션 이미지
FROM node:18-alpine AS production

# 보안을 위한 non-root 사용자 생성
RUN addgroup -g 1001 -S nodejs
RUN adduser -S attendance -u 1001

# 작업 디렉토리 설정
WORKDIR /app

# 의존성만 복사 (빌드 결과물과 분리)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# 사용자 권한 변경
USER attendance

# 포트 노출
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# 서버 시작
CMD ["npm", "start"]