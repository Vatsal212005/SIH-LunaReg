'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import LunarScene from './LunarScene'
import {
  ActivityIcon, ArrowUpRightIcon, BellIcon, BookOpenIcon, ChartIcon, CheckIcon, ChevronDownIcon,
  ChevronRightIcon, CpuIcon, CrosshairIcon, DatabaseIcon, DownloadIcon, FileIcon,
  HistoryIcon, InfoIcon, MaximizeIcon, MenuIcon, MoonIcon, MoreIcon, PlayIcon,
  RegisterIcon, SearchIcon, SettingsIcon, SlidersIcon, SunIcon, UploadIcon, XIcon
} from './Icons'

type NavKey = 'workspace' | 'analytics' | 'catalog' | 'runs' | 'pipeline' | 'guide'
type ViewerMode = 'matches' | 'overlay' | 'coverage' | 'difference'
type Theme = 'dark' | 'light'

type Notify = (message:string)=>void

const navItems: {key: NavKey; label: string; icon: React.ReactNode}[] = [
  { key: 'workspace', label: 'Registration', icon: <RegisterIcon /> },
  { key: 'analytics', label: 'Analytics', icon: <ChartIcon /> },
  { key: 'catalog', label: 'Data Catalog', icon: <DatabaseIcon /> },
  { key: 'runs', label: 'Run History', icon: <HistoryIcon /> },
  { key: 'pipeline', label: 'Model Pipeline', icon: <CpuIcon /> },
  { key: 'guide', label: 'How It Works', icon: <BookOpenIcon /> },
]

const runRows = [
  {id:'LR-0842', pair:'OHRC ↔ LRO NAC', region:'Shackleton Rim', rmse:'0.38 px', inliers:'1,284', ratio:'86.2%', coverage:'92.8%', time:'2.74 s', status:'Validated', when:'Today, 21:48'},
  {id:'LR-0841', pair:'TMC-2 ↔ LRO NAC', region:'Aristarchus Plateau', rmse:'0.46 px', inliers:'986', ratio:'81.4%', coverage:'89.5%', time:'2.31 s', status:'Validated', when:'Today, 20:16'},
  {id:'LR-0839', pair:'OHRC ↔ TMC-2', region:'Mare Imbrium', rmse:'0.51 px', inliers:'1,102', ratio:'79.8%', coverage:'91.1%', time:'2.58 s', status:'Validated', when:'Today, 18:42'},
  {id:'LR-0836', pair:'IIRS ↔ LRO WAC', region:'Tycho Ejecta', rmse:'0.68 px', inliers:'642', ratio:'73.9%', coverage:'84.7%', time:'3.41 s', status:'Reviewed', when:'Yesterday, 23:03'},
  {id:'LR-0832', pair:'OHRC ↔ LRO NAC', region:'Cabeus Crater', rmse:'0.42 px', inliers:'1,176', ratio:'84.6%', coverage:'90.3%', time:'2.69 s', status:'Validated', when:'Yesterday, 20:55'},
]

const sensors = [
  {name:'OHRC', full:'Orbiter High Resolution Camera', res:'0.25–0.32 m', mode:'Panchromatic', products:'2,846', footprint:'~3 km', accent:'cyan'},
  {name:'TMC-2', full:'Terrain Mapping Camera 2', res:'5 m', mode:'Panchromatic', products:'6,129', footprint:'~20 km', accent:'blue'},
  {name:'IIRS', full:'Imaging Infrared Spectrometer', res:'~80 m', mode:'Hyperspectral', products:'1,408', footprint:'~20 km', accent:'violet'},
  {name:'LRO NAC', full:'Lunar Reconnaissance Orbiter NAC', res:'0.5–2 m', mode:'Panchromatic', products:'12,904', footprint:'Variable', accent:'silver'},
]

const pipelineSteps = [
  ['Sensor-Aware Ingestion', 'Reads image products, sensor metadata and ground sampling distance.'],
  ['Lunar Preprocessing', 'Normalizes radiometry and builds structural and shadow-aware representations.'],
  ['Scale Adaptation', 'Uses metadata-guided image pyramids to remove extreme scale mismatch.'],
  ['Cross-Modal Matching', 'Finds corresponding lunar structures across sensors and illumination conditions.'],
  ['Sub-Pixel Refinement', 'Refines each correspondence to fractional pixel coordinates.'],
  ['Geometric Verification', 'Rejects inconsistent matches using robust geometric constraints.'],
  ['Coverage Optimization', 'Selects reliable control points across the full valid image area.'],
]

const matchLines = [
  [122,122,606,145],[215,191,660,211],[321,134,712,159],[376,271,742,284],
  [185,368,635,383],[270,450,684,465],[393,392,756,410],[439,525,790,541],
  [82,486,577,503],[457,207,813,231],[153,575,624,590],[342,575,732,591]
]

function BrandMark({small=false}:{small?:boolean}) {
  return <div className={`brand-mark ${small?'small':''}`} aria-hidden>
    <span className="brand-orbit"/><span className="brand-moon"/><span className="brand-dot"/>
  </div>
}

function Pill({children, tone='default'}:{children:React.ReactNode; tone?:'default'|'cyan'|'green'|'amber'|'violet'}) {
  return <span className={`pill ${tone}`}>{children}</span>
}

function MetricCard({label,value,unit,detail,trend}:{label:string;value:string;unit?:string;detail:string;trend?:string}) {
  return <div className="metric-card">
    <div className="metric-top"><span>{label}</span><ActivityIcon size={16}/></div>
    <div className="metric-value">{value}{unit&&<span>{unit}</span>}</div>
    <div className="metric-detail">{detail}{trend&&<span className="metric-trend">{trend}</span>}</div>
  </div>
}

function TinySpark({values}:{values:number[]}) {
  const min=Math.min(...values), max=Math.max(...values)
  const pts = values.map((v,i)=>`${(i/(values.length-1))*100},${32-((v-min)/(max-min||1))*24}`).join(' ')
  return <svg viewBox="0 0 100 36" className="tiny-spark" preserveAspectRatio="none"><polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke"/></svg>
}

