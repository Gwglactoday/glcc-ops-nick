import { supabase } from '@/lib/supabase'
import { listTabTitles, getTabValues } from '@/lib/google-sheets'

// ============================================================
// 广告日报同步：登记表 → 各品牌当月页签 → marketing_ad_daily
//
// 由「登记表」驱动：Nick 在登记表加一行=加一个数据源，无需改代码。
// ad_daily 用「月份页签」，所以这里按【当前马来月份】在源表里找对应页签，
// 而不是用登记表里固定的 gid。新格式(E-com Report)直接映射；旧 18 栏格式
// 经「转换器」映射进同一张表的共同字段。跳过 TOTAL/Average 等汇总行与未来日期。
// ============================================================

const REGISTRY_ID =
  process.env.GOOGLE_SYNC_REGISTRY_ID?.trim() || '1ZfG2NEBTHZTeSMG4-NkJWmMk-9OyKktZGNqTrx09Dts'

const MONTHS_SHORT = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const MONTHS_LONG = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

// ---------- 小工具 ----------

// "RM1,234.50" / "1,234" / "12.3%" / 数字 → number
function num(v: unknown): number {
  if (typeof v === 'number') return isFinite(v) ? v : 0
  if (v == null) return 0
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''))
  return isFinite(n) ? n : 0
}

// 归一化用于「按名字匹配表头」：转小写、去掉空白/换行/标点，但保留中英文字与数字
// （\p{L} 含中文，所以中文表头「数据类型/公司/品牌」也能匹配）。
function norm(s: unknown): string {
  return String(s ?? '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
}

function todayMY(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }) // YYYY-MM-DD
}

// 从一行表头里，按「名字片段」找出列下标（容忍换行/空格/大小写/标点）。
function findCol(header: string[], ...needles: string[]): number {
  const H = header.map(norm)
  for (const nd of needles) {
    const key = norm(nd)
    const i = H.findIndex(h => h === key)
    if (i >= 0) return i
    const j = H.findIndex(h => h.includes(key))
    if (j >= 0) return j
  }
  return -1
}

