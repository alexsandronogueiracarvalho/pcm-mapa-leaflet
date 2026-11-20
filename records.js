// Contract for a future authenticated reader: findByCodigoSAP(code) resolves
// to { codigoSAP, descricao, latitude, longitude } or null.
export const demoRecords = {
  async findByCodigoSAP() {
    return null
  },
}

export function parseCodigoSAP(value) {
  const code = value?.trim()
  return code && !/[\x00-\x1f\x7f]/.test(code)
    && code.split('-').every(level => level && level === level.trim()) ? code : null
}

export function parseDecimal(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function parseCoordinates(lat, lon) {
  const latitude = parseDecimal(lat)
  const longitude = parseDecimal(lon)
  if (latitude === null || longitude === null || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null
  return { latitude, longitude }
}

export async function resolveLocation(reader, codigoSAP) {
  if (!codigoSAP) return { record: null, reference: null }

  const levels = codigoSAP.split('-')
  let record = null
  while (levels.length) {
    const code = levels.join('-')
    const candidate = await reader.findByCodigoSAP(code)
    if (code === codigoSAP) record = candidate
    const coordinates = parseCoordinates(candidate?.latitude, candidate?.longitude)
    if (coordinates) {
      return {
        record,
        reference: {
          ...coordinates,
          origemCoordenada: code === codigoSAP ? 'propria' : 'herdada',
          codigoLocalReferencia: code,
        },
      }
    }
    levels.pop()
  }
  return { record, reference: null }
}
