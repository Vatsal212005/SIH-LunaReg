'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIcon, ArrowUpRightIcon, BellIcon, BookOpenIcon, ChartIcon, CheckIcon,
  ChevronRightIcon, CpuIcon, CrosshairIcon, DatabaseIcon, DownloadIcon,
  HistoryIcon, InfoIcon, MenuIcon, MoonIcon, PlayIcon, RegisterIcon, SearchIcon,
  SettingsIcon, SlidersIcon, SunIcon, XIcon
} from './Icons'
import {
  API_BASE, backendAsset, DemoMetrics, DemoRun, DemoStatus, getDemoStatus, runLiveDemo
} from '@/lib/lunareg-demo'

type NavKey = 'workspace' | 'analytics' | 'catalog' | 'runs' | 'pipeline' | 'guide'
type ViewerMode = 'matches' | 'overlay' | 'source' | 'reference'
type Theme = 'dark' | 'light'

const RECORDED: DemoMetrics = {
  proposed_matches: 298,
  verified_inliers: 155,
  inlier_ratio: 0.5201,
  rmse_px: 1.7056,
  median_error_px: 1.5139,
  p90_error_px: 2.4941,
  spatial_coverage: 0.7969,
  coverage_entropy: 0.8848,
  processing_time_s: 0.9563,
  ground_equivalent_rmse_m: 3.9975,
}

const NAV_ITEMS: {key: NavKey; label: string; icon: React.ReactNode}[] = [
  { key: 'workspace', label: 'Registration', icon: <RegisterIcon /> },
  { key: 'analytics', label: 'Analytics', icon: <ChartIcon /> },
  { key: 'catalog', label: 'Data Catalog', icon: <DatabaseIcon /> },
  { key: 'runs', label: 'Run History', icon: <HistoryIcon /> },
  { key: 'pipeline', label: 'Model Pipeline', icon: <CpuIcon /> },
  { key: 'guide', label: 'How It Works', icon: <BookOpenIcon /> },
]

const BASELINES = [
  {method:'SIFT', status:'FAILED', proposed:17, inliers:5, ratio:.2941, rmse:.6006, coverage:.0781, entropy:.3870, time:.2155, memory:null},
  {method:'LoFTR', status:'SUCCESS', proposed:217, inliers:50, ratio:.2304, rmse:1.2458, coverage:.2031, entropy:.4824, time:.6947, memory:1010.46},
  {method:'SuperPoint + LightGlue', status:'SUCCESS', proposed:298, inliers:155, ratio:.5201, rmse:1.7056, coverage:.7969, entropy:.8848, time:.9563, memory:262.27},
]

const ROBUSTNESS = [
  {name:'Northwest', group:'Native region', inliers:56, coverage:.3750, rmse:1.5926, time:.5923},
  {name:'Northeast', group:'Native region', inliers:70, coverage:.4844, rmse:1.7766, time:.0568},
  {name:'Center', group:'Native region', inliers:100, coverage:.6719, rmse:1.8161, time:.0477},
  {name:'Southwest', group:'Native region', inliers:78, coverage:.5781, rmse:1.6966, time:.0549},
  {name:'Southeast', group:'Native region', inliers:80, coverage:.6250, rmse:1.9216, time:.0468},
  {name:'Scale 0.75×', group:'Controlled stress', inliers:65, coverage:.4062, rmse:1.5687, time:.0717},
  {name:'Rotation +10°', group:'Controlled stress', inliers:42, coverage:.3594, rmse:1.8554, time:.0716},
  {name:'Gamma / contrast', group:'Photometric proxy', inliers:81, coverage:.6562, rmse:1.6369, time:.0475},
]

const IMPLEMENTED = [
  ['Scientific ingestion', 'Real Chandrayaan-2 OHRC IMG, XML and geometry CSV.'],
  ['GCP/TPS georectification', '484 geometry samples warp OHRC onto the exact LRO lunar map grid.'],
  ['Scale-normalized working pair', 'Frozen 1500×1500 common grid; 640×640 eco copy for the learned benchmark.'],
  ['SuperPoint + LightGlue', 'Current primary learned correspondence backbone.'],
  ['RANSAC verification', 'Homography-based geometric consistency filtering.'],
  ['Coverage evaluation', '8×8 spatial occupancy and entropy measure scene-wide support.'],
]

const PLANNED = [
  ['Cross-acquisition validation', 'Independent OHRC acquisitions with genuinely different illumination and orbital geometry.'],
  ['TMC-2 sensor path', 'Sensor/GSD-aware preprocessing for Chandrayaan-2 TMC-2.'],
  ['IIRS adapter', 'Spectral-spatial representation for hyperspectral correspondence.'],
  ['Sub-pixel refinement', 'Fractional-pixel refinement after robust coarse correspondence.'],
]

const PROCESS_STEPS = [
  ['Preparing canonical pair', 'Loading the verified OHRC and LRO common-grid products.'],
  ['Extracting SuperPoint features', 'Computing compact learned keypoints and descriptors.'],
  ['Computing LightGlue correspondences', 'Matching lunar structures across the sensor pair.'],
  ['Geometric verification', 'Rejecting inconsistent correspondences with RANSAC.'],
  ['Measuring spatial coverage', 'Checking control-point support across the 8 × 8 grid.'],
  ['Generating registration products', 'Writing match visualizations, overlay and quality metrics.'],
]

function pct(v:number, digits=1){ return `${(v*100).toFixed(digits)}%` }
function num(v:number|null|undefined, digits=2){ return v==null ? '—' : v.toFixed(digits) }

function BrandMark({small=false}:{small?:boolean}) {
  return <div className={`brand-mark ${small?'small':''}`} aria-hidden>
    <span className="brand-orbit"/><span className="brand-moon"/><span className="brand-dot"/>
  </div>
}

function Pill({children,tone='default'}:{children:React.ReactNode;tone?:'default'|'cyan'|'green'|'amber'|'violet'}) {
  return <span className={`pill ${tone}`}>{children}</span>
}

