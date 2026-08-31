#!/usr/bin/env node
/**
 * 京东家政赠品清单数据更新脚本
 *
 * 流程（与「京推推」换链话术一致）：
 *   ① 抓取线报源站页面 -> 解析商品/分类（link 暂为原始 u.jd.com 链接）
 *   ② 用京推推账号密码登录，拿到 token Cookie
 *   ③ 逐条调用京推推转链接口，把 link 换成自己的推广短链，写回 JSON
 *
 * 用法：
 *   node scripts/update-products.mjs                 # 抓取 + 京推推转链并写入
 *   node scripts/update-products.mjs --dry-run       # 只抓取解析，不落盘、不转链
 *   node scripts/update-products.mjs --out=tmp.json  # 指定输出文件
 *   node scripts/update-products.mjs --source=https://example.com/xxx
 *
 * 敏感配置全部通过环境变量（GitHub Repository secrets）注入，见 README。
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/* ---------------------------------- 参数 ---------------------------------- */

const argv = process.argv.slice(2)
const hasFlag = (name) => argv.includes(`--${name}`)
const getFlag = (name) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : undefined
}

const CONFIG = {
  // ⚠️ 以下变量全部从环境变量（GitHub Repository secrets）注入，脚本内不写任何默认值。
  // 缺少必需项时脚本会直接报错退出，避免用错误配置覆盖线上数据。
  /** 数据源页面地址（必需，从 secret 读取） */
  sourceUrl: getFlag('source') || process.env.JDJZ_SOURCE_URL || '',
  /** 源站需要 Cookie / 特定 UA 时使用（可选，留空则不附加） */
  cookie: process.env.JDJZ_SOURCE_COOKIE || '',
  userAgent: process.env.JDJZ_SOURCE_UA || '',
  /** 输出文件 */
  outFile: path.resolve(ROOT, getFlag('out') || process.env.JDJZ_OUTPUT || 'public/data/jdjz_products.json'),
  /** 少于该数量视为源站改版/抓取失败，直接报错（可选，未设置按 30 校验） */
  minProducts: Number(process.env.JDJZ_MIN_PRODUCTS || 30),
  /** 商品图统一尺寸，留空则保留源站原图 */
  imageSize: process.env.JDJZ_IMAGE_SIZE || '',
  dryRun: hasFlag('dry-run'),
  /** 京推推换链：账号密码、unionId、positionId 均从 Repository secrets 注入（无默认值） */
  jtt: {
    username: process.env.JTT_USERNAME || '',
    password: process.env.JTT_PASSWORD || '',
    unionId: process.env.JTT_UNION_ID || '',
    positionId: process.env.JTT_POSITION_ID || '',
    /** 登录与转链的基础域名（服务地址常量，一般无需修改） */
    base: (process.env.JTT_BASE_URL || 'https://www.jingtuitui.com').replace(/\/+$/, '')
  }
}

const DEFAULT_KEYWORDS = ['牙膏', '洗衣', '洗发', '护发', '发膜', '沐浴', '身体乳']

const log = (...args) => console.log('[jdjz]', ...args)
const warn = (...args) => console.warn('[jdjz]', ...args)

/* ---------------------------------- 工具 ---------------------------------- */

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" }

function decodeEntities(input = '') {
  return input
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (raw, code) => {
      const key = code.toLowerCase()
      if (key.startsWith('#x')) return String.fromCodePoint(parseInt(code.slice(2), 16))
      if (key.startsWith('#')) return String.fromCodePoint(Number(code.slice(1)))
      return ENTITIES[key] ?? raw
    })
    .trim()
}

const stripTags = (html = '') => decodeEntities(html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '))

/** 去掉内联脚本/样式，避免其中的文案（如城市列表、"限地域"说明）污染卡片解析 */
const stripScripts = (html = '') =>
  html.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, '')

/**
 * 京东图片统一换成大图尺寸：
 *   /n0/s200x200_jfs/... -> /n0/s800x800_jfs/...
 *   /n1/jfs/...（无尺寸段的原图）-> /n0/s800x800_jfs/...
 * imageSize 为空时默认用 s800x800（保证封面清晰），设置则用指定尺寸。
 */
