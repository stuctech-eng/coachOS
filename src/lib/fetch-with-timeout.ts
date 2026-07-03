// ─── Fetch met timeout ──────────────────────────────────────────────────────
// Voorkomt dat een trage/hangende externe API (bv. Open-Meteo, ipapi.co) een
// volledige serverless function laat vastlopen tot de platform-timeout.
// Gebruikt AbortController — bij overschrijding van timeoutMs wordt de fetch
// afgebroken en gooit hij een AbortError, die de aanroeper zelf afvangt.

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 3000
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    return res
  } finally {
    clearTimeout(timeoutId)
  }
}
