import crypto from 'crypto'
import fs from 'fs'

// ============================================================
// Google Sheets 只读访问（服务账号）
//
// 用一个「只读服务账号」读 Google Sheet —— 不需要 OAuth 弹窗、不需要人手登录，
// 适合每天定时跑的 cron。流程：自己签一个 JWT → 跟 Google 换 access token →
// 调 Sheets API 读数据。0 token、不涉及 AI。
//
// 凭证来源（任选一种，本地用文件、Vercel 用整段 JSON）：
//   • GOOGLE_SA_KEY_JSON  —— 服务账号 JSON 钥匙的「整段内容」（Vercel 上用这个）
//   • GOOGLE_SA_KEY_FILE  —— 本机 JSON 钥匙文件的「路径」（本地测试用这个，密钥不进 .env）
// 服务账号 email 形如 xxx@<project>.iam.gserviceaccount.com，
// 要把「源 Sheet / 登记表所在文件夹」共享(Viewer)给它，它才读得到。
// ============================================================

type ServiceAccount = { client_email: string; private_key: string }

let cachedSA: ServiceAccount | null = null

function loadServiceAccount(): ServiceAccount {
  if (cachedSA) return cachedSA
  const raw =
    process.env.GOOGLE_SA_KEY_JSON?.trim() ||
    (process.env.GOOGLE_SA_KEY_FILE ? fs.readFileSync(process.env.GOOGLE_SA_KEY_FILE.trim(), 'utf8') : '')
  if (!raw) {
    throw new Error('Google 服务账号未配置：设置 GOOGLE_SA_KEY_JSON（整段 JSON）或 GOOGLE_SA_KEY_FILE（钥匙文件路径）')
  }
  const json = JSON.parse(raw)
  // private_key 在 .env 里常被存成带字面 \n 的一行，这里还原成真正的换行
  const private_key = String(json.private_key || '').replace(/\\n/g, '\n')
  cachedSA = { client_email: json.client_email, private_key }
  return cachedSA
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// 用服务账号私钥签一个 JWT，跟 Google 换一个 1 小时有效的 access token。
let tokenCache: { token: string; exp: number } | null = null
async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (tokenCache && tokenCache.exp - 60 > now) return tokenCache.token

  const sa = loadServiceAccount()
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))
  const signingInput = `${header}.${claims}`
  const signature = base64url(crypto.createSign('RSA-SHA256').update(signingInput).sign(sa.private_key))
  const assertion = `${signingInput}.${signature}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`换取 Google access token 失败 ${res.status}: ${t.slice(0, 300)}`)
  }
  const data = await res.json()
  tokenCache = { token: data.access_token, exp: now + (data.expires_in ?? 3600) }
  return tokenCache.token
}

// 列出一个表格里所有页签的名字（用来按「当前月份」找对应月份页签）。
export async function listTabTitles(spreadsheetId: string): Promise<string[]> {
  const token = await getAccessToken()
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`读取页签列表失败 ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  return (data.sheets ?? []).map((s: { properties: { title: string } }) => s.properties.title)
}

// 读某个页签的全部单元格（二维数组，行 × 列）。空尾列会被 Google 省略，调用方需容错。
export async function getTabValues(spreadsheetId: string, tabTitle: string): Promise<string[][]> {
  const token = await getAccessToken()
  const range = encodeURIComponent(`'${tabTitle.replace(/'/g, "''")}'`)
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}` +
    `?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`读取页签「${tabTitle}」失败 ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  return (data.values ?? []) as string[][]
}
