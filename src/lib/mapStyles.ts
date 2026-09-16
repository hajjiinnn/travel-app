/**
 * Basemap choices.
 *
 * Hard-won rule: only use tile servers that need no API key. A provider that
 * starts requiring one does not fail loudly, it serves a normal image with
 * "API key required" printed on it, so no error handler ever fires. The default
 * below therefore uses OpenStreetMap's own tiles, which need no key, and mutes
 * them with a CSS filter rather than depending on someone else's muted style.
 */
export interface MapStyle {
  id: string
  label: string
  description: string
  url: string
  subdomains: string
  attribution: string
  maxZoom: number
  /** CSS filter applied to the tile layer so we can mute tiles ourselves. */
  filter?: string
}

const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

export const MAP_STYLES: MapStyle[] = [
  {
    id: 'muted',
    label: 'Muted',
    description: 'OpenStreetMap, desaturated so your places stand out. Needs no account.',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: 'abc',
    attribution: OSM_ATTRIBUTION,
    maxZoom: 19,
    filter: 'saturate(0.32) brightness(1.07) contrast(0.92)',
  },
  {
    id: 'soft',
    label: 'Softer still',
    description: 'The same map pushed closer to grey. Quietest option, labels still readable.',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: 'abc',
    attribution: OSM_ATTRIBUTION,
    maxZoom: 19,
    filter: 'saturate(0.12) brightness(1.12) contrast(0.88)',
  },
  {
    id: 'detailed',
    label: 'Detailed',
    description: 'Full-colour OpenStreetMap. Busiest, but easiest for finding an exact street.',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: 'abc',
    attribution: OSM_ATTRIBUTION,
    maxZoom: 19,
  },
  {
    id: 'greycanvas',
    label: 'Grey canvas',
    description: 'Esri’s pale grey basemap with very few labels. If it ever shows blank tiles, pick another.',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    subdomains: '',
    attribution: 'Tiles &copy; Esri',
    maxZoom: 16,
  },
]

export const DEFAULT_MAP_STYLE = MAP_STYLES[0]
export const MAP_STYLE_SETTING = 'mapStyle'

export function findMapStyle(id: string | undefined): MapStyle {
  return MAP_STYLES.find((s) => s.id === id) ?? DEFAULT_MAP_STYLE
}
