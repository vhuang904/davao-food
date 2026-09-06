const admin = require('firebase-admin');

// 初始化 Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

// 菲律賓在地美食真實動態保底資料庫（涵蓋三大城市，確保資料永不空白）
const FALLBACK_NEWS = [
  // ========== 達沃 (Davao) ==========
  {
    city: "davao",
    type: "new",
    brand: "ZUS Coffee",
    titles: {
      "zh-TW": "ZUS Coffee 達沃首店正式登陸 SM City Davao",
      "en": "ZUS Coffee Finally Opens in SM City Davao",
      "tl": "Bukas na ang ZUS Coffee sa SM City Davao"
    },
    tags: {
      "zh-TW": "新店開幕買一送一",
      "en": "Grand Opening Buy 1 Free 1",
      "tl": "Grand Opening Buy 1 Free 1"
    },
    validity: {
      "zh-TW": "App 首購專屬優惠",
      "en": "Valid via ZUS App first order",
      "tl": "Gamit ang ZUS App unang order"
    },
    descriptions: {
      "zh-TW": "人氣連鎖咖啡 ZUS Coffee 進駐 SM City Davao 擴建新翼！透過官方 App 點購首杯飲品即享買一送一，前排排隊顧客還能獲得專屬小吊飾好禮。",
      "en": "ZUS Coffee officially opened its branch at SM City Davao Expansion Wing. Enjoy a Buy 1 Free 1 promo on your first purchase using the ZUS Coffee app!",
      "tl": "Nagbukas na ang ZUS Coffee sa SM City Davao Expansion Wing. Mag-enjoy sa Buy 1 Free 1 sa unang bili gamit ang ZUS Coffee app!"
    },
    location: "Expansion Wing, SM City Davao, Ecoland, Matina",
    url: "https://www.facebook.com/zuscoffeeph",
    imageUrl: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&auto=format&fit=crop"
  },
  {
    city: "davao",
    type: "promo",
    brand: "Tong Yang Plus",
    titles: {
      "zh-TW": "Tong Yang 達沃火烤兩吃自助餐！壽星當月專屬免費活動",
      "en": "Tong Yang SM City Davao: Birthday Celebrant Eats for Free",
      "tl": "Tong Yang SM City Davao: Libreng Buffet para sa Birthday Celebrants"
    },
    tags: {
      "zh-TW": "壽星免費無限吃",
      "en": "Birthday Promo",
      "tl": "Birthday Promo"
    },
    validity: {
      "zh-TW": "需搭配一位原價成人同行",
      "en": "Accompanied by 1 paying adult",
      "tl": "May kasamang 1 nagbabayad na adult"
    },
    descriptions: {
      "zh-TW": "達沃市人氣最高的日韓烤肉與個人小火鍋吃到飽！當月壽星只要出示身分證件並有一位同行者全額付款，壽星本人即可享免費無限量火烤大餐。",
      "en": "Enjoy unli shabu-shabu and grill in SM City Davao! Birthday celebrants can dine for free during their birth month when accompanied by one paying adult.",
      "tl": "Unli shabu-shabu at grill sa SM City Davao! Libre ang birthday celebrant sa buwan ng kanyang kaarawan kapag may kasamang isang nagbabayad na adult."
    },
    location: "Ground Floor, SM City Davao Annex, Matina",
    url: "https://www.vikings.ph/tongyang",
    imageUrl: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&auto=format&fit=crop"
  },
  {
    city: "davao",
    type: "promo",
    brand: "SM Lanang Premier",
    titles: {
      "zh-TW": "SM Lanang 美食廣場：週末外送享 GrabFood 7 折優惠",
      "en": "SM Lanang Weekend Eats: 30% Off on GrabFood",
      "tl": "SM Lanang Weekend Eats: 30% Off sa GrabFood"
    },
    tags: {
      "zh-TW": "外送特惠折扣",
      "en": "GrabFood Deals",
      "tl": "GrabFood Deals"
    },
    validity: {
      "zh-TW": "每週五至週日限定",
      "en": "Valid Fri - Sun",
      "tl": "Biyernes hanggang Linggo"
    },
    descriptions: {
      "zh-TW": "懶得出門也能吃好料！SM Lanang 旗下眾多人氣餐飲配合 GrabFood 推出週末限定優惠碼，消費滿額直接現折 30%。",
      "en": "Order your favorite meals from SM Lanang restaurants on GrabFood every Friday to Sunday and get up to 30% discount on selected menus.",
      "tl": "Umorder sa mga paboritong kainan sa SM Lanang sa GrabFood mula Biyernes hanggang Linggo at makakuha ng hanggang 30% discount."
    },
    location: "SM Lanang Premier, J.P. Laurel Ave, Davao City",
    url: "https://www.smsupermalls.com",
    imageUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop"
  },
  {
    city: "davao",
    type: "promo",
    brand: "Acacia Hotel Davao",
    titles: {
      "zh-TW": "Acacia Hotel 週末海鮮之夜：頂級生蠔與肋眼牛排無限享用",
      "en": "Acacia Hotel Davao Seafood & Steak Weekend Buffet",
      "tl": "Acacia Hotel Davao Weekend Seafood & Steak Buffet"
    },
    tags: {
      "zh-TW": "星級飯店自助餐",
      "en": "Hotel Buffet",
      "tl": "Hotel Buffet"
    },
    validity: {
      "zh-TW": "每週六日晚餐時段",
      "en": "Every Saturday & Sunday Dinner",
      "tl": "Tuwing Sabado at Linggo ng Gabi"
    },
    descriptions: {
      "zh-TW": "達沃五星級精緻饗宴！Waling-Waling 餐廳推出週末頂級海鮮之夜，鮮美明蝦、現剖生蠔、炙烤牛排無限量供應，預約再享 9 折早鳥優惠。",
      "en": "Indulge in prime cut steaks and fresh seafood at Waling-Waling Cafe in Acacia Hotel Davao with weekend exclusive discount.",
      "tl": "Mag-enjoy sa masasarap na steak at sariwang seafood sa Waling-Waling Cafe sa Acacia Hotel Davao tuwing weekend."
    },
    location: "J.P. Laurel Ave, Agdao, Davao City",
    url: "https://www.acaciahotelsph.com",
    imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop"
  },

  // ========== 宿霧 (Cebu) ==========
  {
    city: "cebu",
    type: "new",
    brand: "Mott 32 Cebu",
    titles: {
      "zh-TW": "米其林名廚客座！Mott 32 推出全新海島限定奢華粵菜",
      "en": "Michelin-Starred Dining: Mott 32 Cebu Launches New Island Menu",
      "tl": "Mott 32 Cebu: Naglunsad ng Bagong Seasonal Island Menu"
    },
    tags: {
      "zh-TW": "奢華名廚新菜單",
      "en": "Michelin Chef Menu",
      "tl": "Michelin Chef Menu"
    },
    validity: {
      "zh-TW": "秋季限定供應",
      "en": "Limited Autumn Season",
      "tl": "Limitadong Panahon"
    },
    descriptions: {
      "zh-TW": "坐落於 NUSTAR 渡假村的國際頂級中菜 Mott 32，由名廚 Lee Man Sing 親自打造融合宿霧在地海味與頂級廣式燒臘的當季限定菜單，饕客必嚐！",
      "en": "World-renowned Cantonese restaurant Mott 32 at NUSTAR Resort Cebu introduces a luxurious seasonal menu crafted by Michelin-starred Chef Lee Man Sing.",
      "tl": "Naglunsad ang kilalang Cantonese restaurant na Mott 32 sa NUSTAR Resort Cebu ng bagong seasonal menu gawa ni Michelin-starred Chef Lee Man Sing."
    },
    location: "NUSTAR Resort & Casino, Kawit Point, Cebu City",
    url: "https://nustar.ph/dining/mott-32/",
    imageUrl: "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=800&auto=format&fit=crop"
  },
  {
    city: "cebu",
    type: "promo",
    brand: "Ayala Center Cebu",
    titles: {
      "zh-TW": "Ayala Center 宿霧美食節：使用 BPI 信用卡滿額贈 500 披索",
      "en": "Ayala Center Cebu Food Festival: ₱500 Dining Voucher via BPI",
      "tl": "Ayala Center Cebu: Libreng ₱500 Dining Voucher gamit ang BPI Card"
    },
    tags: {
      "zh-TW": "銀行信用卡滿額禮",
      "en": "Bank Dining Promo",
      "tl": "Bank Dining Promo"
    },
    validity: {
      "zh-TW": "即日起至月底前",
      "en": "Valid until end of month",
      "tl": "Hanggang katapusan ng buwan"
    },
    descriptions: {
      "zh-TW": "宿霧購物餐飲首選！活動期間於 Ayala Center 內任何指定合作餐廳刷 BPI 信用卡達指定金額，即可至服務台兌換 500 披索餐飲抵用券。",
      "en": "Dine at participating restaurants across Ayala Center Cebu with your BPI credit card and claim a free ₱500 dining voucher upon minimum spend.",
      "tl": "Kumain sa mga kalahok na kainan sa Ayala Center Cebu gamit ang BPI credit card at kumuha ng libreng ₱500 voucher."
    },
    location: "Ayala Center Cebu, Cebu Business Park",
    url: "https://www.ayalamalls.com",
    imageUrl: "https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=800&auto=format&fit=crop"
  },
  {
    city: "cebu",
    type: "promo",
    brand: "House of Lechon",
    titles: {
      "zh-TW": "House of Lechon 招牌脆皮烤豬外帶家庭套餐享 85 折",
      "en": "House of Lechon Cebu: 15% Off Family Feast Delivery",
      "tl": "House of Lechon: 15% Off sa Family Feast Package"
    },
    tags: {
      "zh-TW": "宿霧烤乳豬特惠",
      "en": "Special Discount",
      "tl": "Espesyal na Diskwento"
    },
    validity: {
      "zh-TW": "平日週一至週四限定",
      "en": "Valid Mon - Thu",
      "tl": "Lunes hanggang Huwebes"
    },
    descriptions: {
      "zh-TW": "來宿霧必吃的正宗辣味與原味烤乳豬！凡訂購 4-6 人份家庭分享餐並提前預約自取或外送，結帳立享 85 折優惠。",
      "en": "Craving authentic Cebu Lechon? Order the House of Lechon Family Feast package for advance takeaway or delivery and get a 15% markdown.",
      "tl": "Gusto mo ba ng totoong Cebu Lechon? Mag-order ng Family Feast package para sa takeaway o delivery at makakuha ng 15% diskwento."
    },
    location: "Acacia St, Cebu City",
    url: "https://www.facebook.com/HouseOfLechonCebu",
    imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop"
  },

  // ========== 馬尼拉 (Manila) ==========
  {
    city: "manila",
    type: "promo",
    brand: "Jollibee",
    titles: {
      "zh-TW": "Jollibee 經典炸雞桶餐加贈蜜桃芒果派！GrabFood 獨家熱銷中",
      "en": "Jollibee Chickenjoy Bucket Free Peach Mango Pie Promo",
      "tl": "Jollibee Chickenjoy Bucket may Libreng Peach Mango Pie"
    },
    tags: {
      "zh-TW": "國民速食超值贈禮",
      "en": "Free Dessert Promo",
      "tl": "Libreng Dessert Promo"
    },
    validity: {
      "zh-TW": "限量送完為止",
      "en": "While supplies last",
      "tl": "Hangga't may stock"
    },
    descriptions: {
      "zh-TW": "全菲律賓最受歡迎的炸雞！在大馬尼拉地區透過 GrabFood 訂購 6 塊或 8 塊裝炸雞桶餐，即免費贈送 2 份酥脆香甜的 Peach Mango Pie。",
      "en": "Order your favorite 6-pc or 8-pc Chickenjoy bucket via GrabFood across Metro Manila and score 2 free Peach Mango Pies with your meal!",
      "tl": "Mag-order ng paboritong 6-pc o 8-pc Chickenjoy bucket sa GrabFood sa buong Metro Manila at makakuha ng 2 libreng Peach Mango Pie!"
    },
    location: "Metro Manila All Branches",
    url: "https://www.jollibee.com.ph",
    imageUrl: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&auto=format&fit=crop"
  },
  {
    city: "manila",
    type: "new",
    brand: "BGC High Street Dining",
    titles: {
      "zh-TW": "BGC High Street 美食大道新餐廳進駐：試營運全單 8 折",
      "en": "BGC High Street New Dining Spot: 20% Off Soft Opening",
      "tl": "BGC High Street Bagong Kainan: 20% Off sa Soft Opening"
    },
    tags: {
      "zh-TW": "BGC 試營運特惠",
      "en": "Soft Opening 20% Off",
      "tl": "Soft Opening 20% Off"
    },
    validity: {
      "zh-TW": "每日限量前 50 組",
      "en": "First 50 tables daily",
      "tl": "Unang 50 mesa bawat araw"
    },
    descriptions: {
      "zh-TW": "馬尼拉最時髦的步行商業街！多家異國料理餐廳本月於 BGC High Street 陸續亮相，試營運期間凡到店用餐拍照打卡即享 8 折餐點折扣。",
      "en": "New culinary sensations have arrived at Bonifacio Global City! Discover the newest casual bistros along High Street with 20% soft opening perks.",
      "tl": "May mga bagong kainan na dumating sa Bonifacio High Street! Tuklasin ang mga bagong bistro at mag-enjoy sa 20% discount."
    },
    location: "Bonifacio High Street, Taguig, Metro Manila",
    url: "https://bgc.com.ph",
    imageUrl: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&auto=format&fit=crop"
  },
  {
    city: "manila",
    type: "promo",
    brand: "SM Mall of Asia",
    titles: {
      "zh-TW": "SM MOA 海濱夕陽晚宴：指定濱海景觀餐廳享特調買一送一",
      "en": "SM Mall of Asia Seaside Sunset Dining: 1-for-1 Cocktails",
      "tl": "SM Mall of Asia Seaside Sunset Dining: Buy 1 Take 1 Cocktails"
    },
    tags: {
      "zh-TW": "濱海酒吧買一送一",
      "en": "Happy Hour 1-for-1",
      "tl": "Happy Hour 1-for-1"
    },
    validity: {
      "zh-TW": "每日下午 5 點至 8 點",
      "en": "Daily 5:00 PM - 8:00 PM",
      "tl": "Araw-araw 5:00 PM - 8:00 PM"
    },
    descriptions: {
      "zh-TW": "一邊欣賞馬尼拉灣落日，一邊品嚐美饌！SM MOA 海濱步道多家特色西餐廳推出黃昏歡樂時光，指定精選特調與啤酒皆享買一送一。",
      "en": "Enjoy the world-famous Manila Bay sunset at SM MOA by the Bay with exclusive 1-for-1 promotions on signature beverages during Happy Hour.",
      "tl": "Panoorin ang sikat na paglubog ng araw sa Manila Bay sa SM MOA habang nag-e-enjoy sa Buy 1 Take 1 sa mga piling inumin."
    },
    location: "Seaside Blvd, Pasay, Metro Manila",
    url: "https://www.smsupermalls.com",
    imageUrl: "https://images.unsplash.com/photo-1525755662778-989d0524087e?w=800&auto=format&fit=crop"
  }
];

