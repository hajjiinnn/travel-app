import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/schema'
import { createList, deletePlace, savePlace, togglePlaceInList } from '../db/repo'

beforeEach(async () => {
  await Promise.all([db.places.clear(), db.lists.clear(), db.tags.clear(), db.photos.clear()])
})

describe('savePlace', () => {
  it('normalizes tags and remembers them for later suggestions', async () => {
    const p = await savePlace({ name: 'A', lat: 0, lng: 0, status: 'been', category: 'cafe', tags: [' #Coffee ', 'coffee', 'Cozy'] })
    expect(p.tags).toEqual(['coffee', 'cozy'])
    expect((await db.tags.toArray()).map((t) => t.name).sort()).toEqual(['coffee', 'cozy'])
  })

  it('drops the rating when a place becomes a want-to-go', async () => {
    const p = await savePlace({ name: 'A', lat: 0, lng: 0, status: 'been', category: 'cafe', rating: 4 })
    const updated = await savePlace({ ...p, status: 'want' })
    expect(updated.rating).toBeUndefined()
    expect(updated.createdAt).toBe(p.createdAt)
  })
})

describe('lists', () => {
  it('toggles membership and cleans up when a place is deleted', async () => {
    const p = await savePlace({ name: 'A', lat: 0, lng: 0, status: 'want', category: 'bar' })
    const list = await createList('Weekend')
    expect(await togglePlaceInList(list.id, p.id)).toBe(true)
    expect((await db.lists.get(list.id))!.placeIds).toEqual([p.id])
    await deletePlace(p.id)
    expect((await db.lists.get(list.id))!.placeIds).toEqual([])
  })
})