function ResidualChart() {
  const bars=[18,28,49,72,91,88,64,43,27,16,9,5]
  return <div className="chart-wrap"><div className="chart-y"><span>400</span><span>300</span><span>200</span><span>100</span><span>0</span></div><div className="bar-chart">{bars.map((h,i)=><div key={i} className="bar-col"><span className="bar" style={{height:`${h}%`}}/><span>{(i*.1).toFixed(1)}</span></div>)}</div></div>
}

function ErrorTrend() {
  const a=[1.14,1.06,.98,.86,.77,.71,.63,.59,.53,.49,.46,.42,.40,.38]
  const b=[1.45,1.39,1.32,1.24,1.19,1.11,1.04,.99,.92,.88,.82,.79,.74,.72]
  const path=(arr:number[])=>arr.map((v,i)=>`${(i/(arr.length-1))*100},${90-((1.6-v)/1.3)*78}`).join(' ')
  return <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="trend-chart">{[10,30,50,70,90].map(y=><line key={y} x1="0" y1={y} x2="100" y2={y} className="grid-line"/>)}<polyline points={path(b)} className="trend-secondary"/><polyline points={path(a)} className="trend-primary"/></svg>
}

function CoverageRing({value=92.8}:{value?:number}) {
  const r=42, c=2*Math.PI*r, o=c*(1-value/100)
  return <div className="coverage-ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r={r} className="ring-bg"/><circle cx="50" cy="50" r={r} className="ring-fg" strokeDasharray={c} strokeDashoffset={o}/></svg><div><b>{value}%</b><span>coverage</span></div></div>
}

function SceneMedia({kind,preview,className=''}:{kind:'source'|'reference';preview?:string;className?:string}) {
  const [failed,setFailed]=useState(false)
  const src=preview || (kind==='source'?'/lunar-source.jpg':'/lunar-reference.jpg')
  useEffect(()=>setFailed(false),[src])
  if(failed) return <div className={`scene-fallback ${className}`}><LunarScene variant={kind}/></div>
  return <img src={src} alt={kind==='source'?'Source lunar image':'Reference lunar image'} className={`scene-photo ${className}`} onError={()=>setFailed(true)}/>
}

function Header({active,onExport,theme,onToggleTheme,onOpenSearch,onMobileMenu,notificationOpen,onToggleNotifications}:{active:NavKey;onExport:()=>void;theme:Theme;onToggleTheme:()=>void;onOpenSearch:()=>void;onMobileMenu:()=>void;notificationOpen:boolean;onToggleNotifications:()=>void}) {
  const names:Record<NavKey,string>={workspace:'Registration Workspace',analytics:'Registration Analytics',catalog:'Lunar Data Catalog',runs:'Run History',pipeline:'Model Pipeline',guide:'How It Works'}
  return <header className="topbar">
    <div className="topbar-left"><button className="icon-btn mobile-menu-btn" onClick={onMobileMenu} aria-label="Open navigation"><MenuIcon size={19}/></button><div className="topbar-title"><span>LunaReg</span><ChevronRightIcon size={14}/><strong>{names[active]}</strong></div></div>
    <div className="topbar-actions">
      <button className="search-chip" onClick={onOpenSearch}><SearchIcon size={16}/><span>Search runs, sensors, regions</span><kbd>⌘ K</kbd></button>
      <button className="icon-btn" onClick={onToggleTheme} title={`Switch to ${theme==='dark'?'light':'dark'} mode`}>{theme==='dark'?<SunIcon size={18}/>:<MoonIcon size={18}/>}</button>
      <div className="notification-wrap"><button className="icon-btn" onClick={onToggleNotifications} aria-label="Notifications"><BellIcon size={18}/><span className="notify-dot"/></button>{notificationOpen&&<div className="notification-popover panel"><b>System status</b><p>Registration engine is ready.</p><span>Catalog synchronization completed successfully.</span></div>}</div>
      <button className="ghost-btn top-export" onClick={onExport}><DownloadIcon size={16}/>Export</button>
      <div className="avatar">TM</div>
    </div>
  </header>
}

function FileSelector({kind,name,meta,onChange}:{kind:string;name:string;meta:string;onChange:(name:string,preview?:string)=>void}) {
  const ref=useRef<HTMLInputElement>(null)
  const choose=(file?:File)=>{if(!file)return; const canPreview=file.type.startsWith('image/')&&!/tiff/i.test(file.type);onChange(file.name,canPreview?URL.createObjectURL(file):undefined)}
  return <div className="file-select" onClick={()=>ref.current?.click()}>
    <input ref={ref} hidden type="file" accept=".tif,.tiff,.img,.jp2,.png,.jpg,.jpeg,.webp" onChange={e=>choose(e.target.files?.[0])}/>
    <div className="file-icon"><FileIcon size={19}/></div>
    <div className="file-copy"><span>{kind}</span><strong>{name}</strong><small>{meta}</small></div>
    <button className="file-change" onClick={e=>{e.stopPropagation();ref.current?.click()}} aria-label={`Change ${kind.toLowerCase()}`}><UploadIcon size={16}/></button>
  </div>
}

