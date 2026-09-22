'use client'

import { useEffect, useState } from 'react'
import {
  IconArrow,
  IconCircle,
  IconDownload,
  IconGauge,
  IconGrid,
  IconLong,
  IconMoon,
  IconShield,
  IconSparkles,
  IconSquare,
  IconSun,
  IconText,
} from '@/components/Icons'
import { cn } from '@/components/ui'
import Logo from '@/components/Logo'
import { SITE_URL, absUrl } from '@/lib/site'

const FEATURES = [
  {
    icon: <IconGrid className="h-5 w-5" />,
    title: '海量布局模板',
    desc: '1~30 张图片智能布局，250+ 种专业模板一键套用，拖动分割线还能自由调整格子大小。',
  },
  {
    icon: <IconLong className="h-5 w-5" />,
    title: '长图拼接',
    desc: '聊天记录、网页截图一键拼成长图，支持横竖双向，拖拽即可调整拼接顺序。',
  },
  {
    icon: <IconText className="h-5 w-5" />,
    title: '自由标注',
    desc: '文字、箭头、方框、圆圈随意添加，拖动即移动，手柄缩放，双击改字，颜色粗细随手调。',
  },
  {
    icon: <IconGauge className="h-5 w-5" />,
    title: '精细样式控制',
    desc: '画布比例、间距、圆角、边距、背景纯色渐变、图片描边与阴影，全部实时预览。',
  },
  {
    icon: <IconDownload className="h-5 w-5" />,
    title: '高清无水印导出',
    desc: 'PNG / JPG / WebP 任选，支持 1x~3x 与 4K 超清导出，画质与体积自由平衡。',
  },
  {
    icon: <IconShield className="h-5 w-5" />,
    title: '绝对隐私',
    desc: '全部处理在你自己的浏览器里完成，图片从不上传服务器，不存储、不留痕。',
  },
]

const STEPS = [
  { n: '1', title: '选择布局', desc: '从几十种模板中挑选，或上传多张图片让系统自动匹配合适布局。' },
  { n: '2', title: '上传调整', desc: '拖拽上传与交换，滚轮缩放图片，Alt 拖动精细构图，还能加标注。' },
  { n: '3', title: '导出保存', desc: '调整样式参数，选择格式、分辨率与画质，一键下载高清拼图。' },
]

const SCENES = [
  { title: '社交媒体', desc: '小红书封面、朋友圈九宫格、Instagram 故事，让内容更吸睛。' },
  { title: '电商与作品集', desc: '商品多角度对比图、设计作品集排版，专业效果一步到位。' },
  { title: '生活记录', desc: '旅行合辑、成长记录、宠物日常，把美好瞬间拼成一幅画。' },
  { title: '教育培训', desc: '步骤分解、错题整理、课件配图，清晰直观便于讲解。' },
]

const FAQS = [
  {
    q: '我的图片会被上传到服务器吗？',
    a: '不会。所有图片处理都在你的浏览器本地完成，图片不会离开你的设备，我们也不存储任何图片数据。',
  },
  {
    q: '支持哪些图片格式？',
    a: '上传支持 JPG、PNG、WebP、GIF 等常见格式；导出支持 PNG、JPG、WebP，其中 PNG 支持透明背景。',
  },
  {
    q: '最多可以拼多少张图？',
    a: '布局模式最多支持 30 张图片，提供数百种模板；长图拼接模式不限制拼接数量，可以拼出超长图。',
  },
  {
    q: '导出的图片清晰吗？',
    a: '支持 1x、2x、3x 以及 4K 超清导出，最高可达 3840px 长边，无水印，满足打印与商用需求。',
  },
  {
    q: '手机上可以用吗？',
    a: '可以。编辑器针对手机与平板做了适配，上传、拖拽排序、样式调整、导出在小屏上同样顺滑。',
  },
  {
    q: '真的完全免费吗？',
    a: '是的。无需注册登录，无使用次数限制，所有功能永久免费，也没有隐藏付费。',
  },
]

function ThemeToggle() {
  const [dark, setDark] = useState(false)
  useEffect(() => setDark(document.documentElement.classList.contains('dark')), [])
  const toggle = () => {
    const next = !document.documentElement.classList.contains('dark')
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('kupintu-theme', next ? 'dark' : 'light')
    setDark(next)
  }
  return (
    <button
      onClick={toggle}
      className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      aria-label="切换主题"
    >
      {dark ? <IconSun className="h-4 w-4" /> : <IconMoon className="h-4 w-4" />}
    </button>
  )
}

