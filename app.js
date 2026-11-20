import { demoRecords, parseCodigoSAP, parseCoordinates, parseDecimal, resolveLocation } from './records.js'
import { buildCanvasReturnLink, parseCanvasWebLink } from './power-apps-link.js'

const defaultCenter = [0, 0]
const initialZoom = 2
const minZoom = 2
const maxZoom = 21
const imageryItem = 'https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9'
const imageryService = 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'

const codigo = document.querySelector('#codigo-sap')
const descricao = document.querySelector('#descricao')
const mapStatus = document.querySelector('#map-status')
const parameters = new URLSearchParams(location.search)
const canvasWebLink = parseCanvasWebLink(parameters.get('canvasUrl'))
const requestedCode = parseCodigoSAP(parameters.get('codigoSAP'))
const requestedCoordinates = parseCoordinates(parameters.get('lat'), parameters.get('lon'))
const zoom = parseDecimal(parameters.get('zoom'))
const requestedZoom = Number.isInteger(zoom) && zoom >= minZoom && zoom <= maxZoom ? zoom : initialZoom
codigo.value = requestedCode ?? ''

function showMapStatus(message) {
  mapStatus.textContent = message
  mapStatus.hidden = !message
}

if (globalThis.L) {
  initMap(globalThis.L)
} else {
  showMapStatus('O Leaflet não carregou. Verifique o acesso ao CDN e recarregue a página.')
}

