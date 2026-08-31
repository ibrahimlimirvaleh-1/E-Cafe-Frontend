type RestaurantMapTarget = {
  address: string
  latitude?: number | null
  longitude?: number | null
  name: string
}

const mapEmbedBaseUrl = import.meta.env.VITE_MAP_EMBED_BASE_URL
const coordinateZoom = readZoomLevel(import.meta.env.VITE_MAP_EMBED_COORDINATE_ZOOM, 17)
const addressZoom = readZoomLevel(import.meta.env.VITE_MAP_EMBED_ADDRESS_ZOOM, 15)

export function createRestaurantMapEmbedUrl(target: RestaurantMapTarget) {
  const baseUrl = readMapEmbedBaseUrl()
  const hasCoordinates = target.latitude != null && target.longitude != null
  const query = hasCoordinates ? `${target.latitude},${target.longitude}` : `${target.address} ${target.name}`
  const url = new URL(baseUrl)

  url.searchParams.set('q', query)
  url.searchParams.set('z', String(hasCoordinates ? coordinateZoom : addressZoom))
  url.searchParams.set('output', 'embed')

  return url.toString()
}

function readMapEmbedBaseUrl() {
  if (typeof mapEmbedBaseUrl === 'string' && mapEmbedBaseUrl.trim()) {
    return mapEmbedBaseUrl.trim()
  }

  return 'https://maps.google.com/maps'
}

function readZoomLevel(value: unknown, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(Math.max(Math.round(parsed), 1), 21)
}