function MetricCard({label,value,unit,detail,trend}:{label:string;value:string;unit?:string;detail:string;trend?:string}) {
  return <div className="metric-card">
    <div className="metric-top"><span>{label}</span><ActivityIcon size={16}/></div>
    <div className="metric-value">{value}{unit&&<span>{unit}</span>}</div>
    <div className="metric-detail">{detail}{trend&&<span className="metric-trend">{trend}</span>}</div>
  </div>
}

function AnimatedNumber({value,decimals=0}:{value:number;decimals?:number}) {
  const [display,setDisplay]=useState(0)
  useEffect(()=>{
    let frame=0
    const started=performance.now()
    const duration=760
    const tick=(now:number)=>{
      const progress=Math.min(1,(now-started)/duration)
      const eased=1-Math.pow(1-progress,3)
      setDisplay(value*eased)
      if(progress<1) frame=requestAnimationFrame(tick)
    }
    frame=requestAnimationFrame(tick)
    return()=>cancelAnimationFrame(frame)
  },[value])
  return <>{display.toFixed(decimals)}</>
}

function AnimatedMetricCard({
  label,value,decimals=0,unit,detail,trend
}:{
  label:string;value:number;decimals?:number;unit?:string;detail:string;trend?:string
}) {
  return <div className="metric-card proto-metric-animated">
    <div className="metric-top"><span>{label}</span><ActivityIcon size={16}/></div>
    <div className="metric-value"><AnimatedNumber value={value} decimals={decimals}/>{unit&&<span>{unit}</span>}</div>
    <div className="metric-detail">{detail}{trend&&<span className="metric-trend">{trend}</span>}</div>
  </div>
}

function SafeImage({src,fallback,alt}:{src?:string;fallback:string;alt:string}) {
  const [failed,setFailed]=useState(false)
  useEffect(()=>setFailed(false),[src])
  return <img
    className="scene-photo"
    src={failed || !src ? fallback : src}
    alt={alt}
    onError={()=>setFailed(true)}
  />
}

function downloadJSON(data:unknown, filename:string) {
  const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'})
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(()=>URL.revokeObjectURL(a.href),100)
}

function Header({
  active, theme, onToggleTheme, onSearch, backend, live, onMobile
}:{
  active:NavKey; theme:Theme; onToggleTheme:()=>void; onSearch:()=>void;
  backend:DemoStatus|null; live:boolean; onMobile:()=>void
}) {
  const [statusOpen,setStatusOpen]=useState(false)
  const titles:Record<NavKey,string>={
    workspace:'Registration Workspace',analytics:'Registration Analytics',catalog:'Lunar Data Catalog',
    runs:'Run History',pipeline:'Model Pipeline',guide:'How It Works'
  }
  const ready=backend?.status==='ready'
  const statusLabel=live?'LIVE RUN':ready?'SYSTEM READY':backend?'CHECK SYSTEM':'CONNECTING'
  return <header className="topbar">
    <div className="topbar-left">
      <button className="icon-btn mobile-menu-btn" onClick={onMobile}><MenuIcon size={18}/></button>
      <div className="topbar-title"><span>LunaReg</span><ChevronRightIcon size={14}/><strong>{titles[active]}</strong></div>
    </div>
    <div className="topbar-actions">
      <button className="search-chip" onClick={onSearch}><SearchIcon size={16}/><span>Search LunaReg</span><kbd>Ctrl K</kbd></button>
      <div className="proto-status-wrap">
        <button className={`proto-engine-chip ${live?'live':ready?'ready':backend?'recorded':'connecting'}`} onClick={()=>setStatusOpen(v=>!v)}>
          <span/>{statusLabel}
        </button>
        {statusOpen&&<div className="proto-system-popover panel">
          <div className="proto-system-head"><div><span>DEMO READINESS</span><b>{ready?'All critical systems ready':'System check'}</b></div><button className="icon-btn mini" onClick={()=>setStatusOpen(false)}><XIcon size={14}/></button></div>
          <div className="proto-system-list">
            <div className={backend?'ok':'pending'}><i/><span>FastAPI service</span><b>{backend?'READY':'CONNECTING'}</b></div>
            <div className={backend?.canonical_pair_ready?'ok':'pending'}><i/><span>Canonical OHRC/LRO pair</span><b>{backend?.canonical_pair_ready?'READY':'CHECK'}</b></div>
            <div className={backend?.cuda_ready?'ok':'pending'}><i/><span>CUDA / RTX inference</span><b>{backend?.cuda_ready?'READY':'CHECK'}</b></div>
            <div className={backend?.v002_ready?'ok':'pending'}><i/><span>V0.02 evidence</span><b>{backend?.v002_ready?'READY':'CHECK'}</b></div>
            <div className={backend?.v003_ready?'ok':'pending'}><i/><span>V0.03 robustness</span><b>{backend?.v003_ready?'READY':'CHECK'}</b></div>
            <div className="ok"><i/><span>Validated fallback</span><b>READY</b></div>
          </div>
          <small>{live?'Fresh live inference is loaded in the workspace.':'Click Run Live Registration for a fresh CUDA result.'}</small>
          <button className="proto-replay-intro" onClick={()=>{sessionStorage.removeItem('lunareg-splash-seen');window.location.reload()}}>Replay launch sequence</button>
        </div>}
      </div>
      <button className="icon-btn" onClick={onToggleTheme}>{theme==='dark'?<SunIcon size={18}/>:<MoonIcon size={18}/>}</button>
      <button className="icon-btn" title="Prototype status" onClick={()=>setStatusOpen(v=>!v)}><BellIcon size={18}/></button>
      <div className="avatar">T8</div>
    </div>
  </header>
}

