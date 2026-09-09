/**
 * 大V的旅遊窩 PWA - Google Sheets CMS 資料串接服務 (v17.0 Master)
 * 支援四大分頁 Schema 映射、RFC 4180 狀態機 CSV 解析、多語系 Fallback 與快取機制
 */

// 試算表設定 (已對齊您的真實 Google Sheet)
export const SHEET_CONFIG = {
  spreadsheetId: "1sQELyvgQ8ZhL0iolKZ0fdEgr6z7FrFsK5Cgl2xz145g", //
  sheets: {
    bigVPicks: "BigV_Picks",
    attractions: "Attractions",
    promotions: "Promotions",
    autoDiscovered: "Auto_Discovered"
  },
  // 快取有效期限：5 分鐘 (毫秒)
  cacheTTL: 5 * 60 * 1000
};

/**
 * RFC 4180 規格之強固型 CSV 解析器 (狀態機實作)
 * 能精準處理單元格內的換行、逗號與雙引號跳脫
 */
export function parseCSV(text) {
  const rows = [];
  let currentRow = [];
  let currentVal = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentVal += '"';
          i++; // 跳過下一個轉義雙引號
        } else {
          inQuotes = false;
        }
      } else {
        currentVal += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentVal.trim());
        currentVal = '';
      } else if (char === '\r') {
        if (nextChar === '\n') i++;
        currentRow.push(currentVal.trim());
        rows.push(currentRow);
        currentRow = [];
        currentVal = '';
      } else if (char === '\n') {
        currentRow.push(currentVal.trim());
        rows.push(currentRow);
        currentRow = [];
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
  }

  // 處理最後一個單元格
  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    rows.push(currentRow);
  }

  return rows;
}

/**
 * 依據 Sheet 名稱抓取 gviz/tq CSV 資料並轉為物件陣列
 */
