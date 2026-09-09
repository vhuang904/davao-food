/**
 * 大V的旅遊窩 PWA - Service Worker (自動偵測與無感熱更新版)
 * 1. API、Google Sheet、Firebase 嚴禁快取，100% 即時連線
 * 2. 核心檔案採用 Network First（網路優先），免手動改版號，發布自動生效
 * 3. 離線備援防護
 */

const CACHE_NAME = 'bigv-app-dynamic';

self.addEventListener('install', (event) => {
  // 發現新檔案立刻就位，不等待舊版關閉
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // 立刻接管所有開啟中的分頁
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Google Sheets CSV 查詢、Firebase、Firestore 與 Cloudflare AI Worker 一律直通網路，永不快取
  if (
    url.hostname.includes('docs.google.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('firestore') ||
    url.hostname.includes('workers.dev') ||
    event.request.method !== 'GET'
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 2. HTML 與 JS 檔案採用【網路優先 (Network First)】：
  // 只要有網路，就必定去 GitHub 抓取最新檔案；斷網時才讀取快取作為離線備援
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
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 3. 圖標與其他靜態資源採用 Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networked = fetch(event.request)
        .then((resp) => {
          if (resp && resp.status === 200) {
            const respClone = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, respClone));
          }
          return resp;
        })
        .catch(() => null);

      return cached || networked;
    })
  );
});
