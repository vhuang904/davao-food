/**
 * sync-attractions.js
 * 菲律賓全區景點、商場、賭場與站長私房餐廳（Curated Places）自動同步腳本
 * 支援區域：北部(Luzon)、中部(Visayas)、南部(Mindanao)
 */

import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc } from "firebase/firestore";
import fs from "fs";
import path from "path";

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

// 全菲核心地標資料庫（北中南全區）
const ATTRACTIONS_SEED_DATA = [
    // ==================== 北部：呂宋島群 (LUZON) ====================
    // 馬尼拉 (Manila)
    {
        id: "manila_okada",
        city: "manila",
        region: "luzon",
        category: "casino",
        name: "Okada Manila (岡田馬尼拉)",
        name_en: "Okada Manila",
        address: "New Seaside Dr, Entertainment City, Parañaque, Metro Manila",
        phone: "+63 2 8888 0777",
        googleRating: 4.7,
        googleReviewCount: 38900,
        description: "亞洲頂級奢華娛樂地標，以震撼的戶外水舞噴泉秀、金碧輝煌的賭場大廳與頂級奢華購物街聞名。",
        images: ["https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=800&auto=format&fit=crop"]
    },
    {
        id: "manila_solaire",
        city: "manila",
        region: "luzon",
        category: "casino",
        name: "Solaire Resort Entertainment City",
        name_en: "Solaire Resort",
        address: "1 Aseana Ave, Entertainment City, Parañaque, Metro Manila",
        phone: "+63 2 8888 8888",
        googleRating: 4.7,
        googleReviewCount: 26500,
        description: "馬尼拉灣畔五星級旗艦綜合度假城，擁有米其林級名廚餐廳、國際劇院與頂級 VIP 博彩空間。",
        images: ["https://images.unsplash.com/photo-1511193311914-0346f16efe90?w=800&auto=format&fit=crop"]
    },
    {
        id: "manila_sm_mall_of_asia",
        city: "manila",
        region: "luzon",
        category: "shopping",
        name: "SM Mall of Asia (MOA)",
        name_en: "SM Mall of Asia",
        address: "Seaside Blvd, Pasay, Metro Manila",
        phone: "+63 2 8556 0680",
        googleRating: 4.7,
        googleReviewCount: 89000,
        description: "全亞洲最具規模的指標級濱海購物商城之一，設有巨型摩天輪、奧運標準滑冰場與大型展演空間。",
        images: ["https://images.unsplash.com/photo-1519567241046-7f570eee3ce6?w=800&auto=format&fit=crop"]
    },
    {
        id: "manila_greenbelt",
        city: "manila",
        region: "luzon",
        category: "shopping",
        name: "Greenbelt (Ayala Center Makati)",
        name_en: "Greenbelt Mall",
        address: "Legazpi Village, Makati, Metro Manila",
        phone: "+63 2 7795 9595",
        googleRating: 4.7,
        googleReviewCount: 34000,
        description: "馬尼拉金融區的核心奢華旗艦購物勝地，環繞於熱帶植栽水景間，匯聚全球一線精品名牌與戶外景觀餐酒館。",
        images: ["https://images.unsplash.com/photo-1581417478175-a9ef18f210c2?w=800&auto=format&fit=crop"]
    },
    {
        id: "manila_intramuros",
        city: "manila",
        region: "luzon",
        category: "history",
        name: "Intramuros (西班牙王城區)",
        name_en: "Intramuros",
        address: "Bonifacio Dr & Padre Burgos Ave, Manila",
        phone: "+63 2 8527 3155",
        googleRating: 4.7,
        googleReviewCount: 29500,
        description: "馬尼拉著名的西班牙殖民古城，保留完整護城石牆、聖地牙哥堡壘與四百年歷史的聖奧古斯丁教堂。",
        images: ["https://images.unsplash.com/photo-1548625361-195fe578df93?w=800&auto=format&fit=crop"]
    },

    // 巴拉望 (Palawan - 愛妮島 / 科隆 / 公主港)
    {
        id: "palawan_elnido_big_lagoon",
        city: "palawan",
        region: "luzon",
        category: "nature",
        name: "El Nido Big Lagoon (愛妮島大潟湖)",
        name_en: "Big Lagoon, El Nido",
        address: "Miniloc Island, El Nido, Palawan",
        googleRating: 4.9,
        googleReviewCount: 3200,
        description: "愛妮島最震撼的自然奇觀，乘獨木舟穿梭在翠綠清澈的海水與高聳入雲的喀斯特石灰岩懸崖之間。",
        images: ["https://images.unsplash.com/photo-1518684079-3c830dcef090?w=800&auto=format&fit=crop"]
    },
    {
        id: "palawan_coron_kayangan_lake",
        city: "palawan",
        region: "luzon",
        category: "nature",
        name: "Kayangan Lake (科隆凱央根湖)",
        name_en: "Kayangan Lake, Coron",
        address: "Coron Island, Palawan",
        googleRating: 4.9,
        googleReviewCount: 4100,
        description: "譽為菲律賓最純淨的國寶級湖泊，兼具淡水與海水，能見度極高，是浮潛與攝影的終極天堂。",
        images: ["https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop"]
    },

    // ==================== 中部：米沙鄢海島群 (VISAYAS) ====================
    // 宿霧 (Cebu)
    {
        id: "cebu_nustar_resort",
        city: "cebu",
        region: "visayas",
        category: "casino",
        name: "NUSTAR Resort and Casino",
        name_en: "NUSTAR Resort and Casino",
        address: "Kawit Island, South Road Properties, Cebu City",
        phone: "+63 32 888 8282",
        googleRating: 4.8,
        googleReviewCount: 4600,
        description: "宿霧頂級五星海景奢華綜合娛樂度假城，擁有菲律賓中部最大規模的國際賭場與精品名店街。",
        images: ["https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=800&auto=format&fit=crop"]
    },
    {
        id: "cebu_sm_seaside_city",
        city: "cebu",
        region: "visayas",
        category: "shopping",
        name: "SM Seaside City Cebu",
        name_en: "SM Seaside City Cebu",
        address: "South Road Properties, Cebu City",
        phone: "+63 32 340 8735",
        googleRating: 4.7,
        googleReviewCount: 36000,
        description: "宿霧環形未來感地標巨型商場，坐擁無敵海景觀景台、天台花園、IMAX 影城與龐大美食廣場。",
        images: ["https://images.unsplash.com/photo-1519567241046-7f570eee3ce6?w=800&auto=format&fit=crop"]
    },
    {
        id: "cebu_magellans_cross",
        city: "cebu",
        region: "visayas",
        category: "history",
        name: "Magellan's Cross (麥哲倫十字架)",
        name_en: "Magellan's Cross",
        address: "P. Burgos St, Cebu City",
        googleRating: 4.6,
        googleReviewCount: 14500,
        description: "1521 年麥哲倫抵達宿霧時所豎立的天主教歷史地標，象徵天主教傳入菲律賓的發源地。",
        images: ["https://images.unsplash.com/photo-1548625361-195fe578df93?w=800&auto=format&fit=crop"]
    },

    // 長灘島 (Boracay)
    {
        id: "boracay_white_beach",
        city: "boracay",
        region: "visayas",
        category: "nature",
        name: "Boracay White Beach (長灘島白沙灘)",
        name_en: "White Beach, Boracay",
        address: "Malay, Aklan, Boracay Island",
        googleRating: 4.8,
        googleReviewCount: 19800,
        description: "長達四公里的世界級極品麵粉白沙灘，分為 Station 1, 2, 3，夕陽風帆與沙灘酒吧夜生活聞名全球。",
        images: ["https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop"]
    },
    {
        id: "boracay_dmall",
        city: "boracay",
        region: "visayas",
        category: "shopping",
        name: "D'Mall Boracay",
        name_en: "D'Mall Boracay",
        address: "Station 2, Balabag, Boracay Island",
        googleRating: 4.5,
        googleReviewCount: 8900,
        description: "長灘島的心臟地帶露天商圈，聚集各式異國餐廳、海灘風格精品小店、換匯點與地標摩天輪。",
        images: ["https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=800&auto=format&fit=crop"]
    },

    // 薄荷島 (Bohol)
    {
        id: "bohol_chocolate_hills",
        city: "bohol",
        region: "visayas",
        category: "nature",
        name: "Chocolate Hills (薄荷島巧克力山)",
        name_en: "Chocolate Hills",
        address: "Carmen, Bohol",
        googleRating: 4.7,
        googleReviewCount: 9200,
        description: "世界地質奇觀，由 1,200 多座圓錐形石灰岩小山丘組成，旱季時植被枯竭呈現一片可可棕褐色。",
        images: ["https://images.unsplash.com/photo-1518684079-3c830dcef090?w=800&auto=format&fit=crop"]
    },

    // ==================== 南部：民答那峨群島 (MINDANAO) ====================
    // 達沃 (Davao)
    {
        id: "davao_sm_lanang",
        city: "davao",
        region: "mindanao",
        category: "shopping",
        name: "SM Lanang Premier",
        name_en: "SM Lanang Premier",
        address: "J.P. Laurel Ave, Lanang, Davao City, Davao del Sur",
        phone: "+63 82 285 0943",
        googleRating: 4.6,
        googleReviewCount: 18200,
        description: "達沃市最具代表性的高端大型購物商場，擁有 IMAX 影城、噴泉中庭廣場與眾多國際品牌及精選餐廳。",
        images: ["https://images.unsplash.com/photo-1519567241046-7f570eee3ce6?w=800&auto=format&fit=crop"]
    },
    {
        id: "davao_sm_city_ecoland",
        city: "davao",
        region: "mindanao",
        category: "shopping",
        name: "SM City Davao (Ecoland)",
        name_en: "SM City Davao (Ecoland)",
        address: "Quimpo Blvd, Ecoland, Matina, Davao City",
        phone: "+63 82 297 0274",
        googleRating: 4.5,
        googleReviewCount: 16500,
        description: "民答那峨島第一家 SM 百貨，達沃南部最具人氣的家庭生活、美食聚餐與流行購物核心樞紐。",
        images: ["https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=800&auto=format&fit=crop"]
    },
    {
        id: "davao_abreeza_mall",
        city: "davao",
        region: "mindanao",
        category: "shopping",
        name: "Abreeza Mall (Ayala Malls)",
        name_en: "Abreeza Mall",
        address: "J.P. Laurel Ave, Poblacion District, Davao City",
        phone: "+63 82 321 9332",
        googleRating: 4.6,
        googleReviewCount: 15400,
        description: "由 Ayala 集團打造的頂級開放式綠意花園商場，擁有舒適用餐露台、精品名店與熱鬧的戶外綠帶。",
        images: ["https://images.unsplash.com/photo-1581417478175-a9ef18f210c2?w=800&auto=format&fit=crop"]
    },
    {
        id: "davao_gmall_bajada",
        city: "davao",
        region: "mindanao",
        category: "shopping",
        name: "Gaisano Mall of Davao (G-Mall)",
        name_en: "Gaisano Mall of Davao",
        address: "J.P. Laurel Ave, Bajada, Davao City",
        phone: "+63 82 221 5406",
        googleRating: 4.4,
        googleReviewCount: 12100,
        description: "達沃在地老牌大型商場，生活用品齊全、美食街選擇眾多，頂樓設有熱門的室內娛樂設施。",
        images: ["https://images.unsplash.com/photo-1519567241046-7f570eee3ce6?w=800&auto=format&fit=crop"]
    },
    {
        id: "davao_grand_regal_casino",
        city: "davao",
        region: "mindanao",
        category: "casino",
        name: "Casino Filipino Davao (Grand Regal Hotel)",
        name_en: "Casino Filipino Davao",
        address: "KM 7, J.P. Laurel Ave, Lanang, Davao City",
        phone: "+63 82 235 0888",
        googleRating: 4.2,
        googleReviewCount: 1350,
        description: "位於 Grand Regal Hotel 內的合法娛樂場，提供經典百家樂、輪盤、吃角子老虎機與夜間表演。",
        images: ["https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=800&auto=format&fit=crop"]
    },
    {
        id: "davao_eden_nature_park",
        city: "davao",
        region: "mindanao",
        category: "nature",
        name: "Eden Nature Park & Resort",
        name_en: "Eden Nature Park & Resort",
        address: "Bo. Eden, Toril, Davao City",
        phone: "+63 82 295 1020",
        googleRating: 4.6,
        googleReviewCount: 3800,
        description: "位於阿波火山腳下的高山避暑勝地，擁有松樹林步道、飛索設施與有機花園景觀餐廳。",
        images: ["https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop"]
    },

    // 薩馬爾島 (Samal Island - 達沃後花園)
    {
        id: "samal_pearl_farm_beach",
        city: "samal",
        region: "mindanao",
        category: "nature",
        name: "Pearl Farm Beach Resort (珍珠農場度假村)",
        name_en: "Pearl Farm Beach Resort",
        address: "Kaputian, Island Garden City of Samal",
        phone: "+63 82 285 0601",
        googleRating: 4.7,
        googleReviewCount: 2900,
        description: "民答那峨最負盛名的五星級海上高腳屋度假村，坐擁純白沙灘、私人潟湖與無敵海景夕陽。",
        images: ["https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop"]
    }
];