function Workspace({runRegistration,notify}:{runRegistration:()=>void;notify:Notify}) {
  const [mode,setMode]=useState<ViewerMode>('matches')
  const [overlay,setOverlay]=useState(52)
  const [source,setSource]=useState('ch2_ohrc_shackleton_2026-08-11.tif')
  const [reference,setReference]=useState('lro_nac_m1414238064le.tif')
  const [sourcePreview,setSourcePreview]=useState<string>()
  const [referencePreview,setReferencePreview]=useState<string>()
  const [advanced,setAdvanced]=useState(false)
  const [expanded,setExpanded]=useState(false)
  const [configOpen,setConfigOpen]=useState(false)
  const [selectedMatch,setSelectedMatch]=useState<number|null>(null)
  const [coords,setCoords]=useState({lat:'89.7642° S',lon:'128.4417° E'})

  const mouseMove=(e:React.MouseEvent<HTMLDivElement>)=>{
    const r=e.currentTarget.getBoundingClientRect(); const x=(e.clientX-r.left)/r.width; const y=(e.clientY-r.top)/r.height
    setCoords({lat:`${(89.70+y*.09).toFixed(4)}° S`,lon:`${(128.20+x*.55).toFixed(4)}° E`})
  }

  return <div className="page-content">
    <section className="page-heading"><div><div className="eyebrow"><span className="live-dot"/> ACTIVE REGISTRATION SESSION</div><h1>Shackleton Rim <span>/</span> OHRC to LRO NAC</h1><p>Cross-sensor lunar registration with solar-invariant structural matching and sub-pixel refinement.</p></div><div className="heading-actions"><button className="ghost-btn" onClick={()=>setConfigOpen(true)}><SettingsIcon size={17}/>Configure</button><button className="primary-btn" onClick={runRegistration}><PlayIcon size={17}/>Run Registration</button></div></section>

    <section className="metrics-grid"><MetricCard label="Registration RMSE" value="0.38" unit=" px" detail="Median residual 0.21 px" trend="↓ 36.7%"/><MetricCard label="Verified Inliers" value="1,284" detail="From 1,489 proposed matches" trend="86.2%"/><MetricCard label="Spatial Coverage" value="92.8" unit="%" detail="59 / 64 active grid cells" trend="+14.3%"/><MetricCard label="Processing Time" value="2.74" unit=" s" detail="512 px tiles • FP16" trend="GPU"/></section>

    <section className="workspace-grid">
      <div className={`viewer-card panel ${expanded?'viewer-expanded':''}`}>
        <div className="panel-head viewer-head"><div><h2>Registration Viewer</h2><span className="subtle">EPSG:104903 • Lunar 2000 geographic frame</span></div><div className="viewer-modes">{(['matches','overlay','coverage','difference'] as ViewerMode[]).map(m=><button key={m} className={mode===m?'active':''} onClick={()=>setMode(m)}>{m[0].toUpperCase()+m.slice(1)}</button>)}</div><button className="icon-btn" onClick={()=>setExpanded(v=>!v)} title={expanded?'Exit full view':'Expand viewer'}>{expanded?<XIcon size={17}/>:<MaximizeIcon size={17}/>}</button></div>

        <div className="viewer-stage interactive-stage" onMouseMove={mouseMove}>
          {mode==='matches' && <div className="pair-view"><div className="pair-half"><SceneMedia kind="source" preview={sourcePreview}/><div className="viewer-label"><b>Source</b><span>OHRC • 0.32 m/px</span></div></div><div className="pair-half"><SceneMedia kind="reference" preview={referencePreview}/><div className="viewer-label right"><b>Reference</b><span>LRO NAC • 0.50 m/px</span></div></div><svg className="match-overlay" viewBox="0 0 1000 660" preserveAspectRatio="none">{matchLines.map((p,i)=><g key={i} className={selectedMatch===i?'selected-match':''} onClick={()=>setSelectedMatch(i)}><line x1={p[0]} y1={p[1]} x2={p[2]} y2={p[3]} className="match-line"/><circle cx={p[0]} cy={p[1]} r="5" className="match-hit"/><circle cx={p[2]} cy={p[3]} r="5" className="match-hit"/></g>)}</svg>{selectedMatch!==null&&<div className="match-inspector"><span>MATCH {String(selectedMatch+1).padStart(2,'0')}</span><b>Confidence {(98.4-selectedMatch*.43).toFixed(1)}%</b><small>Residual {(0.16+selectedMatch*.027).toFixed(2)} px</small><button onClick={()=>setSelectedMatch(null)}>Close</button></div>}</div>}
          {mode==='overlay' && <div className="single-view overlay-real" style={{'--source-opacity':overlay/100} as React.CSSProperties}><SceneMedia kind="reference" preview={referencePreview} className="overlay-base"/><SceneMedia kind="source" preview={sourcePreview} className="overlay-source"/><div className="overlay-tint" style={{opacity:Math.max(0,.18-overlay/650)}}/><div className="overlay-caption left">REFERENCE</div><div className="overlay-caption right">REGISTERED SOURCE • {overlay}%</div></div>}
          {mode==='coverage' && <div className="single-view"><SceneMedia kind="source" preview={sourcePreview}/><div className="coverage-grid-overlay">{Array.from({length:64}).map((_,i)=><span key={i} className={i===7||i===48||i===57?'weak':''}/>)}</div><div className="coverage-points">{matchLines.map((p,i)=><i key={i} style={{left:`${p[0]/10}%`,top:`${p[1]/6.6}%`}}/>)}</div></div>}
          {mode==='difference' && <div className="difference-view"><SceneMedia kind="source" preview={sourcePreview}/><div className="difference-mask"/><div className="difference-legend"><span><i className="cold"/>Low residual</span><span><i className="mid"/>Moderate</span><span><i className="hot"/>High residual</span></div></div>}
        </div>

        <div className="viewer-footer"><div className="coordinates"><CrosshairIcon size={15}/><span>{coords.lat}</span><span>{coords.lon}</span><span>Altitude 3.82 km</span></div>{mode==='overlay'?<div className="opacity-control"><span>Source opacity</span><input aria-label="Source opacity" type="range" min="0" max="100" value={overlay} onChange={e=>setOverlay(Number(e.target.value))}/><b>{overlay}%</b></div>:<div className="viewer-stats"><span><i className="dot cyan"/>1,284 inliers</span><span><i className="dot amber"/>205 rejected</span></div>}</div>
      </div>

      <aside className="run-panel panel"><div className="panel-head"><div><h2>Registration Setup</h2><span className="subtle">Current pair configuration</span></div><MoreIcon size={18}/></div><div className="file-stack"><FileSelector kind="SOURCE IMAGE" name={source} meta="OHRC • 0.32 m/px • 89.76° S" onChange={(n,p)=>{setSource(n);setSourcePreview(p);notify('Source image loaded')}}/><div className="pair-connector"><span/><b>↕</b><span/></div><FileSelector kind="REFERENCE IMAGE" name={reference} meta="LRO NAC • 0.50 m/px • 89.76° S" onChange={(n,p)=>{setReference(n);setReferencePreview(p);notify('Reference image loaded')}}/></div><div className="setup-grid"><div><span>Estimated scale</span><b>1.56×</b></div><div><span>Sun elevation Δ</span><b>18.4°</b></div><div><span>View angle Δ</span><b>7.2°</b></div><div><span>Overlap</span><b>83.6%</b></div></div><button className="advanced-toggle" onClick={()=>setAdvanced(!advanced)}><span><SlidersIcon size={16}/>Advanced parameters</span><ChevronDownIcon size={16} className={advanced?'rotated':''}/></button>{advanced&&<div className="advanced-grid"><label>Matcher<select defaultValue="LunaReg Hybrid"><option>LunaReg Hybrid</option><option>RoMa Baseline</option><option>XoFTR Baseline</option></select></label><label>Grid density<select defaultValue="8 × 8"><option>8 × 8</option><option>10 × 10</option><option>12 × 12</option></select></label><label>Confidence<input defaultValue="0.78"/></label><label>RANSAC threshold<input defaultValue="1.25 px"/></label></div>}<div className="pipeline-mini"><div className="pipeline-mini-head"><span>Processing Pipeline</span><Pill tone="green"><CheckIcon size={12}/>Validated</Pill></div>{pipelineSteps.map((s,i)=><div className="pipeline-step" key={s[0]}><div className="step-node"><CheckIcon size={11}/></div><div><b>{s[0]}</b><span>{['42 ms','118 ms','164 ms','1.21 s','438 ms','396 ms','352 ms'][i]}</span></div></div>)}</div></aside>
    </section>

    <section className="lower-grid"><div className="panel insight-card"><div className="panel-head"><div><h2>Spatial Match Coverage</h2><span className="subtle">Uniformity across valid image area</span></div><Pill tone="cyan">High coverage</Pill></div><div className="coverage-layout"><CoverageRing/><div className="coverage-copy"><div><span>Occupied cells</span><b>59 / 64</b></div><div><span>Coverage entropy</span><b>0.914</b></div><div><span>Mean matches / cell</span><b>21.8</b></div><div><span>Weak regions</span><b>3</b></div></div><div className="mini-coverage-map">{Array.from({length:64}).map((_,i)=><span key={i} className={i===7||i===48||i===57?'weak':i%9===0?'mid':'good'}/>)}</div></div></div><div className="panel insight-card"><div className="panel-head"><div><h2>Residual Distribution</h2><span className="subtle">Geometric reprojection error, pixels</span></div><Pill>Median 0.21 px</Pill></div><ResidualChart/></div><div className="panel insight-card metadata-card"><div className="panel-head"><div><h2>Scene Metadata</h2><span className="subtle">Instrument and acquisition geometry</span></div><InfoIcon size={16}/></div><div className="metadata-list"><div><span>Target</span><b>Moon</b></div><div><span>Region</span><b>Shackleton Rim</b></div><div><span>Source GSD</span><b>0.32 m / px</b></div><div><span>Reference GSD</span><b>0.50 m / px</b></div><div><span>Solar azimuth</span><b>121.8° / 139.2°</b></div><div><span>Incidence angle</span><b>76.4° / 72.1°</b></div></div></div></section>

    {configOpen&&<div className="modal-backdrop" onMouseDown={()=>setConfigOpen(false)}><div className="config-modal panel" onMouseDown={e=>e.stopPropagation()}><div className="modal-title"><div><span>REGISTRATION PROFILE</span><h2>Configure LunaReg</h2></div><button className="icon-btn" onClick={()=>setConfigOpen(false)}><XIcon size={18}/></button></div><div className="config-form"><label>Feature matcher<select defaultValue="LunaReg Hybrid"><option>LunaReg Hybrid</option><option>RoMa Baseline</option><option>XoFTR Baseline</option></select></label><label>Tile size<select defaultValue="512 × 512"><option>384 × 384</option><option>512 × 512</option><option>768 × 768</option></select></label><label>Minimum confidence<input type="range" min="50" max="95" defaultValue="78"/></label><label>Coverage grid<select defaultValue="8 × 8"><option>8 × 8</option><option>10 × 10</option><option>12 × 12</option></select></label></div><div className="modal-actions"><button className="ghost-btn" onClick={()=>setConfigOpen(false)}>Cancel</button><button className="primary-btn" onClick={()=>{setConfigOpen(false);notify('Registration profile updated')}}><CheckIcon size={16}/>Apply configuration</button></div></div></div>}
  </div>
}

