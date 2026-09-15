# Been There

A quick, phone-first app for keeping track of places you've been and places you want to go.
Log a restaurant in the ten seconds after the check arrives: pick it from what's around you,
tap a star rating, jot what to order (and what to skip), add a photo, done. Later, filter your
map by city, rating, cost, or your own tags, and send a friend a rec or a whole city list as a
single link that carries your notes with it.

## What it does

- **Map view and list view** of everything you've saved, switchable from the top bar.
- **Quick add**: tap **+**, see what's within a short walk of you, or search by name. Pick a
  place, choose *Been there* or *Want to go*, rate it, set a cost (`$` to `$$$$`), add
  "order this" / "skip this" tips, notes, tags, and photos.
- **Filters**: been / want, minimum rating, cost, distance from you, city, custom tags, and
  place type. Sort by recent, top rated, nearest, or A–Z. Free-text search covers names,
  notes, tips, and tags.
- **Lists**: group places into lists like "Lisbon weekend" or "Best coffee in Brooklyn".
- **Sharing**: share one place or a whole list. The link contains the places and your notes,
  so the recipient opens it in the app and saves everything with one tap (as *Want to go* by
  default). There's also a plain-text version for pasting into a message.
- **Backup**: export everything, photos included, to a single JSON file and import it on a new
  phone.
- **Installable**: it's a PWA. On iOS use Share → *Add to Home Screen*; on Android accept the
  install prompt. Works offline for everything except place search and fresh map tiles.

## Storage and privacy

All data lives in the browser's IndexedDB on the device. There is no account and no server.
Sharing a rec puts the place data inside the link itself. If you clear the browser's site
data you lose everything, so use **Settings → Export backup** now and then.

## Place search

By default search uses OpenStreetMap (Nominatim for text search, Overpass for "what's around
me"). Both are free, need no key, and are fine for personal use.

To use Google Places instead, create a key with the *Places API (New)* enabled, restrict it to
your site's HTTP referrers, and set it at build time:

```
VITE_GOOGLE_MAPS_API_KEY=your-key npm run build
```

Map tiles are always OpenStreetMap.

## Development

```
npm install
npm run dev        # http://localhost:5173, also reachable from your phone on the same Wi-Fi
npm test           # unit tests for filters, sharing, and the data layer
npm run build      # production build in dist/
npm run preview    # serve the production build
```

Location and the camera require a secure context. `localhost` counts; if you test on a phone
over the LAN, use HTTPS (for example `npx vite --host` behind a tunnel like ngrok).

## Deploying

`dist/` is a static site. Any static host works (Netlify, Vercel, Cloudflare Pages, GitHub
Pages). It must be served over HTTPS for location, camera, and installation to work. Share
links point at whatever origin the app is served from.

## Project layout

```
src/
  db/schema.ts        Dexie (IndexedDB) tables and the Place / List / Photo types
  db/repo.ts          save/delete helpers, tag normalization, list membership
  lib/filters.ts      pure filter + sort logic (tested)
  lib/search.ts       OpenStreetMap and Google Places providers
  lib/share.ts        share-link encoding and plain-text formatting (tested)
  lib/backup.ts       export / import
  lib/geo.ts          distance, formatting, geolocation
  lib/photos.ts       client-side photo resizing
  components/         bottom sheets, form, detail, filters, share, pickers
  views/              MapView, ListView, ListsView, SettingsView, ImportView
  App.tsx             tabs, modals, filter state, share-link handling
```