function Sidebar({active,onNavigate,mobileOpen,onClose}:{active:NavKey;onNavigate:(k:NavKey)=>void;mobileOpen:boolean;onClose:()=>void}) {
  return <>
    <aside className={`sidebar ${mobileOpen?'mobile-open':''}`}>
      <div className="mobile-sidebar-top">
        <div className="brand"><BrandMark/><div><b>LunaReg</b><span>LUNAR REGISTRATION</span></div></div>
        <button className="icon-btn mobile-close" onClick={onClose}><XIcon size={18}/></button>
      </div>
      <div className="project-badge"><span>SIH 2026</span><b>PS 26166</b></div>
      <nav className="nav-list">
        <span className="nav-label">PROTOTYPE</span>
        {NAV_ITEMS.map(n=><button key={n.key} onClick={()=>onNavigate(n.key)} className={active===n.key?'active':''}>
          <span className="nav-icon">{n.icon}</span>{n.label}
        </button>)}
      </nav>
      <div className="sidebar-spacer"/>
      <div className="engine-status">
        <div className="engine-icon"><CpuIcon size={17}/><span className="status-pulse"/></div>
        <div><b>Prototype Engine</b><span>LightGlue · CUDA</span></div>
        <ChevronRightIcon size={14}/>
      </div>
      <div className="team-card"><div className="team-avatar">T8</div><div><b>Termin8ors</b><span>Smart India Hackathon 2026</span></div></div>
    </aside>
    {mobileOpen&&<button className="mobile-scrim" onClick={onClose}/>}
  </>
}

function Workspace({
  metrics,run,backend,running,lastError,onRun,onRefresh,onExport,notify
}:{
  metrics:DemoMetrics; run:DemoRun|null; backend:DemoStatus|null; running:boolean; lastError:string;
  onRun:()=>void; onRefresh:()=>void; onExport:()=>void; notify:(s:string)=>void
}) {
  const [mode,setMode]=useState<ViewerMode>('matches')
  const [expanded,setExpanded]=useState(false)

  const assets = useMemo(()=>{
    const fallback={
      source:'/demo-runtime/source.png',reference:'/demo-runtime/reference.png',
      matches:'/demo-runtime/matches.jpg',overlay:'/demo-runtime/overlay.jpg'
    }
    if(!run)return fallback
    return {
      source:backendAsset(run.assets.source)||fallback.source,
      reference:backendAsset(run.assets.reference)||fallback.reference,
      matches:backendAsset(run.assets.matches_inliers)||fallback.matches,
      overlay:backendAsset(run.assets.overlay)||fallback.overlay,
    }
  },[run])

  const liveMem = run?.gpu?.peak_allocated_memory_mb
  const liveStart = run?.gpu?.temperature_before_c
  const liveEnd = run?.gpu?.temperature_after_c
  const computeMemory = run && liveMem!=null ? `${liveMem.toFixed(0)} MB` : '262 MB'
  const computeTemp = run && liveStart!=null && liveEnd!=null ? `${liveStart.toFixed(0)} → ${liveEnd.toFixed(0)} °C` : '52 → 54 °C'
  const computeTime = run ? `${metrics.processing_time_s.toFixed(3)} s` : '0.956 s'

  return <div className="page-content">
    <section className="page-heading">
      <div>
        <div className="eyebrow"><span className="live-dot"/> WORKING PROTOTYPE · CANONICAL PAIR 001</div>
        <h1>OHRC <span>→</span> LRO NAC</h1>
        <p>Real Chandrayaan-2 OHRC correspondence against an LRO NAC orthophoto on a verified common lunar map grid.</p>
      </div>
      <div className="heading-actions">
        <button className="ghost-btn" onClick={onRefresh}><ActivityIcon size={16}/>Check backend</button>
        <button className="ghost-btn" onClick={onExport}><DownloadIcon size={16}/>Export</button>
        <button className="primary-btn" onClick={onRun} disabled={running}><PlayIcon size={17}/>{running?'Running LightGlue…':'Run Live Registration'}</button>
      </div>
    </section>

    {lastError&&<div className="proto-warning"><InfoIcon size={17}/><div><b>Validated fallback ready</b><span>{lastError}</span></div></div>}

    <section className="metrics-grid" key={run?.run_id||'recorded-metrics'}>
      <AnimatedMetricCard label="Verified Inliers" value={metrics.verified_inliers} detail={`From ${metrics.proposed_matches} proposed matches`} trend={run?'LIVE':'V0.02'}/>
      <AnimatedMetricCard label="Spatial Coverage" value={metrics.spatial_coverage*100} decimals={1} unit="%" detail="8 × 8 common-grid occupancy" trend={run?'LIVE':'V0.02'}/>
      <AnimatedMetricCard label="Inlier Ratio" value={metrics.inlier_ratio*100} decimals={1} unit="%" detail="Geometrically consistent candidates"/>
      <AnimatedMetricCard label="Residual RMSE" value={metrics.rmse_px||0} decimals={2} unit=" px" detail="Homography reprojection residual" trend="not absolute accuracy"/>
    </section>

    <section className="workspace-grid">
      <div className={`viewer-card panel ${expanded?'viewer-expanded':''}`}>
        <div className="panel-head viewer-head">
          <div><h2>Registration Viewer</h2><span className="subtle">Canonical 1500 × 1500 grid · 1 m/px · eco inference 640 × 640</span></div>
          <div className="viewer-modes">
            {(['matches','overlay','source','reference'] as ViewerMode[]).map(m=><button key={m} className={mode===m?'active':''} onClick={()=>setMode(m)}>{m[0].toUpperCase()+m.slice(1)}</button>)}
          </div>
          <button className="icon-btn" onClick={()=>setExpanded(v=>!v)}>{expanded?<XIcon size={17}/>:<CrosshairIcon size={17}/>}</button>
        </div>
        <div className="viewer-stage proto-viewer-stage">
          <div key={`${mode}-${run?.run_id||'recorded'}`} className="proto-view-frame">
            {mode==='matches'&&<SafeImage src={assets.matches} fallback="/lunar-source.jpg" alt="Verified LightGlue correspondences"/>}
            {mode==='overlay'&&<SafeImage src={assets.overlay} fallback="/lunar-reference.jpg" alt="Registered overlay"/>}
            {mode==='source'&&<SafeImage src={assets.source} fallback="/lunar-source.jpg" alt="Georectified Chandrayaan-2 OHRC source"/>}
            {mode==='reference'&&<SafeImage src={assets.reference} fallback="/lunar-reference.jpg" alt="LRO NAC reference"/>}
          </div>
        </div>
        <div className="viewer-footer">
          <div className="coordinates"><CrosshairIcon size={15}/><span>Pair center 32.331194° E</span><span>69.441400° S</span></div>
          <div className="viewer-stats"><span><i className="dot cyan"/>{run?'Fresh inference':'Recorded validated evidence'}</span><span>{metrics.verified_inliers} inliers</span></div>
        </div>
      </div>

      <aside className="run-panel panel">
        <div className="panel-head"><div><h2>Registration Setup</h2><span className="subtle">Evidence-backed demo configuration</span></div><Pill tone={run?'green':'cyan'}>{run?'LIVE':'V0.02'}</Pill></div>
        <div className="proto-pair-stack">
          <div className="proto-file-card"><span>SOURCE</span><b>Chandrayaan-2 OHRC</b><small>ch2_ohr_ncp_20230823… · nominal 0.25 m/px</small></div>
          <div className="pair-connector"><span/><b>↕</b><span/></div>
          <div className="proto-file-card"><span>REFERENCE</span><b>LRO NAC orthophoto</b><small>NAC_DTM_VIKRAMSITE1… · 1 m/px product</small></div>
        </div>
        <div className="setup-grid">
          <div><span>Common grid</span><b>1 m/px</b></div>
          <div><span>Canonical size</span><b>1500²</b></div>
          <div><span>Working size</span><b>640²</b></div>
          <div><span>Geometry samples</span><b>484</b></div>
        </div>
        <div className="proto-config">
          <div><span>Feature extractor</span><b>SuperPoint</b></div>
          <div><span>Matcher</span><b>LightGlue</b></div>
          <div><span>Max keypoints</span><b>768</b></div>
          <div><span>Verification</span><b>RANSAC homography</b></div>
          <div><span>Thermal guard</span><b className="ok-text">Active</b></div>
        </div>
        <div className="proto-scope-note"><InfoIcon size={15}/><span>Current measured prototype scope is OHRC ↔ LRO on one independent acquisition pair. TMC-2, IIRS and sub-pixel refinement are planned.</span></div>
      </aside>
    </section>

    <section className="lower-grid">
      <div className="panel insight-card">
        <div className="panel-head"><div><h2>Classical vs Learned Matching</h2><span className="subtle">Same verified pair and geometric evaluation layer</span></div></div>
        <div className="proto-compare">
          <div><span>SIFT</span><b>5</b><small>verified inliers</small><em>7.8% coverage</em></div>
          <ChevronRightIcon size={20}/>
          <div className="winner"><span>LightGlue</span><b>155</b><small>verified inliers</small><em>79.7% coverage</em></div>
        </div>
      </div>
      <div className="panel insight-card">
        <div className="panel-head"><div><h2>{run?'Current Live Compute':'Measured V0.02 Compute'}</h2><span className="subtle">{run?'Fresh values from this inference':'Recorded benchmark values'}</span></div><CpuIcon size={17}/></div>
        <div className="proto-compute-grid">
          <div><span>Peak allocated VRAM</span><b>{computeMemory}</b></div>
          <div><span>GPU temperature</span><b>{computeTemp}</b></div>
          <div><span>Matcher inference</span><b>{computeTime}</b></div>
        </div>
      </div>
      <div className="panel insight-card metadata-card">
        <div className="panel-head"><div><h2>Scientific Interpretation</h2><span className="subtle">What the current result means</span></div><InfoIcon size={16}/></div>
        <div className="metadata-list">
          <div><span>Acquisition pairs</span><b>1 independent</b></div>
          <div><span>Native robustness crops</span><b>5 disjoint</b></div>
          <div><span>Controlled stress cases</span><b>3</b></div>
          <div><span>Absolute geodetic claim</span><b>No</b></div>
          <div><span>Sub-pixel refinement</span><b>Planned</b></div>
        </div>
      </div>
    </section>
  </div>
}