// 在某月页签名候选里挑出当前年月对应的那个页签。
// 容忍 "Jun 2026" / "Jun2026" / "June 2026" / "Jun" / "06/2026" 等写法。
function resolveMonthTab(titles: string[], year: number, month: number): string | null {
  const short = MONTHS_SHORT[month - 1]
  const long = MONTHS_LONG[month - 1]
  const yr = String(year)
  const yr2 = yr.slice(2)
  const scored = titles.map(t => {
    const n = norm(t)
    const hasMonth = n.includes(short) || n.includes(long)
    const has4yr = /\d{4}/.test(n)
    const hasYear = n.includes(yr) || (!has4yr && n.includes(yr2))
    let score = -1
    if (hasMonth && n.includes(yr)) score = 3            // 月 + 完整年（最准）
    else if (hasMonth && hasYear) score = 2               // 月 + 两位年
    else if (hasMonth && !has4yr) score = 1               // 只有月、没有别的年份干扰
    return { t, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored[0] && scored[0].score >= 1 ? scored[0].t : null
}

// 把 Date 单元格 + 页签的(年,月) 解析成 YYYY-MM-DD。失败返回 null（用来跳过汇总/空行）。
function parseRowDate(cell: unknown, year: number, month: number): string | null {
  if (cell == null || cell === '') return null
  const s = String(cell).trim()
  // ISO: 2026-06-01
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
  // 找「日」：第一个 1–31 的数字
  const dayM = s.match(/\b([0-3]?\d)\b/)
  if (!dayM) return null
  const day = parseInt(dayM[1], 10)
  if (day < 1 || day > 31) return null
  // 找「月名」（cell 里若有就用 cell 的，否则用页签的月份）
  let m = month
  const low = s.toLowerCase()
  const mi = MONTHS_SHORT.findIndex(ms => low.includes(ms))
  if (mi >= 0) m = mi + 1
  return `${year}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// 在 values 里找数据表头那一行（第一格是 Date，且包含某关键列）。
function findHeaderRow(values: string[][], mustContain: string): number {
  const key = norm(mustContain)
  for (let i = 0; i < values.length; i++) {
    const row = values[i] || []
    if (norm(row[0]) === 'date' && row.some(c => norm(c).includes(key))) return i
  }
  return -1
}

type Canon = {
  date: string
  source_format: 'new' | 'old'
  meta_spend: number; shopee_cpas: number; shopee_ads: number
  lazada_cpas: number; lazada_ads: number; tiktok_spend: number; total_ad_spend: number
  fb_sales: number; ig_sales: number; shopee_sales: number; lazada_sales: number
  tiktok_sales: number; other_sales: number; total_sales: number
  total_orders: number; total_units: number; new_msg: number; total_msg: number
  details: Record<string, number>
}

// ---------- 新格式（E-com Report，如 Fitmode）----------
function parseNew(values: string[][], year: number, month: number, cutoff: string): Canon[] {
  const h = findHeaderRow(values, 'Total Ad Spend')
  if (h < 0) return []
  const header = values[h]
  const col = (...n: string[]) => findCol(header, ...n)
  const c = {
    date: col('Date'), meta: col('Meta Spend'), newMsg: col('New Msg'), totMsg: col('Total Msg'),
    fb: col('FB Sales'), ig: col('IG Sales'), metaOrd: col('Meta Orders'), metaUnit: col('Meta Units'),
    sCpas: col('Shopee CPAS'), sAds: col('Shopee Ads'), sTotal: col('Shopee Total'), sNet: col('Shopee Net'), sOrd: col('Shopee Orders'), sUnit: col('Shopee Units'),
    lCpas: col('Lazada CPAS'), lAds: col('Lazada Ads'), lTotal: col('Lazada Total'), lNet: col('Lazada Net'), lOrd: col('Lazada Orders'), lUnit: col('Lazada Units'),
    tSpend: col('TikTok Spend'), tSales: col('TikTok Sales'), tOrd: col('TikTok Orders'), tUnit: col('TikTok Units'),
    other: col('Other Sales'), totSpend: col('Total Ad Spend'), totOrd: col('Total Orders'), totUnit: col('Total Units'), totSales: col('Total Sales'),
    cumul: col('Cumul'), existMsg: col('Existing Msg'),
  }
  const out: Canon[] = []
  for (let i = h + 1; i < values.length; i++) {
    const r = values[i] || []
    const date = parseRowDate(r[c.date], year, month)
    if (!date) continue
    if (date > cutoff) continue // 跳过未来日期
    out.push({
      date, source_format: 'new',
      meta_spend: num(r[c.meta]), shopee_cpas: num(r[c.sCpas]), shopee_ads: num(r[c.sAds]),
      lazada_cpas: num(r[c.lCpas]), lazada_ads: num(r[c.lAds]), tiktok_spend: num(r[c.tSpend]),
      total_ad_spend: num(r[c.totSpend]),
      fb_sales: num(r[c.fb]), ig_sales: num(r[c.ig]), shopee_sales: num(r[c.sTotal]), lazada_sales: num(r[c.lTotal]),
      tiktok_sales: num(r[c.tSales]), other_sales: num(r[c.other]), total_sales: num(r[c.totSales]),
      total_orders: Math.round(num(r[c.totOrd])), total_units: Math.round(num(r[c.totUnit])),
      new_msg: Math.round(num(r[c.newMsg])), total_msg: Math.round(num(r[c.totMsg])),
      details: {
        shopee_net: num(r[c.sNet]), lazada_net: num(r[c.lNet]),
        meta_orders: num(r[c.metaOrd]), meta_units: num(r[c.metaUnit]),
        shopee_orders: num(r[c.sOrd]), shopee_units: num(r[c.sUnit]),
        lazada_orders: num(r[c.lOrd]), lazada_units: num(r[c.lUnit]),
        tiktok_orders: num(r[c.tOrd]), tiktok_units: num(r[c.tUnit]),
        existing_msg: num(r[c.existMsg]), cumul_sales: num(r[c.cumul]),
      },
    })
  }
  return out
}

// ---------- 登记表 ----------
type RegRow = { company: string; brand: string; sheetId: string }

function sheetIdFromUrl(url: string): string {
  const m = String(url).match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  return m ? m[1] : ''
}

async function readAdDailyRegistry(): Promise<RegRow[]> {
  const titles = await listTabTitles(REGISTRY_ID)
  const values = await getTabValues(REGISTRY_ID, titles[0])
  const hi = values.findIndex(r => r.some(c => norm(c).includes('sheet')) && r.some(c => norm(c).includes(norm('数据类型')) || norm(c).includes('type')))
  const header = values[hi >= 0 ? hi : 0]
  const ci = {
    on: findCol(header, '启用'), type: findCol(header, '数据类型'),
    company: findCol(header, '公司'), brand: findCol(header, '品牌'), link: findCol(header, 'Sheet链接', 'Sheet'),
  }
  const rows: RegRow[] = []
  for (let i = (hi >= 0 ? hi : 0) + 1; i < values.length; i++) {
    const r = values[i] || []
    const on = String(r[ci.on] ?? '').trim()
    const enabled = /✓|✔|yes|true|1|y/i.test(on)
    if (!enabled) continue
    if (norm(r[ci.type]) !== norm('ad_daily')) continue
    const sheetId = sheetIdFromUrl(r[ci.link] ?? '')
    if (!sheetId) continue
    rows.push({ company: String(r[ci.company] ?? '').trim(), brand: String(r[ci.brand] ?? '').trim(), sheetId })
  }
  return rows
}

export type SyncResult = { brand: string; company: string; tab?: string; rows: number; months?: number; error?: string }

// 从页签名解析出年月，如 "May 2026" / "April 2026" / "Jun2026" → {y,m}；认不出返回 null。
function monthFromTabName(title: string): { y: number; m: number } | null {
  const t = title.toLowerCase()
  const mi = MONTHS_SHORT.findIndex(s => t.includes(s))   // 长名含短名：april⊇apr、june⊇jun…
  const ym = t.match(/(20\d{2})/)
  if (mi < 0 || !ym) return null
  return { y: Number(ym[1]), m: mi + 1 }
}

// 同步某品牌某个月份页签：解析(新格式) → 只删该月 → 插入。返回写入行数（0=没解析到）。
async function syncOneMonth(src: RegRow, tab: string, y: number, m: number, cutoff: string): Promise<number> {
  const values = await getTabValues(src.sheetId, tab)
  const parsed = parseNew(values, y, m, cutoff)
  if (parsed.length === 0) return 0
  const mp = `${y}-${String(m).padStart(2, '0')}`
  const nextMonthStart = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10) // 下月1号（避开31号无效日期）
  const del = await supabase.from('marketing_ad_daily').delete()
    .eq('brand', src.brand).gte('date', `${mp}-01`).lt('date', nextMonthStart)
  if (del.error) throw new Error('删除该月旧行失败: ' + del.error.message)
  const payload = parsed.map(p => ({ company: src.company, brand: src.brand, ...p }))
  const ins = await supabase.from('marketing_ad_daily').insert(payload)
  if (ins.error) throw new Error('写入失败: ' + ins.error.message)
  return parsed.length
}

// allMonths=true：回填——把所有「能认出月份」的页签都拉进来（一次性补历史）。
// 默认 false：只同步当前月份（每天 cron 用，快）。
export async function syncAdDaily(opts: { allMonths?: boolean } = {}): Promise<SyncResult[]> {
  const cutoff = todayMY()
  const [y, m] = cutoff.split('-').map(Number)
  const reg = await readAdDailyRegistry()
  const results: SyncResult[] = []

  for (const src of reg) {
    const res: SyncResult = { brand: src.brand, company: src.company, rows: 0 }
    try {
      const titles = await listTabTitles(src.sheetId)
      if (opts.allMonths) {
        const monthTabs = titles
          .map(t => ({ t, ym: monthFromTabName(t) }))
          .filter((x): x is { t: string; ym: { y: number; m: number } } => !!x.ym)
        if (monthTabs.length === 0) { res.error = `没有可识别的月份页签；现有: ${titles.join(', ').slice(0, 120)}`; results.push(res); continue }
        let total = 0; const done: string[] = []
        for (const { t, ym } of monthTabs) {
          const rows = await syncOneMonth(src, t, ym.y, ym.m, cutoff)
          if (rows > 0) { total += rows; done.push(t) }
        }
        res.rows = total; res.months = done.length; res.tab = done.join(', ')
        if (total === 0) res.error = '所有月份页签都没解析到新格式数据'
      } else {
        const tab = resolveMonthTab(titles, y, m)
        if (!tab) { res.error = `找不到当前月份(${y}-${m})的页签；现有页签: ${titles.join(', ').slice(0, 120)}`; results.push(res); continue }
        res.tab = tab
        const rows = await syncOneMonth(src, tab, y, m, cutoff)
        if (rows === 0) { res.error = '该页签没解析到数据行（新格式表头未识别，或本月暂无数据）'; results.push(res); continue }
        res.rows = rows
      }
    } catch (e) {
      res.error = e instanceof Error ? e.message : String(e)
    }
    results.push(res)
  }
  return results
}
