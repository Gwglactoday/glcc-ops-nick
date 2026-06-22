import Link from 'next/link'
import { supabase, supabaseConfigured } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type Row = {
  company: string; brand: string; date: string
  shopee_cpas_ads_cost: number; lazada_cpas_ads_cost: number; awa_ads_cost: number; lead_to_pm_ad_cost: number
  new_pm: number; pmed: number; total_comments: number; new_order: number; repeat_order: number; product_sold: number
  fb_new_sales: number; fb_repeat_sales: number; insta_new_sales: number; insta_repeat_sales: number
  shopee_sales: number; lazada_sales: number; other_platform_sales: number
}

const SPEND = ['shopee_cpas_ads_cost', 'lazada_cpas_ads_cost', 'awa_ads_cost', 'lead_to_pm_ad_cost'] as const
const SALES = ['fb_new_sales', 'fb_repeat_sales', 'insta_new_sales', 'insta_repeat_sales', 'shopee_sales', 'lazada_sales', 'other_platform_sales'] as const
const rm = (n: number) => 'RM ' + Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const sum = (r: Row, keys: readonly string[]) => keys.reduce((s, k) => s + Number((r as any)[k] || 0), 0)
const orders = (r: Row) => Number(r.new_order || 0) + Number(r.repeat_order || 0)

export default async function AdDaily({ searchParams }: { searchParams: Promise<{ brand?: string }> }) {
  const sp = await searchParams

  if (!supabaseConfigured) {
    return (<><h1 className="ph">广告日报 Ad Daily</h1><p className="empty">Supabase 还没连上 — 在 .env 填好后刷新。</p></>)
  }

  const { data, error } = await supabase
    .from('marketing_ad_daily')
    .select('*')
    .order('date', { ascending: true })
  const all = (data ?? []) as Row[]

  if (error || all.length === 0) {
    return (
      <>
        <p className="cap"><Link href="/marketing" style={{ color: 'var(--muted)' }}>← Marketing</Link></p>
        <h1 className="ph">广告日报 Ad Daily</h1>
        <p className="empty">{error ? `读取出错：${error.message}` : '还没有数据 — 在 Supabase 跑 supabase/marketing-ad-daily.sql，或等同步把品牌 sheet 拉进来。'}</p>
      </>
    )
  }

  const brands = Array.from(new Set(all.map(r => r.brand))).sort()
  const brand = sp?.brand && brands.includes(sp.brand) ? sp.brand : brands[0]
  const rows = all.filter(r => r.brand === brand)

  const totalSpend = rows.reduce((s, r) => s + sum(r, SPEND), 0)
  const totalSales = rows.reduce((s, r) => s + sum(r, SALES), 0)
  const totalOrders = rows.reduce((s, r) => s + orders(r), 0)
  const roas = totalSpend ? totalSales / totalSpend : 0
  const cards: [string, string][] = [
    ['总广告花费', rm(totalSpend)],
    ['总销售', rm(totalSales)],
    ['ROAS', `${roas.toFixed(2)}x`],
    ['总订单', String(totalOrders)],
  ]

  return (
    <>
      <p className="cap"><Link href="/marketing" style={{ color: 'var(--muted)' }}>← Marketing</Link></p>
      <h1 className="ph">广告日报 Ad Daily</h1>
      <p className="cap">{brand} · 每日投放 vs 销售/订单</p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        {brands.map(b => (
          <Link key={b} href={`/marketing/ad-daily?brand=${encodeURIComponent(b)}`}
            className={`pill ${b === brand ? 'won' : ''}`}
            style={{ textDecoration: 'none', padding: '6px 12px', fontSize: 14 }}>
            {b}
          </Link>
        ))}
      </div>

      <div className="grid">
        {cards.map(([l, v]) => (
          <div className="stat" key={l}><p className="l">{l}</p><p className="v">{v}</p></div>
        ))}
      </div>

      <table className="tbl">
        <thead><tr><th>日期</th><th>广告花费</th><th>订单</th><th>出货</th><th>销售</th><th>ROAS</th></tr></thead>
        <tbody>
          {rows.map(r => {
            const spend = sum(r, SPEND), sales = sum(r, SALES)
            const rr = spend ? sales / spend : 0
            return (
              <tr key={r.date}>
                <td data-label="日期">{r.date}</td>
                <td data-label="广告花费">{rm(spend)}</td>
                <td data-label="订单">{orders(r)}</td>
                <td data-label="出货">{r.product_sold}</td>
                <td data-label="销售">{rm(sales)}</td>
                <td data-label="ROAS">{spend ? `${rr.toFixed(2)}x` : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </>
  )
}
