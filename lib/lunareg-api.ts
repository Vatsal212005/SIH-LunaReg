/**
 * LunaReg backend contract.
 * Point NEXT_PUBLIC_LUNAREG_API_URL to the FastAPI service when model inference is connected.
 */
export const API_BASE = process.env.NEXT_PUBLIC_LUNAREG_API_URL ?? ''

export type RegistrationMetrics = {
  rmse_px: number
  median_error_px: number
  p90_error_px: number
  proposed_matches: number
  verified_inliers: number
  inlier_ratio: number
  spatial_coverage: number
  coverage_entropy: number
  processing_time_s: number
}

export type RegistrationResult = {
  run_id: string
  source_sensor: string
  reference_sensor: string
  registered_product_url?: string
  match_points_url?: string
  quality_report_url?: string
  metrics: RegistrationMetrics
}

export async function createRegistration(source: File, reference: File): Promise<RegistrationResult> {
  if (!API_BASE) throw new Error('LunaReg API URL is not configured.')
  const body = new FormData()
  body.append('source', source)
  body.append('reference', reference)
  const response = await fetch(`${API_BASE}/v1/registrations`, { method: 'POST', body })
  if (!response.ok) throw new Error(`Registration failed with status ${response.status}.`)
  return response.json()
}

export async function getRegistration(runId: string): Promise<RegistrationResult> {
  if (!API_BASE) throw new Error('LunaReg API URL is not configured.')
  const response = await fetch(`${API_BASE}/v1/registrations/${encodeURIComponent(runId)}`)
  if (!response.ok) throw new Error(`Could not load run ${runId}.`)
  return response.json()
}
