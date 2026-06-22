import Link from 'next/link'

export const dynamic = 'force-dynamic'

// Marketing 部门首页 = 一个 Tab，下面分多个子页面（每个 task 一页）。
// 子页面逐步上线：广告日报 → 团购 → KOC/KOL；线下活动延后。
const SUBPAGES = [
  { href: '/marketing/ad-daily', label: '广告日报', en: 'Ad Daily', desc: '各自有品牌每日投放 vs 销售/订单 · ROAS', ready: true },
  { href: '#', label: '团购', en: 'Group Buy', desc: '团购活动 + 主播/负责人 + 进度状态', ready: false },
  { href: '#', label: 'KOC / KOL', en: 'Seeding', desc: '达人合作总表 + 各品牌 seeding 进度', ready: false },
]

export default function Marketing() {
  return (
    <>
      <h1 className="ph">Marketing</h1>
      <p className="cap">营销部门 · 选一个子页面进去</p>
      <div className="grid">
        {SUBPAGES.map(s => {
          const inner = (
            <>
              <p className="l">{s.en}{s.ready ? ' →' : ' · 即将上线'}</p>
              <p className="v" style={{ fontSize: 22 }}>{s.label}</p>
              <p className="l" style={{ marginTop: 6 }}>{s.desc}</p>
            </>
          )
          return s.ready ? (
            <Link key={s.label} href={s.href} className="stat" style={{ textDecoration: 'none', opacity: 1 }}>{inner}</Link>
          ) : (
            <div key={s.label} className="stat" style={{ opacity: 0.55 }}>{inner}</div>
          )
        })}
      </div>
    </>
  )
}