function Analytics({onExport}:{onExport:()=>void}) {
  const methods=[['SIFT','2.71 px','37.4%','31.2%','0.42 s'],['RIFT2','1.62 px','54.8%','46.1%','1.84 s'],['SuperGlue','1.18 px','67.9%','58.7%','1.21 s'],['LoFTR','0.91 px','73.6%','67.5%','0.94 s'],['XoFTR','0.73 px','78.1%','73.9%','1.47 s'],['RoMa','0.62 px','81.3%','79.6%','2.06 s'],['LunaReg','0.38 px','86.2%','92.8%','2.74 s']]
  return <div className="page-content"><section className="page-heading"><div><div className="eyebrow">PERFORMANCE ANALYSIS</div><h1>Registration Analytics</h1><p>Cross-sensor performance, residual behavior, robustness and baseline comparison.</p></div><div className="heading-actions"><button className="ghost-btn" onClick={onExport}><DownloadIcon size={16}/>Export report</button></div></section><section className="analytics-top"><div className="panel analytics-hero"><div className="panel-head"><div><h2>RMSE Across Validation Runs</h2><span className="subtle">Last 30 verified registrations</span></div><div className="legend"><span><i className="dot cyan"/>LunaReg</span><span><i className="dot gray"/>RoMa baseline</span></div></div><div className="hero-chart"><div className="ylabels"><span>1.6</span><span>1.2</span><span>0.8</span><span>0.4</span><span>0.0</span></div><ErrorTrend/></div><div className="chart-footer"><span>Run 01</span><span>Run 08</span><span>Run 15</span><span>Run 22</span><span>Run 30</span></div></div><div className="analytics-side"><div className="panel stat-feature"><span>Mean RMSE</span><b>0.44 <small>px</small></b><TinySpark values={[.58,.51,.49,.47,.45,.46,.43,.42,.44,.41,.39,.44]}/><small>Across all sensor pairs</small></div><div className="panel stat-feature"><span>Mean Inlier Ratio</span><b>83.7<small>%</small></b><TinySpark values={[72,76,77,81,80,82,84,83,85,86,84,87]}/><small>+8.9 pp vs RoMa</small></div></div></section><section className="analytics-grid"><div className="panel robustness-card"><div className="panel-head"><div><h2>Robustness Matrix</h2><span className="subtle">Performance by difficulty band</span></div></div><div className="heatmap"><div/><b>Low</b><b>Moderate</b><b>High</b><b>Extreme</b>{['Sun Δ','Scale ratio','Viewpoint Δ','Shadow fraction'].flatMap((label,row)=>[<b key={label}>{label}</b>,...Array.from({length:4}).map((_,col)=><span key={label+col} className={`h${Math.min(4,1+Math.abs(col-row%2))}`}>{[.34,.41,.53,.71][Math.min(3,col+Math.floor(row/3))].toFixed(2)}</span>)])}</div><div className="heat-legend"><span>Lower RMSE</span><i/><span>Higher RMSE</span></div></div><div className="panel sensor-performance"><div className="panel-head"><div><h2>Sensor Pair Performance</h2><span className="subtle">Validated registration groups</span></div></div>{[['OHRC ↔ LRO NAC',94,.36],['OHRC ↔ TMC-2',89,.43],['TMC-2 ↔ LRO NAC',85,.49],['IIRS ↔ Optical',72,.66]].map(([name,v,e])=><div className="sensor-bar" key={String(name)}><div><b>{name}</b><span>{Number(e).toFixed(2)} px RMSE</span></div><div className="bar-track"><span style={{width:`${v}%`}}/></div><strong>{v}%</strong></div>)}</div></section><section className="panel benchmark-panel"><div className="panel-head"><div><h2>Baseline Comparison</h2><span className="subtle">Same validation set and geometric acceptance criteria</span></div><Pill tone="violet">7 methods</Pill></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Method</th><th>RMSE ↓</th><th>Inlier Ratio ↑</th><th>Coverage ↑</th><th>Time</th></tr></thead><tbody>{methods.map(r=><tr key={r[0]} className={r[0]==='LunaReg'?'featured':''}>{r.map((c,i)=><td key={i}>{i===0&&r[0]==='LunaReg'?<span className="method-feature"><BrandMark small/>{c}</span>:c}</td>)}</tr>)}</tbody></table></div></section></div>
}

