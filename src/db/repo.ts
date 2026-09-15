import { db, newId, nowIso, type Place, type PlaceList, type Photo } from './schema'

export type PlaceInput = Omit<Place, 'id' | 'createdAt' | 'updatedAt' | 'visits' | 'tags'> & {
  id?: string
  tags?: string[]
  visits?: string[]
}

function normalizeTags(tags: string[] | undefined): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of tags ?? []) {
    const t = raw.trim().replace(/^#/, '').toLowerCase()
    if (t && !seen.has(t)) {
      seen.add(t)
      out.push(t)
    }
  }
  return out
}

async function rememberTags(tags: string[]) {
  if (!tags.length) return
  const createdAt = nowIso()
  await db.tags.bulkPut(tags.map((name) => ({ name, createdAt })))
}

export async function savePlace(input: PlaceInput): Promise<Place> {
  const tags = normalizeTags(input.tags)
  const now = nowIso()
  const existing = input.id ? await db.places.get(input.id) : undefined
  const place: Place = {
    ...existing,
    ...input,
    id: input.id ?? newId(),
    tags,
    visits: input.visits ?? existing?.visits ?? [],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
  if (place.status === 'want') {
    delete place.rating
  }
  await db.places.put(place)
  await rememberTags(tags)
  return place
}

export async function deletePlace(id: string): Promise<void> {
  await db.transaction('rw', db.places, db.photos, db.lists, async () => {
    await db.places.delete(id)
    await db.photos.where('placeId').equals(id).delete()
    const lists = await db.lists.filter((l) => l.placeIds.includes(id)).toArray()
    for (const list of lists) {
      await db.lists.update(list.id, {
        placeIds: list.placeIds.filter((p) => p !== id),
        updatedAt: nowIso(),
      })
    }
  })
}

export async function addPhoto(placeId: string, blob: Blob, width: number, height: number): Promise<Photo> {
  const photo: Photo = { id: newId(), placeId, blob, width, height, createdAt: nowIso() }
  await db.photos.add(photo)
  return photo
}

export async function deletePhoto(id: string): Promise<void> {
  await db.photos.delete(id)
}

export async function createList(name: string, description?: string, placeIds: string[] = []): Promise<PlaceList> {
  const now = nowIso()
  const list: PlaceList = { id: newId(), name: name.trim(), description, placeIds, createdAt: now, updatedAt: now }
  await db.lists.add(list)
  return list
}

export async function updateList(id: string, patch: Partial<Omit<PlaceList, 'id' | 'createdAt'>>): Promise<void> {
  await db.lists.update(id, { ...patch, updatedAt: nowIso() })
}

export async function deleteList(id: string): Promise<void> {
  await db.lists.delete(id)
}

export async function togglePlaceInList(listId: string, placeId: string): Promise<boolean> {
  const list = await db.lists.get(listId)
  if (!list) return false
  const has = list.placeIds.includes(placeId)
  await updateList(listId, {
    placeIds: has ? list.placeIds.filter((p) => p !== placeId) : [...list.placeIds, placeId],
  })
  return !has
}

export async function getSetting(key: string): Promise<string | undefined> {
  return (await db.settings.get(key))?.value
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.settings.put({ key, value })
}

export async function clearAllData(): Promise<void> {
  await db.transaction('rw', db.places, db.photos, db.lists, db.tags, db.settings, async () => {
    await Promise.all([db.places.clear(), db.photos.clear(), db.lists.clear(), db.tags.clear(), db.settings.clear()])
  })
}
