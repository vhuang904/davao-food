const admin = require('firebase-admin');
const https = require('https');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 使用你原本已發布整份文件的 CSV 網址
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR7RqEOBMOhNBT_Mo2kee4w4WNugbZFLRRWhmc3c9FWCjams-n9oyaug1bI4lXyd0G9MfU8ftW8utuJ/pub?output=csv';

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
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push(field.trim());
      field = '';
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && nextC === '\n') i++;
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

  const headers = rows[0].map(h => h.replace(/^"|"$/g, '').trim()).filter(h => h !== '');
  const result = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length === 0 || (r.length === 1 && r[0] === '')) continue;
    
    const obj = {};
    headers.forEach((header, index) => {
      let val = r[index] !== undefined ? r[index] : '';
      obj[header] = val.replace(/^"|"$/g, '').trim();
    });
    
    if (obj.name || obj.title || obj.videoUrl) {
      result.push(obj);
    }
  }
  return result;
}

function fetchCSVData(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
        return fetchCSVData(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function syncData() {
  console.log("【單一網址同步】正在從 Google 試算表抓取整份文件資料...");
  try {
    const csvText = await fetchCSVData(SHEET_CSV_URL);
    const allData = parseCSV(csvText);

    if (allData.length === 0) {
      console.log("警告：沒有解析到任何有效資料。");
      return;
    }

    const batch = db.batch();
    let restaurantCount = 0;
    let videoCount = 0;

    for (let i = 0; i < allData.length; i++) {
      const item = allData[i];

      // 判斷是否為短影片資料 (依據 title 與 videoUrl)
      if (item.title && item.videoUrl) {
        const safeTitle = item.title.replace(/[^a-zA-Z0-9]/g, '') || ('video_' + i);
        const docRef = db.collection('videos').doc(safeTitle);
        batch.set(docRef, item, { merge: true });
        videoCount++;
      } 
      // 判斷是否為餐廳資料
      else if (item.name && !item.name.toLowerCase().startsWith('city:') && !/^\d+$/.test(item.name)) {
        const city = item.city ? item.city.trim().toLowerCase() : 'davao';
        let safeName = item.name.replace(/[^a-zA-Z0-9]/g, '');
        if (!safeName || safeName.trim() === '') {
          safeName = 'restaurant_' + i;
        }
        const docRef = db.collection('restaurants').doc(`${city}_${safeName}`);
        batch.set(docRef, item, { merge: true });
        restaurantCount++;
      }
    }

    await batch.commit();
    console.log(`同步完成！成功寫入 ${restaurantCount} 筆餐廳、${videoCount} 筆短影片到 Firebase！`);
  } catch (error) {
    console.error("同步失敗詳細原因：", error);
    process.exit(1);
  }
}

syncData();