function Catalog({notify}:{notify:Notify}) {
  const uploadRef=useRef<HTMLInputElement>(null)
  return <div className="page-content"><input ref={uploadRef} hidden type="file" multiple onChange={e=>{if(e.target.files?.length)notify(`${e.target.files.length} image product${e.target.files.length>1?'s':''} queued for indexing`)}}/><section className="page-heading"><div><div className="eyebrow">LUNAR DATASETS</div><h1>Data Catalog</h1><p>Indexed Chandrayaan-2 and lunar reference products available to the registration pipeline.</p></div><div className="heading-actions"><button className="primary-btn" onClick={()=>uploadRef.current?.click()}><UploadIcon size={16}/>Add imagery</button></div></section><section className="catalog-summary"><div><span>Indexed products</span><b>23,287</b></div><div><span>Mapped surface</span><b>17.8 TB</b></div><div><span>Sensor families</span><b>4</b></div><div><span>Georeferenced</span><b>98.4%</b></div></section><section className="sensor-cards">{sensors.map(s=><div className={`sensor-card panel ${s.accent}`} key={s.name}><div className="sensor-card-top"><div className="sensor-icon"><MoonIcon size={21}/></div><Pill>{s.mode}</Pill></div><h2>{s.name}</h2><p>{s.full}</p><div className="sensor-specs"><div><span>Ground resolution</span><b>{s.res}</b></div><div><span>Indexed products</span><b>{s.products}</b></div><div><span>Typical footprint</span><b>{s.footprint}</b></div></div><button className="text-btn" onClick={()=>notify(`${s.name} collection opened`)}>Open collection <ArrowUpRightIcon size={14}/></button></div>)}</section><section className="catalog-grid"><div className="panel map-panel"><div className="panel-head"><div><h2>Indexed Lunar Coverage</h2><span className="subtle">Available image footprints by instrument</span></div><div className="legend"><span><i className="dot cyan"/>OHRC</span><span><i className="dot violet"/>IIRS</span></div></div><div className="moon-map"><div className="moon-disc"><span className="orbit-line o1"/><span className="orbit-line o2"/><span className="coverage-patch p1"/><span className="coverage-patch p2"/><span className="coverage-patch p3"/><span className="coverage-patch p4"/></div><div className="map-grid-lines"/></div></div><div className="panel recent-products"><div className="panel-head"><div><h2>Recently Indexed</h2><span className="subtle">Latest products added to catalog</span></div></div>{[['OHRC','SHACKLETON_RIM_0811','89.76°S','1.8 GB'],['TMC-2','MARE_IMBRIUM_0809','22.14°N','2.4 GB'],['IIRS','TYCHO_EJECTA_0808','43.31°S','4.2 GB'],['LRO NAC','M1414238064LE','89.77°S','982 MB']].map(r=><button className="recent-row recent-button" key={r[1]} onClick={()=>notify(`${r[1]} selected`)}><span className={`sensor-tag ${r[0].replaceAll(' ','').toLowerCase()}`}>{r[0]}</span><div><b>{r[1]}</b><span>{r[2]}</span></div><strong>{r[3]}</strong><ChevronRightIcon size={15}/></button>)}</div></section></div>
}