function normalizeImage(url = '') {
  if (!url) return url
  const target = CONFIG.imageSize || 's800x800'
  if (/\/n\d+\/s\d+x\d+_jfs\//.test(url)) {
    return url.replace(/\/n\d+\/s\d+x\d+_jfs\//, `/n0/${target}_jfs/`)
  }
  if (/\/n\d+\/jfs\//.test(url)) {
    return url.replace(/\/n\d+\/jfs\//, `/n0/${target}_jfs/`)
  }
  return url.replace(/\/s\d+x\d+_jfs\//, `/${target}_jfs/`)
}

/** 估算图片清晰度优先级：360buy 商品图最高，data: 占位图最差 */
function imageScore(url = '') {
  if (!url) return -1
  if (url.startsWith('data:')) return -2
  if (/360buyimg\.com/.test(url)) return 100
  if (/jd\.com|jdl\.com/.test(url)) return 50
  return 0
}

/**
 * 从卡片区块中提取「商品封面图」地址：
 * - 优先取 <figure class="jl-product-card__media"> 内的商品主图，避免误取凑单搭配图
 * - 每个 <img> 收集 src / srcset / data-src 候选，按域名可信度打分
 * - 源站输出的都是 s100x100~s200x200 缩略图，最终统一由 normalizeImage 换成大图尺寸
 */
function extractImage(block = '') {
  const media = block.match(/<figure\b[^>]*jl-product-card__media[\s\S]*?<\/figure>/)?.[0]
  const scope = media || block
  const imgs = [...scope.matchAll(/<img\b([^>]*)>/g)]
  let best = ''
  let bestScore = -Infinity
  for (const m of imgs) {
    const tag = m[1]
    const cands = []
    const src = tag.match(/\bsrc="([^"]*)"/)?.[1]
    if (src) cands.push(src)
    for (const part of (tag.match(/\bsrcset="([^"]*)"/)?.[1] || '').split(',')) {
      const url = part.trim().match(/^(https?:\/\/\S+)/)?.[1]
      if (url) cands.push(url)
    }
    const ds = tag.match(/\bdata-src="([^"]*)"/)?.[1] || tag.match(/\bdata-original="([^"]*)"/)?.[1]
    if (ds) cands.push(ds)
    for (const url of cands) {
      if (url.startsWith('data:') || /placeholder|loading\.|gray|empty|spacer/i.test(url)) continue
      const score = imageScore(url)
      if (score > bestScore) {
        bestScore = score
        best = url
      }
    }
  }
  return best
}

/** 北京时间 yyyy-MM-dd HH:mm:ss */
function beijingNow(withDate = false) {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
    .formatToParts(new Date())
    .reduce((acc, p) => ((acc[p.type] = p.value), acc), {})
  if (withDate) return `${parts.year}年${parts.month}月${parts.day}日`
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchText(url, { retries = 3 } = {}) {
  let lastErr
  const ua = CONFIG.userAgent || JTT_UA
  for (let i = 1; i <= retries; i += 1) {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(30_000),
        headers: {
          'user-agent': ua,
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'zh-CN,zh;q=0.9',
          ...(CONFIG.cookie ? { cookie: CONFIG.cookie } : {})
        }
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      if (!text || text.length < 1024) throw new Error(`响应内容过短（${text.length} bytes）`)
      return text
    } catch (err) {
      lastErr = err
      warn(`抓取失败（第 ${i}/${retries} 次）：${err.message}`)
      if (i < retries) await sleep(2000 * i)
    }
  }
  throw new Error(`抓取源站失败：${lastErr?.message || 'unknown'}`)
}

/* --------------------------------- HTML 解析 -------------------------------- */

/**
 * 源站（Astro 静态站）当前结构：整页一个扁平商品网格 #deal-grid，每件商品一张卡片
 *
 *   <article class="jl-product-card jl-product-card--direct"
 *            data-sku data-category data-promotion-kind data-default-plan
 *            data-promotion-label data-price data-available-days data-has-gift ...>
 *     <a class="jl-product-card__primary" href="https://u.jd.com/xxx"
 *        data-umami-event-name data-umami-event-sku data-umami-event-price>
 *       <h3 class="jl-product-card__name">…</h3>
 *       <strong class="jl-product-card__condition">买3件</strong>
 *       <span class="jl-product-card__price"><small>¥</small>89<em>.70</em></span>
 *       <div class="jl-product-card__benefit"><strong>家政/除螨二选一</strong>…</div>
 *       <p class="jl-product-card__service-terms">…</p>
 *       <p class="jl-product-card__other-gifts">另赠 …</p>
 *     </a>
 *   </article>
 *
 * 两类特殊卡片：
 *   - data-promotion-kind="add-on"（可凑单）：整张卡是 <button> + 购买方案 <dialog>，
 *     没有 jl-product-card__primary 单品链接；同一 sku 另有一张 data-default-plan="false"
 *     的隐藏卡片，代表「只买这款」的单品方案，本脚本取后者，语义与 JSON 的单品结构一致。
 *   - 其余卡片均为 data-default-plan="true" 的单品方案。
 * 因此「取所有带 jl-product-card__primary 的卡片并按 sku 去重」正好等于页面声明的商品总数。
 */
const CARD_RE = /<article\b[^>]*\bclass="[^"]*jl-product-card[^"]*"[\s\S]*?<\/article>/g

const attr = (tag = '', name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1]

const CARD_SEL = {
  primary: /<a\b([^>]*\bclass="[^"]*jl-product-card__primary[^"]*"[^>]*)>/,
  name: /class="jl-product-card__name"[^>]*>([\s\S]*?)<\/h3>/,
  condition: /class="jl-product-card__condition"[^>]*>([^<]*)</,
  priceBox: /class="jl-product-card__price"[^>]*>([\s\S]*?)<\/span>/,
  benefit: /class="jl-product-card__benefit"[^>]*>([\s\S]*?)<\/div>/,
  otherGifts: /class="jl-product-card__other-gifts"[^>]*>([\s\S]*?)<\/p>/,
  otherGiftsTitle: /class="jl-product-card__other-gifts"[^>]*\btitle="([^"]*)"/,
  serviceTerms: /class="jl-product-card__service-terms"[^>]*>([\s\S]*?)<\/p>/
}

