/**
 * 大V的旅遊窩 PWA - Google Sheets CMS 資料串接服務 (v17.5 Multi-Tab Medical & Smart Links)
 * 移除有害死鎖快取，保證使用者每次開啟皆抓取 Google 試算表真值
 * 支援分頁：BigV_Picks, Attractions, Promotions, Auto_Discovered, Medical
 */

export const SHEET_CONFIG = {
  spreadsheetId: "1sQELyvgQ8ZhL0iolKZ0fdEgr6z7FrFsK5Cgl2xz145g",
  sheets: {
    bigVPicks: "BigV_Picks",
    attractions: "Attractions",
    promotions: "Promotions",
    autoDiscovered: "Auto_Discovered",
    medical: "Medical"
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

  // 將表頭轉為標準乾淨的小寫 key，並替換底線
  const headers = rawRows[0].map(h => h.toLowerCase().trim().replace(/^['"]|['"]$/g, '').replace(/[\s_-]/g, ''));
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
    .filter(row => !row.isactive || String(row.isactive).trim().toUpperCase() !== 'FALSE')
    .map(row => ({
      id: row.id,
      city: (row.city || '').toLowerCase().trim(),
      name: row.namezh || row.name || row.id,
      name_zh: row.namezh || row.name || '',
      name_en: row.nameen || '',
      name_tl: row.nametl || '',
      category: row.category || '',
      categoryKey: (row.category || '').toLowerCase().trim(),
      big_v_comment: row.bigvcommentzh || row.bigvcomment || '',
      bigv_comment_zh: row.bigvcommentzh || row.bigvcomment || '',
      bigv_comment_en: row.bigvcommenten || '',
      bigv_comment_tl: row.bigvcommenttl || '',
      must_try: row.musttryzh || row.musttry || '',
      must_try_zh: row.musttryzh || row.musttry || '',
      must_try_en: row.musttryen || '',
      must_try_tl: row.musttrytl || '',
      address: row.address || '',
      phone: cleanPhoneNumber(row.phone),
      website: row.website || '',
      image_url: row.imageurl || row.image || '',
      nav_link: row.navlink || '',
      is_active: true
    }));
}

function normalizeAttractions(rows) {
  return rows
    .filter(row => !row.isactive || String(row.isactive).trim().toUpperCase() !== 'FALSE')
    .map(row => ({
      id: row.id,
      city: (row.city || '').toLowerCase().trim(),
      type: 'attraction',
      name: row.namezh || row.name || row.id,
      name_zh: row.namezh || row.name || '',
      name_en: row.nameen || '',
      name_tl: row.nametl || '',
      category: row.category || '',
      categoryKey: (row.category || '').toLowerCase().trim(),
      desc: row.desczh || row.description || row.desc || '',
      desc_zh: row.desczh || row.description || row.desc || '',
      desc_en: row.descen || '',
      desc_tl: row.desctl || '',
      googleRating: parseFloat(row.googlerating) || 4.5,
      googleReviewCount: parseInt(row.googlereviewcount || row.reviewcount, 10) || 100,
      address: row.address || '',
      phone: cleanPhoneNumber(row.phone),
      website: row.website || '',
      image_url: row.imageurl || row.image || '',
      nav_link: row.navlink || '',
      is_active: true
    }));
}

function normalizePromotions(rows) {
  return rows
    .filter(row => !row.isactive || String(row.isactive).trim().toUpperCase() !== 'FALSE')
    .map(row => ({
      id: row.id,
      city: (row.city || 'all').toLowerCase().trim(),
      type: (row.type || 'ongoing').toLowerCase().trim(),
      store_name: row.storename || row.brand || '精選特約門市',
      title: row.titlezh || row.title || '',
      title_zh: row.titlezh || row.title || '',
      title_en: row.titleen || '',
      title_tl: row.titletl || '',
      description: row.descriptionzh || row.description || '',
      description_zh: row.descriptionzh || row.description || '',
      description_en: row.descriptionen || '',
      description_tl: row.descriptiontl || '',
      valid_until: row.validuntil || '長期有效',
      address: row.address || '',
      phone: cleanPhoneNumber(row.phone),
      website: row.website || '',
      image_url: row.imageurl || row.image || '',
      nav_link: row.navlink || '',
      is_active: true
    }));
}

function normalizeAutoDiscovered(rows) {
  return rows.map(row => ({
    id: row.id,
    city: (row.city || '').toLowerCase().trim(),
    type: (row.type || 'restaurant').toLowerCase().trim(),
    name_zh: row.namezh || '',
    name_en: row.nameen || '',
    name_tl: row.nametl || '',
    category: row.category || '',
    categoryKey: (row.category || '').toLowerCase().trim(),
    googleRating: parseFloat(row.googlerating) || 4.5,
    googleReviewCount: parseInt(row.googlereviewcount || row.reviewcount, 10) || 50,
    address: row.address || '',
    phone: cleanPhoneNumber(row.phone),
    website: row.website || '',
    image_url: row.imageurl || row.image || '',
    nav_link: row.navlink || ''
  }));
}

function normalizeMedical(rows) {
  return rows
    .filter(row => !row.isactive || String(row.isactive).trim().toUpperCase() !== 'FALSE')
    .map(row => ({
      id: row.id,
      city: (row.city || '').toLowerCase().trim(),
      type: 'medical',
      name: row.namezh || row.nameen || row.name || row.id,
      name_zh: row.namezh || '',
      name_en: row.nameen || '',
      name_tl: row.nametl || '',
      category: (row.category || 'clinic').toLowerCase().trim(), // hospital | clinic | pharmacy
      address: row.address || '',
      phone: cleanPhoneNumber(row.phone),
      website: row.website || '',
      image_url: row.imageurl || row.image || '',
      nav_link: row.navlink || '',
      is_active: true
    }));
}

/**
 * 載入 Master 資料庫核心（徹底移除快取，並將 Medical 分頁納入同步）
 */
export async function loadMasterDatabase() {
  const [rawBigV, rawAttr, rawPromo, rawAuto, rawMed] = await Promise.allSettled([
    fetchSheetCsv(SHEET_CONFIG.sheets.bigVPicks),
    fetchSheetCsv(SHEET_CONFIG.sheets.attractions),
    fetchSheetCsv(SHEET_CONFIG.sheets.promotions),
    fetchSheetCsv(SHEET_CONFIG.sheets.autoDiscovered),
    fetchSheetCsv(SHEET_CONFIG.sheets.medical)
  ]);

  return {
    bigVPicks: rawBigV.status === 'fulfilled' ? normalizeBigVPicks(rawBigV.value) : [],
    attractions: rawAttr.status === 'fulfilled' ? normalizeAttractions(rawAttr.value) : [],
    promotions: rawPromo.status === 'fulfilled' ? normalizePromotions(rawPromo.value) : [],
    autoDiscovered: rawAuto.status === 'fulfilled' ? normalizeAutoDiscovered(rawAuto.value) : [],
    medical: rawMed.status === 'fulfilled' ? normalizeMedical(rawMed.value) : []
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
