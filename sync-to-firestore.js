const admin = require('firebase-admin');

// 1. 初始化 Firebase Admin SDK
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

// 2. 取得環境變數
const GOOGLE_SHEET_CSV_URL = process.env.GOOGLE_SHEET_CSV_URL;
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// 延遲工具函式
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 簡易原生 CSV 解析器（支援逗號、引號處理，免裝 csv-parser）
 */
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return [];

  function splitLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
    return result;
  }

  const headers = splitLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitLine(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = values[idx] || '';
    });
    rows.push(obj);
  }

  return rows;
}

/**
 * 呼叫 Google Places API (New) 搜尋店家
 * 使用原生 fetch
 */
async function fetchPlaceData(name, address, city) {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn("⚠️ 尚未配置 GOOGLE_MAPS_API_KEY，略過 Google Places 資料檢索。");
    return { images: [], openingHours: null };
  }

  const query = `${name} ${address || ''} ${city || ''}`.trim();
  const url = 'https://places.googleapis.com/v1/places:searchText';

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.photos,places.regularOpeningHours'
      },
      body: JSON.stringify({ textQuery: query })
    });

    const data = await res.json();
    const places = data.places;
    if (!places || places.length === 0) {
      console.log(`   ℹ️ Google Places 未查找到店家: "${query}"`);
      return { images: [], openingHours: null };
    }

    const place = places[0];

    // 1. 照片（最多 5 張）
    const images = [];
    if (place.photos && Array.isArray(place.photos)) {
      for (let i = 0; i < Math.min(place.photos.length, 5); i++) {
        const photoName = place.photos[i].name;
        const photoUrl = `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=800&maxWidthPx=800&key=${GOOGLE_MAPS_API_KEY}`;
        images.push(photoUrl);
      }
    }

    // 2. 營業時間
    let openingHours = null;
    if (place.regularOpeningHours) {
      openingHours = {
        openNow: place.regularOpeningHours.openNow || false,
        weekdayDescriptions: place.regularOpeningHours.weekdayDescriptions || [],
        periods: place.regularOpeningHours.periods || []
      };
    }

    return { images, openingHours };

  } catch (error) {
    console.warn(`   ⚠️ 抓取 Places API 失敗 [${name}]:`, error.message);
    return { images: [], openingHours: null };
  }
}

/**
 * 主執行流程
 */
async function syncData() {
  console.log("🚀 開始執行 Google Sheets 同步至 Firestore 流程...");

  if (!GOOGLE_SHEET_CSV_URL) {
    throw new Error("❌ 缺少環境變數 GOOGLE_SHEET_CSV_URL！");
  }

  // 1. 下載 CSV
  console.log("📥 正在下載 Google 試算表 CSV...");
  const res = await fetch(GOOGLE_SHEET_CSV_URL);
  if (!res.ok) throw new Error(`無法下載 CSV: ${res.statusText}`);
  const csvText = await res.text();

  // 2. 原生解析 CSV
  const rows = parseCSV(csvText);
  console.log(`📊 成功自試算表讀取 ${rows.length} 筆店家紀錄。`);

  // 3. 讀取現有快取
  const existingSnapshot = await db.collection('restaurants').get();
  const existingMap = new Map();
  existingSnapshot.forEach(doc => {
    existingMap.set(doc.id, doc.data());
  });

  console.log(`🔍 開始處理資料並比對 Google Places 影像與營業時間...`);

  let count = 0;
  for (const row of rows) {
    const rawName = (row.name || row.Name || row['餐廳名稱'] || '').trim();
    if (!rawName) continue;

    const city = (row.city || row.City || row['城市'] || 'davao').trim().toLowerCase();
    const safeDocId = `${city}_${rawName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}`;

    // 快取檢查
    const cachedData = existingMap.get(safeDocId);
    let images = [];
    let openingHours = null;

    if (cachedData && cachedData.images && cachedData.images.length > 0 && cachedData.openingHours) {
      images = cachedData.images;
      openingHours = cachedData.openingHours;
    } else {
      const address = (row.address || row.Address || row['地址'] || '').trim();
      console.log(`   🔎 正在向 Places API 查詢: ${rawName} (${city})...`);
      const placeData = await fetchPlaceData(rawName, address, city);
      images = placeData.images;
      openingHours = placeData.openingHours;

      await sleep(250);
    }

    const restaurantDoc = {
      name: rawName,
      name_en: (row.name_en || row.Name_en || row['英文名稱'] || rawName).trim(),
      city: city,
      categoryKey: (row.categoryKey || row.Category || row['分類'] || 'filipino').trim(),
      address: (row.address || row.Address || row['地址'] || '').trim(),
      phone: (row.phone || row.Phone || row['電話'] || '').trim(),
      description: (row.description || row.Description || row['描述'] || '').trim(),
      grabUrl: (row.grabUrl || row.GrabUrl || row['Grab外送連結'] || '').trim(),
      foodpandaUrl: (row.foodpandaUrl || row.FoodpandaUrl || row['Foodpanda外送連結'] || '').trim(),
      images: images,
      openingHours: openingHours,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('restaurants').doc(safeDocId).set(restaurantDoc, { merge: true });
    count++;
  }

  console.log(`🎉 恭喜！全數 ${count} 間餐廳資料已順利同步至 Firestore（包含真實照片與營業時間）！`);
}

syncData().catch(err => {
  console.error("❌ 同步失敗，錯誤訊息：", err);
  process.exit(1);
});
