import type { Metadata, Viewport } from 'next'
import './globals.css'
import { SITE_NAME, SITE_URL, absUrl } from '@/lib/site'

const TITLE = '免费在线拼图工具 - 自由布局与长图拼接 - 酷拼图'
const DESCRIPTION =
  '一款强大的免费在线拼图工具，支持多种网格布局和自定义长图拼接，无水印免登录直接下载。无需下载软件，浏览器在线即可轻松拖拽图片，调整间距、圆角和背景，创作出个性化的照片拼图。轻松拼出好看的小红书首图、抖音封面、淘宝拼图照片、拼多多拼图照片等！'
const OG_IMAGE = '/og-image.png'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  keywords:
    '拼图，在线拼图，免费拼图，拼图无水印，免费拼图无水印，图片拼接, 长图拼接, 照片拼接, 酷拼图, 拼图制作器, collage maker, 网格布局, 自由拼图',
  authors: [{ name: '酷拼图', url: SITE_URL }],
  creator: '酷拼图',
  publisher: '酷拼图',
  applicationName: SITE_NAME,
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL + '/',
    siteName: SITE_NAME,
    type: 'website',
    locale: 'zh_CN',
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: '酷拼图 - 免费在线拼图与长图拼接工具',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: SITE_NAME,
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#6366f1',
}

/** 全站结构化数据：WebSite + 免费 Web 应用 */
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': absUrl('/#website'),
      url: SITE_URL + '/',
      name: SITE_NAME,
      inLanguage: 'zh-CN',
      description: DESCRIPTION,
      publisher: { '@id': absUrl('/#app') },
    },
    {
      '@type': 'WebApplication',
      '@id': absUrl('/#app'),
      name: SITE_NAME,
      url: SITE_URL + '/',
      applicationCategory: 'MultimediaApplication',
      applicationSubCategory: 'Photo Collage Maker',
      operatingSystem: 'All',
      browserRequirements: '需要支持 Canvas 的现代浏览器（Chrome / Edge / Safari / Firefox）',
      softwareVersion: '1.0.0',
      inLanguage: 'zh-CN',
      image: absUrl(OG_IMAGE),
      screenshot: absUrl(OG_IMAGE),
      description: DESCRIPTION,
      isAccessibleForFree: true,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'CNY',
        availability: 'https://schema.org/InStock',
      },
      featureList: [
        '1~30 张网格布局模板',
        '横竖双向长图拼接',
        '文字 / 箭头 / 方框 / 圆圈标注',
        '间距、圆角、边距、背景自由调整',
        'PNG / JPG / WebP 高清无水印导出',
        '浏览器本地处理，图片不上传服务器',
      ],
    },
  ],
}

const themeScript = `
(function(){
  try {
    var t = localStorage.getItem('kupintu-theme');
    var dark = t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="bg-white text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        {children}
      </body>
    </html>
  )
}
