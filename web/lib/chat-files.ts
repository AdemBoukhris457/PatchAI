const DB_NAME = "patchai"
const STORE = "files"

export type StoredFile = {
  id: string
  chatId: string
  url: string
}

export function fileKey(chatId: string, messageId: string, index: number) {
  return `${chatId}\u001f${messageId}\u001f${index}`
}

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function isStoredFile(row: unknown): row is StoredFile {
  if (!row || typeof row !== "object") return false
  const record = row as StoredFile
  return (
    typeof record.id === "string" &&
    typeof record.chatId === "string" &&
    typeof record.url === "string" &&
    record.url.length > 0
  )
}

export function readFiles() {
  if (typeof indexedDB === "undefined") return Promise.resolve<StoredFile[]>([])
  return openDb().then(
    (db) =>
      new Promise<StoredFile[]>((resolve, reject) => {
        const transaction = db.transaction(STORE, "readonly")
        const request = transaction.objectStore(STORE).getAll()
        request.onsuccess = () => {
          const rows = Array.isArray(request.result) ? request.result : []
          resolve(rows.filter(isStoredFile))
        }
        request.onerror = () => reject(request.error)
        transaction.oncomplete = () => db.close()
        transaction.onerror = () => {
          db.close()
          reject(transaction.error)
        }
      }),
  )
}

export function replaceFiles(
  records: StoredFile[],
  liveKeys: ReadonlySet<string>,
  chatIds: ReadonlySet<string>,
) {
  if (typeof indexedDB === "undefined") return Promise.resolve()
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE, "readwrite")
        const store = transaction.objectStore(STORE)
        const request = store.getAll()
        request.onsuccess = () => {
          const rows = Array.isArray(request.result) ? request.result : []
          for (const row of rows) {
            if (!isStoredFile(row)) continue
            if (!chatIds.has(row.chatId) || !liveKeys.has(row.id)) {
              store.delete(row.id)
            }
          }
          for (const record of records) store.put(record)
        }
        request.onerror = () => reject(request.error)
        transaction.oncomplete = () => {
          db.close()
          resolve()
        }
        transaction.onerror = () => {
          db.close()
          reject(transaction.error)
        }
        transaction.onabort = () => {
          db.close()
          reject(transaction.error)
        }
      }),
  )
}
