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

const returnIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const maxReturnAgeSeconds = 10 * 60

export function parseAdministrationSapContext(parameters) {
  if (parameters?.get('tela') !== 'administracaoSap') return null
  return Object.freeze({
    tela: 'administracaoSap',
    localizacaoId: parameters.get('localizacaoId'),
    codigoSAP: parameters.get('codigoSAP'),
    retornoId: parameters.get('retornoId'),
    emitidoEmUtc: parameters.get('emitidoEmUtc'),
  })
}

function validAdministrationContext(context, currentCode, now) {
  if (!context || context.tela !== 'administracaoSap') return false
  const id = Number(context.localizacaoId)
  const issuedAt = typeof context.emitidoEmUtc === 'string' && /^[0-9]+$/.test(context.emitidoEmUtc)
    ? Number(context.emitidoEmUtc) : NaN
  const nowSeconds = Math.floor(now / 1000)
  const contextCode = context.codigoSAP
  return Number.isSafeInteger(id) && id > 0
    && typeof contextCode === 'string' && contextCode.length > 0
    && currentCode === contextCode
    && typeof context.retornoId === 'string' && returnIdPattern.test(context.retornoId)
    && Number.isSafeInteger(issuedAt) && Number.isSafeInteger(nowSeconds)
    && issuedAt <= nowSeconds && nowSeconds - issuedAt <= maxReturnAgeSeconds
}

export function buildCanvasReturnLink(base, codigoSAP, selection, zoom, context = null, now = Date.now()) {
  const url = parseCanvasWebLink(base)
  const point = parseCoordinates(selection?.latitude, selection?.longitude)
  if (!url || !point || selection?.origemCoordenada !== 'manual') return null

  const adminContext = context?.tela === 'administracaoSap' ? context : null
  const currentCode = typeof codigoSAP === 'string' ? codigoSAP : ''
  if (adminContext && !validAdministrationContext(adminContext, currentCode, now)) return null
  if (adminContext && selection.codigoSAPAtSelection !== adminContext.codigoSAP) return null

  for (const [name, value] of Object.entries({
    codigoSAP: adminContext ? adminContext.codigoSAP : codigoSAP,
    latitude: point.latitude,
    longitude: point.longitude,
    origemCoordenada: selection.origemCoordenada,
    codigoLocalReferencia: selection.codigoLocalReferencia,
    zoom,
  })) {
    url.searchParams.set(name, String(value ?? ''))
  }
  if (adminContext) {
    url.searchParams.set('tela', adminContext.tela)
    url.searchParams.set('localizacaoId', adminContext.localizacaoId)
    url.searchParams.set('retornoId', adminContext.retornoId)
    url.searchParams.set('emitidoEmUtc', adminContext.emitidoEmUtc)
  }
  return url.href
}

export function createCanvasReturnAction(buildLink, navigate, { isUsed = () => false, markUsed = () => {} } = {}) {
  let used = false
  return (...args) => {
    if (used || isUsed()) return false
    const link = buildLink(...args)
    if (!link) return false
    used = true
    markUsed()
    navigate(link)
    return true
  }
}
