import { useCallback, useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Photo } from './db/schema'
import { getCurrentPosition, type LatLng } from './lib/geo'

export function usePlaces() {
  return useLiveQuery(() => db.places.toArray(), [], undefined)
}

export function useLists() {
  return useLiveQuery(() => db.lists.orderBy('updatedAt').reverse().toArray(), [], undefined)
}

export function useKnownTags(): string[] {
  return useLiveQuery(async () => (await db.tags.toArray()).map((t) => t.name), [], []) ?? []
}

export function useSetting(key: string): string | undefined {
  return useLiveQuery(async () => (await db.settings.get(key))?.value, [key], undefined)
}

export function usePhotos(placeId: string | undefined): Photo[] {
  return useLiveQuery(() => (placeId ? db.photos.where('placeId').equals(placeId).toArray() : []), [placeId], []) ?? []
}

/** First photo per place, keyed by place id, for list thumbnails. */
export function useCoverPhotos(): Map<string, Photo> {
  return (
    useLiveQuery(async () => {
      const all = await db.photos.orderBy('placeId').toArray()
      const map = new Map<string, Photo>()
      for (const p of all) if (!map.has(p.placeId)) map.set(p.placeId, p)
      return map
    }, []) ?? new Map()
  )
}

/** Object URLs for blobs, revoked when they go away. */
export function useObjectUrls(blobs: Blob[]): string[] {
  const [urls, setUrls] = useState<string[]>([])
  const key = blobs.map((b) => (b as Blob & { __id?: string }).__id ?? `${b.size}-${b.type}`).join('|')
  useEffect(() => {
    const next = blobs.map((b) => URL.createObjectURL(b))
    setUrls(next)
    return () => next.forEach((u) => URL.revokeObjectURL(u))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return urls
}

export function useObjectUrl(blob: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!blob) {
      setUrl(undefined)
      return
    }
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}

export function useUserLocation() {
  const [location, setLocation] = useState<LatLng | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const requested = useRef(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const pos = await getCurrentPosition()
      setLocation(pos)
      return pos
    } catch (e) {
      setError((e as Error).message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (requested.current) return
    requested.current = true
    void refresh()
  }, [refresh])

  return { location, error, loading, refresh }
}

export function useToast() {
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const show = useCallback((msg: string) => {
    setMessage(msg)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMessage(null), 2200)
  }, [])
  return { message, show }
}
