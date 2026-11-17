import type { LocalImageAsset } from './localImage'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('prismpress-assets', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('workspace')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function loadImageAssets(): Promise<Record<string, LocalImageAsset>> {
  const database = await openDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction('workspace').objectStore('workspace').get('images')
      request.onsuccess = () => resolve(request.result ?? {})
      request.onerror = () => reject(request.error)
    })
  } finally { database.close() }
}

export async function saveImageAssets(assets: Record<string, LocalImageAsset>): Promise<void> {
  const database = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('workspace', 'readwrite')
      transaction.objectStore('workspace').put(assets, 'images')
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
  } finally { database.close() }
}