function Runs({onNew,notify}:{onNew:()=>void;notify:Notify}) {
  const [query,setQuery]=useState(''); const [filter,setFilter]=useState<'All'|'Validated'|'Reviewed'>('All'); const [detail,setDetail]=useState<typeof runRows[number]|null>(null)
  const rows=runRows.filter(r=>(filter==='All'||r.status===filter)&&`${r.id} ${r.pair} ${r.region}`.toLowerCase().includes(query.toLowerCase()))
  const exportCsv=()=>{const csv=['Run,Sensor Pair,Region,RMSE,Inliers,Ratio,Coverage,Time,Status',...rows.map(r=>[r.id,r.pair,r.region,r.rmse,r.inliers,r.ratio,r.coverage,r.time,r.status].map(v=>`"${v}"`).join(','))].join('\n');downloadBlob(csv,'lunareg_runs.csv','text/csv')}
  return <div className="page-content"><section className="page-heading"><div><div className="eyebrow">REGISTRATION ARCHIVE</div><h1>Run History</h1><p>Completed registrations, quality metrics and reproducible processing records.</p></div><div className="heading-actions"><button className="ghost-btn" onClick={exportCsv}><DownloadIcon size={16}/>Export visible</button><button className="primary-btn" onClick={onNew}><PlayIcon size={16}/>New registration</button></div></section><section className="run-summary"><MetricCard label="Total Registrations" value="842" detail="+41 this week" trend="+5.1%"/><MetricCard label="Validated Runs" value="791" detail="93.9% acceptance"/><MetricCard label="Median RMSE" value="0.44" unit=" px" detail="Across validated runs"/><MetricCard label="Median Coverage" value="90.6" unit="%" detail="8 × 8 grid metric"/></section><section className="panel runs-panel"><div className="runs-toolbar"><div className="inline-search"><SearchIcon size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by run, region or sensor pair"/></div><button className="filter-btn" onClick={()=>setFilter(filter==='All'?'Validated':filter==='Validated'?'Reviewed':'All')}><SlidersIcon size={15}/>{filter}</button><div className="toolbar-spacer"/><Pill tone="green"><span className="live-dot"/>All systems nominal</Pill></div><div className="table-scroll"><table className="data-table run-table"><thead><tr><th>Run</th><th>Sensor Pair</th><th>Region</th><th>RMSE</th><th>Inliers</th><th>Inlier Ratio</th><th>Coverage</th><th>Time</th><th>Status</th><th>Completed</th><th/></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><b className="run-id">{r.id}</b></td><td>{r.pair}</td><td>{r.region}</td><td><b>{r.rmse}</b></td><td>{r.inliers}</td><td>{r.ratio}</td><td>{r.coverage}</td><td>{r.time}</td><td><Pill tone={r.status==='Validated'?'green':'amber'}>{r.status}</Pill></td><td className="muted-cell">{r.when}</td><td><button className="icon-btn mini" onClick={()=>setDetail(r)}><ChevronRightIcon size={14}/></button></td></tr>)}</tbody></table>{rows.length===0&&<div className="empty-state">No runs match the current search.</div>}</div></section>{detail&&<div className="modal-backdrop" onMouseDown={()=>setDetail(null)}><div className="run-detail panel" onMouseDown={e=>e.stopPropagation()}><div className="modal-title"><div><span>{detail.id}</span><h2>{detail.region}</h2></div><button className="icon-btn" onClick={()=>setDetail(null)}><XIcon size={18}/></button></div><div className="run-detail-grid"><div><span>Sensor pair</span><b>{detail.pair}</b></div><div><span>RMSE</span><b>{detail.rmse}</b></div><div><span>Inliers</span><b>{detail.inliers}</b></div><div><span>Coverage</span><b>{detail.coverage}</b></div><div><span>Status</span><b>{detail.status}</b></div><div><span>Runtime</span><b>{detail.time}</b></div></div><button className="primary-btn" onClick={()=>{setDetail(null);notify(`${detail.id} loaded into workspace`)}}>Open registration</button></div></div>}</div>
}

function Pipeline({notify}:{notify:Notify}) {
  const [selected,setSelected]=useState(3); const [runtimeOpen,setRuntimeOpen]=useState(false)
  return <div className="page-content"><section className="page-heading"><div><div className="eyebrow">LUNAREG CORE</div><h1>Model Pipeline</h1><p>Sensor-aware correspondence architecture from lunar image ingestion to validated sub-pixel control points.</p></div><div className="heading-actions"><Pill tone="green"><span className="live-dot"/>Engine Ready</Pill><button className="ghost-btn" onClick={()=>setRuntimeOpen(v=>!v)}><SettingsIcon size={16}/>Runtime</button></div></section>{runtimeOpen&&<div className="runtime-banner panel"><CpuIcon size={20}/><div><b>CUDA execution profile</b><span>FP16 coarse matching, FP32 sub-pixel head, tiled 512 × 512 processing.</span></div><button className="text-btn" onClick={()=>notify('Runtime profile copied')}>Copy profile</button></div>}<section className="pipeline-layout"><div className="panel pipeline-architecture"><div className="panel-head"><div><h2>Registration Graph</h2><span className="subtle">LunaReg v1.0 • Hybrid coarse-to-fine configuration</span></div><Pill tone="cyan">FP16</Pill></div><div className="architecture-flow"><div className="arch-inputs"><div><span className="arch-sensor cyan">OHRC</span><small>Panchromatic</small></div><div><span className="arch-sensor blue">TMC-2</span><small>Mapping</small></div><div><span className="arch-sensor violet">IIRS</span><small>Hyperspectral</small></div><div><span className="arch-sensor silver">LRO</span><small>Reference</small></div></div><div className="arch-arrow">→</div><div className="arch-stack">{pipelineSteps.map((s,i)=><button onClick={()=>setSelected(i)} key={s[0]} className={`arch-node ${selected===i?'selected':''}`}><span>{String(i+1).padStart(2,'0')}</span><div><b>{s[0]}</b><small>{s[1].split('.')[0]}</small></div><ChevronRightIcon size={14}/></button>)}</div><div className="arch-arrow">→</div><div className="arch-output"><CrosshairIcon size={28}/><b>Registered Product</b><span>Control points</span><span>Warp field</span><span>Quality report</span></div></div></div><aside className="panel module-inspector"><div className="panel-head"><div><h2>Module Inspector</h2><span className="subtle">Stage {selected+1} of 7</span></div></div><div className="module-number">0{selected+1}</div><h3>{pipelineSteps[selected][0]}</h3><p>{pipelineSteps[selected][1]}</p><div className="module-specs"><div><span>Runtime</span><b>{['42 ms','118 ms','164 ms','1.21 s','438 ms','396 ms','352 ms'][selected]}</b></div><div><span>Precision</span><b>{selected===4?'FP32 head':'FP16'}</b></div><div><span>Device</span><b>CUDA:0</b></div><div><span>Status</span><b className="ok-text">Operational</b></div></div><div className="module-tags"><Pill>Geometry aware</Pill><Pill>Batch safe</Pill><Pill>Deterministic</Pill></div></aside></section><section className="pipeline-bottom"><div className="panel runtime-card"><div className="panel-head"><div><h2>Runtime Profile</h2><span className="subtle">Average contribution to end-to-end latency</span></div></div>{pipelineSteps.map((s,i)=><div className="runtime-row" key={s[0]}><span>{s[0]}</span><div><i style={{width:`${[4,9,12,78,34,31,27][i]}%`}}/></div><b>{['1.5','4.3','6.0','44.2','16.0','14.5','12.8'][i]}%</b></div>)}</div><div className="panel model-card"><div className="panel-head"><div><h2>Active Configuration</h2><span className="subtle">Production registration profile</span></div></div><div className="config-list"><div><span>Coarse encoder</span><b>DINOv2 / Lunar Adapter</b></div><div><span>Matcher</span><b>Hybrid Transformer</b></div><div><span>Tile size</span><b>512 × 512</b></div><div><span>Pyramid levels</span><b>5</b></div><div><span>RANSAC threshold</span><b>1.25 px</b></div><div><span>Coverage grid</span><b>8 × 8</b></div><div><span>Sub-pixel window</span><b>9 × 9</b></div></div></div></section></div>
}

