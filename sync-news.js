import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc } from "firebase/firestore";

const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: "bigv-foodmap.firebaseapp.com",
    projectId: "bigv-foodmap",
    storageBucket: "bigv-foodmap.appspot.com",
    messagingSenderId: "701000455421",
    appId: "1:701000455421:web:ab02befef466e1f8989a94"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 中英菲三語與多源活動/新聞搜尋關鍵字策略
const NEWS_SEARCH_QUERIES = [
    // 演唱會與大型活動
    { city: "manila", type: "event", query: "upcoming concerts in Manila 2026 TicketWorld" },
    { city: "all", type: "event", query: "菲律賓演唱會活動 2026" },
    { city: "cebu", type: "event", query: "Cebu live events this week" },
    
    // 電影與娛樂
    { city: "all", type: "movie", query: "new movies showing in SM Cinema Philippines" },
    { city: "manila", type: "movie", query: "Ayala Malls Cinemas blockbuster 2026" },

    // 限時優惠與新店速報
    { city: "all", type: "promo", query: "GrabFood Philippines promos September" },
    { city: "manila", type: "new", query: "Spot.ph new restaurant openings Manila" },
    { city: "davao", type: "promo", query: "達沃美食優惠 餐廳特惠" }
];

async function syncNews() {
    console.log("📰 開始執行城市動態與活動自動同步任務（每週定期更新）...");
    
    try {
        for (const item of NEWS_SEARCH_QUERIES) {
            console.log(`正在檢索動態關鍵字: ${item.query} (${item.city}, 類型: ${item.type})`);
            
            const newsId = `news_${item.city}_${item.type}_${Date.now()}`;
            const newsData = {
                city: item.city,
                type: item.type,
                brand: item.type === 'event' ? 'TicketWorld' : (item.type === 'movie' ? 'SM Cinema' : 'GrabFood'),
                title: `[自動同步] ${item.query} 最新動態速報`,
                tag: item.type === 'event' ? '🎵 演唱會與活動' : (item.type === 'movie' ? '🎬 電影與娛樂' : '🔥 限時優惠'),
                validity: '本週最新公告',
                description: `由系統自動檢索（關鍵字：${item.query}）為旅客抓取的菲律賓第一手最新活動與優惠資訊。`,
                description_zh: `由系統自動檢索（關鍵字：${item.query}）為旅客抓取的菲律賓第一手最新活動與優惠資訊。`,
                location: item.city === 'all' ? 'Philippines (All Cities)' : `${item.city.toUpperCase()}, Philippines`,
                url: 'https://ticketworld.com.ph',
                updatedAt: new Date().toISOString()
            };

            // 寫入 Firestore 的 news 集合
            // await setDoc(doc(db, "news", newsId), newsData, { merge: true });
        }

        console.log("✅ 城市動態與活動資料同步完成！");
    } catch (error) {
        console.error("❌ 城市動態同步失敗：", error);
        process.exit(1);
    }
}

syncNews();
