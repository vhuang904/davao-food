const admin = require('firebase-admin');
const { GoogleGenAI } = require('@google/genai');

// 初始化 Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

// 初始化 Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// 城市特定搜尋設定（分城深挖，確保達沃與宿霧數量充足）
const CITY_CONFIGS = [
  {
    cityKey: 'davao',
    cityName: 'Davao City',
    searchKeywords: 'Davao restaurant promo food deals SM Lanang Abreeza Obrero new opening 2026'
  },
  {
    cityKey: 'cebu',
    cityName: 'Cebu City',
    searchKeywords: 'Cebu food promo restaurant opening Ayala Center SM Seaside IT Park 2026'
  },
  {
    cityKey: 'manila',
    cityName: 'Metro Manila',
    searchKeywords: 'Metro Manila food promo restaurant new opening BGC Makati SM MOA Booky Spot ph 2026'
  }
];

// 備用高品質圖片庫（避免空圖）
const BACKUP_IMAGES = [
  "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=800&auto=format&fit=crop"
];

async function fetchCityNews(cityConfig) {
  console.log(`🔍 正在深挖 [${cityConfig.cityName}] 的即時美食新聞與優惠...`);

  const prompt = `你是一個專業的菲律賓美食特派員與社群情報專家。
請利用 Google 搜尋工具，為菲律賓「${cityConfig.cityName}」挖掘最新、真實的餐飲動態與限時優惠。

搜尋來源包含：
1. 當地商場與熱門商圈（如 SM Malls, Ayala Malls, 知名美食街/夜市）最新餐飲活動。
2. 菲律賓常見的連鎖品牌、外送平台促銷（GrabFood, Foodpanda）、銀行信用卡美食折扣（BPI, BDO, Metrobank）。
3. 近期新開幕、試營運（Soft Opening）或推出人氣新菜單的餐廳。

【硬性要求】：
- 請為 ${cityConfig.cityName} 提供至少 5 則高品質、最新的消息（混合「限時優惠 promo」與「新開餐廳 new」）。
- 嚴格輸出合法的 JSON Array，不要加任何 markdown 標籤（如 \`\`\`json）。
- 每筆物件格式必須嚴格包含以下欄位：
  {
    "city": "${cityConfig.cityKey}",
    "type": "promo" 或 "new",
    "brand": "餐廳或品牌名稱（如 Jollibee, Acacia Hotel, Starbucks）",
    "titles": {
      "zh-TW": "繁體中文標題",
      "en": "English Title",
      "tl": "Tagalog Pamagat"
    },
    "tags": {
      "zh-TW": "促銷標籤（例如：限時買一送一 / 新店登場）",
      "en": "English Tag (e.g. Buy 1 Take 1 / Grand Opening)",
      "tl": "Tagalog Tag (e.g. BOGO Promo / Bagong Bukas)"
    },
    "validity": {
      "zh-TW": "有效期限（例如：即日起至月底 / 試營運中）",
      "en": "Validity (e.g. Until end of month / Soft Opening)",
      "tl": "Bisa (e.g. Hanggang katapusan ng buwan)"
    },
    "descriptions": {
      "zh-TW": "約 40-70 字的中文活動細節介紹",
      "en": "English details description",
      "tl": "Tagalog detalye ng promo"
    },
    "location": "具體分店或商場地址（如 SM Lanang Premier, Davao）",
    "url": "官方活動網址、粉專或報導連結（若無請留空字串）",
    "imageUrl": "真實相片網址（若查無可用空字串）"
  }
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.2
      }
    });

    let text = response.text.trim();
    if (text.startsWith('```json')) text = text.slice(7);
    if (text.startsWith('```')) text = text.slice(3);
    if (text.endsWith('```')) text = text.slice(0, -3);
    text = text.trim();

    const items = JSON.parse(text);
    return Array.isArray(items) ? items : [];
  } catch (err) {
    console.warn(`⚠️ 抓取 [${cityConfig.cityName}] 失敗：`, err.message);
    return [];
  }
}

async function runAutoNews() {
  console.log("🚀 開始分城抓取菲律賓三大城市的美食情報...");

  let allCollectedNews = [];

  for (const config of CITY_CONFIGS) {
    const cityNews = await fetchCityNews(config);
    console.log(`   ✅ [${config.cityName}] 成功抓取到 ${cityNews.length} 則動態！`);
    allCollectedNews = allCollectedNews.concat(cityNews);
  }

  if (allCollectedNews.length === 0) {
    console.log("⚠️ 未能取得任何最新動態，略過更新。");
    return;
  }

  console.log(`📦 準備將全數 ${allCollectedNews.length} 則新聞更新至 Firestore...`);

  const batch = db.batch();

  allCollectedNews.forEach((item, index) => {
    const safeBrand = (item.brand || 'Food').replace(/[^a-zA-Z0-9]/g, '');
    const docId = `${item.city}_${safeBrand}_${Date.now()}_${index}`;
    const docRef = db.collection('news').doc(docId);

    // 補齊預設圖片
    if (!item.imageUrl || item.imageUrl.trim() === '') {
      item.imageUrl = BACKUP_IMAGES[index % BACKUP_IMAGES.length];
    }

    item.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    batch.set(docRef, item, { merge: true });
  });

  await batch.commit();
  console.log(`🎉 成功更新 ${allCollectedNews.length} 則全菲美食動態！`);
}

runAutoNews();