function Analytics() {
  return <div className="page-content">
    <section className="page-heading"><div><div className="eyebrow">MEASURED PERFORMANCE</div><h1>Registration Analytics</h1><p>Only results actually measured on the current prototype are shown here.</p></div></section>
    <section className="panel benchmark-panel">
      <div className="panel-head"><div><h2>V0.02 Baseline Comparison</h2><span className="subtle">Same 640 × 640 pair · same RANSAC evaluation</span></div><Pill tone="cyan">3 methods</Pill></div>
      <div className="table-scroll"><table className="data-table">
        <thead><tr><th>Method</th><th>Status</th><th>Proposed</th><th>Inliers</th><th>Ratio</th><th>RMSE</th><th>Coverage</th><th>Entropy</th><th>Inference</th><th>Peak VRAM</th></tr></thead>
        <tbody>{BASELINES.map(r=><tr key={r.method} className={r.method.includes('LightGlue')?'featured':''}>
          <td><b>{r.method}</b></td><td><Pill tone={r.status==='SUCCESS'?'green':'amber'}>{r.status}</Pill></td>
          <td>{r.proposed}</td><td>{r.inliers}</td><td>{pct(r.ratio)}</td><td>{r.rmse.toFixed(3)} px</td><td>{pct(r.coverage)}</td><td>{r.entropy.toFixed(3)}</td><td>{r.time.toFixed(3)} s</td><td>{r.memory==null?'CPU':`${r.memory.toFixed(0)} MB`}</td>
        </tr>)}</tbody>
      </table></div>
    </section>

    <section className="proto-analytics-cards">
      <div className="panel"><span className="eyebrow">WHY LIGHTGLUE</span><h3>Coverage is the decisive result</h3><p>SIFT’s low residual is based on only five surviving inliers. LightGlue provides 155 verified points over 79.7% of the spatial grid, giving far stronger whole-scene geometric support.</p></div>
      <div className="panel"><span className="eyebrow">LOW COMPUTE</span><h3>~262 MB peak allocated VRAM</h3><p>The selected learned matcher is substantially lighter than LoFTR in this benchmark while producing far broader correspondence coverage.</p></div>
      <div className="panel"><span className="eyebrow">CLAIM BOUNDARY</span><h3>Residual ≠ absolute geolocation error</h3><p>The reported pixel RMSE is the homography reprojection residual on accepted correspondences. It is not independent ground-truth positioning accuracy.</p></div>
    </section>

    <section className="panel proto-robustness-panel">
      <div className="panel-head"><div><h2>V0.03 Initial Robustness</h2><span className="subtle">5 disjoint native regions + 3 controlled perturbations</span></div><Pill tone="green">8 / 8 ROBUST</Pill></div>
      <div className="proto-robust-grid">{ROBUSTNESS.map(r=><div key={r.name} className="proto-robust-item">
        <div><span>{r.group}</span><CheckIcon size={13}/></div><b>{r.name}</b><strong>{r.inliers}<small> inliers</small></strong>
        <dl><div><dt>Coverage</dt><dd>{pct(r.coverage)}</dd></div><div><dt>RMSE</dt><dd>{r.rmse.toFixed(2)} px</dd></div><div><dt>Inference</dt><dd>{r.time.toFixed(3)} s</dd></div></dl>
      </div>)}</div>
      <div className="proto-science-boundary"><InfoIcon size={15}/><span>These five regions are from one acquisition pair. The gamma/contrast case is a photometric stress proxy, not evidence of real Sun-angle invariance.</span></div>
    </section>
  </div>
}

