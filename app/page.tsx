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
import Logo from '@/components/Logo'
import { cn } from '@/components/ui'
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
    a: '上传支持 JPG、PNG、WebP、GIF 等常见格式；导出支持 PNG、JPG、WebP，其中 PNG 与 WebP 支持透明背景（导出面板勾选「透明背景」即可）。',
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
      className="grid h-10 w-10 place-items-center rounded-full border border-hairline text-ink transition-colors active:bg-surface-soft"
      aria-label="切换主题"
    >
      {dark ? <IconSun className="h-4 w-4" /> : <IconMoon className="h-4 w-4" />}
    </button>
  )
}

/** card-feature-photo 语言：32px 大圆角照片卡，内部渐变瓦片视作摄影内容 */
function HeroPreview() {
  return (
    <div className="relative ml-auto w-full max-w-lg">
      <div className="rounded-xxxl border border-hairline-soft bg-canvas p-5 sm:p-6">
        <div className="grid aspect-square grid-cols-4 grid-rows-4 gap-2 overflow-hidden rounded-xxl">
          <div className="col-span-2 row-span-2 rounded-lg bg-gradient-to-br from-indigo-400 to-violet-500" />
          <div className="col-span-2 rounded-lg bg-gradient-to-br from-sky-300 to-cyan-400" />
          <div className="rounded-lg bg-gradient-to-br from-amber-300 to-orange-400" />
          <div className="rounded-lg bg-gradient-to-br from-rose-300 to-pink-400" />
          <div className="col-span-2 row-span-2 rounded-lg bg-gradient-to-br from-emerald-300 to-teal-400" />
          <div className="rounded-lg bg-gradient-to-br from-fuchsia-300 to-purple-400" />
          <div className="rounded-lg bg-gradient-to-br from-slate-300 to-slate-400" />
          <div className="col-span-2 rounded-lg bg-gradient-to-br from-lime-300 to-green-400" />
        </div>
        <div className="mt-4 flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-canvas px-4 py-2 text-xs font-bold text-charcoal">
            <span className="inline-flex gap-0.5">
              <IconText className="h-3.5 w-3.5 text-accent" />
              <IconArrow className="h-3.5 w-3.5 text-critical" />
              <IconSquare className="h-3.5 w-3.5 text-success" />
              <IconCircle className="h-3.5 w-3.5 text-attention" />
            </span>
            文字 · 箭头 · 方框 · 圆圈
          </span>
        </div>
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

/* 营销面 CTA：黑药丸（button-primary）；描边药丸（button-secondary）为其副操作。
   hover 只换底色 + 柔影，不做位移（位移会让按钮在光标下跳动）；按下回到深色 */
const PILL_PRIMARY =
  'text-button inline-flex items-center justify-center gap-2 rounded-full bg-ink-button px-[30px] py-[14px] text-on-ink-button transition duration-200 ease-out hover:bg-ink hover:shadow-[0_4px_12px_rgba(20,22,26,0.18)] active:bg-charcoal active:shadow-none'
const PILL_SECONDARY =
  'text-button inline-flex items-center justify-center rounded-full border-2 border-ink-deep px-[28px] py-[12px] text-ink-deep transition duration-200 ease-out hover:bg-ink-deep/[0.06] hover:shadow-[0_4px_12px_rgba(20,22,26,0.12)] active:bg-ink-deep/10 active:shadow-none'

export default function Home() {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(HOME_JSONLD) }}
      />
      {/* Top Navigation：sticky 白底 64px + hairline-soft 底边 */}
      <header className="sticky top-0 z-30 border-b border-hairline-soft bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-2 px-4 sm:gap-3 sm:px-8">
          <span className="flex shrink-0 items-center gap-2">
            <Logo className="h-[30px] w-[30px] shrink-0 rounded-lg sm:h-7 sm:w-7" />
            <span className="text-[15px] font-bold tracking-tight text-ink-deep">酷拼图</span>
          </span>
          <nav className="ml-6 hidden gap-5 text-sm font-bold text-steel lg:flex">
            <a href="#features" className="hover:text-ink-deep">功能</a>
            <a href="#steps" className="hover:text-ink-deep">使用步骤</a>
            <a href="#scenes" className="hover:text-ink-deep">应用场景</a>
            <a href="#faq" className="hover:text-ink-deep">常见问题</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <a href="/editor/" className="text-button inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-full bg-ink-button px-5 text-on-ink-button transition duration-200 ease-out hover:bg-ink hover:shadow-[0_4px_12px_rgba(20,22,26,0.18)] active:bg-charcoal active:shadow-none">
              免费创作
            </a>
          </div>
        </div>
      </header>

      {/* Hero：stark white canvas，双 CTA（黑药丸 + 描边药丸） */}
      <section className="mx-auto grid max-w-[1280px] gap-12 px-4 py-16 sm:px-8 md:grid-cols-2 md:py-24">
        <div className="flex flex-col justify-center">
          <span className="mb-5 inline-flex w-fit items-center gap-1.5 rounded-full bg-surface-soft px-4 py-1.5 text-xs font-bold text-steel">
            <IconShield className="h-3.5 w-3.5 text-success" />
            纯本地处理 · 无需登录 · 无水印
          </span>
          <h1 className="text-[32px] font-bold leading-[1.16] tracking-tight text-ink-deep sm:text-[44px] md:text-[56px] lg:text-[64px]">
            免费在线<span className="text-accent">拼图</span>
            <br />
            与长图拼接工具
          </h1>
          <p className="mt-5 max-w-xl text-[16px] leading-[1.5] text-charcoal">
            布局拼图、长图拼接、画布标注三合一。几十种模板、拖拽即换、
            滚轮缩放，还能自由添加文字、箭头、方框与圆圈，全部在浏览器本地完成，4K 高清导出不打折。
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href="/editor/" className={PILL_PRIMARY}>
              <IconSparkles className="h-4 w-4" />
              立即免费创作
            </a>
            <a href="#features" className={PILL_SECONDARY}>
              看看能做什么
            </a>
          </div>
          <p className="mt-5 text-xs text-steel">打开即用，用完即走，不留任何痕迹</p>
        </div>
        <div className="flex items-center justify-center">
          <HeroPreview />
        </div>
      </section>

      {/* Features：card-icon-feature（16px 圆角 + hairline-soft 描边 + 24px 内边距） */}
      <section id="features" className="scroll-mt-20 py-16 md:py-20">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-8">
          <h2 className="text-center text-[28px] font-bold leading-[1.21] text-ink-deep md:text-[36px]">
            超越传统拼图的全能画布
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-[16px] leading-[1.5] text-steel">
            不只是把图片摆在一起 —— 布局、长图、标注、样式、导出，一条链路全部搞定。
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border border-hairline-soft bg-canvas p-6">
                <span className="mb-4 grid h-10 w-10 place-items-center rounded-full bg-surface-soft text-accent">
                  {f.icon}
                </span>
                <h3 className="mb-2 text-[18px] font-bold leading-[1.44] text-ink-deep">{f.title}</h3>
                <p className="text-sm leading-[1.43] tracking-[-0.14px] text-steel">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Steps */}
      <section id="steps" className="scroll-mt-20 bg-surface-soft py-16 md:py-20">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-8">
          <h2 className="text-center text-[28px] font-bold leading-[1.21] text-ink-deep md:text-[36px]">
            三步做出一张好拼图
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-xl border border-hairline-soft bg-canvas p-8">
                <span className="chip-accent mb-4 grid h-10 w-10 place-items-center rounded-full text-sm font-bold">
                  {s.n}
                </span>
                <h3 className="mb-2 text-[18px] font-bold leading-[1.44] text-ink-deep">{s.title}</h3>
                <p className="text-sm leading-[1.43] tracking-[-0.14px] text-steel">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Scenes */}
      <section id="scenes" className="scroll-mt-20 py-16 md:py-20">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-8">
          <h2 className="text-center text-[28px] font-bold leading-[1.21] text-ink-deep md:text-[36px]">
            这些场景，它都能搞定
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {SCENES.map((s) => (
              <div key={s.title} className="rounded-xl border border-hairline-soft bg-canvas p-6">
                <h3 className="mb-2 text-[18px] font-bold leading-[1.44] text-ink-deep">{s.title}</h3>
                <p className="text-sm leading-[1.43] tracking-[-0.14px] text-steel">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy：card-promo-strip（ink-deep 深色大卡，32px 圆角） */}
      <section className="py-16">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-8">
          <div className="chip-accent rounded-xxxl px-6 py-12 sm:px-12 sm:py-16">
            <div className="mx-auto max-w-3xl">
              <IconShield className="h-8 w-8" />
              <h2 className="mt-5 text-[28px] font-bold leading-[1.21] md:text-[36px]">
                你的照片，从未离开你的设备
              </h2>
              <p className="mt-4 max-w-2xl text-[16px] leading-[1.5] opacity-75">
                我们不做上传，不做存储，也没有账号体系。所有拼接、渲染、导出都在你的浏览器里完成，
                关掉页面，一切归零。把隐私交还给你自己。
              </p>
              <a
                href="/editor/"
                className="text-button mt-8 inline-flex items-center justify-center rounded-full bg-canvas px-[30px] py-[14px] text-ink-deep transition-colors active:bg-surface-soft"
              >
                开始创作
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ：faq-accordion-item（16px 圆角 + hairline-soft 描边 + 24px 内边距） */}
      <section id="faq" className="scroll-mt-20 py-16 md:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-8">
          <h2 className="text-center text-[28px] font-bold leading-[1.21] text-ink-deep md:text-[36px]">
            常见问题
          </h2>
          <div className="mt-10 space-y-3">
            {FAQS.map((f) => (
              <details
                key={f.q}
                className="group rounded-xl border border-hairline-soft bg-canvas px-6 py-5"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between text-[16px] font-bold text-ink-deep">
                  {f.q}
                  <span className="ml-3 shrink-0 text-steel transition-transform group-open:rotate-180">▾</span>
                </summary>
                <p className="mt-4 text-[15px] leading-[1.5] text-charcoal">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-24">
        <div className="mx-auto max-w-[1280px] px-4 text-center sm:px-8">
          <h2 className="text-[28px] font-bold leading-[1.21] text-ink-deep md:text-[36px]">
            现在就去拼一张
          </h2>
          <p className="mt-3 text-[15px] text-steel">免费、无限制、无需注册，打开就能用。</p>
          <a href="/editor/" className={cn(PILL_PRIMARY, 'mt-8 h-12 px-8')}>
            <IconSparkles className="h-4 w-4" />
            进入拼图编辑器
          </a>
        </div>
      </section>

      {/* footer-region：白底 + 顶部分隔线，steel 链接层级 */}
      <footer className="border-t border-hairline-soft bg-canvas py-14">
        <div className="mx-auto flex max-w-[1280px] flex-col items-center justify-between gap-4 px-4 text-sm text-steel sm:flex-row sm:px-8">
          <span className="text-xs text-steel">© {new Date().getFullYear()} 酷拼图 · 免费在线拼图工具</span>
          <span className="flex items-center gap-6">
            <a href="/editor/" className="font-bold hover:text-ink-deep">编辑器</a>
            <a href="#features" className="font-bold hover:text-ink-deep">功能</a>
            <a href="#faq" className="font-bold hover:text-ink-deep">常见问题</a>
          </span>
        </div>
      </footer>
    </div>
  )
}
