/**
 * 大V的旅遊窩 PWA - Service Worker (版本自適應 & 自動舊快取清理版)
 * 1. 帶動態版本戳記，發布時自動清空舊版死鎖快取
 * 2. 徹底放行 Google Sheets、Firebase、Google 授權與 Cloudflare Workers 原生連線
 * 3. 核心頁面與腳本採用 Network First 網路優先策略
 */

// 👉 每次專案有重大改版發布時，只需修改此版本號即可強制全體手機客戶端自動更新
const CACHE_VERSION = 'v20260910-release';
const CACHE_NAME = `bigv-app-${CACHE_VERSION}`;

// 安裝階段：立即跳過等待，加速新版啟用
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// 啟用階段：主動刪除所有舊版本的快取空間，杜絕死鎖
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log(`[PWA SW] 清除過期快取: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // 1. 嚴格排除非 HTTP/HTTPS 協議（避免 Chrome 擴充功能或內部協議干擾）
  if (!event.request.url.startsWith('http://') && !event.request.url.startsWith('https://')) {
    return;
  }

  const url = new URL(event.request.url);

  // 2. 關鍵放行名單：直接交給瀏覽器原生連線，絕不經由 Service Worker 攔截
  if (
    url.hostname.includes('docs.google.com') ||
    url.hostname.includes('googleusercontent.com') ||
    url.hostname.includes('spreadsheets.google.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('firestore') ||
    url.hostname.includes('accounts.google.com') ||
    url.hostname.includes('apis.google.com') ||
    url.hostname.includes('identitytoolkit') ||
    url.hostname.includes('securetoken.googleapis.com') ||
    url.hostname.includes('workers.dev') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  // 3. 核心 HTML 與 JS 檔案採用【網路優先 (Network First)】
  if (
    event.request.mode === 'navigate' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.js') ||
    url.pathname === '/'
  ) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              if (event.request.url.startsWith('http')) {
                cache.put(event.request, copy);
              }
            });
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 4. 圖標、樣式與其他靜態資源採用 Stale-While-Revalidate（優先快取，背景更新）
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networked = fetch(event.request)
        .then((resp) => {
          if (resp && resp.status === 200) {
            const respClone = resp.clone();
            caches.open(CACHE_NAME).then((cache) => {
              if (event.request.url.startsWith('http')) {
                cache.put(event.request, respClone);
              }
            });
          }
          return resp;
        })
        .catch(() => null);

      return cached || networked;
    })
  );
});
