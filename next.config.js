/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [],
  },
  eslint: {
    // 빌드 중에 ESLint 오류를 무시 (배포 차단 방지)
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig