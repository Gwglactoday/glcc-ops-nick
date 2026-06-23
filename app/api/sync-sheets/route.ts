import { syncAdDaily } from '@/lib/ad-daily-sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// 定时同步入口（Vercel Cron 每天 10:30 / 18:30 MYT 调用）。
// 也可手动触发验证：带 Bearer CRON_SECRET（或 ?key=CRON_SECRET）。
// 纯代码同步：Google Sheets API → Supabase，0 token、不涉及 AI。
//
// 现支持：ad_daily（广告日报）。groupbuy / kol_seeding 之后阶段再加进来。

async function run(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const url = new URL(req.url)
    const bearer = req.headers.get('authorization') === `Bearer ${secret}`
    const keyParam = url.searchParams.get('key') === secret
    if (!bearer && !keyParam) return new Response('forbidden', { status: 401 })
  }

  const startedAt = new Date().toISOString()
  // ?months=all（或 ?backfill=1）→ 回填所有月份页签（一次性补历史）；默认只同步当月。
  const url = new URL(req.url)
  const allMonths = url.searchParams.get('months') === 'all' || url.searchParams.get('backfill') === '1'
  try {
    const adDaily = await syncAdDaily({ allMonths })
    const ok = adDaily.filter(r => !r.error)
    const failed = adDaily.filter(r => r.error)
    return Response.json({
      ok: failed.length === 0,
      startedAt,
      finishedAt: new Date().toISOString(),
      ad_daily: {
        brands: adDaily.length,
        synced: ok.length,
        totalRows: ok.reduce((s, r) => s + r.rows, 0),
        results: adDaily,
      },
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
