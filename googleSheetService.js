/**
 * Tour2Gether.ph - Google Sheet Master Database Service
 * 採用 Google 官方「發布到網路」CSV 直讀管道
 * 100% 解決 404 權限問題，秒速加載真實試算表數據
 */

const PUBLISHED_BASE_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTMYS6pUL-XFoAw2zM2B_fje5qfFAKlCoeLF7heOYLVfktamsWAvPmP-tRgt5vDCioomA52oBMdXHsW/pub?output=csv';

// 各工作表名稱與 gid 對照 ( Attractions gid 為 1406320151 )
const SHEET_CONFIGS = {
  'BigV_Picks': '0',
  'Attractions': '1406320151',
  'Promotions': '1829302194'
};

/**
 * 簡易健壯的 CSV 解析器（支援引號內逗號與換行）
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
 * 透過公開 CSV 端點讀取指定分頁
 */
async function fetchSheetData(sheetName) {
  const gid = SHEET_CONFIGS[sheetName] || '0';
  const url = `${PUBLISHED_BASE_URL}&gid=${gid}&t=${Date.now()}`;

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
 * 多語系文字輔助函式
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
  console.log('🔄 正在同步 Tour2Gether Master Database (公開網路發布端)...');
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
