import {
  Beer,
  Bed,
  Cake,
  Coffee,
  Croissant,
  Landmark,
  MapPin,
  Palette,
  ShoppingBag,
  Ticket,
  Trees,
  Utensils,
} from 'lucide-react'
import type { Category } from '../db/schema'

const ICONS: Record<Category, typeof MapPin> = {
  restaurant: Utensils,
  cafe: Coffee,
  bar: Beer,
  bakery: Croissant,
  dessert: Cake,
  shop: ShoppingBag,
  sight: Landmark,
  park: Trees,
  museum: Palette,
  hotel: Bed,
  activity: Ticket,
  other: MapPin,
}

export function CategoryIcon({ category, size = 18 }: { category: Category; size?: number }) {
  const Icon = ICONS[category] ?? MapPin
  return <Icon size={size} />
}
