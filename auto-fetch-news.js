const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

async function generateAutomatedNews() {
  console.log("🤖【自動化系統】開始更新前七天美食新聞與優惠...");

  try {
    const todayObj = new Date();
    const pastObj = new Date();
    pastObj.setDate(todayObj.getDate() - 7);

    const todayStr = formatDate(todayObj);
    const pastStr = formatDate(pastObj);
    
    // 1. 清空舊的 news 集合
    const newsSnapshot = `await db.collection('news').get();` // 確保乾淨重抓
    const batch = db.batch();
    newsSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    // 2. 建立多筆獨立且分類明確的動態（限時優惠 + 新開餐廳）
    const newsItems = [
      {
        id: "auto-promo-1",
        city: "all",
        type: "promo", // 歸類在限時優惠
        brand: "🔥 連鎖餐飲特惠",
        tag: "🔥 限時優惠",
        title: `本週全區外送與店內優惠總整理 (${pastStr} ~ ${todayStr})`,
        validity: `有效期限至 ${todayStr}`,
        imageUrl: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&auto=format&fit=crop",
        descriptions: {
          "zh-TW": `涵蓋 ${pastStr} 至 ${todayStr} 期間，各大連鎖餐廳（如 Jollibee、McDonald's、KFC）推出的最新外送折扣與 App 優惠碼。`,
          "en": `Weekly food promos and delivery discounts valid until ${todayStr}.`,
          "tl": `Mga promo sa pagkain na may bisang hanggang ${todayStr}.`
        },
        location: "全菲律賓指定門市與線上 App"
      },
      {
        id: "auto-new-1",
        city: "davao",
        type: "new", // 歸類在新開餐廳
        brand: "✨ 達沃新據點",
        tag: "✨ 新開餐廳",
        title: `達沃本週新進駐人氣餐飲品牌 (${pastStr} ~ ${todayStr})`,
        validity: "長期試營運",
        imageUrl: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&auto=format&fit=crop",
        descriptions: {
          "zh-TW": `統計 ${pastStr} 至 ${todayStr} 於達沃市全新開幕的特色餐廳與燒肉、咖啡輕食據點，邀請玩家搶先嚐鮮！`,
          "en": `New restaurant openings and dining spots in Davao this week (${pastStr} - ${todayStr}).`,
          "tl": `Mga bagong bukas na kainan sa Davao ngayong linggo.`
        },
        location: "Davao City 核心商圈"
      }
    ];

    const newBatch = db.batch();
    newsItems.forEach(item => {
      const docRef = db.collection('news').doc(item.id);
      item.timestamp = admin.firestore.FieldValue.serverTimestamp();
      newBatch.set(docRef, item);
    });
    await newBatch.commit();

    console.log("✅【自動化系統】成功寫入前七天限時優惠與新開餐廳動態！");
  } catch (error) {
    console.error("❌【自動化系統】執行失敗：", error);
    process.exit(1);
  }
}

generateAutomatedNews();
