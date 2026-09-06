const admin = require('firebase-admin');
const https = require('https');

// 從 GitHub Secret 讀取 Firebase 金鑰
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 你的 Google 試算表 CSV 匯出網址
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR7RqEOBMOhNBT_Mo2kee4w4WNugbZFLRRWhmc3c9FWCjams-n9oyaug1bI4lXyd0G9MfU8ftW8utuJ/pub?output=csv';

// 解析 CSV 的工具函數
function parseCSV(text) {
  const lines = text.split('\n');
  const result = [];
  if (lines.length === 0) return result;
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const row = [];
    let inQuote = false;
    let currentVal = '';
    
    for (let char of lines[i]) {
      if (char === '"') {
        inQuote = !inQuote;
      } else if (char === ',' && !inQuote) {
        row.push(currentVal.trim());
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
    row.push(currentVal.trim());

    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] ? row[index].replace(/^"|"$/g, '') : '';
    });
    result.push(obj);
  }
  return result;
}

// 透過 HTTPS 下載 CSV 內容
function fetchCSVData(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      // 處理重新導向 (Google Publish 網址常會重新導向)
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchCSVData(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function syncData() {
  console.log("正在從 Google 試算表抓取最新資料...");
  try {
    const csvText = await fetchCSVData(SHEET_CSV_URL);
    const restaurantsData = parseCSV(csvText);

    if (restaurantsData.length === 0) {
      console.log("警告：沒有抓到任何資料，請檢查 Google 試算表格式是否正確。");
      return;
    }

    console.log(`成功解析 ${restaurantsData.length} 筆資料，準備寫入 Firebase...`);
    const batch = db.batch();
    
    for (const item of restaurantsData) {
      if (!item.name) continue; // 若沒有店名則跳過
      const city = item.city || 'davao';
      const docId = `${city}_${item.name.replace(/[^a-zA-Z0-9]/g, '')}`;
      const docRef = db.collection('restaurants').doc(docId);
      batch.set(docRef, item, { merge: true });
    }

    await batch.commit();
    console.log("所有資料已成功同步到 Firebase Firestore！");
  } catch (error) {
    console.error("同步失敗：", error);
    process.exit(1);
  }
}

syncData();