/** 「买3件」+「家政/除螨二选一 ×2」+「送 2小时家政」-> 「买3送4小时」 */
function buildClean(cardOpen, block) {
  const condition = decodeEntities(block.match(CARD_SEL.condition)?.[1] || '').replace(/\s+/g, '')
  const qty = condition.match(/(\d+)/)?.[1]
  const benefit = stripTags(block.match(CARD_SEL.benefit)?.[1] || '')
  // 赠送时长优先取 data-search-text 里的「送 2小时家政」，其次退回赠品名里的小时数
  const searchText = decodeEntities(attr(cardOpen, 'data-search-text') || '')
  const hourText = searchText.match(/送\s*([\d.]+)\s*小时/)?.[1] || benefit.match(/([\d.]+)\s*小时/)?.[1]
  const copies = Number(benefit.match(/[×xX]\s*(\d+)/)?.[1] || 1)

  if (qty && hourText) {
    const hours = Number(hourText) * copies
    return `买${qty}送${Number.isInteger(hours) ? hours : hours.toFixed(1)}小时`
  }
  // 兜底：拼接源站原始文案，保证 badge 至少有内容
  const label = decodeEntities(attr(cardOpen, 'data-promotion-label') || '')
  return [condition, benefit || label].filter(Boolean).join(' ').trim()
}

/** 「另赠 舒肤佳柔护沐浴露山茶花香200g ×2」-> 「舒肤佳柔护沐浴露山茶花香200g ×2」 */
function parseGift(cardOpen, block) {
  if (attr(cardOpen, 'data-has-gift') === 'false') return ''
  const raw =
    decodeEntities(block.match(CARD_SEL.otherGiftsTitle)?.[1] || '') ||
    stripTags(block.match(CARD_SEL.otherGifts)?.[1] || '')
  return raw.replace(/^另赠\s*/, '').trim()
}