function Catalog({backend}:{backend:DemoStatus|null}) {
  const cards = [
    {name:'OHRC',status:'ACTIVE',tone:'cyan',title:'Chandrayaan-2 Orbiter High Resolution Camera',rows:[['Product','ch2_ohr_ncp_20230823…'],['Native resolution','~0.25 m/px'],['Acquisition','23 Aug 2023'],['Role','Prototype source']]},
    {name:'LRO NAC',status:'ACTIVE',tone:'cyan',title:'Lunar Reconnaissance Orbiter NAC',rows:[['Product','NAC_DTM_VIKRAMSITE1…'],['Product resolution','1 m/px'],['Projection','Lunar polar stereographic'],['Role','Reference orthophoto']]},
    {name:'TMC-2',status:'PLANNED',tone:'amber',title:'Chandrayaan-2 Terrain Mapping Camera 2',rows:[['Nominal GSD','~5 m'],['Prototype support','Not implemented'],['Next step','Sensor/GSD adapter'],['Claim','Planned only']]},
    {name:'IIRS',status:'PLANNED',tone:'amber',title:'Chandrayaan-2 Imaging Infrared Spectrometer',rows:[['Modality','Hyperspectral'],['Prototype support','Not implemented'],['Next step','Spectral-spatial adapter'],['Claim','Planned only']]},
  ]
  return <div className="page-content">
    <section className="page-heading"><div><div className="eyebrow">SCIENTIFIC DATA</div><h1>Lunar Data Catalog</h1><p>The catalog distinguishes data actually used by the prototype from final-system sensor targets.</p></div></section>
    <section className="catalog-summary">
      <div><span>Independent acquisition pairs</span><b>1</b></div>
      <div><span>Active prototype sensors</span><b>2</b></div>
      <div><span>Geometry control samples</span><b>484</b></div>
      <div><span>Canonical common coverage</span><b>100%</b></div>
    </section>
    <section className="sensor-cards">{cards.map(c=><div className="sensor-card panel" key={c.name}>
      <div className="sensor-card-top"><div className="sensor-icon"><MoonIcon size={21}/></div><Pill tone={c.tone as 'cyan'|'amber'}>{c.status}</Pill></div>
      <h2>{c.name}</h2><p>{c.title}</p>
      <div className="sensor-specs">{c.rows.map(([a,b])=><div key={a}><span>{a}</span><b>{b}</b></div>)}</div>
    </div>)}</section>
    <section className="panel proto-catalog-status">
      <div className="panel-head"><div><h2>Local Evidence Readiness</h2><span className="subtle">Files required by the internal-hackathon demo</span></div></div>
      <div className="proto-readiness">
        <div><CheckIcon size={14}/><span>Canonical pair</span><b>{backend?.canonical_pair_ready?'READY':'CHECK'}</b></div>
        <div><CheckIcon size={14}/><span>V0.02 benchmark evidence</span><b>{backend?.v002_ready?'READY':'CHECK'}</b></div>
        <div><CheckIcon size={14}/><span>V0.03 robustness evidence</span><b>{backend?.v003_ready?'READY':'CHECK'}</b></div>
        <div><CpuIcon size={14}/><span>CUDA runtime</span><b>{backend?.cuda_ready?'READY':'CHECK'}</b></div>
      </div>
    </section>
  </div>
}

function Runs({run}:{run:DemoRun|null}) {
  const rows = [
    ...(run?[{id:run.run_id,pair:'OHRC ↔ LRO NAC',stage:'Live demo',method:'SuperPoint + LightGlue',inliers:run.metrics.verified_inliers,coverage:pct(run.metrics.spatial_coverage),rmse:`${num(run.metrics.rmse_px,2)} px`,status:'LIVE'}]:[]),
    {id:'V002-LG',pair:'OHRC ↔ LRO NAC',stage:'V0.02 benchmark',method:'SuperPoint + LightGlue',inliers:155,coverage:'79.7%',rmse:'1.71 px',status:'VALIDATED'},
    {id:'V002-LF',pair:'OHRC ↔ LRO NAC',stage:'V0.02 benchmark',method:'LoFTR',inliers:50,coverage:'20.3%',rmse:'1.25 px',status:'VALIDATED'},
    {id:'V002-SIFT',pair:'OHRC ↔ LRO NAC',stage:'V0.02 benchmark',method:'SIFT',inliers:5,coverage:'7.8%',rmse:'0.60 px',status:'FAILED'},
    {id:'V003-ALL',pair:'OHRC ↔ LRO NAC',stage:'V0.03 robustness',method:'LightGlue · 8 cases',inliers:'42–100',coverage:'35.9–67.2%',rmse:'1.57–1.92 px',status:'8/8 ROBUST'},
  ]
  return <div className="page-content">
    <section className="page-heading"><div><div className="eyebrow">REPRODUCIBLE EVIDENCE</div><h1>Run History</h1><p>This view contains the actual prototype benchmark/robustness records and the current live session.</p></div></section>
    <section className="run-summary">
      <MetricCard label="Benchmark Methods" value="3" detail="SIFT · LoFTR · LightGlue"/>
      <MetricCard label="Robustness Cases" value="8" detail="5 native + 3 controlled"/>
      <MetricCard label="Independent Pairs" value="1" detail="Current scientific limitation"/>
      <MetricCard label="Live Session" value={run?'1':'0'} detail={run?'Fresh inference available':'Not run this session'}/>
    </section>
    <section className="panel runs-panel">
      <div className="table-scroll"><table className="data-table run-table">
        <thead><tr><th>Run</th><th>Pair</th><th>Stage</th><th>Method</th><th>Inliers</th><th>Coverage</th><th>RMSE</th><th>Status</th></tr></thead>
        <tbody>{rows.map(r=><tr key={r.id}><td><b className="run-id">{r.id}</b></td><td>{r.pair}</td><td>{r.stage}</td><td>{r.method}</td><td>{r.inliers}</td><td>{r.coverage}</td><td>{r.rmse}</td><td><Pill tone={r.status==='FAILED'?'amber':r.status==='LIVE'?'cyan':'green'}>{r.status}</Pill></td></tr>)}</tbody>
      </table></div>
    </section>
    <div className="proto-science-boundary"><InfoIcon size={15}/><span>V0.03 crops are not counted as independent acquisitions. Run history deliberately avoids fabricated locations, sensor pairs or validation sessions.</span></div>
  </div>
}

