'use client'
import { useEffect, useState } from 'react'
import Nav from './Nav'

// Desktop: a static left sidebar (identical to before — the .side aside).
// Mobile (<=768px, see globals.css): a top bar with a hamburger that slides the
// same aside in as a drawer, with a tap-outside scrim that also closes it. Nav
// links close the drawer via onNavigate.
export default function Sidebar() {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  // Lock background scroll while the mobile drawer is open.
  useEffect(() => {
    document.body.classList.toggle('drawer-open', open)
    return () => document.body.classList.remove('drawer-open')
  }, [open])

  return (
    <>
      <header className="topbar">
        <button
          className="burger"
          aria-label="Open menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <span aria-hidden="true">☰</span>
        </button>
        <div className="brand brand-top"><span className="logo" aria-hidden="true" /> Your AI HQ</div>
      </header>

      <div
        className={`scrim ${open ? 'show' : ''}`}
        onClick={close}
        aria-hidden="true"
      />

      <aside className={`side ${open ? 'open' : ''}`}>
        <button className="side-close" aria-label="Close menu" onClick={close}>×</button>
        <div className="brand"><span className="logo" aria-hidden="true" /> Your AI HQ</div>
        <Nav onNavigate={close} />
        <p className="hint">One <code>records</code> table behind all 8 tabs.</p>
      </aside>
    </>
  )
}