/** 解析整页所有商品卡片，按 sku 去重后返回扁平数组（含 category 字段，供后续分组） */
function parseProducts(html) {
  const map = new Map()

  for (const match of html.matchAll(CARD_RE)) {
    const block = match[0]
    const cardOpen = block.match(/<article\b[^>]*>/)?.[0] || ''

    // 可凑单卡片没有单品链接，跳过（同 sku 的「只买这款」隐藏卡片会被解析到）
    const primaryTag = block.match(CARD_SEL.primary)?.[1]
    if (!primaryTag) continue

    const sku = (attr(cardOpen, 'data-sku') || attr(primaryTag, 'data-umami-event-sku') || '').trim()
    const name =
      decodeEntities(attr(primaryTag, 'data-umami-event-name') || '') ||
      stripTags(block.match(CARD_SEL.name)?.[1] || '')
    if (!sku || !name || map.has(sku)) continue

    const link = attr(primaryTag, 'href') || ''
    if (!/^https?:\/\/[^/]*(?:u\.jd\.com|jd\.com)/i.test(link)) continue

    // 价格：优先 umami 埋点上的到手价，其次 data-price（分），最后从价格 DOM 拼回
    const cents = Number(attr(cardOpen, 'data-price'))
    const priceDom = stripTags(block.match(CARD_SEL.priceBox)?.[1] || '').replace(/[¥\s]/g, '')
    const price =
      attr(primaryTag, 'data-umami-event-price') ||
      (Number.isFinite(cents) && cents > 0 ? (cents / 100).toFixed(2) : '') ||
      priceDom

    const product = {
      name,
      link,
      img: normalizeImage(extractImage(block)),
      price: String(price || '').trim(),
      sku,
      category: decodeEntities(attr(cardOpen, 'data-category') || '') || '其他'
    }

    const clean = buildClean(cardOpen, block)
    if (clean) product.clean = clean
    const gift = parseGift(cardOpen, block)
    if (gift) product.gift = gift
    const terms = stripTags(block.match(CARD_SEL.serviceTerms)?.[1] || '')
    if (/限地域|仅限下单地址/.test(terms)) product.regionLimited = true

    map.set(sku, product)
  }

  return [...map.values()]
}

/** 筛选面板里的分类顺序即源站自己的排序，用它决定输出分类顺序 */
function parseCategoryOrder(html) {
  const panel = html.match(/name="deal-category"[\s\S]*?<\/fieldset>/)?.[0] || ''
  return [...panel.matchAll(/name="deal-category" value="([^"]*)"/g)]
    .map((m) => decodeEntities(m[1]))
    .filter((v) => v && v !== 'all')
}

function parseCategories(html) {
  const products = parseProducts(html)
  const order = parseCategoryOrder(html)
  const buckets = new Map()

  for (const product of products) {
    const { category, ...rest } = product
    if (!buckets.has(category)) buckets.set(category, [])
    buckets.get(category).push(rest)
  }

  const names = [...buckets.keys()].sort((a, b) => {
    const ia = order.indexOf(a)
    const ib = order.indexOf(b)
    // 筛选面板里没有的分类排到末尾，保持彼此的出现顺序
    return (ia === -1 ? Number.MAX_SAFE_INTEGER : ia) - (ib === -1 ? Number.MAX_SAFE_INTEGER : ib)
  })

  return names.map((name) => ({ name, products: buckets.get(name) }))
}

function parseUpdateInfo(html) {
  // 页面声明的商品总数：新版「160 款商品」，兼容旧版「160 件商品」
  const declaredTotal = html.match(/([\d,]+)\s*款商品/) || html.match(/([\d,]+)\s*件商品/)
  // 源站数据时间戳（毫秒）写在每张卡片的 data-update-time 上，取最大值
  const stamps = [...html.matchAll(/data-update-time="(\d+)"/g)].map((m) => Number(m[1])).filter(Number.isFinite)
  const sourceUpdatedAt = stamps.length ? new Date(Math.max(...stamps)) : null
  return {
    date: beijingNow(true),
    updatedAt: beijingNow(),
    declaredTotal: declaredTotal ? Number(declaredTotal[1].replace(/,/g, '')) : 0,
    sourceUpdatedAt: sourceUpdatedAt
      ? sourceUpdatedAt.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
      : ''
  }
}

/* ------------------------------ 京推推登录 + 转链 ------------------------------ */

const JTT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36'