function Pipeline() {
  return <div className="page-content">
    <section className="page-heading"><div><div className="eyebrow">LUNAREG CORE</div><h1>Model Pipeline</h1><p>The implemented prototype and the final SIH architecture are shown separately.</p></div><div className="heading-actions"><Pill tone="green">WORKING CORE</Pill></div></section>
    <section className="pipeline-layout">
      <div className="panel pipeline-architecture">
        <div className="panel-head"><div><h2>Implemented Registration Graph</h2><span className="subtle">Real OHRC → LRO processing path</span></div></div>
        <div className="proto-stage-stack">{IMPLEMENTED.map(([name,desc],i)=><div key={name} className="proto-stage-row"><i><CheckIcon size={12}/></i><div><span>{String(i+1).padStart(2,'0')}</span><b>{name}</b><small>{desc}</small></div></div>)}</div>
      </div>
      <aside className="panel module-inspector">
        <div className="panel-head"><div><h2>Current Matcher</h2><span className="subtle">V0.02 selected backbone</span></div></div>
        <div className="module-number">LG</div><h3>SuperPoint + LightGlue</h3>
        <p>Frozen pretrained matching. No custom training is used in the current prototype.</p>
        <div className="module-specs">
          <div><span>Working input</span><b>640 × 640</b></div>
          <div><span>Max keypoints</span><b>768</b></div>
          <div><span>Mixed precision</span><b>Yes</b></div>
          <div><span>Compile</span><b>No</b></div>
          <div><span>Thermal guard</span><b className="ok-text">Active</b></div>
        </div>
      </aside>
    </section>
    <section className="proto-planned-section panel">
      <div className="panel-head"><div><h2>Final SIH Scope · Planned</h2><span className="subtle">Not represented as implemented functionality</span></div><Pill tone="amber">NEXT STAGES</Pill></div>
      <div className="proto-planned-grid">{PLANNED.map(([name,desc],i)=><div key={name}><i>{i+1}</i><div><b>{name}</b><span>{desc}</span></div></div>)}</div>
    </section>
    <section className="proto-flow panel">
      <div><b>OHRC PDS4</b><span>IMG + XML + geometry</span></div><ChevronRightIcon/><div><b>Common grid</b><span>GCP thin-plate spline</span></div><ChevronRightIcon/><div><b>LightGlue</b><span>learned correspondence</span></div><ChevronRightIcon/><div><b>RANSAC</b><span>geometric verification</span></div><ChevronRightIcon/><div><b>Quality</b><span>residual + coverage</span></div>
    </section>
  </div>
}

function Guide({onWorkspace,onRun}:{onWorkspace:()=>void;onRun:()=>void}) {
  return <div className="page-content guide-page">
    <section className="guide-hero panel">
      <div>
        <div className="eyebrow">SYSTEM OVERVIEW</div><h1>How LunaReg Works</h1>
        <p>LunaReg addresses lunar image correspondence where the same terrain changes appearance because of sensor characteristics, spatial resolution, viewing geometry, illumination and shadows.</p>
        <div className="guide-actions"><button className="primary-btn" onClick={onWorkspace}><RegisterIcon size={17}/>Open workspace</button><button className="ghost-btn" onClick={onRun}><PlayIcon size={17}/>Run live prototype</button></div>
      </div>
      <div className="proto-guide-diagram">
        <div><span>01</span><b>Scientific ingest</b><small>OHRC + metadata</small></div><ChevronRightIcon/>
        <div><span>02</span><b>Common grid</b><small>OHRC ↔ LRO</small></div><ChevronRightIcon/>
        <div><span>03</span><b>LightGlue</b><small>correspondence</small></div><ChevronRightIcon/>
        <div><span>04</span><b>RANSAC</b><small>verification</small></div>
      </div>
    </section>

    <section className="guide-section"><div className="section-title"><span>01</span><div><h2>Current evidence</h2><p>What has already been demonstrated on real lunar data.</p></div></div>
      <div className="metric-explain-grid">
        <div className="panel"><b>LightGlue Inliers</b><strong>155</strong><p>Verified correspondences on the V0.02 canonical pair.</p></div>
        <div className="panel"><b>Spatial Coverage</b><strong>79.7%</strong><p>Broad control-point support compared with SIFT’s 7.8%.</p></div>
        <div className="panel"><b>Robustness</b><strong>8 / 8</strong><p>Five disjoint regions and three controlled perturbations passed the internal diagnostic.</p></div>
        <div className="panel"><b>Compute</b><strong>262 MB</strong><p>Measured peak allocated GPU memory for the selected V0.02 LightGlue run.</p></div>
      </div>
    </section>

    <section className="guide-section"><div className="section-title"><span>02</span><div><h2>What to say during the demo</h2><p>Keep the distinction between working evidence and final scope explicit.</p></div></div>
      <div className="challenge-grid">
        <div className="panel challenge-card"><span>SUPPORTED</span><h3>Real OHRC → LRO correspondence</h3><p>Scientific ingestion, common-grid georectification, learned matching, RANSAC verification and coverage metrics are working now.</p></div>
        <div className="panel challenge-card"><span>SUPPORTED</span><h3>Controlled robustness</h3><p>Scale, rotation and gamma/contrast stress are engineering tests on the current pair.</p></div>
        <div className="panel challenge-card"><span>PLANNED</span><h3>TMC-2 + IIRS</h3><p>These sensors are part of the final SIH architecture but are not implemented in the current prototype.</p></div>
        <div className="panel challenge-card"><span>PLANNED</span><h3>Sub-pixel refinement</h3><p>Current RMSE is reprojection residual, not a claim of absolute sub-pixel geodetic accuracy.</p></div>
      </div>
    </section>

    <section className="final-guide panel">
      <div><div className="eyebrow">30-SECOND PITCH</div><h2>A working core, with a measured path to the full SIH scope.</h2><p>The current LunaReg prototype proves that a low-compute learned matcher can provide dense, spatially distributed OHRC-to-LRO correspondences where classical SIFT fails. The next research step is independent-acquisition validation before adding TMC-2, IIRS and sub-pixel refinement.</p></div>
      <button className="primary-btn" onClick={onWorkspace}>Open Registration <ChevronRightIcon size={16}/></button>
    </section>
  </div>
}

