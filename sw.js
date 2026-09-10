/**
 * 大V的旅遊窩 PWA - Service Worker (解除 Pending 死鎖修正版)
 * 1. Google Sheets、Firebase、Google 授權直接 return 讓瀏覽器原生連線，絕不攔截
 * 2. 核心檔案 Network First（網路優先）
 * 3. 嚴格過濾非 http/https 請求
 */

const CACHE_NAME = 'bigv-app-dynamic';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // 1. 嚴格排除非 HTTP/HTTPS 協議
  if (!event.request.url.startsWith('http://') && !event.request.url.startsWith('https://')) {
    return;
  }

  const url = new URL(event.request.url);

  // 2. 關鍵修正：Google Sheets、Firebase、Google 帳號認證一律【直接 return 放行】！
  // 絕不可調用 event.respondWith(fetch(event.request))，否則會觸發 CORS 重定向死鎖
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
    return; // 直接交給瀏覽器原生底層發送，不再經由 Service Worker
  }

  // 3. 網站自身 HTML 與 JS 檔案採用【網路優先 (Network First)】
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

  // 4. 圖標與其他靜態資源採用 Stale-While-Revalidate
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
