const admin = require('firebase-admin');

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
      tags: {
        "zh-TW": "🔥 限時優惠",
        "en": "🔥 Limited Deal",
        "tl": "🔥 Limitadong Promo"
      },
      titles: {
        "zh-TW": `馬尼拉最新外送與門市折扣 (${pastStr} ~ ${todayStr})`,
        "en": `Metro Manila Delivery & Dining Deals (${pastStr} - ${todayStr})`,
        "tl": `Mga Promo sa Pagkain sa Metro Manila (${pastStr} - ${todayStr})`
      },
      url: "https://food.grab.com/ph/en/",
      validity: {
        "zh-TW": `有效期限至 ${todayStr}`,
        "en": `Valid until ${todayStr}`,
        "tl": `May bisang hanggang ${todayStr}`
      },
      imageUrl: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&auto=format&fit=crop",
      descriptions: {
        "zh-TW": `涵蓋 ${pastStr} 至 ${todayStr}：BGC 與 Makati 熱門餐廳推出限時優惠碼，支援 GrabFood 與外帶自取。`,
        "en": `Weekly food promos and GrabFood discounts in BGC and Makati valid until ${todayStr}.`,
        "tl": `Mga pinakabagong food promo at GrabFood discount sa BGC at Makati hanggang ${todayStr}.`
      },
      location: "Metro Manila (BGC / Makati)"
    },
    {
      id: "news-promo-cebu",
      city: "cebu",
      type: "new",
      brand: "✨ Cebu Food Crawl",
      tags: {
        "zh-TW": "✨ 新開餐廳",
        "en": "✨ New Opening",
        "tl": "✨ Bagong Bukas"
      },
      titles: {
        "zh-TW": `宿霧海邊新概念餐廳試營運 (${pastStr} ~ ${todayStr})`,
        "en": `New Seaside Concept Dining Spots in Cebu (${pastStr} - ${todayStr})`,
        "tl": `Bagong Bukas na Kainan sa Tabing-dagat sa Cebu (${pastStr} - ${todayStr})`
      },
      url: "https://www.foodpanda.ph",
      validity: {
        "zh-TW": "長期試營運",
        "en": "Soft Opening",
        "tl": "Kasalukuyang Bukas"
      },
      imageUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop",
      descriptions: {
        "zh-TW": `統計 ${pastStr} 至 ${todayStr} 宿霧新開幕聚落：Mactan 海邊全新海鮮碳烤與輕食概念店。`,
        "en": `New dining spot and seaside restaurant opened in Mactan, Cebu (${pastStr} - ${todayStr}).`,
        "tl": `Bagong bukas na kainan at tambayan sa tabing-dagat sa Mactan, Cebu ngayong linggo.`
      },
      location: "Cebu City / Mactan"
    },
    {
      id: "news-promo-davao",
      city: "davao",
      type: "promo",
      brand: "🔥 Davao Food Specials",
      tags: {
        "zh-TW": "🔥 限時優惠",
        "en": "🔥 Limited Deal",
        "tl": "🔥 Limitadong Promo"
      },
      titles: {
        "zh-TW": `達沃人氣美食與燒肉最新特惠 (${pastStr} ~ ${todayStr})`,
        "en": `Davao BBQ & Dining Specials (${pastStr} - ${todayStr})`,
        "tl": `Davao Inihaw at Sulit Food Deals (${pastStr} - ${todayStr})`
      },
      url: "https://food.grab.com/ph/en/",
      validity: {
        "zh-TW": `有效期限至 ${todayStr}`,
        "en": `Valid until ${todayStr}`,
        "tl": `May bisang hanggang ${todayStr}`
      },
      imageUrl: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&auto=format&fit=crop",
      descriptions: {
        "zh-TW": `達沃地區最新動態：Lanang 與 Matina 周邊餐廳推出套餐折扣與外送優惠。`,
        "en": `Davao local restaurant promos and GrabFood discounts for this week.`,
        "tl": `Sulit food deals at mga promo sa Davao City ngayong linggo.`
      },
      location: "Lanang / Matina, Davao City"
    }
  ];
}

async function updateNewsData() {
  console.log("🤖【自動化系統】開始更新跨城市美食新聞與優惠（含完整多語系支援）...");

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

      const prompt = `You are a local food journalist in the Philippines.
Perform live web searches using Philippine English and Tagalog keywords ('bagong bukas na kainan', 'food promo Pilipinas', 'tipid food deals', 'restaurant opening').
Timeframe: Between ${pastStr} and ${todayStr}.
Target locations: Manila, Cebu, and Davao.
Target sources: Spot.ph, Booky.ph, When In Manila, SunStar, GrabFood PH, Foodpanda PH.

Return EXACTLY 3 distinct items strictly formatted as a JSON array (no markdown code blocks):
[
  {
    "id": "news-1",
    "city": "manila or cebu or davao",
    "type": "promo or new",
    "brand": "Brand / Category name",
    "tags": {
      "zh-TW": "🔥 限時優惠 (or ✨ 新開餐廳)",
      "en": "🔥 Limited Deal (or ✨ New Opening)",
      "tl": "🔥 Limitadong Promo (or ✨ Bagong Bukas)"
    },
    "titles": {
      "zh-TW": "繁體中文標題",
      "en": "English title",
      "tl": "Tagalog title"
    },
    "url": "Direct Philippine source URL or promo page",
    "validity": {
      "zh-TW": "有效期限或營業說明",
      "en": "Validity or Soft Opening",
      "tl": "Petsa o Kasalukuyang Bukas"
    },
    "imageUrl": "https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&auto=format&fit=crop",
    "descriptions": {
      "zh-TW": "繁體中文詳細說明",
      "en": "English detailed description",
      "tl": "Tagalog detailed description"
    },
    "location": "Local area/district"
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
      console.log("✅ 成功透過在地檢索生成多語系新聞！");
    } catch (aiError) {
      console.warn("⚠️ AI 檢索觸發限制，啟用備援多語系資料庫：", aiError.message);
      newsItems = getFallbackNews(pastStr, todayStr);
    }
  } else {
    newsItems = getFallbackNews(pastStr, todayStr);
  }

  try {
    const newsSnapshot = await db.collection('news').get();
    const batch = db.batch();
    newsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();

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

    console.log(`✅【自動化系統】成功寫入多語系新聞資料！`);
  } catch (dbError) {
    console.error("❌ 寫入 Firestore 失敗：", dbError);
    process.exit(1);
  }
}

updateNewsData();
