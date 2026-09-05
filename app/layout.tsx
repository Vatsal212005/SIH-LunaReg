import type { Metadata } from 'next'
import './globals.css'
import './upgrade.css'
import './prototype.css'

export const metadata: Metadata = {
  title: 'LunaReg | Lunar Image Registration',
  description: 'Working SIH 26166 prototype for Chandrayaan-2 OHRC to LRO lunar image correspondence and registration.',
  icons: { icon: '/lunareg-mark.svg' },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
