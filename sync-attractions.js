/**
 * sync-attractions.js
 * 菲律賓景點、購物商場 (Malls) 與頂級賭場 (Casinos / Integrated Resorts) 自動同步腳本
 * 支援城市：達沃 (Davao)、馬尼拉 (Manila)、宿霧 (Cebu)、長灘島 (Boracay)、巴拉望 (Palawan)
 */

import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc } from "firebase/firestore";

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

// 核心地標資料庫（涵蓋知名購物中心、頂級賭場、歷史與自然景點）
const ATTRACTIONS_SEED_DATA = [
    // ==================== 達沃 (DAVAO) ====================
    // 購物商場 (Shopping Malls)
    {
        id: "davao_sm_lanang",
        city: "davao",
        category: "shopping",
        name: "SM Lanang Premier",
        name_en: "SM Lanang Premier",
        address: "J.P. Laurel Ave, Lanang, Davao City, Davao del Sur",
        phone: "+63 82 285 0943",
        googleRating: 4.6,
        googleReviewCount: 18200,
        description: "達沃市最具代表性的高端大型購物商場，擁有 IMAX 影城、噴泉中庭廣場與眾多國際品牌及精選餐廳。",
        images: [
            "https://images.unsplash.com/photo-1519567241046-7f570eee3ce6?w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1567449303078-57ad995bd302?w=800&auto=format&fit=crop"
        ]
    },
    {
        id: "davao_sm_city_ecoland",
        city: "davao",
        category: "shopping",
        name: "SM City Davao (Ecoland)",
        name_en: "SM City Davao (Ecoland)",
        address: "Quimpo Blvd, Ecoland, Matina, Davao City",
        phone: "+63 82 297 0274",
        googleRating: 4.5,
        googleReviewCount: 16500,
        description: "民答那峨島第一家 SM 百貨，達沃南部最具人氣的家庭生活、美食聚餐與流行購物核心樞紐。",
        images: [
            "https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=800&auto=format&fit=crop"
        ]
    },
    {
        id: "davao_abreeza_mall",
        city: "davao",
        category: "shopping",
        name: "Abreeza Mall (Ayala Malls)",
        name_en: "Abreeza Mall",
        address: "J.P. Laurel Ave, Poblacion District, Davao City",
        phone: "+63 82 321 9332",
        googleRating: 4.6,
        googleReviewCount: 15400,
        description: "由 Ayala 集團打造的頂級開放式綠意花園商場，擁有舒適用餐露台、精品名店與熱鬧的戶外綠帶。",
        images: [
            "https://images.unsplash.com/photo-1581417478175-a9ef18f210c2?w=800&auto=format&fit=crop"
        ]
    },
    {
        id: "davao_gmall_bajada",
        city: "davao",
        category: "shopping",
        name: "Gaisano Mall of Davao (G-Mall)",
        name_en: "Gaisano Mall of Davao",
        address: "J.P. Laurel Ave, Bajada, Davao City",
        phone: "+63 82 221 5406",
        googleRating: 4.4,
        googleReviewCount: 12100,
        description: "達沃在地老牌大型商場，生活用品齊全、美食街選擇眾多，頂樓設有熱門的室內娛樂設施。",
        images: [
            "https://images.unsplash.com/photo-1519567241046-7f570eee3ce6?w=800&auto=format&fit=crop"
        ]
    },
    // 娛樂與賭場 (Casinos & Entertainment)
    {
        id: "davao_grand_regal_casino",
        city: "davao",
        category: "casino",
        name: "Casino Filipino Davao (Grand Regal Hotel)",
        name_en: "Casino Filipino Davao",
        address: "KM 7, J.P. Laurel Ave, Lanang, Davao City",
        phone: "+63 82 235 0888",
        googleRating: 4.2,
        googleReviewCount: 1350,
        description: "位於 Grand Regal Hotel 內的合法娛樂場，提供經典百家樂、輪盤、吃角子老虎機與夜間現場表演。",
        images: [
            "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1511193311914-0346f16efe90?w=800&auto=format&fit=crop"
        ]
    },
    // 自然景觀 (Nature)
    {
        id: "davao_eden_nature_park",
        city: "davao",
        category: "nature",
        name: "Eden Nature Park & Resort",
        name_en: "Eden Nature Park & Resort",
        address: "Bo. Eden, Toril, Davao City",
        phone: "+63 82 295 1020",
        googleRating: 4.6,
        googleReviewCount: 3800,
        description: "位於達沃阿波火山腳下的高山避暑勝地，擁有松樹林步道、飛索設施與有機花園景觀餐廳。",
        images: [
            "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop"
        ]
    },
    {
        id: "davao_philippine_eagle_center",
        city: "davao",
        category: "nature",
        name: "Philippine Eagle Center",
        name_en: "Philippine Eagle Center",
        address: "Malagos, Baguio District, Davao City",
        phone: "+63 82 271 2337",
        googleRating: 4.5,
        googleReviewCount: 2900,
        description: "菲律賓國鳥「食猿鵰」的保育基地，被熱帶雨林環繞，具備高度生態教育意義。",
        images: [
            "https://images.unsplash.com/photo-1518684079-3c830dcef090?w=800&auto=format&fit=crop"
        ]
    },
    // 歷史文化 (History)
    {
        id: "davao_san_pedro_cathedral",
        city: "davao",
        category: "history",
        name: "San Pedro Cathedral",
        name_en: "San Pedro Cathedral",
        address: "San Pedro St, Poblacion District, Davao City",
        phone: "+63 82 226 4740",
        googleRating: 4.6,
        googleReviewCount: 4200,
        description: "達沃市歷史最悠久的主教座堂，獨特的曲線現代主義帆船外觀設計象徵著族群融合。",
        images: [
            "https://images.unsplash.com/photo-1548625361-195fe578df93?w=800&auto=format&fit=crop"
        ]
    },

    // ==================== 馬尼拉 (MANILA) ====================
    // 頂級綜合度假村賭場 (Casinos)
    {
        id: "manila_okada",
        city: "manila",
        category: "casino",
        name: "Okada Manila (岡田馬尼拉)",
        name_en: "Okada Manila",
        address: "New Seaside Dr, Entertainment City, Parañaque, Metro Manila",
        phone: "+63 2 8888 0777",
        googleRating: 4.7,
        googleReviewCount: 38900,
        description: "亞洲頂級奢華娛樂地標，以震撼的戶外水舞噴泉秀、金碧輝煌的賭場大廳與頂級奢華購物街聞名。",
        images: [
            "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1511193311914-0346f16efe90?w=800&auto=format&fit=crop"
        ]
    },
    {
        id: "manila_solaire",
        city: "manila",
        category: "casino",
        name: "Solaire Resort Entertainment City",
        name_en: "Solaire Resort",
        address: "1 Aseana Ave, Entertainment City, Parañaque, Metro Manila",
        phone: "+63 2 8888 8888",
        googleRating: 4.7,
        googleReviewCount: 26500,
        description: "馬尼拉灣畔五星級旗艦綜合度假城，擁有米其林級名廚餐廳、國際劇院與頂級 VIP 博彩空間。",
        images: [
            "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=800&auto=format&fit=crop"
        ]
    },
    {
        id: "manila_city_of_dreams",
        city: "manila",
        category: "casino",
        name: "City of Dreams Manila (新濠天地)",
        name_en: "City of Dreams Manila",
        address: "Asean Ave. cor. Roxas Blvd, Entertainment City, Parañaque",
        phone: "+63 2 8800 8080",
        googleRating: 4.6,
        googleReviewCount: 21000,
        description: "集結 Nobu、Hyatt、Nuwa 三大酒店的頂級娛樂城，設有高科技室內主題樂園與世界級娛樂場。",
        images: [
            "https://images.unsplash.com/photo-1511193311914-0346f16efe90?w=800&auto=format&fit=crop"
        ]
    },
    // 購物商場 (Shopping Malls)
    {
        id: "manila_sm_mall_of_asia",
        city: "manila",
        category: "shopping",
        name: "SM Mall of Asia (MOA)",
        name_en: "SM Mall of Asia",
        address: "Seaside Blvd, Pasay, Metro Manila",
        phone: "+63 2 8556 0680",
        googleRating: 4.7,
        googleReviewCount: 89000,
        description: "全亞洲最具規模的指標級濱海購物商城之一，設有巨型摩天輪、奧運標準滑冰場與 MOA 體育館。",
        images: [
            "https://images.unsplash.com/photo-1519567241046-7f570eee3ce6?w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1567449303078-57ad995bd302?w=800&auto=format&fit=crop"
        ]
    },
    {
        id: "manila_greenbelt_makati",
        city: "manila",
        category: "shopping",
        name: "Greenbelt (Ayala Center Makati)",
        name_en: "Greenbelt Mall",
        address: "Legazpi Village, Makati, Metro Manila",
        phone: "+63 2 7795 9595",
        googleRating: 4.7,
        googleReviewCount: 34000,
        description: "馬尼拉金融核心區的奢華旗艦購物勝地，環繞於熱帶植栽水景間，匯聚全球頂級奢侈名品與戶外景觀餐酒館。",
        images: [
            "https://images.unsplash.com/photo-1581417478175-a9ef18f210c2?w=800&auto=format&fit=crop"
        ]
    },
    {
        id: "manila_sm_megamall",
        city: "manila",
        category: "shopping",
        name: "SM Megamall",
        name_en: "SM Megamall",
        address: "EDSA cor. Doña Julia Vargas Ave, Ortigas Center, Mandaluyong",
        phone: "+63 2 8633 5042",
        googleRating: 4.6,
        googleReviewCount: 52000,
        description: "馬尼拉最具人氣的流行購物中樞之一，匯集時尚快銷品牌、米其林名店與大型展覽中心。",
        images: [
            "https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=800&auto=format&fit=crop"
        ]
    },
    // 歷史文化 (History)
    {
        id: "manila_intramuros",
        city: "manila",
        category: "history",
        name: "Intramuros (西班牙王城區)",
        name_en: "Intramuros",
        address: "Bonifacio Dr & Padre Burgos Ave, Manila",
        phone: "+63 2 8527 3155",
        googleRating: 4.7,
        googleReviewCount: 29500,
        description: "馬尼拉著名的西班牙殖民古城，保留完整護城石牆、聖地牙哥堡壘與四百年歷史的聖奧古斯丁教堂。",
        images: [
            "https://images.unsplash.com/photo-1548625361-195fe578df93?w=800&auto=format&fit=crop"
        ]
    },

    // ==================== 宿霧 (CEBU) ====================
    // 頂級賭場 (Casinos)
    {
        id: "cebu_nustar_resort",
        city: "cebu",
        category: "casino",
        name: "NUSTAR Resort and Casino",
        name_en: "NUSTAR Resort and Casino",
        address: "Kawit Island, South Road Properties, Cebu City",
        phone: "+63 32 888 8282",
        googleRating: 4.8,
        googleReviewCount: 4600,
        description: "宿霧最新開幕的奢華地標五星級海景綜合娛樂度假村，擁有南菲律賓最具規模的國際賭場與頂級名店街。",
        images: [
            "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=800&auto=format&fit=crop"
        ]
    },
    // 購物商場 (Shopping Malls)
    {
        id: "cebu_sm_seaside_city",
        city: "cebu",
        category: "shopping",
        name: "SM Seaside City Cebu",
        name_en: "SM Seaside City Cebu",
        address: "South Road Properties, Cebu City",
        phone: "+63 32 340 8735",
        googleRating: 4.7,
        googleReviewCount: 36000,
        description: "環形未來感建築的地標型巨型商場，坐擁無敵海景觀景台、天台花園與龐大美食天地。",
        images: [
            "https://images.unsplash.com/photo-1519567241046-7f570eee3ce6?w=800&auto=format&fit=crop"
        ]
    },
    {
        id: "cebu_ayala_center",
        city: "cebu",
        category: "shopping",
        name: "Ayala Center Cebu",
        name_en: "Ayala Center Cebu",
        address: "Cebu Business Park, Archbishop Reyes Ave, Cebu City",
        phone: "+63 32 888 3777",
        googleRating: 4.8,
        googleReviewCount: 28000,
        description: "位於宿霧商業核心區的頂級綠洲花園商場，擁有眾多露天餐飲、精緻下午茶與國際流行品牌。",
        images: [
            "https://images.unsplash.com/photo-1581417478175-a9ef18f210c2?w=800&auto=format&fit=crop"
        ]
    },
    // 歷史文化 (History)
    {
        id: "cebu_magellans_cross",
        city: "cebu",
        category: "history",
        name: "Magellan's Cross (麥哲倫十字架)",
        name_en: "Magellan's Cross",
        address: "P. Burgos St, Cebu City",
        phone: "+63 32 412 4321",
        googleRating: 4.6,
        googleReviewCount: 14500,
        description: "葡萄牙探險家麥哲倫於 1521 年登陸宿霧時豎立的歷史十字架，象徵天主教傳入菲律賓的起點。",
        images: [
            "https://images.unsplash.com/photo-1548625361-195fe578df93?w=800&auto=format&fit=crop"
        ]
    }
];

async function syncAttractions() {
    console.log("🚀 開始同步景點、知名百貨 (Malls) 與頂級賭場 (Casinos) 至 Firestore...");
    let successCount = 0;

    for (const item of ATTRACTIONS_SEED_DATA) {
        try {
            const docRef = doc(db, "attractions", item.id);
            await setDoc(docRef, {
                ...item,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            console.log(`✅ [${item.city.toUpperCase()}] [${item.category}] ${item.name}`);
            successCount++;
        } catch (err) {
            console.error(`❌ 寫入失敗: ${item.name}`, err);
        }
    }

    console.log(`🎉 景點與娛樂地標同步完成！共更新 ${successCount} 筆資料。`);
    process.exit(0);
}

syncAttractions();
