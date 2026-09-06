const admin = require('firebase-admin');

// 從 GitHub Secret 讀取金鑰
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 這裡我們帶入你剛才整理好的全部餐廳資料
const restaurantsData = [
  { city: "davao", name: "Yaki2gether by kyoto", categoryKey: "japanese_korean", address: "Fronting, SM City Davao, Quimpo Blvd, Talomo, Davao City, 8000 Davao del Sur, Philippines", phone: "查看 Google 地圖專線", grabUrl: "https://food.grab.com/ph/en/", foodpandaUrl: "https://www.foodpanda.ph/", description_zh: "Google 地圖評分 ⭐ 4.9 (533)。位於 DAVAO 的熱門日韓燒肉首選店家。" },
  { city: "davao", name: "Jollibee (SM City Davao)", categoryKey: "fast_food", address: "SM City Davao, Quimpo Blvd, Talomo, Davao City, Philippines", phone: "+63 82 297 1234", grabUrl: "https://food.grab.com/ph/en/", foodpandaUrl: "https://www.foodpanda.ph/", description_zh: "菲律賓國民快樂蜂炸雞！位於達沃 SM City Davao 商場內的分店。" },
  { city: "davao", name: "Jollibee (Abreeza Mall Davao)", categoryKey: "fast_food", address: "Abreeza Mall, J.P. Laurel Ave, Davao City, Philippines", phone: "+63 82 321 1234", grabUrl: "https://food.grab.com/ph/en/", foodpandaUrl: "https://www.foodpanda.ph/", description_zh: "逛 Abreeza Mall 時享用酥脆 Chickenjoy 與肉汁白飯的最佳選擇。" },
  { city: "davao", name: "McDonald's (Quimpo Blvd Davao)", categoryKey: "fast_food", address: "Quimpo Blvd, Matina, Davao City, Philippines", phone: "+63 82 297 5678", grabUrl: "https://food.grab.com/ph/en/", foodpandaUrl: "https://www.foodpanda.ph/", description_zh: "位於達沃 Quimpo Blvd 的 24小時麥當勞與McCafé據點。" },
  { city: "davao", name: "KFC (SM Lanang Premier Davao)", categoryKey: "fast_food", address: "SM Lanang Premier, J.P. Laurel Ave, Davao City, Philippines", phone: "+63 82 285 1111", grabUrl: "https://food.grab.com/ph/en/", foodpandaUrl: "https://www.foodpanda.ph/", description_zh: "酥脆原味炸雞與 Zinger 漢堡，位於 SM Lanang Premier。" },
  { city: "davao", name: "Pizza Hut (Abreeza Mall Davao)", categoryKey: "fast_food", address: "Abreeza Mall, J.P. Laurel Ave, Davao City, Philippines", phone: "+63 82 321 4444", grabUrl: "https://food.grab.com/ph/en/", foodpandaUrl: "https://www.foodpanda.ph/", description_zh: "提供美味手拍披薩、義大利麵與超值雙人午餐套餐。" },
  { city: "davao", name: "Starbucks (Abreeza Mall Davao)", categoryKey: "coffee_drinks", address: "Abreeza Mall, J.P. Laurel Ave, Davao City, Philippines", phone: "+63 82 321 9999", grabUrl: "https://food.grab.com/ph/en/", foodpandaUrl: "https://www.foodpanda.ph/", description_zh: "達沃人氣星巴克分店，環境舒適，品嚐拿鐵與季節特調咖啡的好去處。" },
  { city: "davao", name: "Starbucks (SM Lanang Premier Davao)", categoryKey: "coffee_drinks", address: "SM Lanang Premier, J.P. Laurel Ave, Davao City, Philippines", phone: "+63 82 285 8888", grabUrl: "https://food.grab.com/ph/en/", foodpandaUrl: "https://www.foodpanda.ph/", description_zh: "位於 SM Lanang 噴泉廣場旁的星巴克，戶外與室內座位舒適。" },
  { city: "davao", name: "PICKUP COFFEE (Roxas Ave Davao)", categoryKey: "coffee_drinks", address: "Roxas Ave, Davao City, Philippines", phone: "+63 917 555 0000", grabUrl: "https://food.grab.com/ph/en/", foodpandaUrl: "https://www.foodpanda.ph/", description_zh: "菲律賓超人氣平價外帶咖啡連鎖，拿鐵與特色手搖冰飲香醇順口。" },
  { city: "manila", name: "Jollibee (Greenbelt Makati Manila)", categoryKey: "fast_food", address: "Greenbelt 1, Legaspi Village, Makati City, Metro Manila, Philippines", phone: "+63 2 812 1234", grabUrl: "https://food.grab.com/ph/en/", foodpandaUrl: "https://www.foodpanda.ph/", description_zh: "位於馬尼拉 Makati 商業核心區 Greenbelt 的 Jollibee 分店。" },
  { city: "manila", name: "McDonald's (BGC High Street Manila)", categoryKey: "fast_food", address: "Bonifacio High Street, Taguig, Metro Manila, Philippines", phone: "+63 2 856 5678", grabUrl: "https://food.grab.com/ph/en/", foodpandaUrl: "https://www.foodpanda.ph/", description_zh: "位於 BGC 步行街的旗艦麥當勞，環境摩登舒適。" },
  { city: "manila", name: "Starbucks Reserve (Alabang Town Center Manila)", categoryKey: "coffee_drinks", address: "Alabang Town Center, Muntinlupa, Metro Manila, Philippines", phone: "+63 2 842 9999", grabUrl: "https://food.grab.com/ph/en/", foodpandaUrl: "https://www.foodpanda.ph/", description_zh: "馬尼拉精選星巴克典藏門市，提供頂級手沖咖啡與精緻烘焙點心。" },
  { city: "cebu", name: "Jollibee (Ayala Center Cebu)", categoryKey: "fast_food", address: "Ayala Center Cebu, Cardinal Rosales Ave, Cebu City, Philippines", phone: "+63 32 231 1234", grabUrl: "https://food.grab.com/ph/en/", foodpandaUrl: "https://www.foodpanda.ph/", description_zh: "宿霧市中心 Ayala Center 內的超人氣 Jollibee 分店。" },
  { city: "cebu", name: "Starbucks (SM City Cebu)", categoryKey: "coffee_drinks", address: "SM City Cebu, North Reclamation Area, Cebu City, Philippines", phone: "+63 32 232 8888", grabUrl: "https://food.grab.com/ph/en/", foodpandaUrl: "https://www.foodpanda.ph/", description_zh: "宿霧 SM City Cebu 的熱鬧星巴克，逛街歇息的最佳去處。" },
  // ...你可以把其餘幾十家傳統餐廳加入這裡，或者未來透過腳本自動從 Google Sheets 撈取
];

async function syncData() {
  const batch = db.batch();
  
  for (const item of restaurantsData) {
    // 建立一個穩定的 Document ID（以城市 + 店名拼音組合）
    const docId = `${item.city}_${item.name.replace(/[^a-zA-Z0-9]/g, '')}`;
    const docRef = db.collection('restaurants').doc(docId);
    batch.set(docRef, item);
  }

  await batch.commit();
  console.log(`成功同步 ${restaurantsData.length} 筆餐廳資料到 Firestore！`);
}

syncData().catch(console.error);
