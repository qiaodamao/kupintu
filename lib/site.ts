/** 站点正式域名（SEO / canonical / sitemap 统一入口，改这里即可） */
export const SITE_URL = 'https://pintu.kusheji.com'

/** 站点名称 */
export const SITE_NAME = '酷拼图'

/** 拼一个绝对 URL，path 需以 / 开头 */
export function absUrl(path: string): string {
  return SITE_URL + (path.startsWith('/') ? path : '/' + path)
}