function Guide({onOpenWorkspace,onRun}:{onOpenWorkspace:()=>void;onRun:()=>void}) {
  const [selected,setSelected]=useState(0)
  const challenges=[['Changing Sun angle','Shadows and bright terrain can reverse or disappear between acquisitions.'],['Extreme scale gap','OHRC, TMC-2, IIRS and LRO products can differ dramatically in ground sampling distance.'],['Different sensors','The same physical feature may have a different radiometric or spectral appearance.'],['Viewpoint variation','Orbital geometry introduces rotation, shift, scale and local perspective differences.']]
  return <div className="page-content guide-page"><section className="guide-hero panel"><div><div className="eyebrow">SYSTEM OVERVIEW</div><h1>How LunaReg Works</h1><p>LunaReg takes two images of the same lunar region, finds trustworthy correspondences despite sensor and acquisition differences, and produces a precisely registered image with measurable quality.</p><div className="guide-actions"><button className="primary-btn" onClick={onOpenWorkspace}><RegisterIcon size={17}/>Open workspace</button><button className="ghost-btn" onClick={onRun}><PlayIcon size={17}/>Run walkthrough</button></div></div><div className="guide-visual"><div className="guide-image-card"><SceneMedia kind="source"/><span>Source</span></div><div className="guide-arrow">→</div><div className="guide-core"><BrandMark/><b>LunaReg</b><small>7-stage registration</small></div><div className="guide-arrow">→</div><div className="guide-image-card"><SceneMedia kind="reference"/><span>Registered</span></div></div></section>
  <section className="guide-section"><div className="section-title"><span>01</span><div><h2>The problem</h2><p>Why ordinary image matching is not enough for lunar imagery.</p></div></div><div className="challenge-grid">{challenges.map((c,i)=><div className="panel challenge-card" key={c[0]}><span>0{i+1}</span><h3>{c[0]}</h3><p>{c[1]}</p></div>)}</div></section>
  <section className="guide-section"><div className="section-title"><span>02</span><div><h2>End-to-end registration</h2><p>Select a stage to see what it contributes.</p></div></div><div className="guide-pipeline panel"><div className="guide-step-list">{pipelineSteps.map((s,i)=><button key={s[0]} className={selected===i?'active':''} onClick={()=>setSelected(i)}><i>{String(i+1).padStart(2,'0')}</i><span>{s[0]}</span><ChevronRightIcon size={15}/></button>)}</div><div className="guide-step-detail"><div className="module-number">0{selected+1}</div><h2>{pipelineSteps[selected][0]}</h2><p>{pipelineSteps[selected][1]}</p><div className="detail-flow"><span>INPUT</span><b>{selected<3?'Sensor imagery + metadata':selected<5?'Aligned feature maps':'Candidate correspondences'}</b><span>OUTPUT</span><b>{selected===6?'Registered image + distributed control points':'Validated intermediate representation'}</b></div></div></div></section>
  <section className="guide-section"><div className="section-title"><span>03</span><div><h2>What the system returns</h2><p>Every registration is inspectable rather than being a black-box aligned image.</p></div></div><div className="output-grid"><div className="panel output-card"><CrosshairIcon size={24}/><h3>Registered product</h3><p>Geometrically aligned source imagery in the reference coordinate frame.</p></div><div className="panel output-card"><ActivityIcon size={24}/><h3>Quality metrics</h3><p>RMSE, residual distribution, inlier ratio, confidence and processing time.</p></div><div className="panel output-card"><ChartIcon size={24}/><h3>Spatial coverage</h3><p>Control-point coverage across the valid scene, not just one high-texture crater.</p></div><div className="panel output-card"><DownloadIcon size={24}/><h3>Reproducible export</h3><p>Match points, transformation metadata and a registration quality report.</p></div></div></section>
  <section className="guide-section"><div className="section-title"><span>04</span><div><h2>Reading the metrics</h2><p>The four numbers that summarize registration quality.</p></div></div><div className="metric-explain-grid"><div className="panel"><b>RMSE</b><strong>0.38 px</strong><p>Average geometric registration error. Lower is better and sub-pixel values are the target.</p></div><div className="panel"><b>Inlier Ratio</b><strong>86.2%</strong><p>Share of proposed matches that remain geometrically consistent after verification.</p></div><div className="panel"><b>Coverage</b><strong>92.8%</strong><p>How much of the valid image area is supported by reliable correspondences.</p></div><div className="panel"><b>Residual</b><strong>0.21 px</strong><p>Typical local error after the final transformation has been estimated.</p></div></div></section>
  <section className="guide-section final-guide panel"><div><div className="eyebrow">WHY LUNAREG</div><h2>Built around the actual lunar failure modes</h2><p>Instead of treating lunar images as ordinary photographs, LunaReg combines solar-aware structural representation, sensor and scale adaptation, sub-pixel refinement and explicit coverage optimization.</p></div><button className="primary-btn" onClick={onOpenWorkspace}>Explore Registration <ChevronRightIcon size={16}/></button></section></div>
}

function downloadBlob(content:string,filename:string,type='application/json') {const blob=new Blob([content],{type});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),100)}