function initMap(leaflet) {
  const map = leaflet.map('map', { maxBounds: [[-85, -180], [85, 180]], minZoom, maxZoom })
  const imagery = leaflet.tileLayer(`${imageryService}/tile/{z}/{y}/{x}`, {
    minZoom,
    maxNativeZoom: 19,
    maxZoom,
    noWrap: true,
    attribution: `<a href="${imageryItem}">Esri World Imagery</a> · Esri, Vantor, Earthstar Geographics e comunidade GIS`,
  })
  let tileFailed = false
  imagery.on('loading', () => { tileFailed = false })
  imagery.on('tileerror', () => {
    tileFailed = true
    showMapStatus('Algumas imagens do satélite não carregaram. A captura de coordenadas continua disponível.')
  })
  imagery.on('load', () => {
    if (!tileFailed) showMapStatus('')
  })
  imagery.addTo(map)

  const latitude = document.querySelector('#latitude')
  const longitude = document.querySelector('#longitude')
  const clear = document.querySelector('#clear-point')
  const captureCenter = document.querySelector('#capture-center')
  const resetView = document.querySelector('#reset-view')
  const captureStatus = document.querySelector('#capture-status')
  const referenceStatus = document.querySelector('#reference-status')
  const pointOrigin = document.querySelector('#point-origin')
  const copy = document.querySelector('#copy-coordinates')
  const json = document.querySelector('#selection-json')
  const confirm = document.querySelector('#confirm-location')
  const returnStatus = document.querySelector('#return-status')
  const initialPoint = requestedCoordinates && {
    ...requestedCoordinates, origemCoordenada: 'url', codigoLocalReferencia: null,
  }
  let selectedCode
  let reference
  let selection
  let referenceMarker
  let selectionMarker
  let lookupVersion = 0

  function canvasReturnLink() {
    return buildCanvasReturnLink(canvasWebLink, parseCodigoSAP(codigo.value), selection, map.getZoom())
  }

  function drawMarker(marker, point, options) {
    marker?.remove()
    if (!point) return undefined
    return leaflet.circleMarker([point.latitude, point.longitude], {
      ...options, interactive: false,
    }).addTo(map)
  }

  function renderOutput() {
    const point = selection ?? reference
    const origin = point?.origemCoordenada ?? 'pendente'
    latitude.value = point ? point.latitude.toFixed(6) : ''
    longitude.value = point ? point.longitude.toFixed(6) : ''
    copy.disabled = !point
    clear.disabled = !selection
    confirm.disabled = !canvasReturnLink()
    returnStatus.textContent = !canvasWebLink
      ? 'Informe o Link da Web do Canvas de teste no parâmetro canvasUrl.'
      : confirm.disabled ? 'Selecione um novo ponto para confirmar.' : 'A confirmação abre o Canvas de teste nesta aba.'
    pointOrigin.hidden = !selection
    pointOrigin.dataset.origin = origin
    pointOrigin.textContent = selection?.origemCoordenada === 'url'
      ? 'Ponto informado na URL, sem confirmação cadastral.'
      : 'Novo ponto selecionado no mapa.'
    json.textContent = JSON.stringify({
      codigoSAP: selectedCode,
      latitude: point?.latitude ?? null,
      longitude: point?.longitude ?? null,
      origemCoordenada: origin,
      codigoLocalReferencia: point?.codigoLocalReferencia ?? null,
      zoom: map.getZoom(),
    }, null, 2)
  }

  function renderPoints() {
    referenceMarker = drawMarker(referenceMarker, reference, {
      radius: 13, color: '#fbbf24', weight: 3, fill: false, className: 'reference-marker',
    })
    selectionMarker = drawMarker(selectionMarker, selection, {
      radius: 7, color: '#ffffff', weight: 2, fillOpacity: 1, className: 'selection-marker',
      fillColor: selection?.origemCoordenada === 'url' ? '#c4b5fd' : '#22d3ee',
    })
    referenceStatus.dataset.origin = reference?.origemCoordenada ?? 'pendente'
    referenceStatus.textContent = selectedCode ? 'Referência SAP pendente.' : 'Sem localização SAP selecionada.'
    if (reference) {
      const label = reference.origemCoordenada === 'propria' ? 'própria' : 'herdada de'
      referenceStatus.textContent = `Referência SAP ${label} ${reference.codigoLocalReferencia} (${reference.latitude.toFixed(6)}, ${reference.longitude.toFixed(6)}).`
    }
    renderOutput()
  }

  async function loadLocation(recenter = false) {
    const code = parseCodigoSAP(codigo.value)
    const version = ++lookupVersion
    if (selectedCode !== code && selection?.origemCoordenada === 'url') selection = null
    selectedCode = code
    reference = null
    renderPoints()
    try {
      const resolved = await resolveLocation(demoRecords, code)
      if (version !== lookupVersion || code !== parseCodigoSAP(codigo.value)) return
      reference = resolved.reference
      if (!descricao.value && resolved.record?.descricao) descricao.value = resolved.record.descricao
      if (reference && !selection) {
        map.setView([reference.latitude, reference.longitude], recenter ? requestedZoom : map.getZoom())
      }
      renderPoints()
    } catch {
      if (version === lookupVersion) referenceStatus.textContent = 'Referência SAP indisponível para consulta.'
    }
  }

  function capture(position) {
    const point = position.wrap()
    selection = { latitude: point.lat, longitude: point.lng, origemCoordenada: 'manual', codigoLocalReferencia: null }
    renderPoints()
    captureStatus.textContent = `Latitude ${latitude.value}, longitude ${longitude.value}.`
  }

  selectedCode = requestedCode
  selection = initialPoint
  const center = initialPoint ? [initialPoint.latitude, initialPoint.longitude] : defaultCenter
  map.setView(center, requestedZoom)
  renderPoints()
  void loadLocation(true)
  codigo.addEventListener('change', () => { void loadLocation() })
  map.on('zoomend', renderOutput)
  map.on('click', ({ latlng }) => capture(latlng))
  captureCenter.addEventListener('click', () => capture(map.getCenter()))
  confirm.addEventListener('click', () => {
    const link = canvasReturnLink()
    if (link) location.assign(link)
  })
  resetView.addEventListener('click', () => map.setView(defaultCenter, initialZoom))
  clear.addEventListener('click', () => {
    selection = null
    renderPoints()
    captureStatus.textContent = 'Ponto removido.'
    captureCenter.focus()
  })
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(`${latitude.value}, ${longitude.value}`)
      captureStatus.textContent = 'Coordenadas copiadas.'
    } catch {
      latitude.focus()
      latitude.select()
      captureStatus.textContent = 'Cópia automática indisponível. Selecione e copie os campos de coordenadas.'
    }
  })
  captureCenter.disabled = false
  resetView.disabled = false
}
