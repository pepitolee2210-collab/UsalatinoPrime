import { NextRequest, NextResponse } from 'next/server'

/**
 * Proxy server-side para resolver ZIP code → ciudad/estado (USA).
 * Evita problemas de CSP al no llamar a zippopotam.us desde el navegador.
 * Response: { city: string, state: string } | { error: string }
 */
export async function GET(req: NextRequest) {
  const zip = (req.nextUrl.searchParams.get('zip') || '').trim()

  if (!/^\d{5}$/.test(zip)) {
    return NextResponse.json({ error: 'Invalid ZIP' }, { status: 400 })
  }

  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`, {
      // 5s timeout — suficiente para esta API
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      return NextResponse.json({ error: 'ZIP not found' }, { status: 404 })
    }
    const data = await res.json()
    const place = data?.places?.[0]
    if (!place) {
      return NextResponse.json({ error: 'ZIP not found' }, { status: 404 })
    }
    return NextResponse.json(
      {
        city: String(place['place name'] || ''),
        state: String(place['state abbreviation'] || ''),
      },
      {
        // Cache 1h a nivel CDN; el ZIP → city/state no cambia
        headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' },
      }
    )
  } catch {
    return NextResponse.json({ error: 'Lookup failed' }, { status: 502 })
  }
}
