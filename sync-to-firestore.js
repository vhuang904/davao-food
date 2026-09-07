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
 * 智慧清洗搜尋字串，避免過多冗餘字眼導致 Places API 找不到
 */
function buildSearchQueries(name, address, city) {
  const queries = [];
  
  // 移除店名中的括號內容作為基礎搜尋詞
  const cleanName = name.replace(/\([^)]*\)/g, '').trim();

  // 策略 1：完整店名 + 城市（命中率最高）
  queries.push(`${name} ${city}`.trim());

  // 策略 2：去除括號的乾淨店名 + 城市
  if (cleanName && cleanName !== name) {
    queries.push(`${cleanName} ${city}`.trim());
  }

  // 策略 3：乾淨店名 + 簡要路名（若地址有提供）
  if (address) {
    const shortAddress = address.split(',')[0].trim();
    queries.push(`${cleanName} ${shortAddress} ${city}`.trim());
  }

  // 策略 4：僅店名保底
  queries.push(cleanName || name);

  return [...new Set(queries)];
}

/**
 * 兩階段查詢 Google Places API
 */
async function fetchPlaceData(name, address, city) {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn("⚠️ 尚未配置 GOOGLE_MAPS_API_KEY，略過檢索。");
    return { images: [], openingHours: null };
  }

  const candidateQueries = buildSearchQueries(name, address, city);
  let placeId = null;

  // 嘗試候選搜尋詞直到找到店家
  for (const query of candidateQueries) {
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
      if (searchData.places && searchData.places.length > 0) {
        placeId = searchData.places[0].id;
        console.log(`   🎯 搜尋成功: "${query}" ➔ Place ID: ${placeId}`);
        break;
      }
    } catch (e) {
      // 忽略單次網路錯誤，繼續下一個詞
    }
  }

  if (!placeId) {
    console.log(`   ℹ️ Places 未查找到店家: "${name} (${city})"`);
    return { images: [], openingHours: null };
  }

  // 階段二：透過 Place ID 取得完整的營業時間與照片
  try {
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

    // 1. 照片處理（最多 5 張）
    const images = [];
    if (place.photos && Array.isArray(place.photos)) {
      for (let i = 0; i < Math.min(place.photos.length, 5); i++) {
        const photoName = place.photos[i].name;
        const photoUrl = `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=800&maxWidthPx=800&key=${GOOGLE_MAPS_API_KEY}`;
        images.push(photoUrl);
      }
    }

    // 2. 營業時間處理
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

    return { images, openingHours };

  } catch (error) {
    console.warn(`   ⚠️ 抓取 Place Details 失敗 [${name}]:`, error.message);
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

    // 快取檢查：必須包含有效的營業時間時段
    const hasValidHours = cachedData && cachedData.openingHours && 
                          cachedData.openingHours.weekdayDescriptions && 
                          cachedData.openingHours.weekdayDescriptions.length > 0;

    if (cachedData && cachedData.images && cachedData.images.length > 0 && hasValidHours) {
      images = cachedData.images;
      openingHours = cachedData.openingHours;
    } else {
      const address = (row.address || row.Address || row['地址'] || '').trim();
      console.log(`   🔎 檢索店家: ${rawName} (${city})...`);
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

  console.log(`🎉 成功同步 ${count} 間店家（營業時間與照片已更新）！`);
}

syncData().catch(err => {
  console.error("❌ 同步失敗：", err);
  process.exit(1);
});
