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
  console.log("🤖【自動化系統】開始更新跨城市美食新聞與優惠（修正活動連結）...");

  try {
    const todayObj = new Date();
    const pastObj = new Date();
    pastObj.setDate(todayObj.getDate() - 7);

    const todayStr = formatDate(todayObj);
    const pastStr = formatDate(pastObj);
    
    // 1. 清空舊的 news 集合
    const newsSnapshot = await db.collection('news').get();
    const batch = db.batch();
    newsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    // 2. 建立精確導向活動與官網的網址
    const newsItems = [
      {
        id: "auto-promo-manila",
        city: "manila",
        type: "promo",
        brand: "🔥 馬尼拉熱門優惠",
        tag: "🔥 限時優惠",
        title: `馬尼拉都會區本週精選餐飲外送與折扣 (${pastStr} ~ ${todayStr})`,
        url: "https://food.grab.com/ph/en/", // 指向 GrabFood 菲律賓官網
        validity: `有效期限至 ${todayStr}`,
        imageUrl: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&auto=format&fit=crop",
        descriptions: {
          "zh-TW": `馬尼拉地區本週精選：BGC 與 Makati 商圈各大餐廳聯手推出線上訂餐最高折抵優惠，適用於 GrabFood 與門市外帶。`,
          "en": `Metro Manila weekly dining promos and delivery discounts valid until ${todayStr}.`,
          "tl": `Mga promo sa pagkain sa Metro Manila hanggang ${todayStr}.`
        },
        location: "Metro Manila (BGC / Makati)"
      },
      {
        id: "auto-promo-cebu",
        city: "cebu",
        type: "new",
        brand: "✨ 宿霧海鮮新據點",
        tag: "✨ 新開餐廳",
        title: `宿霧 Mactan 海邊全新餐飲概念店試營運 (${pastStr} ~ ${todayStr})`,
        url: "https://www.foodpanda.ph", // 指向 Foodpanda 菲律賓官網
        validity: "長期試營運",
        imageUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop",
        descriptions: {
          "zh-TW": `宿霧地區本週焦點：Mactan 島全新開幕的海鮮碳烤與日式料理概念店，主打新鮮碳烤大蝦與海景用餐體驗。`,
          "en": `New seaside dining spot opened in Mactan, Cebu this week.`,
          "tl": `Bagong bukas na kainan sa Mactan, Cebu ngayong linggo.`
        },
        location: "Mactan Island Promenade, Cebu"
      },
      {
        id: "auto-promo-davao",
        city: "davao",
        type: "promo",
        brand: "🔥 達沃在地特惠",
        tag: "🔥 限時優惠",
        title: `達沃人氣燒肉與在地美食本週特惠 (${pastStr} ~ ${todayStr})`,
        url: "https://www.facebook.com/groups/davaofoodclub", // 指向具體的達沃美食社群或相關活動頁面
        validity: `有效期限至 ${todayStr}`,
        imageUrl: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&auto=format&fit=crop",
        descriptions: {
          "zh-TW": `達沃地區本週焦點：Matina 與 Abreeza 商圈周邊人氣餐廳推出憑地圖畫面享專屬折扣活動。`,
          "en": `Davao local restaurant promos and discounts for this week.`,
          "tl": `Mga espesyal na promo sa Davao ngayong linggo.`
        },
        location: "Matina / Abreeza, Davao City"
      }
    ];

    const newBatch = db.batch();
    newsItems.forEach(item => {
      const docRef = db.collection('news').doc(item.id);
      item.timestamp = admin.firestore.FieldValue.serverTimestamp();
      newBatch.set(docRef, item);
    });
    await newBatch.commit();

    console.log("✅【自動化系統】成功寫入更新後的網址！");
  } catch (error) {
    console.error("❌【自動化系統】執行失敗：", error);
    process.exit(1);
  }
}

generateAutomatedNews();
