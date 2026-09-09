/**
 * Tour2Gether.ph - Google Sheet Master Database Service
 * 負責讀取 Google Sheet 三合一公開檢視資料 (BigV_Picks / Attractions / Promotions)
 */

const SHEET_ID = '1sQELyvgQ8ZhL0iolKZ0fdEgr6z7FrFsK5Cgl2xz145g';

/**
 * 透過 Google Visualization (gviz) API 抓取指定分頁資料
 * @param {string} sheetName - 分頁名稱 (BigV_Picks / Attractions / Promotions)
 * @returns {Promise<Array<Object>>} 欄位鍵值物件陣列
 */
async function fetchSheetData(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP 錯誤! 狀態碼: ${response.status}`);
    }
    
    const text = await response.text();
    // gviz API 回傳格式為: /*O_o*/ google.visualization.Query.setResponse({...});
    // 需要擷取有效的 JSON 字串
    const jsonString = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
    const data = JSON.parse(jsonString);
    
    const cols = data.table.cols.map(c => (c ? (c.label || '').trim() : ''));
    const rows = data.table.rows;

    const result = [];
    rows.forEach(r => {
      const entry = {};
      let hasData = false;
      r.c.forEach((cell, idx) => {
        const key = cols[idx];
        if (key) {
          const val = cell ? (cell.v !== null && cell.v !== undefined ? cell.v : '') : '';
          entry[key] = typeof val === 'string' ? val.trim() : val;
          if (val !== '') hasData = true;
        }
      });
      // 只收錄有效非空白資料且 is_active 為 TRUE 的項目
      if (hasData) {
        const isActive = String(entry.is_active || '').toUpperCase() === 'TRUE';
        if (isActive) {
          result.push(entry);
        }
      }
    });

    return result;
  } catch (error) {
    console.error(`讀取分頁 [${sheetName}] 失敗:`, error);
    return [];
  }
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
