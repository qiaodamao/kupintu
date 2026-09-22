/**
 * SEO 冒烟：canonical / Open Graph / JSON-LD 结构化数据（浏览器真实 DOM 层校验）
 * 用法：node scripts/smoke-seo.mjs [baseUrl] [port]
 */
const base = (process.argv[2] ?? 'http://localhost:3222/').replace(/\/$/, '/')
const port = Number(process.argv[3] ?? 9333)
const SITE = 'https://pintu.kusheji.com'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function getWs() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`)
      const list = await res.json()
      const page = list.find((t) => t.type === 'page')
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
    } catch {
      /* 等待浏览器启动 */
    }
    await sleep(500)
  }
  throw new Error('无法连接 Chrome DevTools')
}

const ws = new WebSocket(await getWs())
let id = 0
const pending = new Map()

ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
  }
})
await new Promise((r) => ws.addEventListener('open', r))

function send(method, params = {}) {
  const msgId = ++id
  ws.send(JSON.stringify({ id: msgId, method, params }))
  return new Promise((resolve) => pending.set(msgId, resolve))
}

await send('Runtime.enable')
await send('Page.enable')
await send('Log.enable')
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `
    window.__errs = [];
    window.addEventListener('error', (e) => window.__errs.push(String(e.message || e)));
    const __oe = console.error;
    console.error = function (...a) { window.__errs.push('console: ' + a.map(String).join(' ')); __oe.apply(console, a) };
  `,
})

const evaluate = async (expression) => {
  const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (res.result?.exceptionDetails) {
    return { error: res.result.exceptionDetails.exception?.description ?? 'eval error' }
  }
  return res.result?.result?.value
}

const PROBE = `(() => {
  const abs = (u) => { try { return new URL(u, location.href).href } catch { return u } }
  const meta = (sel) => document.querySelector(sel)?.getAttribute('content') ?? null
  const links = Array.from(document.querySelectorAll('link[rel=canonical]')).map((l) => abs(l.getAttribute('href')))
  const ld = Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map((s) => {
    try { return { ok: true, data: JSON.parse(s.textContent) } } catch (e) { return { ok: false, err: String(e.message) } }
  })
  // FAQPage 与页面可见文案是否一致（防止结构化数据与实际内容不符）
  const faqNodes = Array.from(document.querySelectorAll('#faq details')).map((d) => ({
    q: d.querySelector('summary')?.textContent.replace(/[\\s▾]+/g, '').trim() ?? '',
    a: d.querySelector('p')?.textContent.replace(/\\s+/g, ' ').trim() ?? '',
  }))
  return {
    title: document.title,
    desc: meta('meta[name=description]'),
    keywords: (meta('meta[name=keywords]') || '').slice(0, 40) + '…',
    canonical: links,
    og: {
      title: meta('meta[property="og:title"]'),
      description: meta('meta[property="og:description"]'),
      url: meta('meta[property="og:url"]'),
      image: meta('meta[property="og:image"]'),
      type: meta('meta[property="og:type"]'),
      site: meta('meta[property="og:site_name"]'),
      locale: meta('meta[property="og:locale"]'),
    },
    twitter: {
      card: meta('meta[name="twitter:card"]'),
      site: meta('meta[name="twitter:site"]'),
      title: meta('meta[name="twitter:title"]'),
      description: meta('meta[name="twitter:description"]'),
      image: meta('meta[name="twitter:image"]'),
    },
    ld,
    faqNodes,
    errs: window.__errs || [],
  }
})()`

let failed = 0
const check = (cond, label, extra = '') => {
  if (!cond) failed++
  console.log(`  ${cond ? '✓' : '✗'} ${label}${extra ? ' — ' + extra : ''}`)
}

async function probePage(path, expect) {
  console.log(`\n=== ${path} ===`)
  await send('Page.navigate', { url: base + path.replace(/^\//, '') })
  await sleep(3000)
  const r = await evaluate(PROBE)

  console.log('  title:', r.title)
  check(r.canonical.length === 1, 'canonical 唯一', r.canonical.join(','))
  check(r.canonical[0] === expect.canonical, 'canonical 指向正确', r.canonical[0])
  check(
    !!r.og.url && r.og.url.startsWith(SITE),
    'og:url 为绝对域名',
    r.og.url,
  )
  check(!!r.og.image && r.og.image.startsWith(SITE), 'og:image 为绝对域名', r.og.image)
  check(!!r.og.title && r.og.title !== '', 'og:title 非空', r.og.title)
  check(r.og.type === 'website', 'og:type = website', r.og.type)
  check(r.og.description === r.desc, 'og:description 与 description 一致', (r.og.description || '').slice(0, 24) + '…')
  check(r.twitter.card === 'summary_large_image', 'twitter card 大图', r.twitter.card)
  check(!!r.twitter.site, 'twitter:site 非空', r.twitter.site)
  check(!!r.twitter.title, 'twitter:title 非空', r.twitter.title)
  check(r.twitter.description === r.desc, 'twitter:description 与 description 一致')
  check(!!r.twitter.image && r.twitter.image.startsWith(SITE), 'twitter:image 为绝对域名', r.twitter.image)
  check(!/PIC\.NET/i.test(JSON.stringify(r)), '无竞品残留文案（PIC.NET）')
  check(!!r.desc && r.desc.length > 50, 'description 有效', (r.desc || '').slice(0, 30) + '…')

  // JSON-LD
  const bad = r.ld.filter((x) => !x.ok)
  check(bad.length === 0, `JSON-LD 全部可解析（共 ${r.ld.length} 段）`, bad.map((b) => b.err).join(';'))

  const types = []
  const walk = (n) => {
    if (!n || typeof n !== 'object') return
    if (Array.isArray(n)) return n.forEach(walk)
    if (n['@type']) types.push(Array.isArray(n['@type']) ? n['@type'].join('+') : n['@type'])
    Object.values(n).forEach(walk)
  }
  r.ld.filter((x) => x.ok).forEach((x) => walk(x.data))
  console.log('  类型:', types.join(' | '))
  for (const t of expect.ldTypes) check(types.includes(t), `含 @type=${t}`)

  // WebApplication 关键字段（Google 软件应用富摘要要求）
  const nodes = r.ld
    .filter((x) => x.ok)
    .flatMap((x) => (x.data['@graph'] ? x.data['@graph'] : [x.data]))
  const app = nodes.find((n) => n['@type'] === 'WebApplication')
  check(!!app, 'WebApplication 节点存在')
  if (app) {
    check(app.applicationCategory === 'MultimediaApplication', 'applicationCategory 正确', app.applicationCategory)
    check(!!app.operatingSystem, 'operatingSystem 非空', app.operatingSystem)
    check(String(app.url).startsWith(SITE), 'url 指向本站', app.url)
    check(String(app.offers?.price) === '0', 'offers.price = 0（免费）', String(app.offers?.price))
    check(!!app.offers?.priceCurrency, 'offers.priceCurrency 存在', app.offers?.priceCurrency)
    check(!!app.name && !!app.description, 'name / description 齐全', app.name)
  }

  // FAQPage 与可见文案一致性
  if (expect.faq) {
    const faqLd = r.ld
      .filter((x) => x.ok)
      .flatMap((x) => (x.data['@graph'] ? x.data['@graph'] : [x.data]))
      .find((n) => n['@type'] === 'FAQPage')
    check(!!faqLd, 'FAQPage 节点存在')
    if (faqLd) {
      const items = faqLd.mainEntity || []
      check(items.length === r.faqNodes.length, `FAQ 条数与页面一致（${items.length}/${r.faqNodes.length}）`)
      let mismatch = 0
      items.forEach((it, i) => {
        const dom = r.faqNodes[i]
        if (!dom) return mismatch++
        const qOk = it.name.replace(/\s+/g, '') === dom.q.replace(/\s+/g, '')
        const aOk = it.acceptedAnswer?.text?.replace(/\s+/g, '') === dom.a.replace(/\s+/g, '')
        if (!qOk || !aOk) {
          mismatch++
          console.log(`    ✗ 第 ${i + 1} 条不一致:`, qOk ? 'A 不符' : 'Q 不符', '|', it.name)
        }
      })
      check(mismatch === 0, '每条 Q/A 与页面可见文案逐字一致')
      check(
        items.every((it) => it.acceptedAnswer?.text?.length > 10),
        '每条答案非空',
      )
    }
  }

  check((r.errs || []).length === 0, '零控制台错误', (r.errs || []).slice(0, 2).join(' | '))
  return r
}

await probePage('/', {
  canonical: SITE + '/',
  ldTypes: ['WebSite', 'WebApplication', 'FAQPage'],
  faq: true,
})

await probePage('/editor/', {
  canonical: SITE + '/editor/',
  ldTypes: ['WebSite', 'WebApplication', 'WebPage', 'BreadcrumbList'],
  faq: false,
})

console.log(failed === 0 ? '\n全部通过 ✓' : `\n失败 ${failed} 项 ✗`)
ws.close()
process.exit(failed === 0 ? 0 : 1)