function HeroPreview() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-tr from-brand-200 via-fuchsia-200 to-amber-200 opacity-60 blur-2xl dark:opacity-25" />
      <div className="grid aspect-square grid-cols-4 grid-rows-4 gap-2 rounded-2xl bg-white p-3 shadow-2xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
        <div className="col-span-2 row-span-2 rounded-lg bg-gradient-to-br from-indigo-400 to-violet-500" />
        <div className="col-span-2 rounded-lg bg-gradient-to-br from-sky-300 to-cyan-400" />
        <div className="rounded-lg bg-gradient-to-br from-amber-300 to-orange-400" />
        <div className="rounded-lg bg-gradient-to-br from-rose-300 to-pink-400" />
        <div className="col-span-2 row-span-2 rounded-lg bg-gradient-to-br from-emerald-300 to-teal-400" />
        <div className="rounded-lg bg-gradient-to-br from-fuchsia-300 to-purple-400" />
        <div className="rounded-lg bg-gradient-to-br from-slate-300 to-slate-400" />
        <div className="col-span-2 rounded-lg bg-gradient-to-br from-lime-300 to-green-400" />
      </div>
      <div className="absolute -bottom-4 -right-3 rounded-xl bg-white px-3 py-2 text-xs font-medium shadow-lg ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
        <span className="mr-1 inline-flex gap-0.5 align-middle">
          <IconText className="h-3.5 w-3.5 text-brand-500" />
          <IconArrow className="h-3.5 w-3.5 text-rose-500" />
          <IconSquare className="h-3.5 w-3.5 text-emerald-500" />
          <IconCircle className="h-3.5 w-3.5 text-amber-500" />
        </span>
        文字 · 箭头 · 方框 · 圆圈
      </div>
    </div>
  )
}

