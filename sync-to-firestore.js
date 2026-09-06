const admin = require('firebase-admin');
const https = require('https');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 你的 Google 試算表 CSV 匯出網址
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR7RqEOBMOhNBT_Mo2kee4w4WNugbZFLRRWhmc3c9FWCjams-n9oyaug1bI4lXyd0G9MfU8ftW8utuJ/pub?output=csv';

// 支援引號與換行的強效 CSV 解析器
function parseCSV(text) {
  const rows = [];
  let row = [];
  let inQuotes = false;
  let field = '';

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const nextC = text[i + 1];

    if (c === '"') {
      if (inQuotes && nextC === '"') {
        field += '"';
        i++; // 跳過下一個引號
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push(field.trim());
      field = '';
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && nextC === '\n') i++; // 處理 \r\n
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }

  if (rows.length < 2) return [];

  const headers = rows[0].map(h => h.replace(/^"|"$/g, '').trim());
  const result = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length === 0 || (r.length === 1 && r[0] === '')) continue;
    
    const obj = {};
    headers.forEach((header, index) => {
      let val = r[index] !== undefined ? r[index] : '';
      obj[header] = val.replace(/^"|"$/g, '').trim();
    });
    
    if (obj.name) { // 確保有店名才收錄
      result.push(obj);
    }
  }
  return result;
}

function fetchCSVData(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
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
  console.log("正在從 Google 試算表抓取最新 CSV 資料...");
  try {
    const csvText = await fetchCSVData(SHEET_CSV_URL);
    const restaurantsData = parseCSV(csvText);

    if (restaurantsData.length === 0) {
      console.log("警告：解析後沒有找到任何餐廳資料，請確認試算表第一分頁是否有內容。");
      return;
    }

    console.log(`成功解析 ${restaurantsData.length} 筆餐廳資料，準備寫入 Firebase...`);
    const batch = db.batch();
    
    for (const item of restaurantsData) {
      const city = item.city || 'davao';
      const docId = `${city}_${item.name.replace(/[^a-zA-Z0-9]/g, '')}`;
      const docRef = db.collection('restaurants').doc(docId);
      batch.set(docRef, item, { merge: true });
    }

    await batch.commit();
    console.log("所有餐廳資料已成功同步到 Firebase Firestore！");
  } catch (error) {
    console.error("同步失敗：", error);
    process.exit(1);
  }
}

syncData();