/** 步骤②：用账号密码登录京推推，返回后续转链要用的 token（从 Set-Cookie 中取） */
async function jttLogin() {
  const { username, password, unionId, positionId, base } = CONFIG.jtt
  if (!username || !password) {
    throw new Error('缺少京推推账号密码：请在 Repository secrets 中配置 JTT_USERNAME 与 JTT_PASSWORD')
  }
  if (!unionId || !positionId) {
    throw new Error('缺少京推推 unionId / positionId：请在 Repository secrets 中配置 JTT_UNION_ID 与 JTT_POSITION_ID')
  }

  const loginRes = await fetch(`${base}/user/user_login/`, {
    method: 'POST',
    signal: AbortSignal.timeout(20_000),
    headers: { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8', 'user-agent': JTT_UA },
    body: new URLSearchParams({ phone: username, pwb: password }).toString()
  })
  if (!loginRes.ok) throw new Error(`登录请求失败 HTTP ${loginRes.status}`)

  // 解析 Set-Cookie，提取 token（浏览器里 token 通过 Set-Cookie 下发，无需 PHPSESSID）
  const setCookies = loginRes.headers.getSetCookie?.() ?? []
  const token = setCookies
    .map((c) => c.split(';')[0])
    .find((c) => c.trim().toLowerCase().startsWith('token='))
    ?.split('=')
    .slice(1)
    .join('=')
    .trim()

  let payload
  try {
    payload = await loginRes.json()
  } catch {
    payload = {}
  }
  if (payload?.return !== '0' && payload?.return !== 0) {
    throw new Error(`京推推登录失败：${payload?.result || loginRes.statusText}`)
  }
  if (!token) throw new Error('京推推登录成功但未返回 token，请检查账号状态')
  log('京推推登录成功')
  return token
}

/** 步骤③：单条转链。成功返回推广短链，失败抛错 */
async function jttConvert(token, originalLink) {
  const { unionId, positionId, base } = CONFIG.jtt
  if (!unionId || !positionId) {
    throw new Error('缺少京推推 unionId / positionId：请在 Repository secrets 中配置 JTT_UNION_ID 与 JTT_POSITION_ID')
  }
  const res = await fetch(`${base}/jd?t=go_link`, {
    method: 'POST',
    signal: AbortSignal.timeout(20_000),
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'user-agent': JTT_UA,
      'x-requested-with': 'XMLHttpRequest',
      referer: `${base}/jd?t=universal`,
      cookie: `token=${token}; positionid=${positionId}; unionid=${unionId}`
    },
    body: new URLSearchParams({ positionid: positionId, unionid: unionId, rid: '', content: originalLink }).toString()
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  if (Number(json?.return) !== 0 || json?.result?.fail_msg) {
    throw new Error(json?.result?.fail_msg || json?.result?.msg || '转链失败')
  }
  const chain = json?.result?.link_date?.[0]?.chain_link || json?.result?.chain_content
  if (!chain) throw new Error('转链响应缺少 chain_link')
  return chain
}

async function applyJttLinks(categories) {
  if (CONFIG.dryRun) {
    log('--dry-run：跳过京推推登录与转链')
    return categories
  }
  const token = await jttLogin()

  const products = categories.flatMap((c) => c.products).filter((p) => /^https?:\/\/u\.jd\.com/i.test(p.link))
  const cache = new Map()
  let ok = 0
  let failed = 0
  const CONCURRENCY = 3

  const queue = [...products]
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) {
        const product = queue.shift()
        // 源站偶尔出现多个 sku 共用同一条短链，用原始链接做 key 复用转链结果
        const original = product.link
        if (cache.has(original)) {
          const cached = cache.get(original)
          if (cached) {
            product.link = cached
            ok += 1
          } else {
            product.__jttFailed = true
            failed += 1
          }
          continue
        }
        let chain
        let lastErr
        // 每条链接最多重试 2 次，避免偶发抖动误删商品
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            chain = await jttConvert(token, product.link)
            break
          } catch (err) {
            lastErr = err
            if (attempt < 2) await sleep(500 * (attempt + 1))
          }
        }
        if (chain) {
          product.link = chain
          cache.set(original, chain)
          ok += 1
        } else {
          product.__jttFailed = true
          cache.set(original, '')
          failed += 1
          warn(`转链失败，将删除该商品：${product.name} -> ${lastErr?.message}`)
        }
        await sleep(150)
      }
    })
  )

  // 删除转链失败的商品，并清理空分类；同时去掉内部标记字段
  const kept = categories
    .map((cat) => ({ ...cat, products: cat.products.filter((p) => !p.__jttFailed) }))
    .filter((cat) => cat.products.length > 0)
  kept.forEach((cat) => cat.products.forEach((p) => delete p.__jttFailed))

  log(`京推推转链完成：成功 ${ok} 个，失败删除 ${failed} 个`)
  return kept
}

