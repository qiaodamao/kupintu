import type { Metadata } from 'next'
import Editor from '@/components/editor/Editor'
import { SITE_NAME, SITE_URL, absUrl } from '@/lib/site'

const TITLE = '在线拼图制作器 - 网格布局 · 长图拼接 · 无水印导出 - 酷拼图'
const DESCRIPTION =
  '免费在线拼图编辑器：上传图片即可自由拖拽，支持 1~16 张网格布局模板、横竖长图拼接，可调间距、圆角、背景与标注，一键导出 4K 高清无水印图片，免登录、图片不上传服务器。'
const OG_IMAGE = '/og-image.png'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords:
    '在线拼图，免费拼图，拼图制作器，图片拼接，长图拼接，照片拼接，网格布局，自由拼图，拼图无水印，collage maker',
  alternates: { canonical: '/editor/' },
  robots: { index: true, follow: true },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL + '/editor/',
    siteName: SITE_NAME,
    type: 'website',
    locale: 'zh_CN',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: '酷拼图 - 在线拼图编辑器' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: SITE_NAME,
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
}

/** 编辑器页结构化数据：WebPage + BreadcrumbList */
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': absUrl('/editor/#webpage'),
      url: SITE_URL + '/editor/',
      name: TITLE,
      description: DESCRIPTION,
      inLanguage: 'zh-CN',
      isPartOf: { '@id': absUrl('/#website') },
      about: { '@id': absUrl('/#app') },
      primaryImageOfPage: { '@type': 'ImageObject', url: absUrl(OG_IMAGE) },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: SITE_URL + '/' },
        { '@type': 'ListItem', position: 2, name: '在线拼图编辑器', item: SITE_URL + '/editor/' },
      ],
    },
  ],
}

export default function EditorPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Editor />
    </>
  )
}