function SplashScreen({exiting}:{exiting:boolean}) {
  return <div className={`proto-splash ${exiting?'exit':''}`}>
    <div className="proto-stars"/><div className="proto-stars second"/>
    <div className="proto-splash-orbit orbit-a"/><div className="proto-splash-orbit orbit-b"/>
    <div className="proto-splash-moon"><span/><i/><em/></div>
    <div className="proto-splash-copy">
      <div className="proto-splash-brand"><BrandMark/><span>LUNAREG</span></div>
      <h1>Multi-modal Lunar Image Correspondence</h1>
      <p>Chandrayaan-2 · SIH 2026 · PS 26166</p>
      <div className="proto-boot-line"><span/><b>INITIALIZING REGISTRATION WORKSPACE</b></div>
    </div>
  </div>
}

function ProcessingExperience({step}:{step:number}) {
  return <div className="proto-process-screen">
    <div className="proto-process-card panel">
      <div className="proto-process-title"><span>LIVE CUDA PIPELINE</span><h2>Registering OHRC to LRO NAC</h2><p>No training. One eco-profile SuperPoint + LightGlue inference.</p></div>
      <div className="proto-process-visual">
        <div className="proto-process-image"><img src="/demo-runtime/source.png" alt="OHRC source"/><span>OHRC</span></div>
        <div className="proto-process-core">
          <div className="proto-core-ring r1"/><div className="proto-core-ring r2"/><div className="proto-core-ring r3"/>
          <BrandMark small/><b>LightGlue</b>
        </div>
        <div className="proto-process-image"><img src="/demo-runtime/reference.png" alt="LRO reference"/><span>LRO NAC</span></div>
        <svg className="proto-process-lines" viewBox="0 0 1000 300" preserveAspectRatio="none" aria-hidden>
          {[40,80,120,160,200,240].map((y,i)=><line key={y} x1="250" y1={y} x2="750" y2={y+(i%2?18:-12)} style={{animationDelay:`${i*.12}s`}}/>)}
        </svg>
      </div>
      <div className="proto-process-steps">
        {PROCESS_STEPS.map(([name,description],i)=><div key={name} className={i<step?'done':i===step?'active':''}>
          <i>{i<step?<CheckIcon size={11}/>:i+1}</i><div><b>{name}</b><span>{description}</span></div>
        </div>)}
      </div>
      <div className="proto-indeterminate"><span/></div>
      <small className="proto-process-note">The interface visualizes the known processing sequence; no synthetic result metrics are generated.</small>
    </div>
  </div>
}

function SuccessExperience({run,onClose}:{run:DemoRun;onClose:()=>void}) {
  const m=run.metrics
  return <div className="proto-success-screen">
    <div className="proto-success-card panel">
      <div className="proto-success-check"><CheckIcon size={28}/></div>
      <span>REGISTRATION COMPLETE</span>
      <h2>Fresh LightGlue result ready</h2>
      <div className="proto-success-metrics">
        <div><strong><AnimatedNumber value={m.verified_inliers}/></strong><small>Verified Inliers</small></div>
        <div><strong><AnimatedNumber value={m.spatial_coverage*100} decimals={1}/>%</strong><small>Spatial Coverage</small></div>
        <div><strong><AnimatedNumber value={m.inlier_ratio*100} decimals={1}/>%</strong><small>Inlier Ratio</small></div>
        <div><strong><AnimatedNumber value={m.rmse_px||0} decimals={2}/> px</strong><small>Residual RMSE</small></div>
      </div>
      <div className="proto-success-foot"><span>Run {run.run_id}</span><span>{m.processing_time_s.toFixed(3)} s matcher inference</span></div>
      <button className="primary-btn" onClick={onClose}>View Registration <ChevronRightIcon size={16}/></button>
    </div>
  </div>
}

