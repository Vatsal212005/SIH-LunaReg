'use client'

import React from 'react'

type Props = {
  variant?: 'source' | 'reference' | 'registered' | 'coverage'
  className?: string
  showMatches?: boolean
  overlay?: number
  compact?: boolean
}

const ptsA = [
  [12,18],[22,28],[31,20],[42,34],[55,22],[65,31],[77,20],[86,33],
  [16,47],[27,54],[39,45],[51,56],[63,47],[75,58],[88,50],
  [11,73],[23,68],[35,79],[48,70],[61,80],[74,71],[87,78]
]

const ptsB = [
  [16,21],[25,31],[35,24],[45,36],[57,25],[67,34],[79,24],[89,36],
  [18,49],[30,57],[42,48],[54,59],[66,50],[78,61],[90,53],
  [14,75],[26,71],[38,81],[51,73],[64,82],[77,74],[90,80]
]

export default function LunarScene({variant='source', className='', showMatches=false, overlay=52, compact=false}: Props) {
  const uid = React.useId().replaceAll(':','')
  const suffix = `${variant}${compact ? '-c' : ''}-${uid}`
  const rotation = variant === 'reference' ? 1.4 : variant === 'registered' ? 0.35 : -0.7
  const shiftX = variant === 'reference' ? 12 : variant === 'registered' ? 4 : 0
  const shiftY = variant === 'reference' ? -4 : variant === 'registered' ? 1 : 0
  const scale = variant === 'reference' ? 1.08 : variant === 'registered' ? 1.02 : 1

  return (
    <div className={`lunar-scene ${className}`}>
      <svg viewBox="0 0 1000 660" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Lunar terrain visualization">
        <defs>
          <filter id={`terrain-${suffix}`} x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.028" numOctaves="4" seed={variant === 'reference' ? 8 : 3} result="noise"/>
            <feColorMatrix in="noise" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 .58 0" result="softNoise"/>
            <feBlend in="SourceGraphic" in2="softNoise" mode="soft-light"/>
          </filter>
          <radialGradient id={`vignette-${suffix}`} cx="50%" cy="48%" r="72%">
            <stop offset="0" stopColor="#000000" stopOpacity="0"/>
            <stop offset="0.68" stopColor="#000000" stopOpacity="0.08"/>
            <stop offset="1" stopColor="#000000" stopOpacity="0.88"/>
          </radialGradient>
          <radialGradient id={`bg-${suffix}`} cx={variant==='reference' ? '58%' : '40%'} cy="44%" r="72%">
            <stop offset="0" stopColor={variant==='reference' ? '#4a4b4f' : '#515257'}/>
            <stop offset="0.42" stopColor="#282b30"/>
            <stop offset="1" stopColor="#0b0d10"/>
          </radialGradient>
          <radialGradient id={`crater-${suffix}`} cx="38%" cy="34%" r="66%">
            <stop offset="0" stopColor="#22252a"/>
            <stop offset="0.7" stopColor="#0f1114"/>
            <stop offset="0.76" stopColor="#64666b"/>
            <stop offset="0.84" stopColor="#25282d"/>
            <stop offset="1" stopColor="#111317"/>
          </radialGradient>
          <linearGradient id={`rim-${suffix}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#b8bbc2" stopOpacity=".78"/>
            <stop offset=".35" stopColor="#70737a" stopOpacity=".45"/>
            <stop offset=".8" stopColor="#111318" stopOpacity=".05"/>
          </linearGradient>
          <linearGradient id={`scan-${suffix}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#4cc8ff" stopOpacity="0"/>
            <stop offset=".5" stopColor="#4cc8ff" stopOpacity=".45"/>
            <stop offset="1" stopColor="#4cc8ff" stopOpacity="0"/>
          </linearGradient>
          <filter id={`glow-${suffix}`}>
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <clipPath id={`clip-${suffix}`}><rect width="1000" height="660" rx="18"/></clipPath>
        </defs>

        <g clipPath={`url(#clip-${suffix})`}>
          <rect width="1000" height="660" fill={`url(#bg-${suffix})`}/>
          <g transform={`translate(${shiftX} ${shiftY}) rotate(${rotation} 500 330) scale(${scale})`} filter={`url(#terrain-${suffix})`}>
            <path d="M-60 505 C120 438 197 460 315 412 C441 361 569 398 664 350 C794 284 918 302 1060 238 L1060 720 L-60 720Z" fill="#171a1f" opacity=".74"/>
            <path d="M-60 172 C89 114 203 156 309 131 C419 105 538 68 655 99 C784 133 900 83 1060 112 L1060 -30 L-60 -30Z" fill="#5e6066" opacity=".18"/>
            <path d="M-30 422 C156 367 247 390 346 340 C445 289 560 313 671 278 C798 237 892 238 1030 204" fill="none" stroke="#c3c6cd" strokeOpacity=".08" strokeWidth="5"/>
            <path d="M-20 450 C160 395 263 420 366 368 C471 315 580 341 693 304 C807 267 909 268 1020 238" fill="none" stroke="#0a0c0f" strokeOpacity=".55" strokeWidth="14"/>

            <g opacity=".96">
              <ellipse cx="305" cy="220" rx="155" ry="112" fill={`url(#crater-${suffix})`} transform="rotate(-12 305 220)"/>
              <ellipse cx="291" cy="206" rx="149" ry="104" fill="none" stroke={`url(#rim-${suffix})`} strokeWidth="11" transform="rotate(-12 291 206)"/>
              <ellipse cx="306" cy="222" rx="122" ry="78" fill="#0e1013" opacity=".48" transform="rotate(-12 306 222)"/>
              <path d="M176 180 C228 126 302 121 374 142 C333 129 251 135 198 198Z" fill="#e1e3e8" opacity={variant==='reference'?'.22':'.31'}/>
              <path d="M383 167 C418 218 407 271 356 306 C399 271 404 213 383 167Z" fill="#050608" opacity=".54"/>
            </g>

            <g opacity=".92">
              <ellipse cx="716" cy="352" rx="102" ry="74" fill={`url(#crater-${suffix})`} transform="rotate(17 716 352)"/>
              <ellipse cx="705" cy="342" rx="96" ry="67" fill="none" stroke={`url(#rim-${suffix})`} strokeWidth="8" transform="rotate(17 705 342)"/>
              <path d="M625 330 C660 293 719 292 762 311 C715 300 673 306 640 343Z" fill="#f2f3f5" opacity={variant==='reference'?'.18':'.28'}/>
            </g>

            <g opacity=".88">
              <ellipse cx="563" cy="515" rx="65" ry="48" fill={`url(#crater-${suffix})`} transform="rotate(-8 563 515)"/>
              <ellipse cx="555" cy="507" rx="61" ry="43" fill="none" stroke={`url(#rim-${suffix})`} strokeWidth="6"/>
            </g>

            {[
              [98,325,34,24],[488,128,42,30],[842,153,49,35],[892,465,43,31],[422,465,29,21],[773,557,34,24],[140,550,50,35],[607,229,25,18],[930,280,25,18]
            ].map((c,i)=><g key={i} opacity={0.55+(i%3)*.08}>
              <ellipse cx={c[0]} cy={c[1]} rx={c[2]} ry={c[3]} fill="#0d0f12"/>
              <ellipse cx={c[0]-3} cy={c[1]-3} rx={c[2]} ry={c[3]} fill="none" stroke="#c4c5c8" strokeOpacity=".24" strokeWidth="3"/>
            </g>)}

            <g fill="none" stroke="#cfd4dc" strokeOpacity=".11" strokeWidth="1.4">
              <path d="M37 595 C185 527 314 566 440 518 S699 477 964 379"/>
              <path d="M20 618 C202 545 311 600 466 539 S728 502 984 405"/>
              <path d="M53 91 C207 32 333 70 470 57 S711 27 949 71"/>
            </g>
          </g>

          <rect width="1000" height="660" fill={`url(#vignette-${suffix})`} opacity=".58"/>
          <g opacity=".18">
            {Array.from({length: 13}).map((_,i)=><line key={i} x1="0" y1={i*55} x2="1000" y2={i*55} stroke="#ffffff" strokeWidth=".6"/>) }
            {Array.from({length: 19}).map((_,i)=><line key={i} x1={i*56} y1="0" x2={i*56} y2="660" stroke="#ffffff" strokeWidth=".45"/>) }
          </g>

          {variant === 'coverage' && ptsA.map((p,i)=> (
            <g key={i} transform={`translate(${p[0]*10} ${p[1]*6.6})`} filter={`url(#glow-${suffix})`}>
              <circle r="8" fill="#5cd6ff" fillOpacity=".15" stroke="#5cd6ff" strokeWidth="2"/>
              <circle r="2.5" fill="#c7f2ff"/>
            </g>
          ))}

          {showMatches && (
            <g>
              {ptsA.slice(0,17).map((p,i)=> {
                const q = ptsB[i]
                return <line key={i} x1={p[0]*5} y1={p[1]*6.6} x2={500+q[0]*5} y2={q[1]*6.6} stroke="#65dcff" strokeWidth="1.5" strokeOpacity=".52"/>
              })}
            </g>
          )}

          {variant === 'registered' && (
            <g>
              <rect width={`${Math.max(5,Math.min(95,overlay))}%`} height="660" fill="#4cc8ff" opacity=".05"/>
              <line x1={`${overlay}%`} x2={`${overlay}%`} y1="0" y2="660" stroke="#d9f4ff" strokeWidth="2" strokeOpacity=".85"/>
              <g transform={`translate(${overlay*10} 330)`}>
                <circle r="20" fill="#0c1820" stroke="#8fe7ff" strokeWidth="2"/>
                <path d="M-5 -7l-5 7 5 7M5 -7l5 7-5 7" fill="none" stroke="#d7f8ff" strokeWidth="2"/>
              </g>
            </g>
          )}

          <rect x="20" y="20" width="124" height="34" rx="17" fill="#090c10" fillOpacity=".66" stroke="#ffffff" strokeOpacity=".09"/>
          <circle cx="38" cy="37" r="4" fill="#5cd6ff"/>
          <text x="50" y="42" fill="#dce7ee" fontSize="13" fontFamily="Segoe UI, sans-serif" letterSpacing="1.4">
            {variant === 'reference' ? 'LRO NAC' : variant === 'registered' ? 'REGISTERED' : variant === 'coverage' ? 'COVERAGE' : 'OHRC'}
          </text>

          <g transform="translate(842 584)">
            <line x1="0" y1="22" x2="116" y2="22" stroke="#eef5f8" strokeWidth="2"/>
            <line x1="0" y1="15" x2="0" y2="29" stroke="#eef5f8" strokeWidth="2"/>
            <line x1="116" y1="15" x2="116" y2="29" stroke="#eef5f8" strokeWidth="2"/>
            <text x="58" y="10" textAnchor="middle" fill="#e9f2f6" fontSize="12" fontFamily="Segoe UI, sans-serif">250 m</text>
          </g>
        </g>
      </svg>
    </div>
  )
}
