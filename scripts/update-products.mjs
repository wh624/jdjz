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
 *   /n0/s142x142_jfs/... -> /n0/s800x800_jfs/...
 * imageSize 为空时默认用 s800x800（保证封面清晰），设置则用指定尺寸。
 */
function normalizeImage(url = '') {
  if (!url) return url
  const target = CONFIG.imageSize || 's800x800'
  if (/\/n0\/s\d+x\d+_jfs\//.test(url)) {
    return url.replace(/\/n0\/s\d+x\d+_jfs\//, `/n0/${target}_jfs/`)
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
 * 从卡片区块中提取「商品封面图」高清地址：
 * - 遍历区块内所有 <img>，收集 srcset（取最大尺寸）/ data-src / data-original / src 候选
 * - 优先选 360buyimg 商品图，并选分辨率/尺寸最高者，避免首图是缩略图或占位图
 */
function extractImage(block = '') {
  const imgs = [...block.matchAll(/<img\b([^>]*)>/g)]
  let best = ''
  let bestScore = -Infinity
  for (const m of imgs) {
    const tag = m[1]
    const cands = []
    const ssm = tag.match(/srcset="([^"]*)"/)
    if (ssm) {
      for (const part of ssm[1].split(',').map((s) => s.trim())) {
        const um = part.match(/^\s*(https?:\/\/\S+)/)
        if (!um) continue
        const wm = part.match(/(\d+)w\s*$/)
        const w = wm ? parseInt(wm[1], 10) : 0
        cands.push({ url: um[1], score: w })
      }
    }
    const src = tag.match(/src="([^"]*)"/)?.[1]
    if (src) cands.push({ url: src, score: 0 })
    const ds = tag.match(/data-src="([^"]*)"/)?.[1] || tag.match(/data-original="([^"]*)"/)?.[1]
    if (ds) cands.push({ url: ds, score: 60 })
    for (const c of cands) {
      if (c.url.startsWith('data:') || /placeholder|loading\.|gray|empty|spacer/i.test(c.url)) continue
      const score = imageScore(c.url) * 100000 + c.score
      if (score > bestScore) {
        bestScore = score
        best = c.url
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

const RE = {
  name: /data-umami-event-name="([^"]*)"/,
  sku: /data-umami-event-sku="([^"]*)"/,
  price: /data-umami-event-price="([^"]*)"/,
  link: /href="(https?:\/\/[^"]*(?:u\.jd\.com|jd\.com)[^"]*)"/,
  clean: />\s*(买\s*[\d.]+\s*送\s*[\d.]+\s*小时[^<]*)</,
  priceText: /¥\s*([\d.]+)/,
  giftBlock: /bg-emerald-50[\s\S]*$/
}

/** 提取单张卡片里的赠品文案 */
function parseGift(block) {
  const giftHtml = block.match(RE.giftBlock)?.[0]
  if (!giftHtml || !giftHtml.includes('赠品')) return ''
  const items = [...giftHtml.matchAll(/>([^<>]+)</g)]
    .map((m) => decodeEntities(m[1]))
    .filter((t) => t && !/^[·\s]*$/.test(t) && !t.includes('赠品') && !t.includes('🎁'))
  return [...new Set(items)].join('；')
}

/** 解析一个分类区块里的所有商品（移动端卡片 + 桌面端卡片是同一商品的两套 DOM，按 sku 去重合并） */
function parseProducts(sectionHtml) {
  const marks = [...sectionHtml.matchAll(/<div class="(?:mobile-card|card bg-white)/g)].map((m) => m.index)
  const map = new Map()

  marks.forEach((start, i) => {
    const block = sectionHtml.slice(start, marks[i + 1] ?? sectionHtml.length)
    const sku = block.match(RE.sku)?.[1]?.trim()
    const name = decodeEntities(block.match(RE.name)?.[1] || '')
    if (!sku || !name) return

    const product = {
      name,
      link: block.match(RE.link)?.[1] || '',
      img: normalizeImage(extractImage(block)),
      price: (block.match(RE.price)?.[1] || block.match(RE.priceText)?.[1] || '').trim(),
      sku
    }
    const clean = decodeEntities(block.match(RE.clean)?.[1] || '').replace(/\s+/g, '')
    if (clean) product.clean = clean
    const gift = parseGift(block)
    if (gift) product.gift = gift
    if (/限地域/.test(block)) product.regionLimited = true

    const exist = map.get(sku)
    if (!exist) {
      map.set(sku, product)
      return
    }
    // 合并两套 DOM 中互补的字段；图片优先保留更清晰的版本
    for (const [k, v] of Object.entries(product)) {
      if (!v) continue
      if (k === 'img') {
        if (imageScore(v) > imageScore(exist[k] || '')) exist.img = v
        continue
      }
      if (!exist[k]) exist[k] = v
    }
  })

  return [...map.values()]
}

function parseCategories(html) {
  const viewIndex = html.indexOf('id="category-view"')
  const scoped = viewIndex === -1 ? html : html.slice(viewIndex)
  const mainEnd = scoped.indexOf('</main>')
  const scope = mainEnd > 0 ? scoped.slice(0, mainEnd) : scoped

  const starts = [...scope.matchAll(/<section\b[^>]*>/g)].map((m) => m.index)
  const categories = []
  const seenSku = new Set()

  starts.forEach((start, i) => {
    const chunk = scope.slice(start, starts[i + 1] ?? scope.length)
    const name = stripTags(chunk.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/)?.[1] || '')
      .replace(/\d+\s*件$/, '')
      .trim()
    if (!name) return

    const products = parseProducts(chunk).filter((p) => {
      if (seenSku.has(p.sku)) return false
      seenSku.add(p.sku)
      return true
    })
    if (products.length) categories.push({ name, products })
  })

  return categories
}

function parseUpdateInfo(html) {
  const date = html.match(/(\d{4})年(\d{2})月(\d{2})日/)
  const updatedAt = html.match(/更新于\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/)
  const declaredTotal = html.match(/(\d+)\s*件商品/)
  return {
    date: date ? `${date[1]}年${date[2]}月${date[3]}日` : beijingNow(true),
    updatedAt: updatedAt ? updatedAt[1].replace(/\s+/, ' ') : beijingNow(),
    declaredTotal: declaredTotal ? Number(declaredTotal[1]) : 0
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
        if (cache.has(product.link)) {
          if (cache.get(product.link)) product.link = cache.get(product.link)
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
          cache.set(product.link, chain)
          ok += 1
        } else {
          product.__jttFailed = true
          cache.set(product.link, '')
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
  const { declaredTotal } = parseUpdateInfo(html)

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
    log('--dry-run：跳过写入')
    categories.flatMap((c) => c.products).slice(0, 5).forEach((p) => log(`  示例封面图 [${p.name}] -> ${p.img}`))
    return
  }

  await mkdir(path.dirname(CONFIG.outFile), { recursive: true })
  const before = previous ? `${JSON.stringify(previous, null, 2)}\n` : ''
  await writeFile(CONFIG.outFile, output, 'utf8')
  log(before === output ? `内容无变化：${path.relative(ROOT, CONFIG.outFile)}` : `已写入：${path.relative(ROOT, CONFIG.outFile)}`)
}

main().catch((err) => {
  console.error('[jdjz] 更新失败：', err.message)
  process.exit(1)
})
