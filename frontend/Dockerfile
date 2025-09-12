# 프론트엔드 Docker 설정
FROM node:18-alpine AS builder

# 작업 디렉토리 설정
WORKDIR /app

# package.json과 package-lock.json 복사
COPY package*.json ./

# 의존성 설치 (peer dependency 이슈 해결)
RUN npm ci --legacy-peer-deps && npm cache clean --force

# 소스 코드 복사
COPY . .

# React 앱 빌드
RUN npm run build

# 프로덕션 이미지 (Nginx 사용)
FROM nginx:alpine AS production

# 보안을 위한 설정
RUN addgroup -g 1001 -S nodejs
RUN adduser -S attendance -u 1001

# Nginx 설정 파일 복사
COPY nginx.conf /etc/nginx/nginx.conf

# 빌드된 React 앱 복사
COPY --from=builder /app/build /usr/share/nginx/html

# 포트 노출
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Nginx 시작
CMD ["nginx", "-g", "daemon off;"]