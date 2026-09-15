import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import type { Category, Cost, Place } from '../db/schema'
import { costLabel } from '../db/schema'

/** Compact place shape that travels inside a share link. Photos are never included. */
export interface SharedPlace {
  n: string // name
  a?: string // address
  c?: string // city
  k?: string // country
  la: number
  ln: number
  g: Category
  r?: number // rating
  $?: Cost
  t?: string[] // tags
  o?: string // notes
  y?: string // order tips
  x?: string // avoid tips
  s?: { p: 'google' | 'osm' | 'manual'; i?: string }
}

export interface SharePayload {
  v: 1
  kind: 'rec' | 'list'
  title?: string
  from?: string
  places: SharedPlace[]
}

export function toSharedPlace(p: Place): SharedPlace {
  const s: SharedPlace = { n: p.name, la: round(p.lat), ln: round(p.lng), g: p.category }
  if (p.address) s.a = p.address
  if (p.city) s.c = p.city
  if (p.country) s.k = p.country
  if (p.status === 'been' && p.rating) s.r = p.rating
  if (p.cost) s.$ = p.cost
  if (p.tags.length) s.t = p.tags
  if (p.notes) s.o = p.notes
  if (p.orderTips) s.y = p.orderTips
  if (p.avoidTips) s.x = p.avoidTips
  if (p.source && p.source.provider !== 'manual') s.s = { p: p.source.provider, i: p.source.id }
  return s
}

function round(n: number): number {
  return Math.round(n * 1e6) / 1e6
}

export function buildPayload(
  places: Place[],
  opts: { kind: 'rec' | 'list'; title?: string; from?: string },
): SharePayload {
  return { v: 1, kind: opts.kind, title: opts.title, from: opts.from, places: places.map(toSharedPlace) }
}

export function encodePayload(payload: SharePayload): string {
  return compressToEncodedURIComponent(JSON.stringify(payload))
}

export function decodePayload(encoded: string): SharePayload | null {
  try {
    const json = decompressFromEncodedURIComponent(encoded)
    if (!json) return null
    const data = JSON.parse(json) as SharePayload
    if (data?.v !== 1 || !Array.isArray(data.places)) return null
    return data
  } catch {
    return null
  }
}

export function buildShareUrl(payload: SharePayload, origin = window.location.origin): string {
  return `${origin}${import.meta.env.BASE_URL}#s=${encodePayload(payload)}`
}

export function readShareFromLocation(hash = window.location.hash): SharePayload | null {
  const m = /^#s=(.+)$/.exec(hash)
  return m ? decodePayload(m[1]) : null
}

/** Plain-text version for pasting into a message when a link is not wanted. */
export function formatPlaceText(p: Place): string {
  const lines: string[] = []
  const header = [p.name, p.status === 'been' && p.rating ? `${'★'.repeat(p.rating)}` : '', costLabel(p.cost)]
    .filter(Boolean)
    .join(' · ')
  lines.push(header)
  if (p.address || p.city) lines.push(p.address ?? p.city!)
  if (p.orderTips) lines.push(`Order: ${p.orderTips}`)
  if (p.avoidTips) lines.push(`Skip: ${p.avoidTips}`)
  if (p.notes) lines.push(p.notes)
  if (p.tags.length) lines.push(p.tags.map((t) => `#${t}`).join(' '))
  lines.push(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name} ${p.address ?? ''}`.trim())}`)
  return lines.join('\n')
}

export function formatListText(title: string, places: Place[]): string {
  return [title, '', ...places.map(formatPlaceText).map((t) => t.split('\n').join('\n  '))].join('\n\n')
}
