'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIcon, BookOpenIcon, CheckIcon, ChevronRightIcon, CpuIcon,
  CrosshairIcon, DownloadIcon, InfoIcon, MoonIcon, PlayIcon, SunIcon
} from './Icons'
import {
  API_BASE, backendAsset, DemoMetrics, DemoRun, DemoStatus, getDemoStatus, runLiveDemo
} from '@/lib/lunareg-demo'

type Tab = 'demo' | 'evidence' | 'robustness' | 'pipeline' | 'scope'
type ViewMode = 'matches' | 'overlay' | 'source' | 'reference'
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

const baselineRows = [
  { method: 'SIFT', status: 'FAILED', proposed: 17, inliers: 5, ratio: 0.2941, rmse: 0.6006, coverage: 0.0781, time: 0.2155, compute: 'CPU' },
  { method: 'LoFTR', status: 'SUCCESS', proposed: 217, inliers: 50, ratio: 0.2304, rmse: 1.2458, coverage: 0.2031, time: 0.6947, compute: 'CUDA / 1010 MB' },
  { method: 'SuperPoint + LightGlue', status: 'SUCCESS', proposed: 298, inliers: 155, ratio: 0.5201, rmse: 1.7056, coverage: 0.7969, time: 0.9563, compute: 'CUDA / 262 MB' },
]

const robustnessRows = [
  ['Native NW', 56, 0.3750, 1.5926, 0.5923],
  ['Native NE', 70, 0.4844, 1.7766, 0.0568],
  ['Native Center', 100, 0.6719, 1.8161, 0.0477],
  ['Native SW', 78, 0.5781, 1.6966, 0.0549],
  ['Native SE', 80, 0.6250, 1.9216, 0.0468],
  ['Scale 0.75×', 65, 0.4062, 1.5687, 0.0717],
  ['Rotation +10°', 42, 0.3594, 1.8554, 0.0716],
  ['Gamma / contrast', 81, 0.6562, 1.6369, 0.0475],
] as const

const implemented = [
  ['PDS4 scientific ingestion', 'Real Chandrayaan-2 OHRC IMG, XML and geometry CSV products.'],
  ['GCP/TPS georectification', '484 geometry samples warp OHRC onto the same 1 m LRO map grid.'],
  ['Learned correspondence', 'SuperPoint + LightGlue is the current primary correspondence backbone.'],
  ['Geometric verification', 'RANSAC homography rejects inconsistent candidate matches.'],
  ['Coverage evaluation', 'An 8 × 8 spatial grid measures scene-wide control-point support.'],
]

const planned = [
  ['Cross-acquisition validation', 'Different OHRC acquisitions and real Sun-angle changes.'],
  ['TMC-2 sensor path', 'Sensor/GSD-aware processing for Chandrayaan-2 TMC-2.'],
  ['IIRS adapter', 'Spectral-spatial representation for hyperspectral correspondence.'],
  ['Sub-pixel refinement', 'Fractional-pixel refinement after robust coarse correspondence.'],
]

const pct = (v:number) => `${(v * 100).toFixed(1)}%`
const num = (v:number|null|undefined, d=2) => v == null ? '—' : v.toFixed(d)

function downloadJSON(data:unknown, filename:string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'})
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 100)
}