export async function fetchSheetCsv(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_CONFIG.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  const response = await fetch(url, { cache: 'no-store' });
  
  if (!response.ok) {
    throw new Error(`無法抓取分頁 ${sheetName}: HTTP ${response.status}`);
  }

  const csvText = await response.text();
  const rawRows = parseCSV(csvText);
  if (!rawRows || rawRows.length < 2) return [];

  const headers = rawRows[0].map(h => h.toLowerCase().trim().replace(/^['"]|['"]$/g, ''));
  const records = [];

  for (let r = 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0 || !row[0]) continue; // 略過無 ID 之空行

    const obj = {};
    headers.forEach((key, colIndex) => {
      let val = row[colIndex] || '';
      // 清除多餘包裹引號
      if (typeof val === 'string') {
        val = val.trim();
        if (val.startsWith("'") || val.startsWith('"')) {
          val = val.replace(/^['"]/, '').replace(/['"]$/, '');
        }
      }
      obj[key] = val;
    });

    records.push(obj);
  }

  return records;
}

/**
 * 1. BigV_Picks Schema (17 欄位精準映射)
 * id | city | name_zh | name_en | name_tl | category | bigv_comment_zh | bigv_comment_en | bigv_comment_tl | must_try_zh | must_try_en | must_try_tl | address | phone | image_url | is_active | nav_link
 */
function normalizeBigVPicks(rows) {
  return rows
    .filter(row => (row.is_active || 'TRUE').toUpperCase() === 'TRUE')
    .map(row => ({
      id: row.id,
      city: (row.city || '').toLowerCase().trim(),
      name: row.name_zh || row.name || row.id,
      name_zh: row.name_zh || row.name || '',
      name_en: row.name_en || '',
      name_tl: row.name_tl || '',
      category: row.category || '',
      categoryKey: (row.category || '').toLowerCase().trim(),
      // 點評三語
      big_v_comment: row.bigv_comment_zh || row.big_v_comment || '',
      bigv_comment_zh: row.bigv_comment_zh || row.big_v_comment || '',
      bigv_comment_en: row.bigv_comment_en || '',
      bigv_comment_tl: row.bigv_comment_tl || '',
      // 必點三語
      must_try: row.must_try_zh || row.must_try || '',
      must_try_zh: row.must_try_zh || row.must_try || '',
      must_try_en: row.must_try_en || '',
      must_try_tl: row.must_try_tl || '',
      address: row.address || '',
      phone: cleanPhoneNumber(row.phone),
      image_url: row.image_url || '',
      nav_link: row.nav_link || '',
      is_active: true
    }));
}

/**
 * 2. Attractions Schema (13 欄位精準映射)
 * id | name_zh | name_en | name_tl | city | category | desc_zh | desc_en | desc_tl | image_url | address | nav_link | is_active
 */
function normalizeAttractions(rows) {
  return rows
    .filter(row => (row.is_active || 'TRUE').toUpperCase() === 'TRUE')
    .map(row => ({
      id: row.id,
      city: (row.city || '').toLowerCase().trim(),
      name: row.name_zh || row.name || row.id,
      name_zh: row.name_zh || row.name || '',
      name_en: row.name_en || '',
      name_tl: row.name_tl || '',
      category: row.category || '',
      desc: row.desc_zh || row.description || '',
      desc_zh: row.desc_zh || row.description || '',
      desc_en: row.desc_en || '',
      desc_tl: row.desc_tl || '',
      address: row.address || '',
      phone: cleanPhoneNumber(row.phone),
      nav_link: row.nav_link || '',
      image_url: row.image_url || '',
      is_active: true
    }));
}

/**
 * 3. Promotions Schema (16 欄位精準映射)
 * id | city | type | is_active | store_name | title_zh | title_en | title_tl | description_zh | description_en | description_tl | valid_until | image_url | address | phone | nav_link
 */
function normalizePromotions(rows) {
  return rows
    .filter(row => (row.is_active || 'TRUE').toUpperCase() === 'TRUE')
    .map(row => ({
      id: row.id,
      city: (row.city || 'all').toLowerCase().trim(),
      type: (row.type || 'ongoing').toLowerCase().trim(),
      store_name: row.store_name || row.brand || '精選特約門市',
      title: row.title_zh || row.title || '',
      title_zh: row.title_zh || row.title || '',
      title_en: row.title_en || '',
      title_tl: row.title_tl || '',
      description: row.description_zh || row.description || '',
      description_zh: row.description_zh || row.description || '',
      description_en: row.description_en || '',
      description_tl: row.description_tl || '',
      valid_until: row.valid_until || '長期有效',
      address: row.address || '',
      phone: cleanPhoneNumber(row.phone),
      nav_link: row.nav_link || '',
      image_url: row.image_url || '',
      is_active: true
    }));
}

/**
 * 4. Auto_Discovered Schema (13 欄位預留爬蟲規格)
 * id | city | type | name_zh | name_en | name_tl | category | google_rating | review_count | address | phone | image_url | nav_link
 */
function normalizeAutoDiscovered(rows) {
  return rows.map(row => ({
    id: row.id,
    city: (row.city || '').toLowerCase().trim(),
    type: (row.type || 'restaurant').toLowerCase().trim(),
    name_zh: row.name_zh || '',
    name_en: row.name_en || '',
    name_tl: row.name_tl || '',
    category: row.category || '',
    googleRating: parseFloat(row.google_rating) || 4.5,
    googleReviewCount: parseInt(row.review_count, 10) || 50,
    address: row.address || '',
    phone: cleanPhoneNumber(row.phone),
    image_url: row.image_url || '',
    nav_link: row.nav_link || ''
  }));
}

/**
 * 電話號碼過濾器：清除開頭引號與特殊不合法字元
 */
function cleanPhoneNumber(phone) {
  if (!phone) return '';
  let str = String(phone).trim();
  str = str.replace(/^['"]+/, '').replace(/['"]+$/, '');
  return str;
}

/**
 * 載入 Master 資料庫核心入口（具備 LocalStorage 快取容錯）
 */
export async function loadMasterDatabase(forceRefresh = false) {
  const cacheKey = 'bigv_master_db_cache';
  const cacheTimeKey = 'bigv_master_db_time';

  if (!forceRefresh) {
    try {
      const cached = localStorage.getItem(cacheKey);
      const cacheTime = localStorage.getItem(cacheTimeKey);
      if (cached && cacheTime && (Date.now() - parseInt(cacheTime, 10) < SHEET_CONFIG.cacheTTL)) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.warn("讀取快取失敗，改採即時連線抓取:", e);
    }
  }

  // 平行異步抓取四大分頁
  const [rawBigV, rawAttr, rawPromo, rawAuto] = await Promise.allSettled([
    fetchSheetCsv(SHEET_CONFIG.sheets.bigVPicks),
    fetchSheetCsv(SHEET_CONFIG.sheets.attractions),
    fetchSheetCsv(SHEET_CONFIG.sheets.promotions),
    fetchSheetCsv(SHEET_CONFIG.sheets.autoDiscovered)
  ]);

  const result = {
    bigVPicks: rawBigV.status === 'fulfilled' ? normalizeBigVPicks(rawBigV.value) : [],
    attractions: rawAttr.status === 'fulfilled' ? normalizeAttractions(rawAttr.value) : [],
    promotions: rawPromo.status === 'fulfilled' ? normalizePromotions(rawPromo.value) : [],
    autoDiscovered: rawAuto.status === 'fulfilled' ? normalizeAutoDiscovered(rawAuto.value) : []
  };

  try {
    localStorage.setItem(cacheKey, JSON.stringify(result));
    localStorage.setItem(cacheTimeKey, Date.now().toString());
  } catch (e) {
    console.warn("寫入 LocalStorage 快取失敗:", e);
  }

  return result;
}

/**
 * 多語系文字安全取得工具 (含三級 Fallback)
 * @param {Object} item 資料物件
 * @param {string} field 欄位前綴 (如 'name', 'desc', 'title', 'bigv_comment', 'must_try')
 * @param {string} langCode 語言簡碼 ('zh', 'en', 'tl')
 */
export function getLocalizedText(item, field, langCode = 'zh') {
  if (!item) return '';

  const keySpecific = `${field}_${langCode}`;
  if (item[keySpecific] && String(item[keySpecific]).trim()) {
    return String(item[keySpecific]).trim();
  }

  // 1. 回退到中文
  const keyZh = `${field}_zh`;
  if (item[keyZh] && String(item[keyZh]).trim()) {
    return String(item[keyZh]).trim();
  }

  // 2. 回退到英文
  const keyEn = `${field}_en`;
  if (item[keyEn] && String(item[keyEn]).trim()) {
    return String(item[keyEn]).trim();
  }

  // 3. 回退到純欄位名
  if (item[field] && String(item[field]).trim()) {
    return String(item[field]).trim();
  }

  return '';
}
