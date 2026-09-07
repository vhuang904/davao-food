const admin = require('firebase-admin');

// 1. 初始化 Firebase Admin
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 各城市重點核心商圈探測錨點（精準鎖定人氣餐飲聚集地）
const CITY_ANCHORS = {
  davao: [
    { name: "SM Lanang Premier", lat: 7.0988, lng: 125.6315 },
    { name: "Abreeza Mall", lat: 7.0917, lng: 125.6105 },
    { name: "SM City Davao (Ecoland)", lat: 7.0494, lng: 125.5898 },
    { name: "Rizal St / Poblacion", lat: 7.0707, lng: 125.6087 }
  ],
  manila: [
    { name: "BGC Taguig", lat: 14.5507, lng: 121.0494 },
    { name: "Makati Greenbelt", lat: 14.5524, lng: 121.0207 }
  ],
  cebu: [
    { name: "Cebu IT Park", lat: 10.3297, lng: 123.9066 },
    { name: "Ayala Center Cebu", lat: 10.3173, lng: 123.9056 }
  ]
};

// 料理類別判定推導器
function guessCategory(types = [], displayName = '') {
  const text = (types.join(' ') + ' ' + displayName).toLowerCase();
  if (text.includes('chinese') || text.includes('dimsum') || text.includes('dumpling') || text.includes('hotpot') || text.includes('noodle')) return 'chinese';
  if (text.includes('japanese') || text.includes('korean') || text.includes('sushi') || text.includes('ramen') || text.includes('bbq') || text.includes('samgyup')) return 'japanese_korean';
  if (text.includes('fast_food') || text.includes('burger') || text.includes('pizza')) return 'fast_food';
  if (text.includes('seafood') || text.includes('grill') || text.includes('barbecue') || text.includes('ihaw')) return 'bbq_seafood';
  if (text.includes('cafe') || text.includes('coffee') || text.includes('tea') || text.includes('bakery') || text.includes('dessert')) return 'coffee_drinks';
  return 'filipino';
}

/**
 * 探測商圈周邊高品質餐廳（Places API New: searchNearby）
 */
async function searchNearbyAnchor(lat, lng) {
  const url = 'https://places.googleapis.com/v1/places:searchNearby';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.primaryType,places.types,places.rating,places.userRatingCount,places.formattedAddress,places.nationalPhoneNumber,places.photos,places.regularOpeningHours,places.currentOpeningHours'
      },
      body: JSON.stringify({
        includedTypes: ['restaurant', 'cafe', 'fast_food_restaurant', 'barbecue_restaurant'],
        maxResultCount: 15,
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: 1200.0 // 探測半徑 1.2 公里
          }
        }
      })
    });

    const data = await res.json();
    if (data.error) {
      console.warn(`   ⚠️ 探測異常: [${data.error.status}] ${data.error.message}`);
      return [];
    }
    return data.places || [];
  } catch (err) {
    console.warn(`   ⚠️ 請求失敗: ${err.message}`);
    return [];
  }
}

/**
 * 主執行流程
 */
async function discover() {
  console.log("🚀 啟動每週美食雷達：自動探索未收錄的高人氣新餐廳...");

  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error("❌ 缺少 GOOGLE_MAPS_API_KEY！");
  }

  // 1. 讀取現有資料庫，建立除重清單
  const existingSnapshot = await db.collection('restaurants').get();
  const existingNames = new Set();
  const existingIds = new Set();

  existingSnapshot.forEach(doc => {
    existingIds.add(doc.id);
    const data = doc.data();
    if (data.name) existingNames.add(data.name.trim().toLowerCase());
    if (data.name_en) existingNames.add(data.name_en.trim().toLowerCase());
  });

  console.log(`📚 資料庫現存 ${existingSnapshot.size} 家餐廳，已建立除重比對表。`);

  let totalNewAdded = 0;

  // 2. 按城市進行商圈巡邏
  for (const [city, anchors] of Object.entries(CITY_ANCHORS)) {
    console.log(`\n🏙️ 正在巡邏城市: 【${city.toUpperCase()}】...`);
    let cityAddedCount = 0;
    const MAX_PER_CITY = 3; // 每個城市每週最多探索入庫 3 家精選店，兼顧品質與額度

    for (const anchor of anchors) {
      if (cityAddedCount >= MAX_PER_CITY) break;

      console.log(`   📍 探測商圈: ${anchor.name}...`);
      const candidates = await searchNearbyAnchor(anchor.lat, anchor.lng);
      await sleep(400);

      // 篩選：評分 4.2 以上、評價數 >= 20、且尚未在資料庫中的名店
      for (const place of candidates) {
        if (cityAddedCount >= MAX_PER_CITY) break;

        const rawName = place.displayName?.text?.trim() || '';
        if (!rawName) continue;

        const rating = place.rating || 0;
        const reviewCount = place.userRatingCount || 0;

        // 品質門檻
        if (rating < 4.2 || reviewCount < 20) continue;

        // 除重檢查
        const lowerName = rawName.toLowerCase();
        const safeDocId = `${city}_${rawName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}`;

        if (existingIds.has(safeDocId) || existingNames.has(lowerName)) {
          continue; // 已收錄，略過
        }

        console.log(`   ✨ 發掘全新優質名店: "${rawName}" (⭐ ${rating} / ${reviewCount} 則評價)`);

        // 整理照片
        const images = [];
        if (place.photos && Array.isArray(place.photos)) {
          for (let i = 0; i < Math.min(place.photos.length, 5); i++) {
            const photoName = place.photos[i].name;
            const photoUrl = `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=800&maxWidthPx=800&key=${GOOGLE_MAPS_API_KEY}`;
            images.push(photoUrl);
          }
        }

        // 整理營業時間
        const hoursObj = place.regularOpeningHours || place.currentOpeningHours || null;
        let openingHours = null;
        if (hoursObj) {
          openingHours = {
            openNow: hoursObj.openNow ?? null,
            weekdayDescriptions: hoursObj.weekdayDescriptions || [],
            periods: hoursObj.periods || []
          };
        }

        const categoryKey = guessCategory(place.types || [], rawName);
        const encodedSearch = encodeURIComponent(`${rawName} ${city}`);

        // 組裝文件寫入 Firestore
        const newDoc = {
          name: rawName,
          name_en: rawName,
          city: city,
          categoryKey: categoryKey,
          address: place.formattedAddress || '',
          phone: place.nationalPhoneNumber || '',
          description: `Google 評分 ⭐ ${rating} (${reviewCount} 則評價) 的在地人氣推薦餐廳。`,
          grabUrl: `https://food.grab.com/ph/en/restaurants?search=${encodedSearch}`,
          foodpandaUrl: `https://www.foodpanda.ph/restaurants?search=${encodedSearch}`,
          images: images,
          openingHours: openingHours,
          isAutoDiscovered: true,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('restaurants').doc(safeDocId).set(newDoc, { merge: true });

        // 加入已收錄集合，避免本輪巡邏同品牌重複出現
        existingIds.add(safeDocId);
        existingNames.add(lowerName);

        cityAddedCount++;
        totalNewAdded++;
        console.log(`      ✅ 已成功自動收錄至資料庫！`);
      }
    }
  }

  console.log(`\n🎉 本輪探索完成！共發掘並自動上架 ${totalNewAdded} 間新餐廳！`);
}

discover().catch(err => {
  console.error("❌ 自動探索任務失敗：", err);
  process.exit(1);
});
