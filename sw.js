/**
 * 大V的旅遊窩 PWA - Service Worker (v17.0 Master)
 */
const CACHE_NAME = 'bigv-travel-nest-v17.0';

// 僅快取前端靜態外殼核心檔案
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './googleSheetService.js',
  './icon.svg'
];

// 1. 安裝階段：快取靜態資源，並強制立即生效
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// 2. 啟動階段：自動清理舊版快取（如舊的 davao-food-v1），釋放空間並避免死鎖
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. 攔截請求：保護 Firebase、Google Sheets 與 AI 後端絕不走死快取
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // 【關鍵防護】凡是 Firebase、Google APIs、Cloudflare Worker 一律放行網路優先，絕不吃掉資料
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('google.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('workers.dev')
  ) {
    return; // 直接交給瀏覽器原生網路處理
  }

  // 靜態資源：快取優先，並具備離線保護
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(e.request).then((networkResponse) => {
        return networkResponse;
      }).catch(() => {
        // 離線且找不到快取時的回退
        if (e.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
