import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // 纯前端工具：静态导出，可部署到 EdgeOne Pages / Vercel / 任意 CDN
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  reactStrictMode: true,
}

export default nextConfig
