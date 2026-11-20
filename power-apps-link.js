import { parseCoordinates } from './records.js'

export function parseCanvasWebLink(value) {
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.origin === 'https://apps.powerapps.com' && url.pathname.startsWith('/play/')
      && url.pathname.length > '/play/'.length && !url.username && !url.password) return url
  } catch {
    return null
  }
  return null
}

export function buildCanvasReturnLink(base, codigoSAP, selection, zoom) {
  const url = parseCanvasWebLink(base)
  const point = parseCoordinates(selection?.latitude, selection?.longitude)
  if (!url || !point || selection.origemCoordenada !== 'manual') return null

  for (const [name, value] of Object.entries({
    codigoSAP,
    latitude: point.latitude,
    longitude: point.longitude,
    origemCoordenada: selection.origemCoordenada,
    codigoLocalReferencia: selection.codigoLocalReferencia,
    zoom,
  })) {
    url.searchParams.set(name, String(value ?? ''))
  }
  return url.href
}
