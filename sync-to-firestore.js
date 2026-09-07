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

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 簡易原生 CSV 解析器
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
 * 標準兩階段查詢：搜尋 Place ID ➔ 抓取完整詳情（確保取得照片與完整時段）
 */
async function fetchPlaceData(name, address, city) {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn("⚠️ 尚未配置 GOOGLE_MAPS_API_KEY，略過檢索。");
    return { images: [], openingHours: null };
  }

  const query = `${name} ${address || ''} ${city || ''}`.trim();
  
  try {
    // 步驟 1：用 Text Search 取得店家的 place_id
    const searchUrl = 'https://places.googleapis.com/v1/places:searchText';
    const searchRes = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'places.id'
      },
      body: JSON.stringify({ textQuery: query })
    });

    const searchData = await searchRes.json();
    if (!searchData.places || searchData.places.length === 0) {
      console.log(`   ℹ️ Places 未查找到店家: "${query}"`);
      return { images: [], openingHours: null };
    }

    const placeId = searchData.places[0].id;

    // 步驟 2：拿 Place ID 抓取包含 regularOpeningHours 的詳情
    const detailsUrl = `https://places.googleapis.com/v1/places/${placeId}`;
    const detailsRes = await fetch(detailsUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'photos,regularOpeningHours,currentOpeningHours'
      }
    });

    const place = await detailsRes.json();

    // 抓取照片（最多 5 張）
    const images = [];
    if (place.photos && Array.isArray(place.photos)) {
      for (let i = 0; i < Math.min(place.photos.length, 5); i++) {
        const photoName = place.photos[i].name;
        const photoUrl = `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=800&maxWidthPx=800&key=${GOOGLE_MAPS_API_KEY}`;
        images.push(photoUrl);
      }
    }

    // 抓取營業時間（優先取 regularOpeningHours，備援 currentOpeningHours）
    let hoursObj = place.regularOpeningHours || place.currentOpeningHours || null;
    let openingHours = null;

    if (hoursObj) {
      openingHours = {
        openNow: hoursObj.openNow ?? null,
        weekdayDescriptions: hoursObj.weekdayDescriptions || [],
        periods: hoursObj.periods || []
      };
      console.log(`   ✅ 成功抓取 [${name}] 營業時間！週時段數: ${openingHours.weekdayDescriptions.length}`);
    } else {
      console.log(`   ⚠️ Google 上該店家未登記營業時間: [${name}]`);
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

  console.log("📥 正在下載 Google 試算表 CSV...");
  const res = await fetch(GOOGLE_SHEET_CSV_URL);
  if (!res.ok) throw new Error(`無法下載 CSV: ${res.statusText}`);
  const csvText = await res.text();

  const rows = parseCSV(csvText);
  console.log(`📊 成功自試算表讀取 ${rows.length} 筆店家紀錄。`);

  const existingSnapshot = await db.collection('restaurants').get();
  const existingMap = new Map();
  existingSnapshot.forEach(doc => {
    existingMap.set(doc.id, doc.data());
  });

  console.log(`🔍 開始處理店家資料並檢索營業時間與影像...`);

  let count = 0;
  for (const row of rows) {
    const rawName = (row.name || row.Name || row['餐廳名稱'] || '').trim();
    if (!rawName) continue;

    const city = (row.city || row.City || row['城市'] || 'davao').trim().toLowerCase();
    const safeDocId = `${city}_${rawName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}`;

    const cachedData = existingMap.get(safeDocId);
    let images = [];
    let openingHours = null;

    // 快取檢查：必須包含完整的營業時間清單才算有效快取
    const hasValidHours = cachedData && cachedData.openingHours && 
                          cachedData.openingHours.weekdayDescriptions && 
                          cachedData.openingHours.weekdayDescriptions.length > 0;

    if (cachedData && cachedData.images && cachedData.images.length > 0 && hasValidHours) {
      images = cachedData.images;
      openingHours = cachedData.openingHours;
    } else {
      const address = (row.address || row.Address || row['地址'] || '').trim();
      console.log(`   🔎 檢索店家詳情: ${rawName} (${city})...`);
      const placeData = await fetchPlaceData(rawName, address, city);
      
      images = (placeData.images && placeData.images.length > 0) ? placeData.images : (cachedData?.images || []);
      openingHours = placeData.openingHours;

      await sleep(350);
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

  console.log(`🎉 成功同步 ${count} 間店家（已整合營業時間資料）！`);
}

syncData().catch(err => {
  console.error("❌ 同步失敗：", err);
  process.exit(1);
});
