'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

// 左侧导航。普通 Tab 一行一个；「部门」(如 Marketing) 是一个可展开/收起的分组：
// 点部门名展开/收起，子页面缩进列在下面。默认：当前在该部门时自动展开。
//   • 加一个普通 Tab：在 TABS 加一行 + app/<name>/page.tsx
//   • 给部门加子页面：在该部门的 children 加一行（ready:false = 灰显「即将上线」）
type Child = { href: string; label: string; ready?: boolean }
type Tab = { href: string; label: string; children?: Child[] }

const TABS: Tab[] = [
  { href: '/', label: 'Dashboard' },
  { href: '/pipeline', label: 'Pipeline' },
  { href: '/money', label: 'Money' },
  { href: '/tasks', label: 'Tasks' },
  { href: '/projects', label: 'Projects' },
  { href: '/contacts', label: 'Contacts' },
  { href: '/content', label: 'Content' },
  { href: '/agents', label: 'Agents' },
  {
    href: '/marketing', label: 'Marketing',
    children: [
      { href: '/marketing/ad-daily', label: '广告日报 Ad Daily', ready: true },
      { href: '/marketing/group-buy', label: '团购 Group Buy', ready: false },
      { href: '/marketing/seeding', label: 'KOC / KOL', ready: false },
    ],
  },
]

function Group({ tab, path, onNavigate }: { tab: Tab; path: string; onNavigate?: () => void }) {
  const inSection = path === tab.href || path.startsWith(tab.href + '/')
  const [open, setOpen] = useState(inSection)
  return (
    <div className="nav-group">
      <button
        type="button"
        className={`group-label ${inSection ? 'active' : ''}`}
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <span className={`chev ${open ? 'open' : ''}`} aria-hidden="true">▸</span>
        {tab.label}
      </button>
      {open && (
        <div className="sub">
          {tab.children!.map(c =>
            c.ready ? (
              <Link key={c.href} href={c.href} className={path === c.href ? 'active' : ''} onClick={onNavigate}>
                {c.label}
              </Link>
            ) : (
              <span key={c.href} className="disabled" title="即将上线">{c.label}<span className="soon">即将上线</span></span>
            ),
          )}
        </div>
      )}
    </div>
  )
}

export default function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname()
  return (
    <nav className="nav">
      {TABS.map(t =>
        t.children ? (
          <Group key={t.href} tab={t} path={path} onNavigate={onNavigate} />
        ) : (
          <Link key={t.href} href={t.href} className={path === t.href ? 'active' : ''} onClick={onNavigate}>
            {t.label}
          </Link>
        ),
      )}
    </nav>
  )
}
