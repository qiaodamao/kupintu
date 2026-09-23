import type { MetadataRoute } from 'next'
import { SITE_NAME } from '@/lib/site'

/** PWA manifest：构建时输出 /manifest.webmanifest（metadataBase 会把相对 src 绝对化） */
export const dynamic = 'force-static'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} - 免费在线拼图与长图拼接工具`,
    short_name: SITE_NAME,
    description:
      '免费在线拼图工具，支持 1~30 张网格布局与横竖长图拼接，可调间距、圆角、背景与标注，一键导出高清无水印图片，图片不上传服务器。',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    lang: 'zh-CN',
    background_color: '#ffffff',
    theme_color: '#6366f1',
    categories: ['graphics', 'photo', 'productivity'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      // maskable：内容已缩进到中心 80% 安全区（见 scripts/gen-pwa-icons.mjs）
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
