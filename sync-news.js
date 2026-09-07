/**
 * sync-news.js
 * 菲律賓城市動態、限時優惠、演唱會與娛樂活動自動同步腳本
 * Node.js CommonJS 相容版
 */

const { initializeApp } = require("firebase/app");
const { getFirestore, doc, setDoc } = require("firebase/firestore");

// 公開安全之 Firebase 前端專案設定
const firebaseConfig = {
    apiKey: "AIzaSyCM2dCa2Y8d6Z-Dc_Uz9yvvgaifav-1Vg",
    authDomain: "bigv-foodmap.firebaseapp.com",
    projectId: "bigv-foodmap",
    storageBucket: "bigv-foodmap.appspot.com",
    messagingSenderId: "701000455421",
    appId: "1:701000455421:web:ab02befef466e1f8989a94"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 城市動態與活動種子資料庫
const NEWS_SEED_DATA = [
    // ==================== 全國 / 限時優惠 (PROMO) ====================
    {
        id: "news_grabfood_weekend_promo",
        city: "all",
        type: "promo",
        brand: "GrabFood",
        title: "全菲週末精選美食 50% OFF 折扣狂歡",
        tag: "🔥 限時優惠",
        validity: "每週五至週日限定",
        description: "全菲律賓 GrabFood 外送精選指定知名餐廳，訂單滿額即享 5 折超值折扣與免運優惠！",
        location: "Manila, Davao, Cebu 全菲適用",
        imageUrl: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&auto=format&fit=crop",
        url: "https://www.grab.com/ph/food/"
    },
    {
        id: "news_foodpanda_super_deals",
        city: "all",
        type: "promo",
        brand: "Foodpanda",
        title: "Foodpanda 晚間消夜專屬優惠券",
        tag: "🔥 限時優惠",
        validity: "每日 20:00 - 24:00",
        description: "輸入指定優惠代碼享精選炸雞、披薩與手搖飲消夜現折 100 比索。",
        location: "各大城市外送服務範圍",
        imageUrl: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&auto=format&fit=crop",
        url: "https://www.foodpanda.ph/"
    },

    // ==================== 演唱會與大型活動 (EVENT) ====================
    {
        id: "news_manila_ed_sheeran",
        city: "manila",
        type: "event",
        brand: "TicketWorld",
        title: "Ed Sheeran: +–=÷× Mathematics Tour in Manila",
        tag: "🎵 演唱會與活動",
        validity: "2026/09/25 盛大開唱",
        description: "全球流行天王 Ed Sheeran 降臨馬尼拉，帶來環形震撼舞台與多首破億金曲連番開唱！",
        location: "SMDC Festival Grounds, Parañaque, Manila",
        imageUrl: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&auto=format&fit=crop",
        url: "https://ticketworld.com.ph"
    },
    {
        id: "news_cebu_sinulog_music_fest",
        city: "cebu",
        type: "event",
        brand: "SM Tickets",
        title: "Cebu Summer Beats Live Music Festival",
        tag: "🎵 演唱會與活動",
        validity: "即將登場",
        description: "集結菲律賓頂尖獨立樂團與國際知名 DJ，打造宿霧海濱最具能量的戶外音樂派對。",
        location: "City di Mare, South Road Properties, Cebu",
        imageUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop",
        url: "https://smtickets.com"
    },

    // ==================== 電影與娛樂 (MOVIE) ====================
    {
        id: "news_sm_cinema_imax_blockbuster",
        city: "all",
        type: "movie",
        brand: "SM Cinema",
        title: "全菲各大 SM IMAX 影城：好萊塢超級英雄巨獻同步熱映",
        tag: "🎬 電影與娛樂",
        validity: "全菲熱映中",
        description: "體驗頂級雷射 IMAX 巨幕與杜比全景聲震撼音效，線上提前預約各熱門時段座位。",
        location: "SM Lanang, SM MOA, SM Seaside 各大 IMAX 影城",
        imageUrl: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&auto=format&fit=crop",
        url: "https://www.smcinema.com"
    },
    {
        id: "news_ayala_malls_cinema",
        city: "all",
        type: "movie",
        brand: "SureSeats",
        title: "Ayala Malls Cinemas 頂級商務艙 VIP 觀影體驗",
        tag: "🎬 電影與娛樂",
        validity: "每日放映",
        description: "全電動真皮傾斜沙發、無限量爆米花與尊榮專人桌邊送餐服務。",
        location: "Abreeza Davao, Greenbelt Manila, Ayala Center Cebu",
        imageUrl: "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=800&auto=format&fit=crop",
        url: "https://www.sureseats.com"
    },

    // ==================== 新開餐廳與打卡熱點 (NEW) ====================
    {
        id: "news_davao_waterfront_seafood",
        city: "davao",
        type: "new",
        brand: "Spot.ph",
        title: "達沃海濱景觀餐酒館 Waterfront Bistro 全新開幕",
        tag: "✨ 新開餐廳",
        validity: "全新開幕營運中",
        description: "坐擁達沃海灣絕美夕陽視野，主打現撈活海鮮炭烤、生魚片刺身拼盤與特調熱帶雞尾酒。",
        location: "Lanang Waterfront, Davao City",
        imageUrl: "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=800&auto=format&fit=crop",
        url: "https://spot.ph"
    },
    {
        id: "news_manila_bgc_matcha_cafe",
        city: "manila",
        type: "new",
        brand: "BGC Insider",
        title: "京都百年宇治抹茶名店落腳馬尼拉 BGC 特區",
        tag: "✨ 新開餐廳",
        validity: "新店試營運",
        description: "採用日本直輸特級初摘抹茶，現場手刷濃厚抹茶拿鐵與手作焙茶霜淇淋熱烈排隊中。",
        location: "Bonifacio High Street, BGC, Taguig",
        imageUrl: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&auto=format&fit=crop",
        url: "https://spot.ph"
    }
];

async function syncNews() {
    console.log("🚀 開始同步城市動態、優惠活動與娛樂新聞至 Firestore...");
    let successCount = 0;

    for (const item of NEWS_SEED_DATA) {
        try {
            const docRef = doc(db, "news", item.id);
            await setDoc(docRef, {
                ...item,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            console.log(`✅ [${item.city.toUpperCase()}] [${item.type}] ${item.title}`);
            successCount++;
        } catch (err) {
            console.error(`❌ 寫入失敗: ${item.title}`, err);
        }
    }

    console.log(`🎉 城市動態同步完成！共更新 ${successCount} 筆資料。`);
    process.exit(0);
}

syncNews();
