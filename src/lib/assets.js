// --- 이미지 에셋 (data 리포 assets/ 업로드 + IndexedDB 로컬 캐시) ---
// 노트 본문엔 ![](assets/<id>.<ext>) 짧은 링크만. 실체 blob은 IndexedDB에 캐시하고
// 데이터 리포 assets/<id>.<ext>로 업로드해 기기 간 동기화한다(private 리포라 프리뷰는 캐시/API로 로드).
const MIME_EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/avif': 'avif',
}
const isAssetPath = (p) => p.startsWith('assets/')
// path -> object URL. 붙여넣기 즉시 채워 프리뷰가 IndexedDB 왕복 없이 바로 표시.
const assetCache = new Map()

const IDB_NAME = 'cplog'
const IDB_STORE = 'assets'
let idbPromise = null
function openIdb() {
  if (idbPromise) return idbPromise
  idbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return idbPromise
}
async function idbPutAsset(key, blob) {
  const db = await openIdb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(blob, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
async function idbGetAsset(key) {
  const db = await openIdb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly')
    const req = tx.objectStore(IDB_STORE).get(key)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}

// Blob -> 순수 base64(데이터 URI 프리픽스 제거) — GitHub Contents API PUT 바디용
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).slice(String(r.result).indexOf(',') + 1))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}
// base64 문자열 -> 바이너리 Uint8Array (Contents API GET 응답 디코드)
function base64ToBytes(b64) {
  const bin = atob(b64.replace(/\s/g, ''))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

export { MIME_EXT, isAssetPath, assetCache, idbPutAsset, idbGetAsset, blobToBase64, base64ToBytes }
