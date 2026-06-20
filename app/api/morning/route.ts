import { sendMessage } from '@/lib/telegram'

export const dynamic = 'force-dynamic'

// 8am morning ping (Vercel Cron). Three things Nick used to do by hand:
//   1) remind to go to class   2) remind to eat breakfast   3) today's weather (KL).
// Secured like /api/digest: if CRON_SECRET is set, only a Bearer-matching caller
// (i.e. Vercel Cron) can trigger it.

// Kuala Lumpur. Open-Meteo is free and needs no API key.
const LAT = 3.139
const LON = 101.6869

// Compact WMO weather_code → emoji + 中文. (https://open-meteo.com/en/docs)
function describeWeather(code: number): string {
  if (code === 0) return '☀️ 晴'
  if (code <= 3) return '⛅ 多云'
  if (code <= 48) return '🌫️ 有雾'
  if (code <= 57) return '🌦️ 毛毛雨'
  if (code <= 67) return '🌧️ 有雨'
  if (code <= 77) return '🌨️ 有雪'
  if (code <= 82) return '🌧️ 阵雨'
  if (code <= 86) return '🌨️ 阵雪'
  return '⛈️ 雷雨' // 95-99
}

async function weatherLine(): Promise<string> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&timezone=Asia%2FKuala_Lumpur&forecast_days=1`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) throw new Error(`open-meteo ${res.status}`)
    const d = (await res.json())?.daily
    const desc = describeWeather(Number(d.weather_code[0]))
    const lo = Math.round(Number(d.temperature_2m_min[0]))
    const hi = Math.round(Number(d.temperature_2m_max[0]))
    const rain = Number(d.precipitation_probability_max[0])
    return `🌧️ 吉隆坡今日：${desc} ☔ 降雨 ${rain}% · ${lo}–${hi}°C`
  } catch (e) {
    console.error('[GLCC] weather fetch failed:', e)
    return '🌧️ 吉隆坡今日：天气暂时取不到，等下自己看一眼 🙂'
  }
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('forbidden', { status: 401 })
  }

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' })
  const weather = await weatherLine()

  const msg =
    `☀️ <b>早安 Nick！</b> (${today})\n` +
    `📚 记得去上课\n` +
    `🍳 记得吃早餐\n` +
    weather

  const owner = process.env.OWNER_CHAT_ID?.trim()
  if (owner) await sendMessage(owner, msg)
  return Response.json({ ok: true, sent: !!owner })
}
