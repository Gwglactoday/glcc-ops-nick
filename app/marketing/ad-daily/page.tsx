import Link from 'next/link'
import { supabase, supabaseConfigured } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type Row = {
  company: string; brand: string; date: string; source_format: string
  meta_spend: number; shopee_cpas: number; shopee_ads: number
  lazada_cpas: number; lazada_ads: number; tiktok_spend: number; total_ad_spend: number
  fb_sales: number; ig_sales: number; shopee_sales: number; lazada_sales: number
  tiktok_sales: number; other_sales: number; total_sales: number
  total_orders: number; total_units: number
}

const rm = (n: number) => 'RM ' + Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const roas = (sales: number, spend: number) => (spend ? sales / spend : 0)
const todayMY = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' })
const addDays = (d: string, n: number) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
const monthBounds = (ym: string) => { const [y, m] = ym.split('-').map(Number); const end = new Date(Date.UTC(y, m, 0)); return { start: `${ym}-01`, end: end.toISOString().slice(0, 10) } }

export default async function AdDaily({ searchParams }: { searchParams: Promise<{ brand?: string; from?: string; to?: string }> }) {
  const sp = await searchParams

  if (!supabaseConfigured) {
    return (<><h1 className="ph">广告日报 Ad Daily</h1><p className="empty">Supabase 还没连上 — 在 .env 填好后刷新。</p></>)
  }

  // 先取所有品牌（做切换按钮），再按品牌 + 日期范围取数据。
  const { data: brandRows } = await supabase.from('marketing_ad_daily').select('brand')
  const brands = Array.from(new Set((brandRows ?? []).map(r => r.brand as string))).sort()

  if (brands.length === 0) {
    return (
      <>
        <h1 className="ph">广告日报 Ad Daily</h1>
        <p className="empty">还没有数据 — 在 Supabase 跑 supabase/marketing-ad-daily.sql，或触发 /api/sync-sheets 把品牌 sheet 拉进来。</p>
      </>
    )
  }

  const brand = sp?.brand && brands.includes(sp.brand) ? sp.brand : brands[0]
  const today = todayMY()
  const thisMonth = today.slice(0, 7)
  // 默认显示「当月」；用户可在 URL/筛选条里改 from/to。
  const dflt = monthBounds(thisMonth)
  const from = sp?.from || dflt.start
  const to = sp?.to || today

  const { data, error } = await supabase
    .from('marketing_ad_daily')
    .select('*')
    .eq('brand', brand)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true })
  const rows = (data ?? []) as Row[]
  const fmt = rows[0]?.source_format ?? 'new'

  // 快捷区间
  const prevMonth = monthBounds(addDays(dflt.start, -1).slice(0, 7))
  const ranges = [
    { key: '本月', from: dflt.start, to: today },
    { key: '上月', from: prevMonth.start, to: prevMonth.end },
    { key: '近30天', from: addDays(today, -29), to: today },
    { key: '今年', from: `${today.slice(0, 4)}-01-01`, to: today },
    { key: '全部', from: '2020-01-01', to: today },
  ]
  const qs = (o: Record<string, string>) => '?' + new URLSearchParams({ brand, ...o }).toString()

  const totalSpend = rows.reduce((s, r) => s + Number(r.total_ad_spend || 0), 0)
  const totalSales = rows.reduce((s, r) => s + Number(r.total_sales || 0), 0)
  const totalOrders = rows.reduce((s, r) => s + Number(r.total_orders || 0), 0)
  const cards: [string, string][] = [
    ['总广告花费', rm(totalSpend)],
    ['总销售', rm(totalSales)],
    ['ROAS', `${roas(totalSales, totalSpend).toFixed(2)}x`],
    ['总订单', String(totalOrders)],
  ]

  return (
    <>
      <p className="cap"><Link href="/marketing" style={{ color: 'var(--muted)' }}>← Marketing</Link></p>
      <h1 className="ph">广告日报 Ad Daily</h1>
      <p className="cap">{brand} · 每日多平台投放 vs 销售 · <span className="pill" style={{ fontSize: 12 }}>{fmt === 'new' ? '新格式' : '旧格式(转换)'}</span></p>

      {/* 品牌切换（保留当前日期范围） */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {brands.map(b => (
          <Link key={b} href={'?' + new URLSearchParams({ brand: b, from, to }).toString()}
            className={`pill ${b === brand ? 'won' : ''}`}
            style={{ textDecoration: 'none', padding: '6px 12px', fontSize: 14 }}>
            {b}
          </Link>
        ))}
      </div>

      {/* 日期范围：快捷键 + 自定义起止 */}
      <div className="daterow">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ranges.map(r => {
            const active = r.from === from && r.to === to
            return (
              <Link key={r.key} href={qs({ from: r.from, to: r.to })}
                className={`pill ${active ? 'won' : ''}`}
                style={{ textDecoration: 'none', padding: '5px 10px', fontSize: 13 }}>
                {r.key}
              </Link>
            )
          })}
        </div>
        <form method="get" className="datepick">
          <input type="hidden" name="brand" value={brand} />
          <input type="date" name="from" defaultValue={from} max={today} />
          <span style={{ color: 'var(--dim)' }}>→</span>
          <input type="date" name="to" defaultValue={to} max={today} />
          <button type="submit" className="pill" style={{ cursor: 'pointer', padding: '5px 12px', fontSize: 13 }}>套用</button>
        </form>
      </div>
      <p className="cap" style={{ marginTop: 8 }}>{from} ~ {to} · 共 {rows.length} 天</p>

      <div className="grid">
        {cards.map(([l, v]) => (
          <div className="stat" key={l}><p className="l">{l}</p><p className="v">{v}</p></div>
        ))}
      </div>

      {error || rows.length === 0 ? (
        <p className="empty">{error ? `读取出错：${error.message}` : '这个时间段没有数据 — 换个日期范围试试。'}</p>
      ) : (
        <table className="tbl">
          <thead><tr><th>日期</th><th>广告花费</th><th>Meta</th><th>Shopee</th><th>Lazada</th><th>TikTok</th><th>销售</th><th>订单</th><th>ROAS</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.date}>
                <td data-label="日期">{r.date}</td>
                <td data-label="广告花费">{rm(r.total_ad_spend)}</td>
                <td data-label="Meta">{rm(Number(r.fb_sales || 0) + Number(r.ig_sales || 0))}</td>
                <td data-label="Shopee">{rm(r.shopee_sales)}</td>
                <td data-label="Lazada">{rm(r.lazada_sales)}</td>
                <td data-label="TikTok">{rm(r.tiktok_sales)}</td>
                <td data-label="销售">{rm(r.total_sales)}</td>
                <td data-label="订单">{r.total_orders}</td>
                <td data-label="ROAS">{r.total_ad_spend ? `${roas(r.total_sales, r.total_ad_spend).toFixed(2)}x` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
