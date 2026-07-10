# Prompt 11 — Offline-First PWA & Sync Queue

**Phase:** 07 — Offline PWA  
**Depends on:** Prompt 10 complete — dashboard and exports working

---

## Context

Dashboard and exports are complete. Now implement the offline-first PWA capability.

Field technicians in Uganda work in areas where 4G is unavailable, 3G is intermittent, and 2G or no signal is common. **The app must work fully offline and sync automatically when signal returns.** This is a non-negotiable core requirement.

---

## Install Dependencies

```bash
npm install dexie dexie-react-hooks vite-plugin-pwa workbox-window browser-image-compression
```

---

## Task

### 1. PWA Setup (`vite.config.ts`)

Configure `vite-plugin-pwa`:

```typescript
VitePWA({
  registerType: 'autoUpdate',
  manifest: {
    name: 'kVAssetTracker',
    short_name: 'kVAsset',
    description: 'UEDCL Transformer Asset Management',
    theme_color: '#0F2544',
    background_color: '#F8FAFC',
    display: 'standalone',
    orientation: 'portrait',
    start_url: '/',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ]
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/api\.mapbox\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'mapbox-tiles',
          expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 }
        }
      },
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
        handler: 'NetworkFirst',
        options: { cacheName: 'supabase-api', networkTimeoutSeconds: 5 }
      }
    ]
  }
})
```

Create app icons: a simple lightning bolt (⚡) in white on a teal circle background, at 192×192 and 512×512 pixels.

---

### 2. IndexedDB Schema (`src/lib/db.ts`)

Create a Dexie database: `KVAssetDB` version 1:

```typescript
import Dexie, { type EntityTable } from 'dexie'

interface CachedTransformer {
  id: string
  asset_id: string
  site_name: string | null
  kva_rating: number | null
  network_voltage_kv: 11 | 33 | null
  operational_status: string
  latitude: number | null
  longitude: number | null
  territory_id: string | null
  service_area_id: string | null
  has_open_fault: boolean
  last_inspection_date: string | null
  synced_at: string
}

interface OfflineQueueItem {
  id?: number          // auto-increment
  action_type: string  // 'create_inspection' | 'create_maintenance' | 'create_fault' | 'create_installation' | 'update_transformer' | 'create_transformer'
  table_name: string
  payload: string      // JSON stringified
  transformer_id: string
  created_at: string
  sync_status: 'pending' | 'syncing' | 'synced' | 'error'
  retry_count: number
  error_message: string | null
}

interface OfflinePhoto {
  id?: number
  queue_item_id: number
  category: string
  blob: ArrayBuffer
  file_name: string
  mime_type: string
  synced_at: string | null
}

interface ReferenceCache {
  id?: number
  table_name: string
  data: string         // JSON stringified
  cached_at: string
}

const db = new Dexie('KVAssetDB') as Dexie & {
  transformers_cache: EntityTable<CachedTransformer, 'id'>
  offline_queue: EntityTable<OfflineQueueItem, 'id'>
  offline_photos: EntityTable<OfflinePhoto, 'id'>
  reference_cache: EntityTable<ReferenceCache, 'id'>
}

db.version(1).stores({
  transformers_cache: 'id, asset_id, territory_id, service_area_id, operational_status, network_voltage_kv',
  offline_queue:      '++id, sync_status, transformer_id, action_type, created_at',
  offline_photos:     '++id, queue_item_id',
  reference_cache:    '++id, table_name',
})

export { db }
export type { CachedTransformer, OfflineQueueItem, OfflinePhoto }
```

---

### 3. Cache Population on Login (`src/hooks/useOfflineCache.ts`)

When a user logs in, trigger this background sync:

```typescript
async function populateOfflineCache(user: User) {
  // 1. Fetch all transformers for user's service area (or all if manager)
  const { data: transformers } = await supabase
    .from('transformers')
    .select('id, asset_id, site_name, kva_rating, network_voltage_kv, operational_status, latitude, longitude, territory_id, service_area_id, has_open_fault, last_inspection_date')
    .eq(user.role === 'field_technician' ? 'service_area_id' : 'territory_id',
        user.role === 'field_technician' ? user.service_area_id : user.territory_id)

  if (transformers) {
    await db.transformers_cache.bulkPut(
      transformers.map(t => ({ ...t, synced_at: new Date().toISOString() }))
    )
  }

  // 2. Cache reference data
  const tables = ['service_territories', 'service_areas', 'feeders', 'districts', 'transformer_ratings']
  for (const table of tables) {
    const { data } = await supabase.from(table).select('*')
    if (data) {
      await db.reference_cache.put({
        table_name: table,
        data: JSON.stringify(data),
        cached_at: new Date().toISOString(),
      })
    }
  }
}
```

Show progress during cache population:
```
Syncing offline data...
✓ 1,247 transformers cached
✓ Reference data cached
Ready for offline use
```

---

### 4. Online Status Hook (`src/hooks/useOnlineStatus.ts`)

```typescript
function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline  = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { isOnline, isOffline: !isOnline }
}
```

Show a persistent banner when offline:
```
┌────────────────────────────────────────────────┐
│ ⚠  You are offline                             │
│    Changes will sync automatically when        │
│    your connection is restored.                │
│    [3 records queued]                          │
└────────────────────────────────────────────────┘
```

