import './globals.css'
import Sidebar from './_components/Sidebar'
import ConnStatus from './_components/ConnStatus'

export const metadata = {
  title: 'Your AI HQ',
  description: 'GLCC Starter — your business in one place',
}

// width=device-width + initial-scale=1 (no iOS auto-zoom); viewportFit=cover lets
// fixed bars use env(safe-area-inset-*) on notched phones.
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app">
          <Sidebar />
          <main className="main"><ConnStatus />{children}</main>
        </div>
      </body>
    </html>
  )
}
