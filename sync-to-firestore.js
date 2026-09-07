const admin = require('firebase-admin');
const axios = require('axios');
const csv = require('csv-parser');
const stream = require('stream');

// 1. 初始化 Firebase Admin SDK
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

// 2. Google Sheets 發布之 CSV 網址（請確認為發布後的公開 CSV 連結）
const GOOGLE_SHEET_CSV_URL = process.env.GOOGLE_SHEET_CSV_URL;
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// 延遲工具函式，避免請求過於頻繁
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 呼叫 Google Places API (New) 搜尋店家並抓取：
 * 1. 前 5 張真實打卡/門市照片
 * 2. 完整的一週營業時間（regularOpeningHours）
 */
async function fetchPlaceData(name, address, city) {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn("⚠️ 尚未配置 GOOGLE_MAPS_API_KEY，略過 Google Places 資料檢索。");
    return { images: [], openingHours: null };
  }

  const query = `${name} ${address || ''} ${city || ''}`.trim();
  const url = 'https://places.googleapis.com/v1/places:searchText';

  try {
    const response = await axios.post(
      url,
      { textQuery: query },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
          // 關鍵遮罩：同時請求 photos 與 regularOpeningHours
          'X-Goog-FieldMask': 'places.id,places.displayName,places.photos,places.regularOpeningHours'
        }
      }
    );

    const places = response.data.places;
    if (!places || places.length === 0) {
      console.log(`   ℹ️ Google Places 未查找到店家: "${query}"`);
      return { images: [], openingHours: null };
    }

    const place = places[0];

    // 1. 抓取照片（最多 5 張）
    const images = [];
    if (place.photos && Array.isArray(place.photos)) {
      for (let i = 0; i < Math.min(place.photos.length, 5); i++) {
        const photoName = place.photos[i].name; // 格式: places/PLACE_ID/photos/PHOTO_REFERENCE
        const photoUrl = `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=800&maxWidthPx=800&key=${GOOGLE_MAPS_API_KEY}`;
        images.push(photoUrl);
      }
    }

    // 2. 抓取營業時間結構
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
    console.warn(`   ⚠️ 抓取 Places API 失敗 [${name}]:`, error.response?.data?.error?.message || error.message);
    return { images: [], openingHours: null };
  }
}

/**
 * 主執行流程：下載 CSV ➔ 解析 ➔ 檢索 Places 資料 ➔ 寫入 Firestore
 */
async function syncData() {
  console.log("🚀 開始執行 Google Sheets 同步至 Firestore 流程...");

  if (!GOOGLE_SHEET_CSV_URL) {
    throw new Error("❌ 缺少環境變數 GOOGLE_SHEET_CSV_URL！");
  }

  // 1. 從 Google Sheets 下載最新 CSV 內容
  console.log("📥 正在下載 Google 試算表 CSV...");
  const response = await axios.get(GOOGLE_SHEET_CSV_URL, { responseType: 'text' });
  const rows = [];

  const bufferStream = new stream.PassThrough();
  bufferStream.end(Buffer.from(response.data));

  await new Promise((resolve, reject) => {
    bufferStream
      .pipe(csv())
      .on('data', (data) => rows.push(data))
      .on('end', resolve)
      .on('error', reject);
  });

  console.log(`📊 成功自試算表讀取 ${rows.length} 筆店家紀錄。`);

  // 2. 讀取 Firestore 現有資料庫（做快取檢查，避免重複呼叫 API 扣款）
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

    // 檢查快取
    const cachedData = existingMap.get(safeDocId);
    let images = [];
    let openingHours = null;

    if (cachedData && cachedData.images && cachedData.images.length > 0 && cachedData.openingHours) {
      // 若已抓過且完整，直接沿用舊資料
      images = cachedData.images;
      openingHours = cachedData.openingHours;
    } else {
      // 否則向 Google Places API 檢索真實資料
      const address = (row.address || row.Address || row['地址'] || '').trim();
      console.log(`   🔎 正在向 Places API 查詢: ${rawName} (${city})...`);
      const placeData = await fetchPlaceData(rawName, address, city);
      images = placeData.images;
      openingHours = placeData.openingHours;

      // 稍微停頓 250ms，確保遵守 API 速率限制
      await sleep(250);
    }

    // 構建結構完整的 Firestore 物件
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

    // 寫入 Firestore
    await db.collection('restaurants').doc(safeDocId).set(restaurantDoc, { merge: true });
    count++;
  }

  console.log(`🎉 恭喜！全數 ${count} 間餐廳資料已順利同步至 Firestore（包含真實照片與每週營業時段）！`);
}

syncData().catch(err => {
  console.error("❌ 同步失敗，錯誤訊息：", err);
  process.exit(1);
});