/** 首页结构化数据：WebPage + FAQPage（FAQ 助力搜索结果富摘要） */
const HOME_JSONLD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': absUrl('/#webpage'),
      url: SITE_URL + '/',
      name: '免费在线拼图工具 - 自由布局与长图拼接 - 酷拼图',
      description:
        '酷拼图是一款免费在线拼图工具，支持 1~30 张网格布局与横竖长图拼接，可调间距、圆角、背景与标注，4K 高清无水印导出，图片不上传服务器。',
      inLanguage: 'zh-CN',
      isPartOf: { '@id': absUrl('/#website') },
      about: { '@id': absUrl('/#app') },
      primaryImageOfPage: { '@type': 'ImageObject', url: absUrl('/og-image.png') },
    },
    {
      '@type': 'FAQPage',
      '@id': absUrl('/#faq'),
      isPartOf: { '@id': absUrl('/#webpage') },
      mainEntity: FAQS.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ],
}

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(HOME_JSONLD) }}
      />
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:gap-3 sm:px-4">
          <span className="flex shrink-0 items-center gap-2">
            <Logo className="h-[30px] w-[30px] shrink-0 rounded-lg sm:h-7 sm:w-7" />
            <span className="text-[15px] font-semibold tracking-tight">酷拼图</span>
          </span>
          <nav className="ml-4 hidden gap-5 text-sm text-slate-600 md:flex dark:text-slate-300">
            <a href="#features" className="hover:text-brand-600">功能</a>
            <a href="#steps" className="hover:text-brand-600">使用步骤</a>
            <a href="#scenes" className="hover:text-brand-600">应用场景</a>
            <a href="#faq" className="hover:text-brand-600">常见问题</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <a
              href="/editor/"
              className="inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-lg bg-brand-600 px-3 text-sm font-medium text-white shadow-sm shadow-brand-600/25 transition hover:bg-brand-700 sm:px-4"
            >
              免费创作
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(99,102,241,0.12),transparent)]" />
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div className="flex flex-col justify-center">
            <span className="mb-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 dark:bg-brand-950 dark:text-brand-300">
              <IconShield className="h-3.5 w-3.5" />
              纯本地处理 · 无需登录 · 无水印
            </span>
            <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl md:text-5xl">
              免费在线
              <span className="bg-gradient-to-r from-brand-600 to-fuchsia-500 bg-clip-text text-transparent">拼图</span>
              与长图拼接工具
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
              布局拼图、长图拼接、画布标注三合一。几十种模板、拖拽即换、
              滚轮缩放，还能自由添加文字、箭头、方框与圆圈，全部在浏览器本地完成，4K 高清导出不打折。
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a
                href="/editor/"
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-brand-600 px-6 text-[15px] font-medium text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700"
              >
                <IconSparkles className="h-4 w-4" />
                立即免费创作
              </a>
              <a
                href="#features"
                className="inline-flex h-12 items-center rounded-xl border border-slate-200 px-6 text-[15px] font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                看看能做什么
              </a>
            </div>
            <p className="mt-4 text-xs text-slate-400">打开即用，用完即走，不留任何痕迹</p>
          </div>
          <div className="flex items-center justify-center">
            <HeroPreview />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-16 border-t border-slate-100 bg-slate-50/60 py-16 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">超越传统拼图的全能画布</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            不只是把图片摆在一起 —— 布局、长图、标注、样式、导出，一条链路全部搞定。
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
              >
                <span className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
                  {f.icon}
                </span>
                <h3 className="mb-1.5 text-[15px] font-semibold">{f.title}</h3>
                <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Steps */}
      <section id="steps" className="scroll-mt-16 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">三步做出一张好拼图</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="relative rounded-2xl border border-slate-200 p-6 dark:border-slate-800">
                <span className="mb-3 grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-fuchsia-500 text-sm font-bold text-white">
                  {s.n}
                </span>
                <h3 className="mb-1.5 text-[15px] font-semibold">{s.title}</h3>
                <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Scenes */}
      <section id="scenes" className="scroll-mt-16 border-t border-slate-100 bg-slate-50/60 py-16 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">这些场景，它都能搞定</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SCENES.map((s) => (
              <div key={s.title} className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
                <h3 className="mb-1.5 text-[15px] font-semibold">{s.title}</h3>
                <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-4">
          <div className="rounded-3xl bg-gradient-to-br from-brand-600 to-fuchsia-600 p-8 text-white sm:p-12">
            <IconShield className="h-8 w-8" />
            <h2 className="mt-4 text-2xl font-bold">你的照片，从未离开你的设备</h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-white/90">
              我们不做上传，不做存储，也没有账号体系。所有拼接、渲染、导出都在你的浏览器里完成，
              关掉页面，一切归零。把隐私交还给你自己。
            </p>
            <a
              href="/editor/"
              className="mt-7 inline-flex h-11 items-center rounded-xl bg-white px-6 text-sm font-semibold text-brand-700 transition hover:bg-white/90"
            >
              开始创作
            </a>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-16 border-t border-slate-100 py-16 dark:border-slate-800">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">常见问题</h2>
          <div className="mt-8 space-y-3">
            {FAQS.map((f) => (
              <details
                key={f.q}
                className="group rounded-xl border border-slate-200 bg-white px-5 py-4 open:shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between text-[15px] font-medium">
                  {f.q}
                  <span className="ml-3 shrink-0 text-slate-400 transition group-open:rotate-180">▾</span>
                </summary>
                <p className="mt-3 text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-20">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">现在就去拼一张</h2>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">免费、无限制、无需注册，打开就能用。</p>
          <a
            href="/editor/"
            className={cn(
              'mt-7 inline-flex h-12 items-center gap-2 rounded-xl bg-brand-600 px-8 text-[15px] font-medium text-white',
              'shadow-lg shadow-brand-600/25 transition hover:bg-brand-700',
            )}
          >
            <IconSparkles className="h-4 w-4" />
            进入拼图编辑器
          </a>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8 dark:border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-xs text-slate-500 sm:flex-row dark:text-slate-400">
          <span>© {new Date().getFullYear()} 酷拼图 · 免费在线拼图工具</span>
          <span className="flex items-center gap-4">
            <a href="/editor/" className="hover:text-brand-600">编辑器</a>
            <a href="#features" className="hover:text-brand-600">功能</a>
            <a href="#faq" className="hover:text-brand-600">常见问题</a>
          </span>
        </div>
      </footer>
    </div>
  )
}