function SafeImage({src, fallback, alt}:{src?:string; fallback:string; alt:string}) {
  const [failed,setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  return <img src={failed || !src ? fallback : src} alt={alt} onError={() => setFailed(true)} />
}

function StatusBadge({mode, backend}:{mode:'live'|'recorded'; backend:DemoStatus|null}) {
  if (mode === 'live') return <span className="hd-status hd-live"><i/>LIVE CUDA RUN</span>
  if (backend?.status === 'ready') return <span className="hd-status hd-ready"><i/>BACKEND READY</span>
  return <span className="hd-status hd-recorded"><i/>RECORDED VALIDATED RESULT</span>
}

export default function HackathonDemo() {
  const [tab,setTab] = useState<Tab>('demo')
  const [view,setView] = useState<ViewMode>('matches')
  const [theme,setTheme] = useState<Theme>('dark')
  const [backend,setBackend] = useState<DemoStatus|null>(null)
  const [backendError,setBackendError] = useState('')
  const [run,setRun] = useState<DemoRun|null>(null)
  const [running,setRunning] = useState(false)
  const [lastError,setLastError] = useState('')
  const [toast,setToast] = useState('')

  useEffect(() => {
    const saved = (localStorage.getItem('lunareg-demo-theme') as Theme|null) || 'dark'
    setTheme(saved)
    document.documentElement.dataset.theme = saved
    getDemoStatus().then(v => {setBackend(v);setBackendError('')}).catch(e => {
      setBackend(null); setBackendError(e instanceof Error ? e.message : 'Backend unavailable')
    })
  }, [])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('lunareg-demo-theme', theme)
  }, [theme])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2500)
    return () => clearTimeout(t)
  }, [toast])

  const mode:'live'|'recorded' = run ? 'live' : 'recorded'
  const metrics = run?.metrics || RECORDED

  const assets = useMemo(() => {
    const fallback = {
      source:'/demo-runtime/source.png',
      reference:'/demo-runtime/reference.png',
      matches:'/demo-runtime/matches.jpg',
      overlay:'/demo-runtime/overlay.jpg'
    }
    if (!run) return fallback
    return {
      source:backendAsset(run.assets.source) || fallback.source,
      reference:backendAsset(run.assets.reference) || fallback.reference,
      matches:backendAsset(run.assets.matches_inliers) || fallback.matches,
      overlay:backendAsset(run.assets.overlay) || fallback.overlay,
    }
  }, [run])

  async function refreshBackend() {
    try {
      const v = await getDemoStatus()
      setBackend(v); setBackendError(''); setToast('Backend status refreshed')
    } catch (e) {
      setBackend(null)
      setBackendError(e instanceof Error ? e.message : 'Backend unavailable')
      setToast('Backend unavailable; recorded fallback remains ready')
    }
  }

  async function execute() {
    if (running) return
    setRunning(true); setLastError(''); setTab('demo')
    try {
      const result = await runLiveDemo()
      setRun(result); setView('matches')
      setToast(`Live registration complete: ${result.metrics.verified_inliers} verified inliers`)
      getDemoStatus().then(setBackend).catch(() => {})
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Live registration failed'
      setRun(null); setLastError(message)
      setToast('Live run unavailable; showing recorded validated result')
    } finally {
      setRunning(false)
    }
  }

  const report = {
    prototype:'LunaReg V0.03 Hackathon Demo',
    mode,
    pair:'Chandrayaan-2 OHRC → LRO NAC, Canonical Pair 001',
    metrics,
    limitations:[
      'One real acquisition pair has been validated so far.',
      'V0.03 regional crops are not independent acquisitions.',
      'Gamma/contrast stress is not proof of real Sun-angle invariance.',
      'Sub-pixel refinement, TMC-2 and IIRS are planned stages.'
    ]
  }

  return <div className="hd-shell">
    <header className="hd-topbar">
      <div className="hd-brand">
        <div className="hd-mark"><MoonIcon size={23}/><span/></div>
        <div><b>LunaReg</b><span>SIH 26166 · WORKING PROTOTYPE</span></div>
      </div>
      <nav className="hd-nav">
        {([['demo','Live Demo'],['evidence','Evidence'],['robustness','Robustness'],['pipeline','Pipeline'],['scope','Scope']] as [Tab,string][]).map(([k,l]) =>
          <button key={k} className={tab===k?'active':''} onClick={() => setTab(k)}>{l}</button>
        )}
      </nav>
      <div className="hd-top-actions">
        <StatusBadge mode={mode} backend={backend}/>
        <button className="hd-icon-btn" onClick={() => setTheme(theme==='dark'?'light':'dark')} title="Toggle theme">
          {theme==='dark'?<SunIcon size={18}/>:<MoonIcon size={18}/>}
        </button>
      </div>
    </header>

    <main className="hd-main">
      {tab==='demo' && <>
        <section className="hd-hero">
          <div>
            <div className="hd-eyebrow">CHANDRAYAAN-2 OHRC → LRO NAC</div>
            <h1>Real lunar correspondence.<br/><span>Measured, not mocked.</span></h1>
            <p>Canonical Pair 001 uses real OHRC PDS data and an LRO NAC orthophoto, georectified onto the same 1 m lunar map grid before learned correspondence.</p>
            <div className="hd-actions">
              <button className="hd-primary" onClick={execute} disabled={running}>
                {running?<span className="hd-spinner"/>:<PlayIcon size={17}/>}
                {running?'Running LightGlue…':'Run Live Registration'}
              </button>
              <button className="hd-secondary" onClick={refreshBackend}><ActivityIcon size={17}/>Check backend</button>
              <button className="hd-secondary" onClick={() => downloadJSON(report,'lunareg_demo_report.json')}><DownloadIcon size={17}/>Export report</button>
            </div>
            <div className="hd-backend-line">
              <span className={backend?.status==='ready'?'ok':'warn'}/>
              {backend?.status==='ready'
                ? `FastAPI ready · CUDA ${backend.cuda_ready===true?'available':'status unknown'} · ${API_BASE}`
                : `Recorded fallback active${backendError?` · ${backendError}`:''}`}
            </div>
          </div>
          <div className="hd-result-summary">
            <span className="hd-summary-label">{mode==='live'?'LIVE RESULT':'V0.02 VALIDATED RESULT'}</span>
            <strong>{metrics.verified_inliers}</strong><b>verified inliers</b>
            <div className="hd-summary-grid">
              <div><span>Coverage</span><b>{pct(metrics.spatial_coverage)}</b></div>
              <div><span>Inlier ratio</span><b>{pct(metrics.inlier_ratio)}</b></div>
              <div><span>Residual RMSE</span><b>{num(metrics.rmse_px)} px</b></div>
              <div><span>Matcher time</span><b>{num(metrics.processing_time_s,3)} s</b></div>
            </div>
            <small>RMSE is homography reprojection residual on accepted correspondences, not independent absolute geodetic accuracy.</small>
          </div>
        </section>

        {lastError && <div className="hd-warning"><InfoIcon size={18}/><div><b>Live inference was not used.</b><span>{lastError}. The viewer is showing the recorded V0.02 validated result.</span></div></div>}

        <section className="hd-metrics">
          <div><span>Proposed matches</span><b>{metrics.proposed_matches}</b><small>SuperPoint candidates</small></div>
          <div><span>Verified inliers</span><b>{metrics.verified_inliers}</b><small>RANSAC-consistent</small></div>
          <div><span>Spatial coverage</span><b>{pct(metrics.spatial_coverage)}</b><small>8 × 8 grid occupancy</small></div>
          <div><span>Coverage entropy</span><b>{num(metrics.coverage_entropy,3)}</b><small>Distribution uniformity</small></div>
        </section>

        <section className="hd-viewer-card">
          <div className="hd-viewer-head">
            <div><span className="hd-section-kicker">CANONICAL PAIR 001</span><h2>Registration Evidence Viewer</h2></div>
            <div className="hd-view-tabs">
              {(['matches','overlay','source','reference'] as ViewMode[]).map(v =>
                <button key={v} className={view===v?'active':''} onClick={() => setView(v)}>{v[0].toUpperCase()+v.slice(1)}</button>
              )}
            </div>
          </div>
          <div className="hd-viewer">
            {view==='matches' && <SafeImage src={assets.matches} fallback="/demo-runtime/matches.jpg" alt="Verified LightGlue correspondences"/>}
            {view==='overlay' && <SafeImage src={assets.overlay} fallback="/demo-runtime/overlay.jpg" alt="Registered source/reference overlay"/>}
            {view==='source' && <SafeImage src={assets.source} fallback="/demo-runtime/source.png" alt="Georectified OHRC source"/>}
            {view==='reference' && <SafeImage src={assets.reference} fallback="/demo-runtime/reference.png" alt="LRO NAC reference"/>}
            {running && <div className="hd-viewer-running"><span className="hd-spinner large"/><b>SuperPoint + LightGlue</b><small>640 × 640 eco profile · one inference</small></div>}
          </div>
          <div className="hd-viewer-foot">
            <span><CrosshairIcon size={15}/>Common 1 m map grid</span>
            <span>Pair center: 32.331194° E, 69.441400° S</span>
            <span>{mode==='live'?'Fresh inference':'Recorded V0.02 evidence'}</span>
          </div>
        </section>

        <section className="hd-demo-bottom">
          <div className="hd-panel">
            <div className="hd-panel-head"><div><span className="hd-section-kicker">WHY IT MATTERS</span><h3>Classical matching failed on the same pair</h3></div></div>
            <div className="hd-compare-mini">
              <div><span>SIFT</span><b>5</b><small>inliers · 7.8% coverage</small></div>
              <ChevronRightIcon size={22}/>
              <div className="winner"><span>LightGlue</span><b>155</b><small>inliers · 79.7% coverage</small></div>
            </div>
          </div>
          <div className="hd-panel">
            <div className="hd-panel-head"><div><span className="hd-section-kicker">COMPUTE</span><h3>Laptop-safe inference</h3></div></div>
            <div className="hd-compute">
              <div><CpuIcon size={22}/><span>Peak allocated VRAM</span><b>262 MB</b></div>
              <div><ActivityIcon size={22}/><span>Measured temperature</span><b>52 → 54 °C</b></div>
              <div><PlayIcon size={22}/><span>Inference</span><b>0.956 s</b></div>
            </div>
          </div>
        </section>
      </>}

      {tab==='evidence' && <section className="hd-page">
        <div className="hd-page-title"><div className="hd-eyebrow">V0.02 BENCHMARK</div><h1>Baseline Evidence</h1><p>Same 640 × 640 pair, same RANSAC evaluation layer, measured on this prototype.</p></div>
        <div className="hd-panel hd-table-panel"><table className="hd-table">
          <thead><tr><th>Method</th><th>Status</th><th>Proposed</th><th>Inliers</th><th>Inlier ratio</th><th>RMSE</th><th>Coverage</th><th>Inference</th><th>Compute</th></tr></thead>
          <tbody>{baselineRows.map(r => <tr key={r.method} className={r.method.includes('LightGlue')?'featured':''}>
            <td><b>{r.method}</b></td><td><span className={`hd-result-pill ${r.status==='SUCCESS'?'success':'failed'}`}>{r.status}</span></td>
            <td>{r.proposed}</td><td>{r.inliers}</td><td>{pct(r.ratio)}</td><td>{r.rmse.toFixed(3)} px</td><td>{pct(r.coverage)}</td><td>{r.time.toFixed(3)} s</td><td>{r.compute}</td>
          </tr>)}</tbody>
        </table></div>
        <div className="hd-evidence-cards">
          <div className="hd-panel"><span className="hd-section-kicker">INFERENCE</span><h3>What V0.02 established</h3><p>SIFT did not provide enough globally distributed correspondences. Both learned methods succeeded, but LightGlue produced much stronger scene-wide coverage.</p></div>
          <div className="hd-panel"><span className="hd-section-kicker">IMPORTANT</span><h3>SIFT's low RMSE is not a win</h3><p>Its 0.60 px residual comes from only five surviving RANSAC points, which is insufficient to constrain the whole scene.</p></div>
          <div className="hd-panel"><span className="hd-section-kicker">CURRENT CHOICE</span><h3>Primary backbone: LightGlue</h3><p>155 verified inliers, 79.7% coverage and ~262 MB peak allocated GPU memory make it the best measured prototype backbone.</p></div>
        </div>
      </section>}

      {tab==='robustness' && <section className="hd-page">
        <div className="hd-page-title"><div className="hd-eyebrow">V0.03 INITIAL</div><h1>Robustness Harness</h1><p>Five disjoint regions plus controlled scale, rotation and photometric perturbations. All eight passed the current engineering diagnostic.</p></div>
        <div className="hd-robust-grid">{robustnessRows.map(([name,inliers,coverage,rmse,time]) =>
          <div className="hd-robust-card" key={name}><div><span>ROBUST</span><CheckIcon size={15}/></div><h3>{name}</h3><b>{inliers} <small>inliers</small></b>
            <dl><div><dt>Coverage</dt><dd>{pct(coverage)}</dd></div><div><dt>RMSE</dt><dd>{rmse.toFixed(2)} px</dd></div><div><dt>Inference</dt><dd>{time.toFixed(3)} s</dd></div></dl>
          </div>
        )}</div>
        <div className="hd-warning hd-neutral"><InfoIcon size={18}/><div><b>Scientific boundary</b><span>The five native regions come from one acquisition pair. The gamma/contrast case is a photometric proxy, not proof of real Sun-angle invariance. Cross-acquisition validation is next.</span></div></div>
      </section>}

      {tab==='pipeline' && <section className="hd-page">
        <div className="hd-page-title"><div className="hd-eyebrow">PROTOTYPE ARCHITECTURE</div><h1>Implemented vs planned</h1><p>The demo separates working modules from the final SIH scope.</p></div>
        <div className="hd-pipeline-columns">
          <div className="hd-panel"><div className="hd-panel-head"><div><span className="hd-section-kicker">WORKING NOW</span><h3>Implemented prototype</h3></div><span className="hd-result-pill success">REAL</span></div>
            <div className="hd-stage-list">{implemented.map(([n,d],i) => <div key={n}><i><CheckIcon size={13}/></i><span><b>{i+1}. {n}</b><small>{d}</small></span></div>)}</div>
          </div>
          <div className="hd-panel"><div className="hd-panel-head"><div><span className="hd-section-kicker">NEXT STAGES</span><h3>Final LunaReg scope</h3></div><span className="hd-result-pill planned">PLANNED</span></div>
            <div className="hd-stage-list planned">{planned.map(([n,d],i) => <div key={n}><i>{i+1}</i><span><b>{n}</b><small>{d}</small></span></div>)}</div>
          </div>
        </div>
        <div className="hd-flow">
          <div><b>OHRC PDS4</b><span>IMG + XML + geometry</span></div><ChevronRightIcon size={18}/>
          <div><b>1 m common grid</b><span>GCP thin-plate spline</span></div><ChevronRightIcon size={18}/>
          <div><b>LightGlue</b><span>learned correspondence</span></div><ChevronRightIcon size={18}/>
          <div><b>RANSAC</b><span>geometric verification</span></div><ChevronRightIcon size={18}/>
          <div><b>Quality report</b><span>residual + coverage</span></div>
        </div>
      </section>}

      {tab==='scope' && <section className="hd-page">
        <div className="hd-page-title"><div className="hd-eyebrow">PRESENTATION SCOPE</div><h1>What the prototype supports</h1><p>Use this page if judges ask what is working today versus what remains.</p></div>
        <div className="hd-scope-grid">
          <div className="hd-panel hd-scope yes"><h3><CheckIcon size={20}/> Demonstrated</h3><ul>
            <li>Real Chandrayaan-2 OHRC product ingestion.</li><li>Real LRO NAC reference imagery.</li><li>484-point OHRC georectification onto the LRO grid.</li>
            <li>100% common coverage on Canonical Pair 001.</li><li>SIFT, LoFTR and LightGlue measured comparison.</li><li>Live LightGlue inference.</li><li>Regional and controlled robustness tests.</li>
          </ul></div>
          <div className="hd-panel hd-scope no"><h3><InfoIcon size={20}/> Do not claim yet</h3><ul>
            <li>Absolute sub-pixel geodetic accuracy.</li><li>General real Sun-angle invariance.</li><li>Cross-acquisition generalization.</li>
            <li>Working TMC-2 correspondence.</li><li>Working IIRS correspondence.</li><li>A custom-trained LunaReg neural network.</li>
          </ul></div>
        </div>
        <div className="hd-panel hd-pitch"><BookOpenIcon size={26}/><div><span className="hd-section-kicker">30-SECOND SUMMARY</span><h3>LunaReg combines scientific georectification with learned correspondence and explicit geometric quality checks.</h3><p>The current prototype validates the core OHRC→LRO pipeline on real data. The final architecture extends it to TMC-2, IIRS, independent-acquisition robustness and sub-pixel refinement.</p></div></div>
      </section>}
    </main>

    <footer className="hd-footer"><span>Termin8ors · Smart India Hackathon 2026 · PS 26166</span><span>Prototype V0.03 · evidence frozen for internal demo</span></footer>
    {toast && <div className="hd-toast"><CheckIcon size={16}/>{toast}</div>}
  </div>
}
