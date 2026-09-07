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
 * 原生簡易 CSV 解析
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
 * 乾淨搜尋詞產生器（去除所有括號雜訊）
 */
function buildCleanQueries(name, city) {
  const queries = [];
  const cleanName = name.replace(/\([^)]*\)/g, '').trim();
  
  const cityNameMap = {
    'davao': 'Davao City',
    'manila': 'Manila',
    'cebu': 'Cebu City'
  };
  const properCity = cityNameMap[city.toLowerCase()] || city;

  const matchParen = name.match(/\(([^)]+)\)/);
  if (matchParen && matchParen[1]) {
    queries.push(`${cleanName} ${matchParen[1]} ${properCity}`.trim());
  }

  queries.push(`${cleanName} ${properCity}`.trim());
  queries.push(`${name} ${properCity}`.trim());

  return [...new Set(queries.filter(q => q.length > 0))];
}

/**
 * 兩階段查詢 Google Places API（含真實評分與評價數）
 */
async function fetchPlaceData(name, address, city) {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn("⚠️ 缺少 GOOGLE_MAPS_API_KEY");
    return { images: [], openingHours: null, googleRating: null, googleReviewCount: null };
  }

  const queries = buildCleanQueries(name, city);
  let placeId = null;

  for (const query of queries) {
    try {
      const searchUrl = 'https://places.googleapis.com/v1/places:searchText';
      const searchRes = await fetch(searchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName'
        },
        body: JSON.stringify({ textQuery: query })
      });

      const searchData = await searchRes.json();

      if (searchData.error) {
        console.error(`   🚨 Google API 回傳錯誤: [${searchData.error.status}] ${searchData.error.message}`);
        return { images: [], openingHours: null, googleRating: null, googleReviewCount: null };
      }

      if (searchData.places && searchData.places.length > 0) {
        placeId = searchData.places[0].id;
        console.log(`   🎯 找到店家: "${query}" ➔ Place ID: ${placeId}`);
        break;
      }
    } catch (e) {
      console.warn(`   ⚠️ 網路請求異常: ${e.message}`);
    }
  }

  if (!placeId) {
    console.log(`   ℹ️ Places 未查找到: [${name}] (城市: ${city})`);
    return { images: [], openingHours: null, googleRating: null, googleReviewCount: null };
  }

  // 階段二：取得完整營業時段、照片、真實評分與評論數
  try {
    const detailsUrl = `https://places.googleapis.com/v1/places/${placeId}`;
    const detailsRes = await fetch(detailsUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'photos,regularOpeningHours,currentOpeningHours,rating,userRatingCount'
      }
    });

    const place = await detailsRes.json();

    const images = [];
    if (place.photos && Array.isArray(place.photos)) {
      for (let i = 0; i < Math.min(place.photos.length, 5); i++) {
        const photoName = place.photos[i].name;
        const photoUrl = `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=800&maxWidthPx=800&key=${GOOGLE_MAPS_API_KEY}`;
        images.push(photoUrl);
      }
    }

    let hoursObj = place.regularOpeningHours || place.currentOpeningHours || null;
    let openingHours = null;

    if (hoursObj) {
      openingHours = {
        openNow: hoursObj.openNow ?? null,
        weekdayDescriptions: hoursObj.weekdayDescriptions || [],
        periods: hoursObj.periods || []
      };
      console.log(`   ✅ 成功抓取 [${name}] 營業時間！週時段數: ${openingHours.weekdayDescriptions.length}`);
    }

    const googleRating = place.rating || null;
    const googleReviewCount = place.userRatingCount || null;
    if (googleRating) {
      console.log(`   ⭐ 取得 Google 評分: ${googleRating} (${googleReviewCount} 則評價)`);
    }

    return { images, openingHours, googleRating, googleReviewCount };

  } catch (error) {
    console.warn(`   ⚠️ 抓取 Place Details 失敗 [${name}]:`, error.message);
    return { images: [], openingHours: null, googleRating: null, googleReviewCount: null };
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

  console.log(`🔍 開始處理店家資料並檢索營業時間、評分與影像...`);

  let count = 0;
  for (const row of rows) {
    const rawName = (row.name || row.Name || row['餐廳名稱'] || '').trim();
    if (!rawName) continue;

    const city = (row.city || row.City || row['城市'] || 'davao').trim().toLowerCase();
    const safeDocId = `${city}_${rawName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}`;

    const cachedData = existingMap.get(safeDocId);
    let images = [];
    let openingHours = null;
    let googleRating = null;
    let googleReviewCount = null;

    const hasValidHours = cachedData && cachedData.openingHours && 
                          cachedData.openingHours.weekdayDescriptions && 
                          cachedData.openingHours.weekdayDescriptions.length > 0;
    const hasValidRating = cachedData && cachedData.googleRating !== undefined && cachedData.googleRating !== null;

    if (cachedData && cachedData.images && cachedData.images.length > 0 && hasValidHours && hasValidRating) {
      images = cachedData.images;
      openingHours = cachedData.openingHours;
      googleRating = cachedData.googleRating;
      googleReviewCount = cachedData.googleReviewCount;
    } else {
      const address = (row.address || row.Address || row['地址'] || '').trim();
      console.log(`   🔎 檢索店家: ${rawName} (${city})...`);
      const placeData = await fetchPlaceData(rawName, address, city);
      
      images = (placeData.images && placeData.images.length > 0) ? placeData.images : (cachedData?.images || []);
      openingHours = placeData.openingHours || cachedData?.openingHours || null;
      googleRating = placeData.googleRating || cachedData?.googleRating || null;
      googleReviewCount = placeData.googleReviewCount || cachedData?.googleReviewCount || null;

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
      googleRating: googleRating,
      googleReviewCount: googleReviewCount,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('restaurants').doc(safeDocId).set(restaurantDoc, { merge: true });
    count++;
  }

  console.log(`🎉 成功同步 ${count} 間店家（評分與營業時間已入庫）！`);
}

syncData().catch(err => {
  console.error("❌ 同步失敗：", err);
  process.exit(1);
});