async function syncAll() {
    console.log("🚀 開始同步景點、知名商場、頂級賭場與站長私房清單至 Firestore...");
    let attCount = 0;
    let curatedCount = 0;

    // 1. 同步景點地標
    for (const item of ATTRACTIONS_SEED_DATA) {
        try {
            const docRef = doc(db, "attractions", item.id);
            await setDoc(docRef, {
                ...item,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            attCount++;
        } catch (err) {
            console.error(`❌ 景點寫入失敗: ${item.name}`, err);
        }
    }
    console.log(`✅ 景點與娛樂地標同步完成！共 ${attCount} 筆。`);

    // 2. 自動讀取並同步 curated-places.json（站長私房嚴選）
    const curatedPath = path.resolve("./curated-places.json");
    if (fs.existsSync(curatedPath)) {
        try {
            const fileData = fs.readFileSync(curatedPath, "utf-8");
            const curatedList = JSON.parse(fileData);
            for (const place of curatedList) {
                const docRef = doc(db, "restaurants", place.id);
                await setDoc(docRef, {
                    ...place,
                    isCurated: true,
                    updatedAt: new Date().toISOString()
                }, { merge: true });
                console.log(`👑 [站長嚴選同步] ${place.name}`);
                curatedCount++;
            }
            console.log(`🎉 站長私房清單同步完成！共 ${curatedCount} 家私房店已安全寫入 Firestore。`);
        } catch (err) {
            console.error("❌ 讀取或同步 curated-places.json 失敗:", err);
        }
    } else {
        console.log("⚠️ 未發現 curated-places.json，跳過私房同步。");
    }

    process.exit(0);
}

syncAll();
