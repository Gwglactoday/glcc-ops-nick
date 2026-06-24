import { supabase } from '@/lib/supabase'
import { sendMessage } from '@/lib/telegram'

// ============================================================
// 团购 Telegram 通知（同步后调用）。只针对 GWG 公司、有开团日期的团购，发给 OWNER。
// 信号 = Done Summary Sheet 打勾（= 促销说明已填，同一件事）。
//   ⚠️ 预警：距开团 ≤11 天 且 未打勾 → 每天发（不去重，cron 每天 1 次）。
//   ✅ 开 Listing：距开团 ≤10 天 且 已打勾 → 只发一次（groupbuy_alerts 去重）。
// dryRun=true 时只返回「将发送」的消息，不真正发（测试用）。
// ============================================================

type GBRow = {
  source_month: string; brand: string; host_name: string; start_date: string
  sales_platform: string; done_summary: boolean
}

function todayMY(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' })
}
function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((Date.parse(toISO) - Date.parse(fromISO)) / 86400000)
}

export type AlertResult = { warnings: string[]; listings: string[]; sent: boolean }

export async function checkGroupBuyAlerts({ dryRun = false }: { dryRun?: boolean } = {}): Promise<AlertResult> {
  const today = todayMY()
  const owner = process.env.OWNER_CHAT_ID?.trim()

  const { data } = await supabase
    .from('marketing_groupbuy')
    .select('source_month,brand,host_name,start_date,sales_platform,done_summary')
    .eq('company', 'GWG')
    .not('start_date', 'is', null)
  const rows = (data ?? []) as GBRow[]

  const warnings: { msg: string }[] = []
  const listingCand: { key: string; msg: string }[] = []

  for (const r of rows) {
    const days = daysBetween(today, r.start_date)
    if (days < 0) continue // 已开团/过去，跳过
    const head = `${r.brand} · ${r.host_name}\n开团 ${r.start_date}（还有 ${days} 天）· ${r.sales_platform || '平台未填'}`
    if (!r.done_summary && days <= 11) {
      warnings.push({ msg: `⚠️ <b>团购预警</b>\n${head}\nDone Summary Sheet 还没打勾，快开团了，请尽快完成。` })
    }
    if (r.done_summary && days <= 10) {
      const key = `listing|${r.source_month}|${r.brand}|${r.host_name}|${r.start_date}`
      listingCand.push({ key, msg: `✅ <b>可以开 Listing</b>\n${head}\nDone Summary 已完成，可以去开 listing 了。` })
    }
  }

  // 开 Listing 去重：过滤掉已发过的
  let newListings = listingCand
  if (listingCand.length) {
    const { data: sent } = await supabase
      .from('groupbuy_alerts')
      .select('alert_key')
      .in('alert_key', listingCand.map(l => l.key))
    const sentKeys = new Set((sent ?? []).map(s => s.alert_key as string))
    newListings = listingCand.filter(l => !sentKeys.has(l.key))
  }

  if (!dryRun && owner) {
    for (const w of warnings) await sendMessage(owner, w.msg)
    for (const l of newListings) await sendMessage(owner, l.msg)
    if (newListings.length) {
      await supabase.from('groupbuy_alerts').insert(newListings.map(l => ({ alert_key: l.key, alert_type: 'listing' })))
    }
  }

  return { warnings: warnings.map(w => w.msg), listings: newListings.map(l => l.msg), sent: !dryRun && !!owner }
}
