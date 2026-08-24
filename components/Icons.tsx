import React from 'react'

type IconProps = { size?: number; className?: string }

function base(path: React.ReactNode, size = 18, className = '') {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>{path}</svg>
}

export const GridIcon = ({size=18,className=''}:IconProps) => base(<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,size,className)
export const RegisterIcon = ({size=18,className=''}:IconProps) => base(<><circle cx="8" cy="8" r="4"/><circle cx="16" cy="16" r="4"/><path d="M11 11l2 2"/></>,size,className)
export const ChartIcon = ({size=18,className=''}:IconProps) => base(<><path d="M4 19V9"/><path d="M10 19V5"/><path d="M16 19v-7"/><path d="M22 19H2"/></>,size,className)
export const DatabaseIcon = ({size=18,className=''}:IconProps) => base(<><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></>,size,className)
export const HistoryIcon = ({size=18,className=''}:IconProps) => base(<><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7v5l3 2"/></>,size,className)
export const CpuIcon = ({size=18,className=''}:IconProps) => base(<><rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/></>,size,className)
export const UploadIcon = ({size=18,className=''}:IconProps) => base(<><path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M5 20h14"/></>,size,className)
export const PlayIcon = ({size=18,className=''}:IconProps) => base(<path d="M8 5l11 7-11 7z"/>,size,className)
export const DownloadIcon = ({size=18,className=''}:IconProps) => base(<><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></>,size,className)
export const ChevronRightIcon = ({size=18,className=''}:IconProps) => base(<path d="M9 18l6-6-6-6"/>,size,className)
export const ChevronDownIcon = ({size=18,className=''}:IconProps) => base(<path d="M6 9l6 6 6-6"/>,size,className)
export const MoonIcon = ({size=18,className=''}:IconProps) => base(<path d="M20.2 15.6A9 9 0 0 1 8.4 3.8 9 9 0 1 0 20.2 15.6z"/>,size,className)
export const LayersIcon = ({size=18,className=''}:IconProps) => base(<><path d="M12 2l9 5-9 5-9-5 9-5z"/><path d="M3 12l9 5 9-5"/><path d="M3 17l9 5 9-5"/></>,size,className)
export const CrosshairIcon = ({size=18,className=''}:IconProps) => base(<><circle cx="12" cy="12" r="7"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></>,size,className)
export const EyeIcon = ({size=18,className=''}:IconProps) => base(<><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/></>,size,className)
export const SettingsIcon = ({size=18,className=''}:IconProps) => base(<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.8 1.8 0 0 0 .4 2l.1.1-2.8 2.8-.1-.1a1.8 1.8 0 0 0-2-.4 1.8 1.8 0 0 0-1.1 1.7V21h-4v-.1A1.8 1.8 0 0 0 8.8 19a1.8 1.8 0 0 0-2 .4l-.1.1-2.8-2.8.1-.1a1.8 1.8 0 0 0 .4-2A1.8 1.8 0 0 0 2.7 13H2v-4h.7a1.8 1.8 0 0 0 1.7-1.1 1.8 1.8 0 0 0-.4-2l-.1-.1L6.7 3l.1.1a1.8 1.8 0 0 0 2 .4A1.8 1.8 0 0 0 9.9 2H14v.1a1.8 1.8 0 0 0 1.1 1.7 1.8 1.8 0 0 0 2-.4l.1-.1L20 6.1l-.1.1a1.8 1.8 0 0 0-.4 2A1.8 1.8 0 0 0 21.2 9H22v4h-.8a1.8 1.8 0 0 0-1.8 2z"/></>,size,className)
export const BellIcon = ({size=18,className=''}:IconProps) => base(<><path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,size,className)
export const SearchIcon = ({size=18,className=''}:IconProps) => base(<><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></>,size,className)
export const FileIcon = ({size=18,className=''}:IconProps) => base(<><path d="M5 2h9l5 5v15H5z"/><path d="M14 2v6h5"/></>,size,className)
export const CheckIcon = ({size=18,className=''}:IconProps) => base(<path d="M5 12l4 4L19 6"/>,size,className)
export const ArrowUpRightIcon = ({size=18,className=''}:IconProps) => base(<><path d="M7 17L17 7"/><path d="M7 7h10v10"/></>,size,className)
export const SlidersIcon = ({size=18,className=''}:IconProps) => base(<><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3"/><path d="M1 14h6M9 8h6M17 16h6"/></>,size,className)
export const ActivityIcon = ({size=18,className=''}:IconProps) => base(<path d="M3 12h4l2-6 4 12 2-6h6"/>,size,className)
export const InfoIcon = ({size=18,className=''}:IconProps) => base(<><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/></>,size,className)
export const MaximizeIcon = ({size=18,className=''}:IconProps) => base(<><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></>,size,className)
export const MoreIcon = ({size=18,className=''}:IconProps) => base(<><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/></>,size,className)
export const SunIcon = ({size=18,className=''}:IconProps) => base(<><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></>,size,className)
export const MenuIcon = ({size=18,className=''}:IconProps) => base(<><path d="M4 7h16M4 12h16M4 17h16"/></>,size,className)
export const XIcon = ({size=18,className=''}:IconProps) => base(<><path d="M5 5l14 14M19 5L5 19"/></>,size,className)
export const BookOpenIcon = ({size=18,className=''}:IconProps) => base(<><path d="M3 5.5A3.5 3.5 0 0 1 6.5 2H11v17H6.5A3.5 3.5 0 0 0 3 22z"/><path d="M21 5.5A3.5 3.5 0 0 0 17.5 2H13v17h4.5A3.5 3.5 0 0 1 21 22z"/></>,size,className)
export const CopyIcon = ({size=18,className=''}:IconProps) => base(<><rect x="9" y="9" width="10" height="10" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>,size,className)
