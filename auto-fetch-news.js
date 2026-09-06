const admin = require('firebase-admin');

// 初始化 Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function getFallbackNews(pastStr, todayStr) {
  return [
    {
      id: "news-promo-manila",
      city: "manila",
      type: "promo",
      brand: "🔥 馬尼拉熱門優惠",
      tag: "🔥 限時優惠",
      title: `馬尼拉都會區精選外送與門市折扣 (${pastStr} ~ ${todayStr})`,
      url: "https://food.grab.com/ph/en/",
      validity: `有效期限至 ${todayStr}`,
      imageUrl: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&auto=format&fit=crop",
      descriptions: {
        "zh-TW": `涵蓋 ${pastStr} 至 ${todayStr}：BGC、Makati 及 Ortigas 商圈熱門連鎖餐飲推出線上訂餐最高折抵優惠，支援 GrabFood 與門市自取。`,
        "en": `Metro Manila weekly dining promos and delivery discounts valid until ${todayStr}.`,
        "tl": `Mga promo sa pagkain sa Metro Manila hanggang ${todayStr}.`
      },
      location: "Metro Manila (BGC / Makati / Ortigas)"
    },
    {
      id: "news-promo-cebu",
      city: "cebu",
      type: "new",
      brand: "✨ 宿霧特色新店",
      tag: "✨ 新開餐廳",
      title: `宿霧海邊景觀餐飲概念據點試營運 (${pastStr} ~ ${todayStr})`,
      url: "https://www.foodpanda.ph",
      validity: "長期試營運",
      imageUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop",
      descriptions: {
        "zh-TW": `統計 ${pastStr} 至 ${todayStr} 宿霧地區新進駐熱點：Mactan 與 Cebu City 核心區全新海鮮碳烤與輕食概念店，提供打卡與外送服務。`,
        "en": `New seaside and city dining spots opened in Cebu this week (${pastStr} - ${todayStr}).`,
        "tl": `Mga bagong bukas na kainan sa Cebu ngayong linggo.`
      },
      location: "Cebu City / Mactan"
    },
    {
      id: "news-promo-davao",
      city: "davao",
      type: "promo",
      brand: "🔥 達沃在地特惠",
      tag: "🔥 限時優惠",
      title: `達沃在地燒肉與人氣美食週報 (${pastStr} ~ ${todayStr})`,
      url: "https://food.grab.com/ph/en/",
      validity: `有效期限至 ${todayStr}`,
      imageUrl: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&auto=format&fit=crop",
      descriptions: {
        "zh-TW": `達沃地區最新動態：Lanang 與 Matina 周邊人氣餐廳提供外送專屬折扣與指定套餐組合，適用期間為 ${pastStr} 至 ${todayStr}。`,
        "en": `Davao local restaurant promos and delivery discounts for this week.`,
        "tl": `Mga promo sa pagkain sa Davao ngayong linggo.`
      },
      location: "Lanang / Matina, Davao City"
    }
  ];
}

async function updateNewsData() {
  console.log("🤖【自動化系統】開始更新跨城市美食新聞與優惠...");

  const todayObj = new Date();
  const pastObj = new Date();
  pastObj.setDate(todayObj.getDate() - 7);

  const todayStr = formatDate(todayObj);
  const pastStr = formatDate(pastObj);

  let newsItems = [];

  // 嘗試透過 Gemini AI 進行即時聯網更新
  if (process.env.GEMINI_API_KEY) {
    try {
      console.log("🔍 正在嘗試使用 Gemini 進行聯網檢索...");
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: `請搜尋並整理目前（2026年）菲律賓（包含 Manila、Cebu、Davao）各大餐飲平台的真實優惠或新開餐廳。
請嚴格以 JSON 陣列格式回傳 3 筆資料，不要使用 Markdown code block：
[
  {
    "id": "ai-news-1",
    "city": "manila",
    "type": "promo",
    "brand": "品牌名稱",
    "tag": "🔥 限時優惠",
    "title": "繁體中文標題",
    "url": "https://food.grab.com/ph/en/",
    "validity": "有效期限至 ${todayStr}",
    "imageUrl": "https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&auto=format&fit=crop",
    "descriptions": {
      "zh-TW": "繁體中文摘要",
      "en": "English description",
      "tl": "Tagalog description"
    },
    "location": "地點說明"
  }
]`,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      let rawText = response.text.trim();
      rawText = rawText.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
      newsItems = JSON.parse(rawText);
      console.log("✅ AI 聯網檢索成功！");
    } catch (aiError) {
      console.warn("⚠️ AI 檢索觸發配額限制或連線錯誤，自動切換至備援資料庫：", aiError.message);
      newsItems = getFallbackNews(pastStr, todayStr);
    }
  } else {
    newsItems = getFallbackNews(pastStr, todayStr);
  }

  try {
    // 清空舊資料
    const newsSnapshot = await db.collection('news').get();
    const batch = db.batch();
    newsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    console.log("🧹 已清除舊的動態資料。");

    // 寫入最新動態
    const newBatch = db.batch();
    newsItems.forEach(item => {
      if (!item.id) item.id = "news-" + Math.random().toString(36).substring(7);
      const docRef = db.collection('news').doc(item.id);
      item.timestamp = admin.firestore.FieldValue.serverTimestamp();
      newBatch.set(docRef, item);
    });
    await newBatch.commit();

    console.log(`✅【自動化系統】成功寫入覆蓋 ${pastStr} 至 ${todayStr} 的最新動態！`);
  } catch (dbError) {
    console.error("❌ Firestore 寫入失敗：", dbError);
    process.exit(1);
  }
}

updateNewsData();
