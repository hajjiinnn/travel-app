import { db, newId, nowIso, type Place, type PlaceList } from '../db/schema'
import { blobToDataUrl, dataUrlToBlob } from './photos'

export interface Backup {
  app: 'travel-app'
  version: 1
  exportedAt: string
  places: Place[]
  lists: PlaceList[]
  tags: string[]
  photos: { id: string; placeId: string; width: number; height: number; createdAt: string; dataUrl: string }[]
}

export async function exportBackup(includePhotos = true): Promise<Backup> {
  const [places, lists, tags, photos] = await Promise.all([
    db.places.toArray(),
    db.lists.toArray(),
    db.tags.toArray(),
    includePhotos ? db.photos.toArray() : Promise.resolve([]),
  ])
  return {
    app: 'travel-app',
    version: 1,
    exportedAt: nowIso(),
    places,
    lists,
    tags: tags.map((t) => t.name),
    photos: await Promise.all(
      photos.map(async (p) => ({
        id: p.id,
        placeId: p.placeId,
        width: p.width,
        height: p.height,
        createdAt: p.createdAt,
        dataUrl: await blobToDataUrl(p.blob),
      })),
    ),
  }
}

export function isBackup(data: unknown): data is Backup {
  const d = data as Backup
  return !!d && d.app === 'travel-app' && d.version === 1 && Array.isArray(d.places)
}

/** Merge a backup into the current database. Existing records with the same id are replaced. */
export async function importBackup(backup: Backup): Promise<{ places: number; lists: number; photos: number }> {
  const photos = await Promise.all(
    (backup.photos ?? []).map(async (p) => ({
      id: p.id ?? newId(),
      placeId: p.placeId,
      width: p.width,
      height: p.height,
      createdAt: p.createdAt,
      blob: await dataUrlToBlob(p.dataUrl),
    })),
  )
  await db.transaction('rw', db.places, db.lists, db.tags, db.photos, async () => {
    await db.places.bulkPut(backup.places)
    await db.lists.bulkPut(backup.lists ?? [])
    await db.tags.bulkPut((backup.tags ?? []).map((name) => ({ name, createdAt: nowIso() })))
    await db.photos.bulkPut(photos)
  })
  return { places: backup.places.length, lists: (backup.lists ?? []).length, photos: photos.length }
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
