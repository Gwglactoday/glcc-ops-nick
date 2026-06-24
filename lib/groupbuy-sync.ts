import { supabase } from '@/lib/supabase'
import { listTabTitles, getTabValues } from '@/lib/google-sheets'
import { readRegistry, type RegRow } from '@/lib/registry'

// ============================================================
// 团购同步：团购总表的「按月份追踪页签」（May '26 起）→ marketing_groupbuy
//
// 一行 = 一场团购。各月页签列略不同（Target/Expected GMV、Listing Close Date…）
// → 按列名匹配。无主键 → 每月「先删该月再插入」。只取 2026-05 起的月份追踪表，
// 跳过 SOP / 日历 / KOL / 价目表等其它页签。事件是「向前排程」，所有月份都同步
// （含未来月），不按当天截断。
// ============================================================

const MONTHS_SHORT = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const START_FROM = { y: 2026, m: 5 } // 从 May '26 起，之前的不要

function norm(s: unknown): string {
  return String(s ?? '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
}
function findCol(header: string[], ...needles: string[]): number {
  const H = header.map(norm)
  for (const nd of needles) {
    const key = norm(nd)
    const i = H.findIndex(h => h === key); if (i >= 0) return i
    const j = H.findIndex(h => h.includes(key)); if (j >= 0) return j
  }
  return -1
}
const bool = (v: unknown) => v === true || /^(true|yes|✓|✔|1)$/i.test(String(v ?? '').trim())

// GMV 文字 → 数值。"50k"→50000，"1.5 Million"→1500000，"100k"→100000。
function parseGmv(raw: unknown): number | null {
  const s = String(raw ?? '').toLowerCase().replace(/,/g, '')
  const m = s.match(/([\d.]+)\s*(million|mil|m|k)?/)
  if (!m) return null
  let n = parseFloat(m[1]); if (!isFinite(n)) return null
  const u = m[2] || ''
  if (u === 'k') n *= 1e3
  else if (u === 'm' || u === 'mil' || u === 'million') n *= 1e6
  return n
}

// "3 May 26" / "8 Jun 2026" / "4th May" / "1 July" → YYYY-MM-DD；非日期(如 "Long term")返回 null。
function parseGBDate(cell: unknown, defaultYear: number): string | null {
  const s = String(cell ?? '').trim()
  if (!s) return null
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
  const m = s.match(/^(\d{1,2})\s*(?:st|nd|rd|th)?\s+([A-Za-z]+)\.?\s*'?\s*(\d{2,4})?/)
  if (!m) return null
  const day = parseInt(m[1], 10); if (day < 1 || day > 31) return null
  const mi = MONTHS_SHORT.findIndex(ms => m[2].toLowerCase().startsWith(ms))
  if (mi < 0) return null
  let yr = defaultYear
  if (m[3]) yr = m[3].length <= 2 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10)
  return `${yr}-${String(mi + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// 从页签名解析年月并判断是不是「月份追踪表」。排除日历/SOP/列表等；只认 month + 年份。
function trackerMonth(title: string): { y: number; m: number } | null {
  const t = title.toLowerCase()
  if (/calendar|sop|campaign|forecast|summary|timetable|brand list|kol|hetras|flow|market|joma|lazada/.test(t)) return null
  const mi = MONTHS_SHORT.findIndex(s => t.includes(s)); if (mi < 0) return null
  const ym = t.match(/(\d{4})|'?\s*(\d{2})\b/); if (!ym) return null
  const y = ym[1] ? Number(ym[1]) : 2000 + Number(ym[2])
  return { y, m: mi + 1 }
}

type GBRow = {
  source_month: string; seq: number | null; company: string; brand: string
  start_date: string | null; end_date: string | null; listing_close_date: string | null; date_label: string
  host_name: string; host_type: string; sales_platform: string
  target_gmv: number | null; gmv_label: string; pic: string
  done_poster: boolean; done_listing: boolean; done_summary: boolean; check_erp: boolean
  promotion_link: string; remark: string; remark_logistic: string; details: Record<string, unknown>
}

function parseTracker(values: string[][], sourceMonth: string, year: number): GBRow[] {
  // 表头：含「Host Type」那一行
  const h = values.findIndex(r => r.some(c => /host\s*type/i.test(String(c))))
  if (h < 0) return []
  const header = values[h]
  const c = {
    company: findCol(header, 'Company'), start: findCol(header, 'Start Date'), end: findCol(header, 'End Date'),
    close: findCol(header, 'Listing Close Date'), host: findCol(header, 'Host Name'), type: findCol(header, 'Host Type'),
    brand: findCol(header, 'Brand'), platform: findCol(header, 'Sales Platform'),
    gmv: findCol(header, 'Target GMV', 'Expected GMV', 'GMV'), pic: findCol(header, 'PIC'),
    poster: findCol(header, 'Done Poster'), listing: findCol(header, 'Done Listing'), summary: findCol(header, 'Done Summary'),
    erp: findCol(header, 'Check ERP'), promo: findCol(header, 'Promotion Explanation'),
    remark: findCol(header, 'Remark'), logistic: findCol(header, 'Remark Logistic'),
  }
  const seqCol = c.company > 0 ? c.company - 1 : -1
  const g = (r: string[], i: number) => (i >= 0 ? String(r[i] ?? '').trim() : '')
  const out: GBRow[] = []
  for (let i = h + 1; i < values.length; i++) {
    const r = values[i] || []
    const company = g(r, c.company), brand = g(r, c.brand), host = g(r, c.host)
    if (!company && !brand && !host) continue // 跳过空行
    const startRaw = g(r, c.start), endRaw = g(r, c.end)
    const seqRaw = seqCol >= 0 ? Number(g(r, seqCol)) : NaN
    out.push({
      source_month: sourceMonth, seq: isFinite(seqRaw) ? seqRaw : null,
      company, brand,
      start_date: parseGBDate(startRaw, year), end_date: parseGBDate(endRaw, year),
      listing_close_date: parseGBDate(g(r, c.close), year),
      date_label: [startRaw, endRaw].filter(Boolean).join(' – '),
      host_name: host, host_type: g(r, c.type), sales_platform: g(r, c.platform),
      target_gmv: parseGmv(g(r, c.gmv)), gmv_label: g(r, c.gmv), pic: g(r, c.pic),
      done_poster: bool(r[c.poster]), done_listing: bool(r[c.listing]), done_summary: bool(r[c.summary]),
      check_erp: bool(r[c.erp]), promotion_link: g(r, c.promo),
      remark: g(r, c.remark), remark_logistic: g(r, c.logistic), details: {},
    })
  }
  return out
}

export type GroupBuyResult = { sheet: string; months?: number; rows: number; tabs?: string; error?: string }

export async function syncGroupBuy(): Promise<GroupBuyResult[]> {
  const reg = await readRegistry('groupbuy')
  const results: GroupBuyResult[] = []
  for (const src of reg as RegRow[]) {
    const res: GroupBuyResult = { sheet: src.sheetId.slice(0, 8), rows: 0 }
    try {
      const titles = await listTabTitles(src.sheetId)
      const months = titles
        .map(t => ({ t, ym: trackerMonth(t) }))
        .filter((x): x is { t: string; ym: { y: number; m: number } } =>
          !!x.ym && (x.ym.y > START_FROM.y || (x.ym.y === START_FROM.y && x.ym.m >= START_FROM.m)))
      if (months.length === 0) { res.error = '没找到 May 26 起的月份追踪页签'; results.push(res); continue }
      let total = 0; const done: string[] = []
      for (const { t, ym } of months) {
        const values = await getTabValues(src.sheetId, t)
        const sm = `${ym.y}-${String(ym.m).padStart(2, '0')}`
        const parsed = parseTracker(values, sm, ym.y)
        // 先删该月再插入（无主键，保证与源表一致）
        const del = await supabase.from('marketing_groupbuy').delete().eq('source_month', sm)
        if (del.error) throw new Error('删除旧行失败: ' + del.error.message)
        if (parsed.length > 0) {
          const ins = await supabase.from('marketing_groupbuy').insert(parsed)
          if (ins.error) throw new Error('写入失败: ' + ins.error.message)
        }
        total += parsed.length; done.push(`${t}:${parsed.length}`)
      }
      res.rows = total; res.months = months.length; res.tabs = done.join(', ')
    } catch (e) {
      res.error = e instanceof Error ? e.message : String(e)
    }
    results.push(res)
  }
  return results
}
