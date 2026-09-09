/**
 * Tour2Gether.ph - Google Sheet Master Database Service
 * 負責讀取 Google Sheet 三合一公開檢視資料 (BigV_Picks / Attractions / Promotions)
 * 支援標題自適應解析，保證 100% 抓出每欄真實資料
 */

const SHEET_ID = '1sQELyvgQ8ZhL0iolKZ0fdEgr6z7FrFsK5Cgl2xz145g';

/**
 * 透過 Google Visualization (gviz) API 抓取指定分頁資料
 * 具備雙重標題識別機制：優先讀取 c.label，若無則自動取第一列第一列為 Key
 */
async function fetchSheetData(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP 錯誤! 狀態碼: ${response.status}`);
    }
    
    const text = await response.text();
    const jsonString = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
    const data = JSON.parse(jsonString);
    
    if (!data.table || !data.table.rows || data.table.rows.length === 0) {
      return [];
    }

    // 1. 先嘗試從 cols 取標題
    let colKeys = data.table.cols.map(c => (c && c.label) ? String(c.label).trim().toLowerCase() : '');
    
    let startIndex = 0;
    // 如果 cols 裡面的 label 大多為空，代表試算表第一列 (rows[0]) 才是真實標題！
    const hasValidLabels = colKeys.some(k => k.length > 0);
    if (!hasValidLabels && data.table.rows.length > 0) {
      colKeys = data.table.rows[0].c.map(cell => cell && cell.v ? String(cell.v).trim().toLowerCase() : '');
      startIndex = 1; // 從第二列開始讀取真實資料
    }

    const result = [];
    for (let i = startIndex; i < data.table.rows.length; i++) {
      const r = data.table.rows[i];
      if (!r || !r.c) continue;

      const entry = {};
      let hasData = false;

      r.c.forEach((cell, idx) => {
        const key = colKeys[idx];
        const val = cell ? (cell.v !== null && cell.v !== undefined ? cell.v : '') : '';
        if (key) {
          entry[key] = typeof val === 'string' ? val.trim() : val;
          if (val !== '') hasData = true;
        }
        // 同時備份以欄位索引 (col_0, col_1...) 為 key，確保 100% 絕對拿得到資料！
        entry[`col_${idx}`] = typeof val === 'string' ? val.trim() : val;
      });

      if (hasData) {
        // 如果有 is_active 欄位，檢查是否為 TRUE；若沒有該欄位則預設收錄
        const isActiveStr = String(entry.is_active || entry.col_15 || 'TRUE').toUpperCase();
        if (isActiveStr === 'TRUE' || isActiveStr === '') {
          result.push(entry);
        }
      }
    }

    return result;
  } catch (error) {
    console.error(`讀取分頁 [${sheetName}] 失敗:`, error);
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
 * 一次性加載所有 Master Database 核心資料
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
