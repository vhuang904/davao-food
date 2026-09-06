const admin = require('firebase-admin');
const https = require('https');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 使用標準匯出 CSV 格式
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR7RqEOBMOhNBT_Mo2kee4w4WNugbZFLRRWhmc3c9FWCjams-n9oyaug1bI4lXyd0G9MfU8ftW8utuJ/pub?output=csv';

function fetchCSVData(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      console.log(`HTTP 狀態碼: ${res.statusCode}`);
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
  console.log("正在從 Google 試算表抓取資料...");
  try {
    const csvText = await fetchCSVData(SHEET_CSV_URL);
    console.log("抓取到的原始內容前 200 字元：", csvText.substring(0, 200));

    if (!csvText || csvText.includes("<!DOCTYPE html>")) {
      console.error("錯誤：Google 回傳了 HTML 頁面而非 CSV，可能是權限不足或網址格式有誤。");
      process.exit(1);
    }

    console.log("資料格式正常，準備進行解析...");
  } catch (error) {
    console.error("連線失敗：", error);
    process.exit(1);
  }
}

syncData();
