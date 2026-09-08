/**
 * sync-islands.js
 * 菲律賓四大頂級海島（長灘島、薄荷島、巴拉望愛妮島/科隆、薩馬爾島）
 * 精選 Top 美食、星級飯店與奢華海景 Villa 一次性導入 Firestore
 */

import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

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

const ISLANDS_DATA = [
    // ==================== 1. 薩馬爾島 (SAMAL ISLAND) ====================
    {
        id: "samal_pearl_farm_resort",
        city: "samal",
        name: "Pearl Farm Beach Resort (珍珠農場度假村)",
        name_en: "Pearl Farm Beach Resort",
        categoryKey: "hotel_villa",
        islandType: "villa",
        googleRating: 4.8,
        googleReviewCount: 3200,
        isCurated: true,
        curatedBadge: "👑 站長海島推薦",
        curatedNote: "達沃後花園最負盛名的五星級海上高腳屋度假村，坐擁純白沙灘、私人潟湖與無敵日落夕陽。",
        description: "民答那峨最奢華的指標級海島度假村，保留菲律賓南部傳統建築工藝，提供私人快艇接駁與極致浮潛環境。",
        address: "Kaputian, Island Garden City of Samal, Davao del Norte",
        phone: "+63 82 285 0601",
        images: [
            "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop"
        ]
    },
    {
        id: "samal_chemas_by_the_sea",
        city: "samal",
        name: "Chema's by the Sea",
        name_en: "Chema's by the Sea",
        categoryKey: "hotel_villa",
        islandType: "villa",
        googleRating: 4.6,
        googleReviewCount: 450,
        isCurated: true,
        curatedBadge: "👑 站長私房嚴選",
        curatedNote: "隱密寧靜的西班牙風格海灘別墅，僅有少數幾棟客房，私密性極高，適合情侶小憩放空。",
        description: "充滿熱帶花園綠意與地中海石雕風情的精品沙灘別墅，傍晚在私人海灘享用燭光晚餐體驗極佳。",
        address: "Limao, Island Garden City of Samal",
        phone: "+63 917 814 0814",
        images: [
            "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&auto=format&fit=crop"
        ]
    },
    {
        id: "samal_marina_tuna",
        city: "samal",
        name: "Marina Tuna Samal Seaside",
        name_en: "Marina Tuna Samal",
        categoryKey: "bbq_seafood",
        islandType: "food",
        googleRating: 4.5,
        googleReviewCount: 520,
        description: "民答那峨傳奇鮪魚專賣海景分店，主打新鮮現殺十種部位鮪魚料理與現烤海鮮炭火燒物。",
        address: "Babak District, Island Garden City of Samal",
        phone: "+63 82 233 2266",
        images: [
            "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800&auto=format&fit=crop"
        ]
    },

    // ==================== 2. 長灘島 (BORACAY) ====================
    {
        id: "boracay_shangri_la",
        city: "boracay",
        name: "Shangri-La Boracay (長灘島香格里拉度假村)",
        name_en: "Shangri-La Boracay",
        categoryKey: "hotel_villa",
        islandType: "villa",
        googleRating: 4.8,
        googleReviewCount: 3800,
        isCurated: true,
        curatedBadge: "👑 站長海島推薦",
        curatedNote: "長灘島無可撼動的奢華頂點！獨佔私人海灣 Punta Bunga，懸崖泳池別墅與私人快艇迎賓極致尊榮。",
        description: "座落於長灘島西北端生態保護區內的五星級私人海灣度假村，提供隱密奢華別墅、頂級水療與絕美夕陽餐酒館。",
        address: "Barangay Yapak, Boracay Island, Malay, Aklan",
        phone: "+63 36 288 4988",
        images: [
            "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&auto=format&fit=crop"
        ]
    },
    {
        id: "boracay_henann_crystal_sands",
        city: "boracay",
        name: "Henann Crystal Sands Resort",
        name_en: "Henann Crystal Sands",
        categoryKey: "hotel_villa",
        islandType: "hotel",
        googleRating: 4.7,
        googleReviewCount: 2900,
        description: "Station 2 白沙灘正第一排頂級海景飯店，擁有高空無邊際透明泳池，出門一秒踏上麵粉白沙。",
        address: "Station 2, Balabag, Boracay Island",
        phone: "+63 36 288 9222",
        images: [
            "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop"
        ]
    },
    {
        id: "boracay_jonahs_fruit_shake",
        city: "boracay",
        name: "Jonah's Fruit Shake (長灘島必喝芒果冰沙)",
        name_en: "Jonah's Fruit Shake",
        categoryKey: "coffee_drinks",
        islandType: "food",
        googleRating: 4.6,
        googleReviewCount: 2400,
        isCurated: true,
        curatedBadge: "👑 站長私房嚴選",
        curatedNote: "長灘島無人不知的傳奇冰沙老店！必點芒果香蕉牛奶冰沙（Mango Banana with Milk），濃郁爆棚。",
        description: "長灘島營業數十年的招牌水果冰沙老字號，吹著海風吸一口螺旋瓶裝濃郁冰沙是長灘經典體驗。",
        address: "Station 1, Balabag, Boracay Island",
        phone: "+63 36 288 3286",
        images: [
            "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&auto=format&fit=crop"
        ]
    },
    {
        id: "boracay_dos_mestizos",
        city: "boracay",
        name: "Dos Mestizos (長灘島招牌西班牙海鮮飯)",
        name_en: "Dos Mestizos",
        categoryKey: "bbq_seafood",
        islandType: "food",
        googleRating: 4.6,
        googleReviewCount: 1600,
        description: "長灘島老饕一致推崇的正統西班牙餐酒館，招牌墨魚海鮮烤飯（Paella Negra）與蒜香辣蝦回味無窮。",
        address: "Station 3, Calle Remedios, Boracay Island",
        phone: "+63 36 288 5786",
        images: [
            "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800&auto=format&fit=crop"
        ]
    },

    // ==================== 3. 巴拉望 (PALAWAN - 愛妮島 / 科隆) ====================
    {
        id: "palawan_miniloc_island_resort",
        city: "palawan",
        name: "El Nido Resorts Miniloc Island (愛妮島迷你諾度假村)",
        name_en: "Miniloc Island Resort",
        categoryKey: "hotel_villa",
        islandType: "villa",
        googleRating: 4.8,
        googleReviewCount: 1400,
        isCurated: true,
        curatedBadge: "👑 站長海島推薦",
        curatedNote: "直接座落在大潟湖（Big Lagoon）入口的石灰岩懸崖海灣，推開房門就是水上屋與綠寶石潟湖。",
        description: "愛妮島頂級奢華生態度假村，房型依山傍海直接建於平靜水面上，獨享與熱帶大魚共游的私人環礁。",
        address: "Miniloc Island, El Nido, Palawan",
        phone: "+63 2 7908 8988",
        images: [
            "https://images.unsplash.com/photo-1518684079-3c830dcef090?w=800&auto=format&fit=crop"
        ]
    },
    {
        id: "palawan_two_seasons_coron",
        city: "palawan",
        name: "Two Seasons Coron Island Resort (科隆兩季島嶼度假村)",
        name_en: "Two Seasons Coron Resort",
        categoryKey: "hotel_villa",
        islandType: "villa",
        googleRating: 4.7,
        googleReviewCount: 880,
        description: "科隆島頂級私人島嶼度假勝地，以環保奢華平房與長達百米的雙側白色沙灘聞名。",
        address: "Malcatec Island, Coron, Palawan",
        phone: "+63 2 8410 1313",
        images: [
            "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&auto=format&fit=crop"
        ]
    },
    {
        id: "palawan_trattoria_altrove",
        city: "palawan",
        name: "Trattoria Altrove (愛妮島排隊柴燒窯烤披薩)",
        name_en: "Trattoria Altrove El Nido",
        categoryKey: "bbq_seafood",
        islandType: "food",
        googleRating: 4.6,
        googleReviewCount: 2100,
        isCurated: true,
        curatedBadge: "👑 站長私房嚴選",
        curatedNote: "愛妮島夜間永遠大排長龍的歐陸名店！堅持傳統柴燒磚窯高溫現烤，薄脆餅皮與松露香氣令人難忘。",
        description: "愛妮島鎮上最熱門的意式餐酒館，入內需脫鞋感受木地板溫潤，窯烤披薩與手工義大利麵水準極高。",
        address: "Calle Hama, Brgy. Buena Suerte, El Nido, Palawan",
        phone: "+63 917 822 2433",
        images: [
            "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&auto=format&fit=crop"
        ]
    },

    // ==================== 4. 薄荷島 (BOHOL) ====================
    {
        id: "bohol_bee_farm_restaurant",
        city: "bohol",
        name: "Bohol Bee Farm (蜜蜂農場海景有機餐廳)",
        name_en: "Bohol Bee Farm Restaurant",
        categoryKey: "bbq_seafood",
        islandType: "food",
        googleRating: 4.7,
        googleReviewCount: 4200,
        isCurated: true,
        curatedBadge: "👑 站長海島推薦",
        curatedNote: "薄荷島必訪第一名！懸崖海景木棧台，招牌現摘有機花瓣沙拉、蜂蜜烤雞與木薯甜筒冰淇淋絕頂美味。",
        description: "座落於邦勞島懸崖畔的知名農莊餐廳，全採用在地自產生機食材，吹著海風享用健康美食極具儀式感。",
        address: "Dao, Dauis, Panglao Island, Bohol",
        phone: "+63 38 510 1822",
        images: [
            "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop"
        ]
    },
    {
        id: "bohol_amorita_resort",
        city: "bohol",
        name: "Amorita Resort (阿莫里塔懸崖度假村)",
        name_en: "Amorita Resort Bohol",
        categoryKey: "hotel_villa",
        islandType: "villa",
        googleRating: 4.8,
        googleReviewCount: 2600,
        isCurated: true,
        curatedBadge: "👑 站長私房嚴選",
        curatedNote: "高踞在 Alona 海灘南端懸崖上的奢華綠洲，無邊際泳池俯瞰整座海灣，兼具隱密與便利。",
        description: "邦勞島頂級靜謐度假村，擁有專屬私人階梯直通海灘，極簡現代海景別墅配有私密泳池與管家服務。",
        address: "1 Ester A. Lim Drive, Alona Beach, Panglao, Bohol",
        phone: "+63 38 502 9002",
        images: [
            "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&auto=format&fit=crop"
        ]
    }
];

async function syncIslands() {
    console.log("🚀 開始同步四大海島精選名店、星級飯店與頂級 Villa 至 Firestore...");
    let count = 0;
    for (const item of ISLANDS_DATA) {
        try {
            const docRef = doc(db, "restaurants", item.id);
            await setDoc(docRef, {
                ...item,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            console.log(`🌴 [海島同步成功] ${item.city.toUpperCase()} - ${item.name}`);
            count++;
        } catch (err) {
            console.error(`❌ 同步失敗: ${item.name}`, err);
        }
    }
    console.log(`🎉 四大海島名單同步完成！共 ${count} 筆神級吃住資料已寫入 Firestore。`);
    process.exit(0);
}

syncIslands();
