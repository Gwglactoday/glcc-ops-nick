import Link from 'next/link'
import { supabase, supabaseConfigured } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type Row = {
  source_month: string; company: string; brand: string
  start_date: string | null; end_date: string | null; date_label: string
  host_name: string; host_type: string; sales_platform: string
  target_gmv: number | null; gmv_label: string; pic: string
  done_poster: boolean; done_listing: boolean; done_summary: boolean
  promotion_link: string; remark: string
}

const rm = (n: number) => 'RM ' + Number(n || 0).toLocaleString('en-MY', { maximumFractionDigits: 0 })
const todayMY = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' })
const addDays = (d: string, n: number) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
const monthBounds = (ym: string) => { const [y, m] = ym.split('-').map(Number); const end = new Date(Date.UTC(y, m, 0)); return { start: `${ym}-01`, end: end.toISOString().slice(0, 10) } }

export default async function GroupBuy({
  searchParams,
}: { searchParams: Promise<{ from?: string; to?: string; company?: string; brand?: string }> }) {
  const sp = await searchParams

  if (!supabaseConfigured) {
    return (<><h1 className="ph">团购 Group Buy</h1><p className="empty">Supabase 还没连上 — 在 .env 填好后刷新。</p></>)
  }

  // 取全部行做筛选项（公司/品牌下拉）
  const { data: allRows } = await supabase.from('marketing_groupbuy').select('company,brand')
  const companies = Array.from(new Set((allRows ?? []).map(r => r.company as string).filter(Boolean))).sort()
  const brandList = Array.from(new Set((allRows ?? []).map(r => r.brand as string).filter(Boolean))).sort()

  if ((allRows ?? []).length === 0) {
    return (
      <>
        <p className="cap"><Link href="/marketing" style={{ color: 'var(--muted)' }}>← Marketing</Link></p>
        <h1 className="ph">团购 Group Buy</h1>
        <p className="empty">还没有数据 — 在 Supabase 跑 supabase/marketing-groupbuy.sql，或触发 /api/sync-sheets 把团购表拉进来。</p>
      </>
    )
  }

  const today = todayMY()
  const FAR = '2099-12-31'
  // 默认「即将开团」：今天起的未来团购
  const from = sp?.from || today
  const to = sp?.to || FAR
  const company = sp?.company || ''
  const brand = sp?.brand || ''

  let q = supabase.from('marketing_groupbuy').select('*').gte('start_date', from).lte('start_date', to)
  if (company) q = q.eq('company', company)
  if (brand) q = q.eq('brand', brand)
  const { data, error } = await q.order('start_date', { ascending: true })
  const rows = (data ?? []) as Row[]

  // 快捷区间（保留当前公司/品牌筛选）
  const rangePills = [
    { key: '即将开团', from: today, to: FAR },
    { key: '近30天', from: today, to: addDays(today, 30) },
    { key: '本月', from: monthBounds(today.slice(0, 7)).start, to: monthBounds(today.slice(0, 7)).end },
    { key: '全部', from: '2020-01-01', to: FAR },
  ]
  const qs = (o: Record<string, string>) => '?' + new URLSearchParams({ company, brand, from, to, ...o }).toString()

  const totalGmv = rows.reduce((s, r) => s + Number(r.target_gmv || 0), 0)
  const brands = new Set(rows.map(r => r.brand).filter(Boolean)).size
  const cards: [string, string][] = [
    ['场次', String(rows.length)],
    ['目标 GMV 合计', rm(totalGmv)],
    ['涉及品牌', String(brands)],
    ['未完成总结', String(rows.filter(r => !r.done_summary).length)],
  ]

  const prog = (label: string, done: boolean) => <span className={`prog ${done ? 'done' : ''}`}>{label}</span>

  return (
    <>
      <p className="cap"><Link href="/marketing" style={{ color: 'var(--muted)' }}>← Marketing</Link></p>
      <h1 className="ph">团购 Group Buy</h1>
      <p className="cap">每场团购：主播 · 品牌 · 平台 · 目标GMV · 负责人 · 进度</p>

      {/* 日期快捷 + 公司/品牌/日期筛选 */}
      <div className="daterow">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {rangePills.map(r => {
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
        <form method="get" className="datepick" style={{ flexWrap: 'wrap' }}>
          <select name="company" defaultValue={company}>
            <option value="">全部公司</option>
            {companies.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select name="brand" defaultValue={brand}>
            <option value="">全部品牌</option>
            {brandList.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <input type="date" name="from" defaultValue={from === FAR ? '' : from} />
          <span style={{ color: 'var(--dim)' }}>→</span>
          <input type="date" name="to" defaultValue={to === FAR ? '' : to} />
          <button type="submit" className="pill" style={{ cursor: 'pointer', padding: '5px 12px', fontSize: 13 }}>套用</button>
        </form>
      </div>
      <p className="cap" style={{ marginTop: 8 }}>
        {from} ~ {to === FAR ? '不限' : to}{company ? ` · ${company}` : ''}{brand ? ` · ${brand}` : ''} · 共 {rows.length} 场
      </p>

      <div className="grid">
        {cards.map(([l, v]) => (
          <div className="stat" key={l}><p className="l">{l}</p><p className="v">{v}</p></div>
        ))}
      </div>

      {error || rows.length === 0 ? (
        <p className="empty">{error ? `读取出错：${error.message}` : '这个范围暂无团购 — 换个日期/筛选看看。'}</p>
      ) : (
        <table className="tbl">
          <thead><tr>
            <th>日期</th><th>公司</th><th>品牌</th><th>主播 Host</th><th>类型</th><th>平台</th>
            <th>目标GMV</th><th>负责人</th><th>进度</th><th>促销说明</th>
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td data-label="日期">{r.date_label || '—'}</td>
                <td data-label="公司">{r.company || '—'}</td>
                <td data-label="品牌">{r.brand || '—'}</td>
                <td data-label="主播">{r.host_name || '—'}</td>
                <td data-label="类型"><span className="pill" style={{ fontSize: 11 }}>{r.host_type || '—'}</span></td>
                <td data-label="平台">{r.sales_platform || '—'}</td>
                <td data-label="目标GMV">{r.target_gmv ? rm(r.target_gmv) : (r.gmv_label || '—')}</td>
                <td data-label="负责人">{r.pic || '—'}</td>
                <td data-label="进度"><span className="progs">{prog('海报', r.done_poster)}{prog('上架', r.done_listing)}{prog('总结', r.done_summary)}</span></td>
                <td data-label="促销说明">
                  {r.promotion_link
                    ? <a href={r.promotion_link} target="_blank" rel="noreferrer" style={{ color: '#8ec5ff' }}>🔗 查看</a>
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
