# 酷拼图 · kupintu

免费在线拼图 / 长图拼接 / 图片标注工具。对标 [pic.net/grid](https://www.pic.net/grid/zh/) 与 [mergeimage.org](https://mergeimage.org/zh)，
并做了功能超集：**所有处理都在浏览器本地完成，图片不上传服务器，无需登录，无水印。**

## 技术栈

| 层 | 选型 |
| --- | --- |
| 框架 | Next.js 15.5（App Router + 静态导出 `output: 'export'`） |
| UI | React 19.3 + TypeScript 5.7 |
| 样式 | Tailwind CSS 4.3（`@tailwindcss/postcss`，零配置文件） |
| 状态 | Zustand 5（含撤销 / 重做快照栈） |
| 渲染 | 原生 Canvas 2D（自研场景渲染器，预览与导出共用同一套绘制代码） |

没有 UI 组件库与图标库依赖，图标为内联 SVG，首屏 JS 约 110 KB。

## 功能

**布局拼图**
- 1~16 张图片、132 个自动生成的布局模板（递归二分树 + 10 种分割策略去重）
- 拖动图片到另一格交换；拖到画布外文件直接上传
- 拖动分割线调整格子比例；滚轮缩放图片；Alt/Shift 拖动平移；方向键微调
- 画布比例 1:1 / 4:5 / 3:4 / 4:3 / 3:2 / 16:9 / 9:16

**长图拼接**
- 横竖双向，画布尺寸按图片比例自动推导，不限制张数
- 左侧列表拖拽排序，画布上可直接缩放平移单张

**画布标注**
- 文字（双击编辑、加粗、底色、拖拽 8 向缩放）、箭头、方框、圆圈
- 颜色 / 粗细 / 填充 / 虚线随手改，Delete 删除，Esc 取消选中

**样式与导出**
- 间距、边距、圆角、阴影、描边；背景纯色 / 渐变（含预设）/ 透明
- 导出 PNG / JPG / WebP，1x / 2x / 3x / 4K，JPG/WebP 可调画质，PNG 支持透明背景
- 导出分辨率与预览完全一致（同一 `drawScene`，仅整体缩放倍率不同）

## 本地开发

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # 静态产物输出到 out/
npm run preview    # 本地预览 out/ 产物 http://localhost:3222
npm run typecheck
```

冒烟测试（需要用本机 Chrome 打开页面、模拟上传、检查渲染与导出）：

```bash
# 1. 启动服务（生产产物 npm run preview，或开发服务器 npm run dev）
npm run preview
# 2. 另开一个终端，用调试端口启动本机 Chrome
chrome.exe --headless=new --remote-debugging-port=9333 --user-data-dir=%TEMP%\kp-chrome
# 3. 跑测试
npm run smoke      # 或 node scripts/smoke.mjs http://localhost:3222/editor/ 9333
```

> `smoke-long-style.mjs` 需要读 store 内部状态，请在 **dev 服务器**上跑
> （`window.__store` 只在 `NODE_ENV !== 'production'` 时挂载，生产构建不含该钩子）。

## 部署

项目是**纯静态站点**（`npm run build` 产物在 `out/`，无任何服务端代码），因此不需要 Node 运行时，
可部署到 EdgeOne Pages / Vercel / Cloudflare Pages / OSS 等任意静态托管。

### 腾讯 EdgeOne Pages（本项目部署目标）

1. 进入 [EdgeOne 控制台](https://console.cloud.tencent.com/edgeone) → **Pages** → 新建项目 → 导入 Git 仓库
2. 框架预设：选 **Next.js**；若预设里没有，选「静态站点」/「其它」并手工填下面两项
3. 构建命令：`npm run build`
4. 输出目录：`out`（由 `next.config.ts` 的 `output: 'export'` 决定）
5. **Node 版本：20 或以上**（Next 15 要求 ≥ 18.18，`package.json` 已声明 `engines.node >= 20`）
6. 安装命令保持默认 `npm install`（仓库已提交 `package-lock.json`，也可改成 `npm ci`）→ 部署

部署后 EdgeOne 会分配 `xxx.edgeone.app` 域名，绑定自有域名需在控制台配置 CNAME。
后续推送到 `main` 分支会自动触发重新构建。

**注意**：若站点不是部署在根路径（例如挂在 `example.com/kupintu/` 下），
需要在 `next.config.ts` 中加 `basePath: '/kupintu'` 并重新构建，否则静态资源路径会 404。

### Vercel

1. 把代码推到 GitHub / GitLab
2. Vercel → Add New → Project → 导入仓库
3. Framework 自动识别为 Next.js，构建命令 `npm run build`，其余保持默认 → Deploy

仓库内已附 `vercel.json`。也可用 CLI：

```bash
npx vercel deploy --prod
```

### Cloudflare Pages / GitHub Pages / OSS

```bash
npm run build
# 上传 out/ 目录即可
# GitHub Pages 注意设置 basePath：在 next.config.ts 中加 basePath: '/<repo-name>'
```

## 目录结构

```
app/
  layout.tsx          全局壳、SEO metadata、主题防闪烁脚本
  page.tsx            中文落地页（特性 / 步骤 / 场景 / FAQ）
  editor/page.tsx     编辑器页
components/
  editor/
    Editor.tsx        组装、图片解码缓存、场景与槽位计算
    CanvasStage.tsx   画布交互（命中检测、拖拽、缩放、标注手柄、拖放上传）
    Panels.tsx        顶栏 / 图片面板 / 样式面板 / 导出弹窗 / 移动端工具条
  ui.tsx              基础控件（Button / Slider / Segmented / Switch / ColorPicker…）
  Icons.tsx           内联 SVG 图标
  Logo.tsx            站点 Logo（复用 app/icon.svg → /icon.svg）
lib/
  types.ts            数据模型与常量（逻辑画布基准宽 BASE_W = 1200）
  layout.ts           布局模板生成、矩形计算、分割线命中、比例修改
  render.ts           Canvas 场景渲染 + 长图布局计算
  store.ts            Zustand 状态与撤销重做
  export.ts           离屏渲染、格式 / 分辨率 / 画质、下载
scripts/
  serve.mjs                  本地静态预览服务器
  smoke.mjs                  上传 → 渲染 → 导出 → 长图模式 主链路
  smoke-interaction.mjs      滚轮锚点缩放 / 拖动平移 / Shift 交换 / 撤销事务
  smoke-view-wheel.mjs       预览区滚轮缩放（智能区分 + 光标锚点）
  smoke-view-zoom.mjs        缩放按钮与图片浮层工具条（pointer capture 回归）
  smoke-split-hint.mjs       分割线 hover 提示与拖拽改比例
  smoke-panel-count.mjs      模板数量选择器可见性与选中态
  smoke-long-style.mjs       长图模式默认样式（需 dev 服务器）
  smoke-logo.mjs             站点 Logo 与 favicon 加载
  smoke-mobile-header.mjs    顶栏在 320/390/768/1024 断点无溢出、按钮可见
```

## 实现要点

- **坐标系统**：所有样式数值都以逻辑宽度 `BASE_W = 1200` 为基准的像素值；预览时按视图缩放绘制，导出时按目标宽度整体 `ctx.scale()`，保证所见即所得。
- **布局引擎**：模板由递归二分树生成，`Plan`（方向 / 切分方式 / 比例策略 / 主次侧）只在首层生效，子区域一律等比细分，避免出现趋近于零的窄格；生成结果按结构签名去重。
- **渲染管线**：`drawScene(ctx, {slots, images, style, annotations, ...})` 是唯一绘制入口，预览、导出、撤销重做后的重绘都走它。
- **隐私**：图片只存在于 `URL.createObjectURL` 与内存，无任何网络请求。
