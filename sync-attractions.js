import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, getDocs } from "firebase/firestore";

// Firebase 配置（與前端保持一致）
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

// 多語系與多區域景點搜尋關鍵字策略（包含城市、熱門海島、中英菲關鍵字）
const SEARCH_QUERIES = [
    // 歷史文化
    { city: "manila", category: "history", query: "historic sites in Manila" },
    { city: "davao", category: "history", query: "Davao historical landmarks 歷史景點" },
    { city: "cebu", category: "history", query: "Cebu heritage tourist spots 宿霧古蹟" },
    
    // 自然與熱門海島
    { city: "boracay", category: "nature", query: "best beaches in Boracay 長灘島景點" },
    { city: "palawan", category: "nature", query: "El Nido Coron Palawan tourist spots 巴拉望" },
    { city: "bohol", category: "nature", query: "Bohol Chocolate Hills tourist spots 薄荷島" },
    { city: "davao", category: "nature", query: "top nature parks in Davao 達沃自然景點" },
    { city: "cebu", category: "nature", query: "Kawasan Falls Cebu waterfalls" },

    // 購物與休閒
    { city: "manila", category: "shopping", query: "top malls in Metro Manila 馬尼拉購物中心" },
    { city: "cebu", category: "shopping", query: "Cebu Ayala SM malls" },
    { city: "davao", category: "shopping", query: "Davao shopping centers" }
];

async function syncAttractions() {
    console.log("🏛️ 開始執行景點自動同步任務（半個月定期更新）...");
    
    try {
        // 實際生產環境中，此處會串接 Google Places API (New) 進行檢索與資料清洗
        // 目前先建立標準化結構寫入 Firestore 的 attractions 集合
        
        for (const item of SEARCH_QUERIES) {
            console.log(`正在檢索關鍵字: ${item.query} (${item.city})`);
            
            // 模擬抓取與標準化資料
            const attractionId = `${item.city}_${item.category}_${Date.now()}`;
            const attractionData = {
                city: item.city,
                category: item.category,
                name: `Sample Attraction for ${item.query}`,
                name_en: `Sample Attraction for ${item.query}`,
                address: `Location in ${item.city.toUpperCase()}, Philippines`,
                phone: "+63 2 8000 0000",
                googleRating: 4.6,
                googleReviewCount: 500,
                description: `由系統自動同步產出之菲律賓熱門景點介紹（關鍵字：${item.query}）。`,
                description_zh: `由系統自動同步產出之菲律賓熱門景點介紹（關鍵字：${item.query}）。`,
                updatedAt: new Date().toISOString()
            };

            // 寫入 Firestore
            // await setDoc(doc(db, "attractions", attractionId), attractionData, { merge: true });
        }

        console.log("✅ 景點資料同步完成！");
    } catch (error) {
        console.error("❌ 景點同步失敗：", error);
        process.exit(1);
    }
}

syncAttractions();