Amber background, dark text. Do **not** block the user from using the app.

---

### 5. Form Submission with Offline Queue

Modify all field activity forms to use this submit pattern:

```typescript
async function submitForm(actionType: string, tableName: string, formData: object) {
  if (isOnline) {
    try {
      const { error } = await supabase.from(tableName).insert(formData)
      if (error) throw error
      // Success — update local cache if needed
    } catch (err) {
      // Network failed despite being "online" — queue it
      await queueOfflineAction(actionType, tableName, formData)
    }
  } else {
    await queueOfflineAction(actionType, tableName, formData)
  }
}

async function queueOfflineAction(
  actionType: string,
  tableName: string,
  payload: object,
  photos?: File[]
): Promise<number> {
  const itemId = await db.offline_queue.add({
    action_type: actionType,
    table_name: tableName,
    payload: JSON.stringify(payload),
    transformer_id: (payload as any).transformer_id,
    created_at: new Date().toISOString(),
    sync_status: 'pending',
    retry_count: 0,
    error_message: null,
  })

  // Store photos as ArrayBuffer blobs
  if (photos && photos.length > 0) {
    for (const photo of photos.slice(0, 5)) {  // max 5 photos offline
      const compressed = await compressImage(photo)
      const buffer = await compressed.arrayBuffer()
      await db.offline_photos.add({
        queue_item_id: itemId as number,
        category: (photo as any).category || 'inspection',
        blob: buffer,
        file_name: photo.name,
        mime_type: photo.type,
        synced_at: null,
      })
    }
  }

  return itemId as number
}
```

---

### 6. Sync Engine (`src/lib/sync.ts`)

```typescript
async function syncOfflineQueue(): Promise<void> {
  const pending = await db.offline_queue
    .where('sync_status').equals('pending')
    .toArray()

  if (pending.length === 0) return

  let syncedCount = 0
  let errorCount = 0

  for (const item of pending) {
    try {
      await db.offline_queue.update(item.id!, { sync_status: 'syncing' })
      const payload = JSON.parse(item.payload)

      // Upload photos first
      const photos = await db.offline_photos
        .where('queue_item_id').equals(item.id!)
        .toArray()

      for (const photo of photos) {
        if (photo.synced_at) continue
        const file = new File([photo.blob], photo.file_name, { type: photo.mime_type })
        const path = `${item.transformer_id}/${Date.now()}_${photo.file_name}`
        const { data } = await supabase.storage
          .from('asset-photos')
          .upload(path, file)

        if (data) {
          const url = supabase.storage.from('asset-photos').getPublicUrl(path).data.publicUrl
          payload.photo_urls = [...(payload.photo_urls || []), url]
          await db.offline_photos.update(photo.id!, { synced_at: new Date().toISOString() })
        }
      }

      // Insert the record
      const { error } = await supabase.from(item.table_name).insert(payload)
      if (error) throw error

      await db.offline_queue.update(item.id!, { sync_status: 'synced' })
      syncedCount++

    } catch (error: any) {
      await db.offline_queue.update(item.id!, {
        sync_status: item.retry_count >= 3 ? 'error' : 'pending',
        retry_count: (item.retry_count || 0) + 1,
        error_message: error.message,
      })
      errorCount++
    }
  }

  if (syncedCount > 0) {
    showToast(`${syncedCount} record${syncedCount > 1 ? 's' : ''} synced successfully`)
  }
  if (errorCount > 0) {
    showToast(`${errorCount} record${errorCount > 1 ? 's' : ''} failed to sync — tap to retry`, 'error')
  }
}

// Trigger sync on reconnection
window.addEventListener('online', () => {
  syncOfflineQueue()
})

// Also attempt sync every 30 seconds while online
setInterval(() => {
  if (navigator.onLine) syncOfflineQueue()
}, 30_000)
```

---

### 7. Offline Transformer Search

Modify transformer search to work offline:

```typescript
async function searchTransformers(query: string) {
  if (navigator.onLine) {
    // Query Supabase as normal
    return supabase.from('transformers').select(...).ilike('site_name', `%${query}%`)
  } else {
    // Query IndexedDB cache
    const results = await db.transformers_cache
      .filter(t =>
        t.asset_id?.toLowerCase().includes(query.toLowerCase()) ||
        t.site_name?.toLowerCase().includes(query.toLowerCase())
      )
      .toArray()
    return { data: results, offline: true }
  }
}
```

When showing offline search results, display label: _"Offline Mode — showing cached data"_

---

### 8. Sync Status Component (`src/components/SyncStatus.tsx`)

Small status indicator in the navigation header:

| State | Display |
|---|---|
| Online, nothing pending | 🟢 Connected |
| Offline, records queued | 🟡 Offline — 3 queued |
| Syncing | ⟳ Syncing... |
| Sync error | 🔴 2 failed — tap to retry |

Tapping "tap to retry" manually triggers `syncOfflineQueue()`.

---

## Notes

> Test offline mode in Chrome DevTools → Network tab → select "Offline" to simulate.

> Maximum 5 photos per offline form submission (to manage device storage).

> The sync engine handles conflicts conservatively: if a record fails after 3 retries, mark as `error` and surface to the user rather than silently discarding.
