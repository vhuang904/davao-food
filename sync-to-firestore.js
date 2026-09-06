const admin = require('firebase-admin');
const https = require('https');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 使用 Google 試算表發布的 CSV 網址
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR7RqEOBMOhNBT_Mo2kee4w4WNugbZFLRRWhmc3c9FWCjams-n9oyaug1bI4lXyd0G9MfU8ftW8utuJ/pub?output=csv';
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// 向 Google Places API (New) 抓取該餐廳在 Google Maps 上的真實打卡照片
async function fetchGooglePlacePhotos(restaurantName, address, city) {
  if (!GOOGLE_MAPS_API_KEY) {
    return [];
  }

  try {
    const cityName = city || 'Philippines';
    const query = `${restaurantName} ${address || ''} ${cityName}`;
    const searchUrl = 'https://places.googleapis.com/v1/places:searchText';

    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'places.photos,places.displayName'
      },
      body: JSON.stringify({
        textQuery: query,
        maxResultCount: 1
      })
    });

    const data = await response.json();
    if (!data.places || data.places.length === 0 || !data.places[0].photos) {
      return [];
    }

    // 最多取得前 5 張 Google Maps 真實打卡照
    const photos = data.places[0].photos.slice(0, 5);
    const photoUrls = photos.map(p => {
      return `https://places.googleapis.com/v1/${p.name}/media?maxWidthPx=800&key=${GOOGLE_MAPS_API_KEY}`;
    });

    return photoUrls;
  } catch (error) {
    console.warn(`⚠️ 查詢 [${restaurantName}] Google 照片失敗：`, error.message);
    return [];
  }
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let inQuotes = false;
  let field = '';

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const nextC = text[i + 1];

    if (c === '"') {
      if (inQuotes && nextC === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push(field.trim());
      field = '';
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && nextC === '\n') i++;
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }

  if (rows.length < 2) return [];

  const headers = rows[0].map(h => h.replace(/^"|"$/g, '').trim()).filter(h => h !== '');
  const result = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length === 0 || (r.length === 1 && r[0] === '')) continue;
    
    const obj = {};
    headers.forEach((header, index) => {
      let val = r[index] !== undefined ? r[index] : '';
      obj[header] = val.replace(/^"|"$/g, '').trim();
    });
    
    // 只保留有填寫名稱的餐廳資料
    if (obj.name) {
      result.push(obj);
    }
  }
  return result;
}

function fetchCSVData(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
        return fetchCSVData(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function syncData() {
  console.log("🚀【餐廳資料同步】正在從 Google 試算表讀取資料...");
  try {
    const csvText = await fetchCSVData(SHEET_CSV_URL);
    const allData = parseCSV(csvText);

    if (allData.length === 0) {
      console.log("⚠️ 警告：沒有解析到任何有效餐廳資料。");
      return;
    }

    const batch = db.batch();
    let restaurantCount = 0;

    for (let i = 0; i < allData.length; i++) {
      const item = allData[i];

      // 過濾非餐廳標題行與無效列
      if (item.name && !item.name.toLowerCase().startsWith('city:') && !/^\d+$/.test(item.name)) {
        const city = item.city ? item.city.trim().toLowerCase() : 'davao';
        let safeName = item.name.replace(/[^a-zA-Z0-9]/g, '');
        if (!safeName || safeName.trim() === '') {
          safeName = 'restaurant_' + i;
        }
        const docId = `${city}_${safeName}`;
        const docRef = db.collection('restaurants').doc(docId);

        // 檢查相片：若試算表未自填且有 API Key，查詢 Google Places API
        if ((!item.images || item.images === '') && GOOGLE_MAPS_API_KEY) {
          // 檢查 Firestore 舊資料庫是否已有相片，避免重複呼叫 API 消耗額度
          const existingDoc = await docRef.get();
          const existingData = existingDoc.exists ? existingDoc.data() : null;

          if (existingData && existingData.images && existingData.images.length > 0) {
            item.images = existingData.images;
          } else {
            console.log(`📸 [${restaurantCount + 1}] 查詢 Google Maps 照片: ${item.name} (${city})...`);
            const googlePhotos = await fetchGooglePlacePhotos(item.name, item.address, city);
            if (googlePhotos.length > 0) {
              item.images = googlePhotos;
              console.log(`   ✅ 成功取得 ${googlePhotos.length} 張 Google 真實相片！`);
            } else {
              item.images = [];
            }
          }
        } else if (typeof item.images === 'string' && item.images.includes(',')) {
          // 若試算表填多張逗號分隔的圖片網址，轉為陣列
          item.images = item.images.split(',').map(s => s.trim());
        }

        item.updatedAt = admin.firestore.FieldValue.serverTimestamp();
        batch.set(docRef, item, { merge: true });
        restaurantCount++;
      }
    }

    await batch.commit();
    console.log(`🎉 餐廳同步完成！成功處理並寫入 ${restaurantCount} 筆餐廳至 Firestore！`);
  } catch (error) {
    console.error("❌ 同步失敗詳細原因：", error);
    process.exit(1);
  }
}

syncData();
