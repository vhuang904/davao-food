const admin = require('firebase-admin');

// 初始化 Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function generateAutomatedNewsWithAI() {
  console.log("🤖【AI 自動化系統】正在透過聯網搜尋菲律賓最新美食新聞與優惠...");

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // 1. 透過 Gemini 聯網搜尋菲律賓當週最新餐飲促銷與新店資訊（更新為 gemini-3.6-flash）
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: `請搜尋並整理目前（2026年）菲律賓（包含 Manila、Cebu、Davao）各大連鎖餐飲或美食平台的最新真實優惠、促銷活動或新開餐廳。
請嚴格以 JSON 陣列格式回傳 3 筆資料，不要包在 Markdown code block 裡面，結構如下：
[
  {
    "id": "ai-news-1",
    "city": "manila 或 cebu 或 davao 或 all",
    "type": "promo 或 new",
    "brand": "品牌名稱或類別",
    "tag": "🔥 限時優惠 或 ✨ 新開餐廳",
    "title": "繁體中文標題",
    "url": "相關的真實官方或活動網站網址(若無則填 https://www.foodpanda.ph)",
    "validity": "有效期限或更新日期",
    "imageUrl": "https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&auto=format&fit=crop",
    "descriptions": {
      "zh-TW": "繁體中文詳細摘要",
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
    
    const newsItems = JSON.parse(rawText);

    // 2. 清空舊的 news 集合
    const newsSnapshot = await db.collection('news').get();
    const batch = db.batch();
    newsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    console.log("🧹 已清除舊的動態資料。");

    // 3. 寫入 AI 自動生成的真實動態
    const newBatch = db.batch();
    newsItems.forEach(item => {
      if (!item.id) item.id = "ai-news-" + Math.random().toString(36).substring(7);
      const docRef = db.collection('news').doc(item.id);
      item.timestamp = admin.firestore.FieldValue.serverTimestamp();
      newBatch.set(docRef, item);
    });
    await newBatch.commit();

    console.log("✅【AI 自動化系統】成功透過聯網搜尋取得並寫入最新美食動態！");
  } catch (error) {
    console.error("❌【AI 自動化系統】執行失敗：", error);
    process.exit(1);
  }
}

generateAutomatedNewsWithAI();
