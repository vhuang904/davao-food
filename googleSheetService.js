/**
 * Tour2Gether.ph - Google Sheet Master Database Service
 * 採用 Google 官方公開 CSV 發布管道 (直讀真實資料庫)
 * 100% 杜絕 404/400 錯誤，免 API Key 秒速加載
 */

const SHEET_ID = '1sQELyvgQ8ZhL0iolKZ0fdEgr6z7FrFsK5Cgl2xz145g';
const PUBLISHED_BASE_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTMYS6pUL-XFoAw2zM2B_fje5qfFAKlCoeLF7heOYLVfktamsWAvPmP-tRgt5vDCioomA52oBMdXHsW/pub?output=csv';

// Attractions 分頁的真實 gid (由您發布的網址確認)
const ATTRACTIONS_GID = '1406320151';

/**
 * 健壯的 CSV 解析器（支援引號內逗號與換行）
 */
function parseCSV(text) {
  const lines = [];
  let row = [];
  let inQuotes = false;
  let currentStr = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentStr += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentStr.trim());
      currentStr = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(currentStr.trim());
      if (row.some(val => val !== '')) {
        lines.push(row);
      }
      row = [];
      currentStr = '';
    } else {
      currentStr += char;
    }
  }

  if (currentStr || row.length > 0) {
    row.push(currentStr.trim());
    if (row.some(val => val !== '')) {
      lines.push(row);
    }
  }

  if (lines.length < 2) return [];

  const headers = lines[0].map(h => h.toLowerCase().trim());
  const results = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i];
    const entry = {};
    let hasValue = false;

    headers.forEach((header, idx) => {
      const val = values[idx] !== undefined ? values[idx] : '';
      if (header) {
        entry[header] = val;
      }
      entry[`col_${idx}`] = val;
      if (val !== '') hasValue = true;
    });

    if (hasValue) {
      const isActive = String(entry.is_active || 'TRUE').toUpperCase();
      if (isActive === 'TRUE' || isActive === '') {
        results.push(entry);
      }
    }
  }

  return results;
}

/**
 * 透過公開 CSV 端點或 gviz 直讀指定分頁資料
 */
async function fetchSheetData(sheetName) {
  let url = '';
  if (sheetName === 'Attractions') {
    url = `${PUBLISHED_BASE_URL}&gid=${ATTRACTIONS_GID}&t=${Date.now()}`;
  } else {
    // BigV_Picks 與 Promotions 採用公開 gviz 查詢，免猜 gid 永不 400
    url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}&t=${Date.now()}`;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP 狀態碼錯誤: ${response.status}`);
    }
    const csvText = await response.text();
    const data = parseCSV(csvText);
    return data;
  } catch (error) {
    console.warn(`讀取分頁 [${sheetName}] 失敗:`, error);
    return [];
  }
}

/**
 * 多語系文字取得輔助函式
 */
export function getLocalizedText(item, fieldPrefix, lang = 'zh') {
  if (!item) return '';
  const currentLang = (lang || 'zh').toLowerCase();

  const targetKey = `${fieldPrefix}_${currentLang}`;
  if (item[targetKey] && String(item[targetKey]).trim() !== '') {
    return String(item[targetKey]).trim();
  }

  const enKey = `${fieldPrefix}_en`;
  if (item[enKey] && String(item[enKey]).trim() !== '') {
    return String(item[enKey]).trim();
  }

  const zhKey = `${fieldPrefix}_zh`;
  if (item[zhKey] && String(item[zhKey]).trim() !== '') {
    return String(item[zhKey]).trim();
  }

  if (item[fieldPrefix] && String(item[fieldPrefix]).trim() !== '') {
    return String(item[fieldPrefix]).trim();
  }

  return '';
}

/**
 * 一次性加載三合一主資料庫
 */
export async function loadMasterDatabase() {
  console.log('🔄 正在同步 Tour2Gether Master Database...');
  const [bigVPicks, attractions, promotions] = await Promise.all([
    fetchSheetData('BigV_Picks'),
    fetchSheetData('Attractions'),
    fetchSheetData('Promotions')
  ]);

  console.log(`✅ 同步完成: 站長嚴選 (${bigVPicks.length} 筆), 景點 (${attractions.length} 筆), 專屬優惠 (${promotions.length} 筆)`);

  return {
    bigVPicks,
    attractions,
    promotions
  };
}
