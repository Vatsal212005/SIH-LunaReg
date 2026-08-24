import type { Metadata } from 'next'
import './globals.css'
import './upgrade.css'

export const metadata: Metadata = {
  title: 'LunaReg | Lunar Image Registration',
  description: 'Sensor-aware lunar image correspondence and registration workspace for SIH 26166.',
  icons: { icon: '/lunareg-mark.svg' },
}


export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
