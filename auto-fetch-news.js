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
      brand: "🔥 Metro Manila Deals",
      tag: "🔥 限時優惠",
      title: `馬尼拉最新外送與門市折扣 (${pastStr} ~ ${todayStr})`,
      url: "https://food.grab.com/ph/en/",
      validity: `有效期限至 ${todayStr}`,
      imageUrl: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&auto=format&fit=crop",
      descriptions: {
        "zh-TW": `涵蓋 ${pastStr} 至 ${todayStr}：BGC 與 Makati 熱門餐廳推出限時優惠碼，支援 GrabFood 與外帶自取。`,
        "en": `Metro Manila weekly food promos and GrabFood discounts valid until ${todayStr}.`,
        "tl": `Mga pinakabagong food promo at GrabFood discount sa Metro Manila hanggang ${todayStr}.`
      },
      location: "Metro Manila (BGC / Makati)"
    },
    {
      id: "news-promo-cebu",
      city: "cebu",
      type: "new",
      brand: "✨ Bagong Bukas sa Cebu",
      tag: "✨ 新開餐廳",
      title: `宿霧海邊新概念餐廳試營運 (${pastStr} ~ ${todayStr})`,
      url: "https://www.foodpanda.ph",
      validity: "長期試營運",
      imageUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop",
      descriptions: {
        "zh-TW": `統計 ${pastStr} 至 ${todayStr} 宿霧新開幕聚落：Mactan 海邊全新海鮮碳烤與輕食概念店。`,
        "en": `New dining spot and seaside restaurant opened in Cebu (${pastStr} - ${todayStr}).`,
        "tl": `Bagong bukas na kainan at tambayan sa tabing-dagat sa Cebu ngayong linggo.`
      },
      location: "Cebu City / Mactan"
    },
    {
      id: "news-promo-davao",
      city: "davao",
      type: "promo",
      brand: "🔥 Davao Food Specials",
      tag: "🔥 限時優惠",
      title: `達沃人氣美食與燒肉最新特惠 (${pastStr} ~ ${todayStr})`,
      url: "https://food.grab.com/ph/en/",
      validity: `有效期限至 ${todayStr}`,
      imageUrl: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&auto=format&fit=crop",
      descriptions: {
        "zh-TW": `達沃地區最新動態：Lanang 與 Matina 周邊餐廳推出套餐折扣與外送優惠。`,
        "en": `Davao local restaurant promos and discounts for this week.`,
        "tl": `Sulit food deals at mga promo sa Davao City ngayong linggo.`
      },
      location: "Lanang / Matina, Davao City"
    }
  ];
}

async function updateNewsData() {
  console.log("🤖【自動化系統】開始透過菲律賓英文與 Tagalog 檢索在地美食動態...");

  const todayObj = new Date();
  const pastObj = new Date();
  pastObj.setDate(todayObj.getDate() - 7);

  const todayStr = formatDate(todayObj);
  const pastStr = formatDate(pastObj);

  let newsItems = [];

  if (process.env.GEMINI_API_KEY) {
    try {
      console.log("🔍 正在使用 Philippine English 與 Tagalog 搜尋在地社群與新聞來源...");
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      // 提示詞明確要求以在地的 Philippine English 與 Tagalog/Taglish 關鍵詞搜尋
      const prompt = `You are a local food scout in the Philippines.
Perform live web searches using BOTH Philippine English and Tagalog (Filipino/Taglish) keywords (such as: 'bagong bukas na kainan', 'food promo Pilipinas', 'tipid food deals Manila Cebu Davao', 'new restaurant opening Philippines', 'sulit meals discount').
Search timeframe: Published between ${pastStr} and ${todayStr}.
Target locations: Manila, Cebu, and Davao.
Target local sources: Spot.ph, Booky.ph, When In Manila, SunStar Cebu/Davao, GrabFood/Foodpanda PH, and local PH food blogs.

Return EXACTLY 3 distinct items strictly formatted as a JSON array (no markdown code blocks, no backticks):
[
  {
    "id": "news-1",
    "city": "manila or cebu or davao",
    "type": "promo or new",
    "brand": "Brand / Category name (e.g. Jollibee, Local Spot, Inihaw Bar)",
    "tag": "🔥 限時優惠 (for promo) or ✨ 新開餐廳 (for new)",
    "title": "Title translated to Traditional Chinese (繁體中文)",
    "url": "Direct Philippine source URL or official promo link (e.g. spot.ph, booky.ph, foodpanda, grab)",
    "validity": "Valid date range or '長期試營運'",
    "imageUrl": "https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&auto=format&fit=crop",
    "descriptions": {
      "zh-TW": "繁體中文摘要說明",
      "en": "English description of the promo or new spot",
      "tl": "Maikling paglalarawan sa Tagalog tungkol sa promo o bagong kainan"
    },
    "location": "Local area/district (e.g. BGC Taguig, Mandaue Cebu, Matina Davao)"
  }
]`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      let rawText = response.text.trim();
      rawText = rawText.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
      newsItems = JSON.parse(rawText);
      console.log("✅ 成功透過菲律賓在地雙語檢索取得動態！");
    } catch (aiError) {
      console.warn("⚠️ AI 檢索觸發限制或連線問題，自動切換至備援資料：", aiError.message);
      newsItems = getFallbackNews(pastStr, todayStr);
    }
  } else {
    newsItems = getFallbackNews(pastStr, todayStr);
  }

  try {
    // 1. 清空舊資料
    const newsSnapshot = await db.collection('news').get();
    const batch = db.batch();
    newsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    console.log("🧹 已清空舊的動態資料。");

    // 2. 寫入最新動態
    const newBatch = db.batch();
    newsItems.forEach(item => {
      if (!item.id) {
        item.id = "news-" + Math.random().toString(36).substring(2, 9);
      }
      const docRef = db.collection('news').doc(item.id);
      item.timestamp = admin.firestore.FieldValue.serverTimestamp();
      newBatch.set(docRef, item);
    });
    await newBatch.commit();

    console.log(`✅【自動化系統】成功寫入涵蓋 ${pastStr} 至 ${todayStr} 的在地新聞與優惠！`);
  } catch (dbError) {
    console.error("❌ 寫入 Firestore 失敗：", dbError);
    process.exit(1);
  }
}

updateNewsData();