export default function LunaRegApp() {
  const [active,setActive]=useState<NavKey>('workspace')
  const [theme,setTheme]=useState<Theme>('dark')
  const [backend,setBackend]=useState<DemoStatus|null>(null)
  const [backendError,setBackendError]=useState('')
  const [run,setRun]=useState<DemoRun|null>(null)
  const [running,setRunning]=useState(false)
  const [processingStep,setProcessingStep]=useState(0)
  const [showSuccess,setShowSuccess]=useState(false)
  const [showSplash,setShowSplash]=useState(true)
  const [splashExit,setSplashExit]=useState(false)
  const [lastError,setLastError]=useState('')
  const [toast,setToast]=useState('')
  const [searchOpen,setSearchOpen]=useState(false)
  const [search,setSearch]=useState('')
  const [mobileOpen,setMobileOpen]=useState(false)

  const metrics = run?.metrics || RECORDED

  useEffect(()=>{
    const saved=(localStorage.getItem('lunareg-theme') as Theme|null)||'dark'
    setTheme(saved); document.documentElement.dataset.theme=saved

    const seen=sessionStorage.getItem('lunareg-splash-seen')
    if(seen){
      setShowSplash(false)
    }else{
      sessionStorage.setItem('lunareg-splash-seen','1')
      const exitTimer=window.setTimeout(()=>setSplashExit(true),1450)
      const hideTimer=window.setTimeout(()=>setShowSplash(false),1850)
      return()=>{window.clearTimeout(exitTimer);window.clearTimeout(hideTimer)}
    }
  },[])

  useEffect(()=>{refresh(false)},[])
  useEffect(()=>{document.documentElement.dataset.theme=theme;localStorage.setItem('lunareg-theme',theme)},[theme])
  useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),2600);return()=>clearTimeout(t)},[toast])

  useEffect(()=>{
    if(!running){setProcessingStep(0);return}
    setProcessingStep(0)
    const timer=window.setInterval(()=>setProcessingStep(v=>Math.min(PROCESS_STEPS.length-1,v+1)),500)
    return()=>window.clearInterval(timer)
  },[running])

  useEffect(()=>{
    if(!showSuccess)return
    const timer=window.setTimeout(()=>setShowSuccess(false),2800)
    return()=>window.clearTimeout(timer)
  },[showSuccess])

  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setSearchOpen(true)}
      if(e.key==='Escape'){setSearchOpen(false);setMobileOpen(false);setShowSuccess(false)}
    }
    window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h)
  },[])

  async function refresh(show=true){
    try{
      const s=await getDemoStatus()
      setBackend(s);setBackendError('')
      if(show)setToast(s.status==='ready'?'All demo systems are ready':'System check completed')
    }catch(e){
      console.warn('LunaReg status check:',e)
      setBackend(null)
      setBackendError('The live engine is still starting or unavailable. Validated V0.02 evidence remains ready for demonstration.')
      if(show)setToast('Live engine not ready; validated evidence is available')
    }
  }

  async function execute(){
    if(running)return
    setRunning(true);setLastError('');setActive('workspace');setShowSuccess(false)
    try{
      const minimumPresentationTime=new Promise<void>(resolve=>window.setTimeout(resolve,2800))
      const liveRun=runLiveDemo()
      const [r]=await Promise.all([liveRun,minimumPresentationTime])
      setRun(r)
      setShowSuccess(true)
      setToast(`Fresh registration complete: ${r.metrics.verified_inliers} verified inliers`)
      try{setBackend(await getDemoStatus())}catch{}
    }catch(e){
      console.warn('LunaReg live inference:',e)
      const friendly=e instanceof Error && e.message
        ? e.message
        : 'Live inference is temporarily unavailable. Validated offline evidence is ready.'
      setLastError(friendly)
      setRun(null)
      setToast('Validated V0.02 result loaded as fallback')
    }finally{
      setRunning(false)
    }
  }

  const report={
    prototype:'LunaReg V0.03 internal hackathon',
    display_mode:run?'live':'recorded validated V0.02',
    api:API_BASE,
    backend,
    metrics,
    live_gpu:run?.gpu||null,
    v002_baselines:BASELINES,
    v003_robustness:ROBUSTNESS,
    limitations:[
      'One independent OHRC/LRO acquisition pair.',
      'V0.03 native regions are disjoint crops, not independent acquisitions.',
      'Gamma/contrast stress is not proof of real Sun-angle invariance.',
      'TMC-2, IIRS and sub-pixel refinement are planned.',
      'Residual RMSE is not independent absolute geodetic accuracy.'
    ]
  }

  const navigate=(k:NavKey)=>{setActive(k);setMobileOpen(false);window.scrollTo({top:0,behavior:'smooth'})}
  const filtered=NAV_ITEMS.filter(n=>n.label.toLowerCase().includes(search.toLowerCase()))

  const view = active==='analytics'?<Analytics/>:
    active==='catalog'?<Catalog backend={backend}/>:
    active==='runs'?<Runs run={run}/>:
    active==='pipeline'?<Pipeline/>:
    active==='guide'?<Guide onWorkspace={()=>navigate('workspace')} onRun={execute}/>:
    <Workspace metrics={metrics} run={run} backend={backend} running={running} lastError={lastError||backendError}
      onRun={execute} onRefresh={()=>refresh(true)} onExport={()=>{downloadJSON(report,'lunareg_prototype_report.json');setToast('Prototype report exported')}} notify={setToast}/>

  return <>
    {showSplash&&<SplashScreen exiting={splashExit}/>}
    <div className="app-shell proto-app-enter">
      <Sidebar active={active} onNavigate={navigate} mobileOpen={mobileOpen} onClose={()=>setMobileOpen(false)}/>
      <main className="main-area">
        <Header active={active} theme={theme} onToggleTheme={()=>setTheme(theme==='dark'?'light':'dark')}
          onSearch={()=>setSearchOpen(true)} backend={backend} live={!!run} onMobile={()=>setMobileOpen(true)}/>
        <div key={active} className="proto-page-enter">{view}</div>
      </main>

      {searchOpen&&<div className="modal-backdrop command-backdrop" onMouseDown={()=>setSearchOpen(false)}>
        <div className="command-palette panel" onMouseDown={e=>e.stopPropagation()}>
          <div className="command-input"><SearchIcon size={20}/><input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search LunaReg…"/><kbd>ESC</kbd></div>
          <div className="command-results">{filtered.map(n=><button key={n.key} onClick={()=>{navigate(n.key);setSearchOpen(false);setSearch('')}}><span className="nav-icon">{n.icon}</span><div><b>{n.label}</b><small>Open prototype section</small></div><span>↵</span></button>)}</div>
        </div>
      </div>}

      {running&&<ProcessingExperience step={processingStep}/>}
      {showSuccess&&run&&<SuccessExperience run={run} onClose={()=>setShowSuccess(false)}/>}
      {toast&&<div className="toast"><CheckIcon size={16}/>{toast}</div>}
    </div>
  </>
}