export default function LunaRegApp() {
  const [active,setActive]=useState<NavKey>('workspace')
  const [processing,setProcessing]=useState(false)
  const [progress,setProgress]=useState(0)
  const [processingStep,setProcessingStep]=useState(0)
  const [theme,setTheme]=useState<Theme>('dark')
  const [searchOpen,setSearchOpen]=useState(false)
  const [search,setSearch]=useState('')
  const [notificationOpen,setNotificationOpen]=useState(false)
  const [mobileOpen,setMobileOpen]=useState(false)
  const [toast,setToast]=useState('')

  useEffect(()=>{const saved=(localStorage.getItem('lunareg-theme') as Theme|null);const initial=saved||'dark';setTheme(initial);document.documentElement.dataset.theme=initial},[])
  useEffect(()=>{document.documentElement.dataset.theme=theme;localStorage.setItem('lunareg-theme',theme)},[theme])
  useEffect(()=>{const handler=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setSearchOpen(true)}if(e.key==='Escape'){setSearchOpen(false);setMobileOpen(false)}};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler)},[])
  useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),2400);return()=>clearTimeout(t)},[toast])

  const notify=(message:string)=>setToast(message)
  const navigate=(key:NavKey)=>{setActive(key);setMobileOpen(false);window.scrollTo({top:0,behavior:'smooth'})}
  const runRegistration=()=>{setProcessing(true);setProgress(0);setProcessingStep(0);const total=4200,start=Date.now();const timer=setInterval(()=>{const p=Math.min(100,Math.round(((Date.now()-start)/total)*100));setProgress(p);setProcessingStep(Math.min(6,Math.floor(p/15)));if(p>=100){clearInterval(timer);setTimeout(()=>{setProcessing(false);notify('Registration completed successfully')},650)}},90)}
  const exportReport=()=>{const payload={run:'LR-0842',region:'Shackleton Rim',source:'OHRC',reference:'LRO NAC',rmse_px:0.38,inliers:1284,inlier_ratio:0.862,coverage:0.928,processing_time_s:2.74,generated_at:new Date().toISOString()};downloadBlob(JSON.stringify(payload,null,2),'lunareg_LR-0842_report.json');notify('Registration report exported')}

  const view=useMemo(()=>{if(active==='analytics')return <Analytics onExport={exportReport}/>;if(active==='catalog')return <Catalog notify={notify}/>;if(active==='runs')return <Runs onNew={()=>navigate('workspace')} notify={notify}/>;if(active==='pipeline')return <Pipeline notify={notify}/>;if(active==='guide')return <Guide onOpenWorkspace={()=>navigate('workspace')} onRun={runRegistration}/>;return <Workspace runRegistration={runRegistration} notify={notify}/>},[active])
  const searchItems=navItems.filter(n=>n.label.toLowerCase().includes(search.toLowerCase()))

  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen?'mobile-open':''}`}><div className="mobile-sidebar-top"><div className="brand"><BrandMark/><div><b>LunaReg</b><span>LUNAR REGISTRATION</span></div></div><button className="icon-btn mobile-close" onClick={()=>setMobileOpen(false)}><XIcon size={18}/></button></div><div className="project-badge"><span>SIH 2026</span><b>PS 26166</b></div><nav className="nav-list"><span className="nav-label">WORKSPACE</span>{navItems.map(n=><button key={n.key} onClick={()=>navigate(n.key)} className={active===n.key?'active':''}><span className="nav-icon">{n.icon}</span>{n.label}{n.key==='runs'&&<em>842</em>}</button>)}</nav><div className="sidebar-spacer"/><div className="engine-status"><div className="engine-icon"><CpuIcon size={17}/><span className="status-pulse"/></div><div><b>Registration Engine</b><span>CUDA • Ready</span></div><ChevronRightIcon size={14}/></div><div className="team-card"><div className="team-avatar">T8</div><div><b>Termin8ors</b><span>Smart India Hackathon 2026</span></div><MoreIcon size={17}/></div></aside>
    {mobileOpen&&<button className="mobile-scrim" onClick={()=>setMobileOpen(false)} aria-label="Close navigation"/>}
    <main className="main-area"><Header active={active} onExport={exportReport} theme={theme} onToggleTheme={()=>setTheme(theme==='dark'?'light':'dark')} onOpenSearch={()=>setSearchOpen(true)} onMobileMenu={()=>setMobileOpen(true)} notificationOpen={notificationOpen} onToggleNotifications={()=>setNotificationOpen(v=>!v)}/>{view}</main>

    {searchOpen&&<div className="modal-backdrop command-backdrop" onMouseDown={()=>setSearchOpen(false)}><div className="command-palette panel" onMouseDown={e=>e.stopPropagation()}><div className="command-input"><SearchIcon size={20}/><input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search LunaReg…"/><kbd>ESC</kbd></div><div className="command-results">{searchItems.map(n=><button key={n.key} onClick={()=>{navigate(n.key);setSearchOpen(false);setSearch('')}}><span className="nav-icon">{n.icon}</span><div><b>{n.label}</b><small>{n.key==='guide'?'System explanation and workflow':n.key==='workspace'?'Configure and inspect registrations':'Open LunaReg workspace'}</small></div><span>↵</span></button>)}</div></div></div>}
    {toast&&<div className="toast"><CheckIcon size={16}/>{toast}</div>}

    {processing&&<div className="processing-overlay"><div className="processing-modal"><div className="processing-top"><BrandMark/><div><span>REGISTRATION IN PROGRESS</span><h2>{pipelineSteps[processingStep][0]}</h2><p>{pipelineSteps[processingStep][1]}</p></div></div><div className="processing-visual"><div className="process-image"><SceneMedia kind="source"/></div><div className="process-core"><span className="core-ring r1"/><span className="core-ring r2"/><BrandMark small/></div><div className="process-image"><SceneMedia kind="reference"/></div></div><div className="progress-meta"><span>Stage {processingStep+1} / 7</span><b>{progress}%</b></div><div className="progress-track"><span style={{width:`${progress}%`}}/></div><div className="process-steps">{pipelineSteps.map((s,i)=><span key={s[0]} className={i<processingStep?'done':i===processingStep?'active':''}><i>{i<processingStep?<CheckIcon size={10}/>:i+1}</i>{s[0]}</span>)}</div></div></div>}
  </div>
}
