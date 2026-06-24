import { syncAdDaily } from '@/lib/ad-daily-sync'
import { syncGroupBuy } from '@/lib/groupbuy-sync'
import { checkGroupBuyAlerts } from '@/lib/groupbuy-alerts'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// 定时同步入口（Vercel Cron 每天傍晚 MYT 调用）。
// 也可手动触发验证：带 Bearer CRON_SECRET（或 ?key=CRON_SECRET）。
// 纯代码同步：Google Sheets API → Supabase，0 token、不涉及 AI。
//
// 「总机」：按数据类型分发到各自独立模块。现支持 ad_daily + groupbuy；
// 同步后跑团购通知检查（只 GWG，发给 OWNER）。
// 通知发送时机：真正 cron(Bearer) 或 ?notify=1 → 真发；?notify=dry → 只返回不发；
//   手动 ?key= 默认不发（避免测试刷屏）。

async function run(req: Request) {
  const url = new URL(req.url)
  const secret = process.env.CRON_SECRET
  const isCron = !!secret && req.headers.get('authorization') === `Bearer ${secret}`
  if (secret) {
    const keyParam = url.searchParams.get('key') === secret
    if (!isCron && !keyParam) return new Response('forbidden', { status: 401 })
  }

  const startedAt = new Date().toISOString()
  // ?months=all（或 ?backfill=1）→ 回填所有月份页签（一次性补历史）；默认只同步当月。
  const allMonths = url.searchParams.get('months') === 'all' || url.searchParams.get('backfill') === '1'
  const notify = url.searchParams.get('notify') // '1' 真发 | 'dry' 只看 | null
  try {
    const adDaily = await syncAdDaily({ allMonths })
    const groupBuy = await syncGroupBuy()
    // 通知：真正 cron 或 ?notify=1 → 真发；?notify=dry → dry-run；其它手动触发不发
    const doNotify = isCron || notify === '1'
    const dryNotify = notify === 'dry'
    const alerts = (doNotify || dryNotify)
      ? await checkGroupBuyAlerts({ dryRun: !doNotify })
      : null
    const adOk = adDaily.filter(r => !r.error)
    const gbFailed = groupBuy.filter(r => r.error)
    return Response.json({
      ok: adDaily.every(r => !r.error) && gbFailed.length === 0,
      startedAt,
      finishedAt: new Date().toISOString(),
      ad_daily: {
        brands: adDaily.length,
        synced: adOk.length,
        totalRows: adOk.reduce((s, r) => s + r.rows, 0),
        results: adDaily,
      },
      group_buy: {
        sources: groupBuy.length,
        totalRows: groupBuy.reduce((s, r) => s + r.rows, 0),
        results: groupBuy,
      },
      alerts: alerts
        ? { sent: alerts.sent, warnings: alerts.warnings.length, listings: alerts.listings.length, messages: [...alerts.warnings, ...alerts.listings] }
        : 'skipped (manual sync — add ?notify=dry or ?notify=1)',
    })
  } catch (e) {
    return Response.json(
      { ok: false, startedAt, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}

export async function GET(req: Request) { return run(req) }
export async function POST(req: Request) { return run(req) }
