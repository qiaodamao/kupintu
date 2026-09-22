/**
 * 生成社交分享封面图 public/og-image.png（1200×630）
 * 用本机 Chrome 无头模式截图 scripts/og-template.html
 * 用法：node scripts/gen-og.mjs
 */
import { spawn } from 'node:child_process'
import { existsSync, copyFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = path.join(root, 'scripts', 'og-template.html')
const tmp = path.join(root, '.next', 'og-template.html')
const out = path.join(root, 'public', 'og-image.png')

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe',
].find((p) => p && existsSync(p))

if (!CHROME) {
  console.error('未找到本机 Chrome，请手动生成 public/og-image.png')
  process.exit(1)
}

mkdirSync(path.dirname(tmp), { recursive: true })
copyFileSync(src, tmp)

const args = [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--force-device-scale-factor=1',
  '--window-size=1200,630',
  '--virtual-time-budget=3000',
  `--screenshot=${out}`,
  'file:///' + tmp.replace(/\\/g, '/'),
]

const p = spawn(CHROME, args, { stdio: 'ignore' })
p.on('exit', (code) => {
  if (code !== 0) {
    console.error('截图失败，exit=' + code)
    process.exit(code ?? 1)
  }
  console.log('已生成封面图: public/og-image.png (1200×630)')
})
