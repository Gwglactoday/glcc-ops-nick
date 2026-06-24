import { listTabTitles, getTabValues } from '@/lib/google-sheets'

// ============================================================
// 共享：读「数据同步登记表」。所有数据类型（ad_daily / groupbuy / kol_seeding…）
// 都从这里拿「要同步哪些源表」。Nick 加一行 = 加一个数据源，无需改代码。
// ============================================================

export const REGISTRY_ID =
  process.env.GOOGLE_SYNC_REGISTRY_ID?.trim() || '1ZfG2NEBTHZTeSMG4-NkJWmMk-9OyKktZGNqTrx09Dts'

export type RegRow = { company: string; brand: string; sheetId: string; tabOrGid: string }

function norm(s: unknown): string {
  return String(s ?? '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
}

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

function sheetIdFromUrl(url: string): string {
  const m = String(url).match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  return m ? m[1] : ''
}

// 读登记表里某个数据类型、且「启用」的所有源行。
export async function readRegistry(dataType: string): Promise<RegRow[]> {
  const titles = await listTabTitles(REGISTRY_ID)
  const values = await getTabValues(REGISTRY_ID, titles[0])
  const hi = values.findIndex(r => r.some(c => norm(c).includes('sheet')) && r.some(c => norm(c).includes(norm('数据类型')) || norm(c).includes('type')))
  const header = values[hi >= 0 ? hi : 0]
  const ci = {
    on: findCol(header, '启用'), type: findCol(header, '数据类型'),
    company: findCol(header, '公司'), brand: findCol(header, '品牌'),
    link: findCol(header, 'Sheet链接', 'Sheet'), tab: findCol(header, '页签或gid', '页签', 'gid'),
  }
  const rows: RegRow[] = []
  for (let i = (hi >= 0 ? hi : 0) + 1; i < values.length; i++) {
    const r = values[i] || []
    const enabled = /✓|✔|yes|true|1|y/i.test(String(r[ci.on] ?? '').trim())
    if (!enabled) continue
    if (norm(r[ci.type]) !== norm(dataType)) continue
    const sheetId = sheetIdFromUrl(r[ci.link] ?? '')
    if (!sheetId) continue
    rows.push({
      company: String(r[ci.company] ?? '').trim(),
      brand: String(r[ci.brand] ?? '').trim(),
      sheetId,
      tabOrGid: String(ci.tab >= 0 ? r[ci.tab] ?? '' : '').trim(),
    })
  }
  return rows
}