/* ---------------------------------- 主流程 --------------------------------- */

async function readPrevious() {
  try {
    return JSON.parse(await readFile(CONFIG.outFile, 'utf8'))
  } catch {
    return null
  }
}

async function main() {
  if (!CONFIG.sourceUrl) {
    throw new Error('缺少数据源地址：请在 Repository secrets 中配置 JDJZ_SOURCE_URL')
  }
  log(`开始抓取：${new URL(CONFIG.sourceUrl).origin}`)
  const html = stripScripts(await fetchText(CONFIG.sourceUrl))

  const categories = parseCategories(html)
  const total = categories.reduce((sum, c) => sum + c.products.length, 0)
  const { declaredTotal, sourceUpdatedAt } = parseUpdateInfo(html)

  if (sourceUpdatedAt) log(`源站数据时间：${sourceUpdatedAt}`)
  log(`解析到 ${categories.length} 个分类 / ${total} 件商品：`)
  categories.forEach((c) => log(`  - ${c.name}：${c.products.length} 件`))

  if (total < CONFIG.minProducts) {
    throw new Error(`仅解析到 ${total} 件商品（阈值 ${CONFIG.minProducts}），疑似源站改版，已中止写入`)
  }
  if (declaredTotal && Math.abs(declaredTotal - total) > Math.max(5, declaredTotal * 0.1)) {
    warn(`源站声明 ${declaredTotal} 件，实际解析 ${total} 件，差异较大，请检查解析规则`)
  }

  // 步骤②+③：京推推登录并转链，转链失败的商品会被删除
  const kept = await applyJttLinks(categories)
  if (!kept.length) throw new Error('全部商品转链失败，疑似京推推账号异常，已中止写入避免清空数据')
  const finalTotal = kept.reduce((sum, c) => sum + c.products.length, 0)
  if (finalTotal < CONFIG.minProducts) {
    throw new Error(`转链后仅剩 ${finalTotal} 件商品（阈值 ${CONFIG.minProducts}），疑似京推推异常，已中止写入`)
  }
  if (finalTotal < total) warn(`转链后商品数 ${finalTotal}（原始 ${total}），已删除 ${total - finalTotal} 个失败项`)

  const previous = await readPrevious()
  const keywords = Array.isArray(previous?.keywords) && previous.keywords.length ? previous.keywords : DEFAULT_KEYWORDS

  const data = {
    // updateInfo 反映「本次脚本运行时间」（北京时间），而非源站页面上的旧时间戳
    updateInfo: { date: beijingNow(true), updatedAt: beijingNow(), total: finalTotal },
    keywords,
    categories: kept
  }
  const output = `${JSON.stringify(data, null, 2)}\n`

  if (CONFIG.dryRun) {
    log('--dry-run：跳过写入，以下为解析样例（link 仍为源站原始链接）')
    console.log(JSON.stringify(categories.flatMap((c) => c.products).slice(0, 3), null, 2))
    return
  }

  await mkdir(path.dirname(CONFIG.outFile), { recursive: true })
  const before = previous ? `${JSON.stringify(previous, null, 2)}\n` : ''
  await writeFile(CONFIG.outFile, output, 'utf8')
  log(before === output ? `内容无变化：${path.relative(ROOT, CONFIG.outFile)}` : `已写入：${path.relative(ROOT, CONFIG.outFile)}`)
}

// 直接执行时跑主流程；被 import 时只导出解析函数（便于本地/单测核对解析结果）
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('[jdjz] 更新失败：', err.message)
    process.exit(1)
  })
}

export { stripScripts, parseProducts, parseCategories, parseUpdateInfo }
