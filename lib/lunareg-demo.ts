export const API_BASE =
  process.env.NEXT_PUBLIC_LUNAREG_API_URL?.replace(/\/$/, '') ||
  'http://127.0.0.1:8000'

export type DemoMetrics = {
  rmse_px: number | null
  median_error_px: number | null
  p90_error_px: number | null
  proposed_matches: number
  verified_inliers: number
  inlier_ratio: number
  spatial_coverage: number
  coverage_entropy: number
  processing_time_s: number
  ground_equivalent_rmse_m?: number | null
}

export type DemoRun = {
  mode: 'live'
  run_id: string
  method: string
  status: string
  metrics: DemoMetrics
  assets: {
    source: string
    reference: string
    matches_all?: string
    matches_inliers?: string
    overlay?: string
  }
  gpu?: {
    temperature_before_c?: number | null
    temperature_after_c?: number | null
    peak_allocated_memory_mb?: number | null
  }
}

export type DemoStatus = {
  status: 'ready' | 'incomplete'
  version: string
  canonical_pair_ready: boolean
  v002_ready: boolean
  v003_ready: boolean
  cuda_ready: boolean | null
  gpu_temperature_c?: number | null
  message: string
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  friendlyTimeout: string,
): Promise<Response> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => {
    controller.abort(new DOMException(friendlyTimeout, 'TimeoutError'))
  }, timeoutMs)

  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(friendlyTimeout)
    }
    if (error instanceof TypeError && /abort/i.test(error.message)) {
      throw new Error(friendlyTimeout)
    }
    throw error
  } finally {
    window.clearTimeout(timer)
  }
}

export function backendAsset(path?: string): string | undefined {
  if (!path) return undefined
  if (/^https?:\/\//.test(path)) return path
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`
}

export async function getDemoStatus(): Promise<DemoStatus> {
  const response = await fetchWithTimeout(
    `${API_BASE}/v1/demo/status`,
    { cache: 'no-store' },
    10000,
    'The registration engine is still starting. Validated offline evidence is ready.',
  )
  if (!response.ok) throw new Error('The registration engine did not report ready status.')
  return response.json()
}

export async function runLiveDemo(): Promise<DemoRun> {
  const response = await fetchWithTimeout(
    `${API_BASE}/v1/demo/lightglue`,
    { method: 'POST' },
    60000,
    'Live inference took longer than expected. Validated offline evidence is ready.',
  )
  if (!response.ok) {
    if (response.status === 423) {
      throw new Error('The thermal guard paused live inference. Validated offline evidence is ready.')
    }
    throw new Error('The live registration engine is temporarily unavailable. Validated offline evidence is ready.')
  }
  return response.json()
}