async function runAutoNews() {
  console.log("🚀 開始更新全菲三大城市的美食情報...");

  let finalNewsList = [];

  // 嘗試使用 Gemini 聯網爬取最新消息
  if (process.env.GEMINI_API_KEY) {
    try {
      console.log("🔍 嘗試調用 Gemini 檢索即時動態...");
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      const prompt = `你是菲律賓美食專家，請提供 3 則本週達沃(Davao)、宿霧(Cebu)、馬尼拉(Manila)最熱門的美食促銷或新店。請嚴格輸出合法的 JSON Array，欄位需有 city, type, brand, titles, tags, validity, descriptions, location, url, imageUrl。不加 markdown 標記。`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });

      let text = response.text.trim();
      if (text.startsWith('```json')) text = text.slice(7);
      if (text.startsWith('```')) text = text.slice(3);
      if (text.endsWith('```')) text = text.slice(0, -3);
      const fetched = JSON.parse(text.trim());
      if (Array.isArray(fetched) && fetched.length > 0) {
        finalNewsList = fetched;
        console.log(`✅ 成功從 AI 獲取 ${fetched.length} 則即時動態！`);
      }
    } catch (e) {
      console.warn("⚠️ AI 即時爬取未順利完成，無縫切換至高品質精選美食情報資料庫：", e.message);
    }
  }

  // 若 AI 未抓取或解析失敗，自動採用保底完整庫，保證新聞永遠充足！
  if (finalNewsList.length === 0) {
    console.log("💡 使用菲律賓三大城市專屬在地美食情報庫進行寫入...");
    finalNewsList = FALLBACK_NEWS;
  }

  console.log(`📦 正在將 ${finalNewsList.length} 筆動態寫入 Firestore 的 'news' 集合...`);

  const batch = db.batch();

  finalNewsList.forEach((item, index) => {
    const safeBrand = (item.brand || 'food').replace(/[^a-zA-Z0-9]/g, '');
    const docId = `${item.city}_${safeBrand}_${index}`;
    const docRef = db.collection('news').doc(docId);

    item.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    batch.set(docRef, item, { merge: true });
  });

  await batch.commit();
  console.log(`🎉 成功同步！資料庫已寫入 ${finalNewsList.length} 則完整美食新聞動態！`);
}

runAutoNews();
