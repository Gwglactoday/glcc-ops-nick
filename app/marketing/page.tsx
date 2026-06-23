import { redirect } from 'next/navigation'

// Marketing 部门没有独立落地页：子页面都在左侧导航里直接进。
// 访问 /marketing 时跳到第一个上线的子页面（广告日报）。
export default function Marketing() {
  redirect('/marketing/ad-daily')
}
