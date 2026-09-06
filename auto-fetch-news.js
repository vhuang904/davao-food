const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function generateAutomatedNews() {
  console.log("🤖【自動化系統】開始執行美食新聞與優惠自動更新...");

  try {
    const today = new Date().toISOString().split('T')[0];
    
    const automatedNewsItem = {
      id: "auto-news-" + Date.now(),
      city: "all",
      type: "promo",
      brand: "🔥 系統自動精選",
      tag: "🔥 AI 即時快報",
      title: "菲律賓本週美食快報：各大連鎖餐飲最新外送與店內優惠總整理",
      validity: `更新於 ${today}`,
      imageUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop",
      descriptions: {
        "zh-TW": `系統自動檢索於 ${today} 更新：達沃、馬尼拉與宿霧地區各大餐飲品牌（包含 Jollibee、McDonald's、KFC 等）本週推出全新線上訂餐優惠碼，建議透過官方 App 享有最高折抵。`,
        "en": `Automated update for ${today}: Check out the latest food promos and delivery discounts across major Philippines cities this week.`,
        "tl": `Awtomatikong update ngayong ${today}: Tingnan ang mga pinakabagong promo at diskwento sa pagkain.`
      },
      location: "全菲律賓指定門市與線上 App",
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = db.collection('news').doc(automatedNewsItem.id);
    await docRef.set(automatedNewsItem);

    console.log("✅【自動化系統】成功自動生成並寫入一筆最新美食動態到 Firebase！");
  } catch (error) {
    console.error("❌【自動化系統】執行失敗：", error);
    process.exit(1);
  }
}

generateAutomatedNews();
