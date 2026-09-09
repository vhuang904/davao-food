/**
 * 大V的旅遊窩 PWA - Google Sheets CMS 資料串接服務 (v17.1 Zero-Cache Hotfix)
 * 移除有害死鎖快取，保證使用者每次開啟皆抓取 Google 試算表真值
 */

export const SHEET_CONFIG = {
  spreadsheetId: "1sQELyvgQ8ZhL0iolKZ0fdEgr6z7FrFsK5Cgl2xz145g",
  sheets: {
    bigVPicks: "BigV_Picks",
    attractions: "Attractions",
    promotions: "Promotions",
    autoDiscovered: "Auto_Discovered"
  }
};

/**
 * RFC 4180 強固型 CSV 狀態機解析器
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
          i++;
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

  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    rows.push(currentRow);
  }

  return rows;
}

/**
 * 抓取試算表 CSV（完全禁用快取，保證資料即時性）
 */
export async function fetchSheetCsv(sheetName) {
  // 加入時間戳記避免被瀏覽器或 CDN 暫存
  const timestamp = Date.now();
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_CONFIG.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}&_t=${timestamp}`;
  
  const response = await fetch(url, { cache: 'no-store' });
  
  if (!response.ok) {
    console.error(`[Sheet 抓取失敗] 分頁: ${sheetName}, HTTP 狀態: ${response.status}`);
    throw new Error(`無法抓取分頁 ${sheetName}: HTTP ${response.status}`);
  }

  const csvText = await response.text();
  const rawRows = parseCSV(csvText);
  if (!rawRows || rawRows.length < 2) {
    console.warn(`[Sheet 資料為空] 分頁: ${sheetName} 沒有有效列`);
    return [];
  }

  // 將表頭轉為標準乾淨的小寫 key
  const headers = rawRows[0].map(h => h.toLowerCase().trim().replace(/^['"]|['"]$/g, ''));
  const records = [];

  for (let r = 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0 || !row[0]) continue;

    const obj = {};
    headers.forEach((key, colIndex) => {
      let val = row[colIndex] || '';
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

function cleanPhoneNumber(phone) {
  if (!phone) return '';
  let str = String(phone).trim();
  str = str.replace(/^['"]+/, '').replace(/['"]+$/, '');
  return str;
}

function normalizeBigVPicks(rows) {
  return rows
    .filter(row => !row.is_active || String(row.is_active).trim().toUpperCase() !== 'FALSE')
    .map(row => ({
      id: row.id,
      city: (row.city || '').toLowerCase().trim(),
      name: row.name_zh || row.name || row.id,
      name_zh: row.name_zh || row.name || '',
      name_en: row.name_en || '',
      name_tl: row.name_tl || '',
      category: row.category || '',
      categoryKey: (row.category || '').toLowerCase().trim(),
      big_v_comment: row.bigv_comment_zh || row.big_v_comment || '',
      bigv_comment_zh: row.bigv_comment_zh || row.big_v_comment || '',
      bigv_comment_en: row.bigv_comment_en || '',
      bigv_comment_tl: row.bigv_comment_tl || '',
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

function normalizeAttractions(rows) {
  // 放寬過濾條件：只要不是明確填 FALSE，都視為有效上架
  return rows
    .filter(row => !row.is_active || String(row.is_active).trim().toUpperCase() !== 'FALSE')
    .map(row => ({
      id: row.id,
      city: (row.city || '').toLowerCase().trim(),
      name: row.name_zh || row.name || row.id,
      name_zh: row.name_zh || row.name || '',
      name_en: row.name_en || '',
      name_tl: row.name_tl || '',
      category: (row.category || '').toLowerCase().trim(),
      desc: row.desc_zh || row.description || row.desc || '',
      desc_zh: row.desc_zh || row.description || row.desc || '',
      desc_en: row.desc_en || '',
      desc_tl: row.desc_tl || '',
      address: row.address || '',
      phone: cleanPhoneNumber(row.phone),
      nav_link: row.nav_link || '',
      image_url: row.image_url || '',
      is_active: true
    }));
}

function normalizePromotions(rows) {
  // 放寬過濾條件：只要不是明確填 FALSE，都視為有效上架
  return rows
    .filter(row => !row.is_active || String(row.is_active).trim().toUpperCase() !== 'FALSE')
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
 * 載入 Master 資料庫核心（徹底移除快取，確保用戶每次都取得即時資料）
 */
export async function loadMasterDatabase() {
  const [rawBigV, rawAttr, rawPromo, rawAuto] = await Promise.allSettled([
    fetchSheetCsv(SHEET_CONFIG.sheets.bigVPicks),
    fetchSheetCsv(SHEET_CONFIG.sheets.attractions),
    fetchSheetCsv(SHEET_CONFIG.sheets.promotions),
    fetchSheetCsv(SHEET_CONFIG.sheets.autoDiscovered)
  ]);

  return {
    bigVPicks: rawBigV.status === 'fulfilled' ? normalizeBigVPicks(rawBigV.value) : [],
    attractions: rawAttr.status === 'fulfilled' ? normalizeAttractions(rawAttr.value) : [],
    promotions: rawPromo.status === 'fulfilled' ? normalizePromotions(rawPromo.value) : [],
    autoDiscovered: rawAuto.status === 'fulfilled' ? normalizeAutoDiscovered(rawAuto.value) : []
  };
}

export function getLocalizedText(item, field, langCode = 'zh') {
  if (!item) return '';
  const keySpecific = `${field}_${langCode}`;
  if (item[keySpecific] && String(item[keySpecific]).trim()) {
    return String(item[keySpecific]).trim();
  }
  const keyZh = `${field}_zh`;
  if (item[keyZh] && String(item[keyZh]).trim()) {
    return String(item[keyZh]).trim();
  }
  const keyEn = `${field}_en`;
  if (item[keyEn] && String(item[keyEn]).trim()) {
    return String(item[keyEn]).trim();
  }
  if (item[field] && String(item[field]).trim()) {
    return String(item[field]).trim();
  }
  return '';
}
