// === 動態設定後端 API 位址（優先使用 Flask:5000） ===
const isLocal = ['127.0.0.1','localhost'].includes(location.hostname);

// 依你的 app.py 路由擇一會成功：
const CANDIDATES = isLocal
  ? [
      'http://127.0.0.1:5000/api',             // ✅ Flask（REST）
      'http://127.0.0.1:5000/app.py',  // ✅ Flask（?path=）
      'http://127.0.0.1:5000'                   // 後備
    ]
  : [
      '/api',
      '/app.py',
      '/'
    ];

let API_BASE = CANDIDATES[0];

// --- Fix: DOM id="map" 造成的 window.map = HTMLElement 衝突 ---
(function neutralizeDomIdMap(){
  // 記住地圖容器（之後 initMap 會用）
  var el = document.getElementById('map');
  if (el && !(window.__mapEl instanceof HTMLElement)) window.__mapEl = el;

  // 清掉已被 DOM 污染的 window.map
  if (window.map instanceof HTMLElement) {
    try { delete window.map; } catch(_) { window.map = undefined; }
  }

  // 永久接管 window.map：只有程式賦值才會改變
  (function installWindowMapGuard(){
    let __gmap;
    Object.defineProperty(window, 'map', {
      configurable: true,
      get(){ return __gmap; },
      set(v){ __gmap = v; }
    });
  })();

  console.log('[guard] window.map guarded; container =', window.__mapEl);
})();

// === 全域快取：一定要在任何使用前先宣告（避免 TDZ） ===
if (!window.DETAILS_CACHE) window.DETAILS_CACHE = {};

function cacheKey(pid){ return `place:DETAILS:v1:${pid}`; }

function isUuid(s){
  return typeof s === 'string' &&
         /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function detailsIsComplete(d){
  if (!d || !d.place_id) return false;
  const hasRating = typeof d.rating === 'number';
  const hasPhoto  = Array.isArray(d.photos) && d.photos.length > 0;
  return hasRating || hasPhoto;
}

//true 為手動，false 為自動
window.TS_DISABLE_AUTO_ROUTE = false;
window.TS_DISABLE_AUTO_RECO = true;
window.TS_ENABLE_DAY_AUTO_RECO = false;
window.TS_DEBUG = false;             // 控制 console.log 

// 讓預算系統預設就視為可用，之後抓到物價 profile 會再覆蓋
window.__BUDGET_READY__ = true;
window.__COST_PROFILE_INITED = false;

// === Recommended Places 偏好 ===
window.SUGGEST_MIN_ZOOM   = 12;   // 只有放大到 >=12 才顯示星星（原本可能 8~10）
window.SUGGEST_MAX_TOTAL  = 100;  // 全地圖最多幾顆星
window.SUGGEST_PER_STOP   = 4;    // 每個 anchor stop 最多幾個推薦
window.SUGGEST_BATCH_YIELD = 20;  // 每產生幾顆就讓出 event loop（原本就有用，不會壞）

// 給 reco v2 用的偏好（如果之前已經有 RECO_PREFS，就改數值就好）
window.RECO_PREFS = window.RECO_PREFS || {};
Object.assign(window.RECO_PREFS, {
  minRating:   4.3, // 星等太低的直接不要
  minReviews:  50,  // 評價數太少的也不要
  perAnchorLimit: 20  // 每個 anchor 最多幾個候選（再配合上面的 SUGGEST_PER_STOP）
});

// 放在所有地圖初始化與事件綁定之後（任何會呼叫 getDetails 之前）
// 目的：把 PlacesService.getDetails 的 opts/resp 印出來，順便自動修正 placeid→placeId
function applyGooglePatches(){
  const PS = google?.maps?.places?.PlacesService;
  if (!PS || !PS.prototype || !PS.prototype.getDetails) return;
  const orig = PS.prototype.getDetails;
  console.log('🧪 Interceptor enabled for PlacesService.getDetails');
}

// === 定義 whenMapsReady ===
window.whenMapsReady = function(callback) {
  if (window.MAP_READY && typeof callback === 'function') {
    callback(); // 地圖已經好，直接呼叫
  } else {
    // 還沒好就先排隊，等地圖載完再執行
    window._mapsReadyQueue = window._mapsReadyQueue || [];
    window._mapsReadyQueue.push(callback);
  }
};

whenMapsReady(() => {
  console.log("✅ Google Maps Ready, applying PlacesService patches");

  const PS = google?.maps?.places?.PlacesService;
  if (!PS?.prototype?.getDetails) return;

  // 只加一層 wrapper 做紀錄，不改用 fetchFields
  const orig = PS.prototype.getDetails;

  PS.prototype.getDetails = function(opts, cb){
    const pid = opts?.placeId || opts?.placeid || opts?.placeID;
    console.log('[shim:getDetails] call placeId =', pid);

    return orig.call(this, opts, (res, status) => {
      console.log('[shim:getDetails] status =', status,
                  'name =', res?.name,
                  'rating =', res?.rating,
                  'user_ratings_total =', res?.user_ratings_total);
      cb && cb(res, status);
    });
  };
});


// === 當 initMap 被真正呼叫時，設定 MAP_READY 並清空等待隊列 ===
window.initMap = function() {
  window.MAP_READY = true;
  console.log("✅ Google Maps 初始化完成");
  if (Array.isArray(window._mapsReadyQueue)) {
    window._mapsReadyQueue.forEach(fn => { try { fn(); } catch(e) {} });
    window._mapsReadyQueue = [];
  }
};

// ===== BEFORE loading Google Maps script 都會執行到 =====
(function bootstrapInitMapStub(){
  if (typeof window._mapsReadyQueue === 'undefined') window._mapsReadyQueue = [];
  // 保證 callback=initMap 叫你時，一定是個 function
  if (typeof window.initMap !== 'function') {
    window.initMap = function(){ /* stub: 等真正的 initMap 覆蓋 */ };
  }
})();

// === Multi-day: single source of truth ===
window.currentDay = Number(window.currentDay || 1);  // 只初始化一次
window.SMART_dirRenderers = window.SMART_dirRenderers || [];
window.SMART_markers      = window.SMART_markers      || [];
window.MAP_READY          = false;   // 地圖完成後會改 true
window.SMART_READY        = false;   // 你的 smart 規畫初始化完成後改 true

// ==== 全域變數（避免被 block scope 藏起來）====
window.map = window.map || null;
window.placesService = window.placesService || null;
window.directionsService = window.directionsService || null;
window.directionsRenderer = window.directionsRenderer || null;
window.overlayView = window.overlayView || null;
window.autocomplete = null;
window.suggestionMarkers = window.suggestionMarkers || [];
window.rangeCircles      = window.rangeCircles      || [];
window.initMap = window.initMap || function(){};
window._mapsReadyQueue = window._mapsReadyQueue || [];

function nowMap(){
  return window.__gmap || window.map || null;
}

function isGMap(m){
  return !!(m && window.google && google.maps && (m instanceof google.maps.Map));
}

// Route 的安全呼叫
function routeOnce(req){
  return new Promise((resolve, reject) => {
    if (!window.directionsService || typeof window.directionsService.route !== 'function') {
      return reject(new Error('DirectionsService not ready'));
    }
    window.directionsService.route(req, (res, status) => {
      const ok = (status === (google.maps.DirectionsStatus?.OK || 'OK')) || status === 'OK';
      if (ok) resolve(res);
      else reject(new Error('Directions request failed: ' + status));
    });
  });
}
window.routeOnce = window.routeOnce || routeOnce;


// === Maps readiness helpers ===
window.MAP_READY = false;

window.SUGGEST_MIN_ZOOM = (typeof window.SUGGEST_MIN_ZOOM === 'number') ? window.SUGGEST_MIN_ZOOM : 12;

// ---- 全域 stops 安全初始化 + 原地覆蓋工具 ----
if (!Array.isArray(window.stops)) window.stops = [];

/** 不用 splice，避免被覆寫造成遞迴 */
function replaceStopsInPlace(arr){
  if (!Array.isArray(window.stops)) window.stops = [];
  const next = Array.isArray(arr) ? arr : [];
  window.stops.length = 0;
  for (let i=0;i<next.length;i++) window.stops.push(next[i]);
}

// ---- 全域工具 ----
if (!Array.isArray(window.suggestionMarkers)) window.suggestionMarkers = [];

// 讓全域也能用 "safeNearbySearch" 名稱（若你只提供 nearbySearchSafe）
async function safeNearbySearch({ center, radius, typeList }) {
  return nearbySearchSafe({ location: center, radius, type: typeList });
}

// ===== SAFETY LAYER (1/6): global defaults & google guard =====
const DEFAULT_CENTER = { lat: 23.9507, lng: 120.9316 }; //（安全預設）
const DEFAULT_ZOOM   = 12;

function isGoogleReady(){
  return !!(window.google && google.maps);
}

// 嚴格驗證 LatLngLiteral
function toLatLngLiteral(v){
  if (!v) return null;
  // 已是 literal
  if (typeof v.lat !== 'undefined' && typeof v.lng !== 'undefined') {
    const la = Number(v.lat), ln = Number(v.lng);
    if (!Number.isNaN(la) && !Number.isNaN(ln)) return { lat: la, lng: ln };
  }
  // google.maps.LatLng
  try {
    if (typeof v.lat === 'function' && typeof v.lng === 'function') {
      return { lat: Number(v.lat()), lng: Number(v.lng()) };
    }
  } catch(_) {}
  return null;
}

function colorForDay(d = getCurrentDay()){
  const colors = ['#38bdf8','#f59e0b','#10b981','#ef4444','#8b5cf6','#22c55e','#fb7185'];
  return colors[(d-1) % colors.length];
}

function ensureTimeline(day){
  const host = getTimelineHost();
  let tl = host.querySelector(`.timeline[data-day="${day}"]`);
  if (!tl) {
    tl = document.createElement('div');
    tl.className = 'timeline';
    tl.dataset.day = String(day);
    host.appendChild(tl);
  }
  tl.style.setProperty('--day-color', colorForDay(day));
  return tl;
}

// 直接從 window.stops 過濾出當天資料，避免快取不同步
function getTodaysStops(day){
  const cur = Number(day) || 1;
  return (window.stops || []).filter(s => Number(s.day ?? 1) === cur);
}

function getCurrentDaySafe(){
  try {
    if (typeof getCurrentDay === 'function') return Number(getCurrentDay()) || 1;
  } catch{}
  return Number(window.currentDay || 1);
}

// ====== 💰 預算估算設定（僅保留結構，數字交給動態 profile） ======
window.COST_CONFIG = window.COST_CONFIG || {
  // 顯示貨幣：固定用 USD
  currency: 'USD',

  // 人數（會跟 #budget-people input 同步）
  people: 1,

  // 價位等級、類別預設、交通費都先給「空物件」
  // 真正的數字會在 /api/budget_profile 回來時由 initCostProfileFromDetails 覆蓋
  placeByPriceLevel: {},      // 例如 {0:0, 1:150, 2:240, 3:360, 4:480}
  placeCategoryDefaults: {},  // 例如 {FOOD:150, CAFE:70, ATTRACTION:90, ...}
  transport: {}               // 例如 {BUS:{perLeg:50}, TAXI:{base:50, perKm:20, min:90}}
};

// === 👥 人數變更事件 ===
document.addEventListener('change', (e) => {
  if (e.target.id === 'budget-people') {
    const v = Number(e.target.value) || 1;
    window.COST_CONFIG.people = v;
    try { recalcBudgetForCurrentDay(); } catch(_){}
  }
});

// 💲 統一用 USD 顯示預算
function formatCurrency(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '–';

  try {
    // 用瀏覽器內建的國際化 API
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0    // 不要小數
    }).format(n);
  } catch (e) {
    // 保底寫法（萬一有舊瀏覽器）
    return 'US$ ' + Math.round(n).toLocaleString('en-US');
  }
}

// 取得城市/國家（含 fallback，處理沒有 locality/country 的國家）
function extractCityCountry(place) {
  let city = null, country = null;
  const comps = place?.address_components || [];

  for (const c of comps) {
    const t = c.types || [];
    if (t.includes("locality")) city = c.long_name;                    // 一般城市
    if (t.includes("postal_town")) city = c.long_name;                 // 英國 / 部分亞洲
    if (t.includes("administrative_area_level_2")) city = c.long_name; // 城市 / 區
    if (!city && t.includes("administrative_area_level_1")) city = c.long_name; // 沒城市就用省
    if (t.includes("country")) country = c.long_name;
  }

  // 若 country 未抓到 → 從 formatted_address 最後一段猜
  if (!country && place.formatted_address) {
    const parts = place.formatted_address.split(',');
    country = parts[parts.length - 1].replace(/[0-9]/g, '').trim();
  }

  console.debug('[COST] extractCityCountry:', { city, country });
  return { city, country };
}

// 依地區物價，覆蓋 COST_CONFIG（使用後端 /api/budget_profile2）
async function initCostProfileFromDetails(details){
  if (!details) return;

  let { city, country } = extractCityCountry(details);

  // 若沒有國家就沒辦法估物價，直接放棄
  if (!country) {
    console.debug('[COST] no country from details', details);
    return;
  }

  // 沒抓到城市就用國家名稱當城市，避免整個流程卡住
  if (!city) {
    city = country;
  }

  const base = (typeof API_BASE === 'string' ? API_BASE : '').replace(/\/$/, '');
  const url  = `${base}/budget_profile?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}`;
  console.debug('[COST] fetching cost profile:', url);

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    if (data && data.ok && data.profile) {
      // 合併原本 config + 後端 profile
      window.COST_CONFIG = Object.assign({}, window.COST_CONFIG || {}, data.profile);
      console.debug('[COST] profile loaded for', city, country, data.profile);
    } else {
      console.warn('[COST] bad cost profile response', data);
    }
  } catch (err) {
    console.warn('[COST] fetch cost profile failed', err);
  } finally {
    // ⭐ 關鍵：標記「預算系統已經初始化完」
    window.__BUDGET_READY__ = true;

    // ⭐ 再算一次今天的預算
    try {
      if (typeof recalcBudgetForCurrentDay === 'function') {
        recalcBudgetForCurrentDay();
      }
    } catch(e) {
      console.warn('[COST] recalc after init failed', e);
    }
  }

  window.__COST_PROFILE_INITED = true;
  recalcBudgetForCurrentDay();
}

// 保留舊名字，避免其他地方有呼叫
async function initCostProfile(){
  const first = (window.stops || [])[0];
  if (!first || !first.details) return;
  return initCostProfileFromDetails(first.details);
}

// 保留舊名字，避免其他地方有呼叫
async function initCostProfile(){
  const first = (window.stops || [])[0];
  if (!first || !first.details) return;
  return initCostProfileFromDetails(first.details);
}

// 判斷是不是「餐飲類」地點（用 Google types + 名稱 + 自訂 category）
function isFoodStop(s){
  if (!s) return false;

  const types =
    (Array.isArray(s.types) && s.types) ||
    (s.details && Array.isArray(s.details.types) && s.details.types) ||
    [];

  const joined = types.join(',').toLowerCase();

  // Google Place types 典型餐飲類
  if (/restaurant|food|meal_takeaway|meal_delivery|cafe|bakery|bar|night_club/.test(joined)) {
    return true;
  }

  // 名稱裡面有明顯「吃的」關鍵字
  const name = (s.name || '').toLowerCase();
  if (/restaurant|resto|cafe|coffee|tea|bistro|diner|bbq|grill|bar|pub/.test(name)) {
    return true;
  }

  // 若你有自訂 category 欄位
  if (typeof s.category === 'string' && /food|restaurant|cafe|飲食|餐|咖啡/i.test(s.category)) {
    return true;
  }

  return false;
}

function getPriceLevelFromStop(s){
  if (!s) return null;
  if (s.price_level != null) return Number(s.price_level);
  if (s.priceLevel != null) return Number(s.priceLevel);
  if (s.details && s.details.price_level != null) return Number(s.details.price_level);
  if (s.details && s.details.priceLevel != null) return Number(s.details.priceLevel);
  return null;
}

// 根據 Google types / 自訂欄位，粗略推一個類別
function inferStopCategory(s){
  if (!s) return 'OTHER';

  const types =
    (s.types && Array.isArray(s.types) && s.types) ||
    (s.details && Array.isArray(s.details.types) && s.details.types) ||
    [];

  const tstr = types.join(',').toLowerCase();

  if (/lodging|hotel|guest_house|hostel/.test(tstr)) return 'LODGING';
  if (/restaurant|food|meal_takeaway|meal_delivery/.test(tstr)) return 'FOOD';
  if (/cafe|coffee|bakery/.test(tstr)) return 'CAFE';
  if (/museum|zoo|amusement_park|theme_park/.test(tstr)) return 'MUSEUM';
  if (/beach/.test(tstr)) return 'BEACH';
  if (/park/.test(tstr)) return 'PARK';
  if (/shopping_mall|store|supermarket|convenience_store/.test(tstr)) return 'SHOPPING';
  if (/tourist_attraction|point_of_interest|place_of_worship|church|temple/.test(tstr)) return 'ATTRACTION';

  // 若你有自訂 category 欄位也可以在這裡判斷
  if (typeof s.category === 'string') {
    const c = s.category.toUpperCase();
    if (c === 'FOOD' || c === 'CAFE' || c === 'ATTRACTION' || c === 'MUSEUM' ||
        c === 'BEACH' || c === 'PARK' || c === 'SHOPPING' || c === 'LODGING') {
      return c;
    }
  }

  return 'OTHER';
}

// 單一景點預估花費（不含交通）
function estimateCostForStop(s){
  if (!s) return 0;

  const cfg = window.COST_CONFIG || {};
  const people = cfg.people || 1;

  // 1) 若有手動 cost（或之後你從表單寫入），優先用
  if (typeof s.cost === 'number' && Number.isFinite(s.cost)) {
    return s.cost * people;
  }

  // 2) 若 meta_json 裡有 cost（你之後可用在 AI or DB）
  try {
    if (s.meta_json && typeof s.meta_json === 'string') {
      const meta = JSON.parse(s.meta_json);
      if (meta && typeof meta.cost === 'number') {
        return meta.cost * people;
      }
    }
  } catch(_) {}

  // 3) 先看 price_level 對應表
  const lvl = getPriceLevelFromStop(s);
  if (lvl != null) {
    const table = cfg.placeByPriceLevel || {};
    if (Object.prototype.hasOwnProperty.call(table, lvl)) {
      return Number(table[lvl] || 0) * people;
    }
  }

  // 4) 沒有 price_level → 用類別預設值
  const cat = inferStopCategory(s);
  const catTable = cfg.placeCategoryDefaults || {};
  const base = Number(
    catTable[cat] != null ? catTable[cat] :
    catTable.OTHER != null ? catTable.OTHER :
    0
  );

  return base * people;
}

// 單一交通段預估花費（用 B.leg）
function estimateCostForLeg(leg){
  if (!leg) return 0;

  const cfg  = window.COST_CONFIG || {};
  const tcfg = cfg.transport || {};
  const people = cfg.people || 1;

  const mode = String(leg.mode || 'UNKNOWN').toUpperCase();
  const rule = tcfg[mode] || tcfg.UNKNOWN || {};

  // 距離：優先用路線 distanceM；沒有就用手動距離 km
  let meters = 0;
  if (leg.distanceM != null) meters = Number(leg.distanceM);
  else if (leg.distance != null) meters = Number(leg.distance);
  else if (leg.manualDistanceKm != null) meters = Number(leg.manualDistanceKm) * 1000;

  const km = Math.max(0, meters / 1000);

  // 計價：base + perKm + perLeg，再套最低消費
  let cost = 0;
  if (rule.base)   cost += Number(rule.base);
  if (rule.perKm)  cost += km * Number(rule.perKm);
  if (rule.perLeg) cost += Number(rule.perLeg);

  if (rule.min && cost < rule.min) cost = Number(rule.min);

  return cost * people;
}

// 💰 只計算「目前 Day」的預算
function recalcBudgetForCurrentDay() {
  const elTotal   = document.getElementById('budget-total');
  const elToday   = document.getElementById('budget-today');   // 有留的話就一起顯示
  const elSights  = document.getElementById('budget-sights');
  const elFood    = document.getElementById('budget-food');
  const elTrans   = document.getElementById('budget-transport');
  const elPlaces  = document.getElementById('budget-places');

  // 🔧 小工具：一次更新所有欄位
  function setAll(text) {
    if (elTotal)  elTotal.textContent  = text;
    if (elToday)  elToday.textContent  = text;
    if (elSights) elSights.textContent = text;
    if (elFood)   elFood.textContent   = text;
    if (elTrans)  elTrans.textContent  = text;
    if (elPlaces) elPlaces.textContent = text;
  }

  // 🔹 Profile 還沒好：不要算任何金額，只顯示「計算中」
  if (!window.__COST_PROFILE_INITED) {
    setAll('Calculating…');
    return;
  }

  const allStops = Array.isArray(window.stops) ? window.stops.slice() : [];

  const curDay = (typeof getCurrentDaySafe === 'function'
    ? getCurrentDaySafe()
    : (typeof getCurrentDay === 'function'
        ? Number(getCurrentDay()) || 1
        : Number(window.currentDay || 1))) || 1;

  // 🔹 沒任何行程 → 顯示 dash
  if (!allStops.length) {
    setAll('–');
    return;
  }

  // 🔹 只取「目前 Day」的 stops
  const todays = allStops
    .filter(s => Number(s.day ?? 1) === curDay)
    .sort((a, b) => {
      const da = Number(a.seq ?? 0);
      const db = Number(b.seq ?? 0);
      return da - db;
    });

  // 如果當天沒有點，也當作 0
  if (!todays.length) {
    setAll('–');
    return;
  }

  // 🔹 當天的 景點 / 餐飲 / 交通
  let todaySight = 0;
  let todayFood  = 0;
  let todayTrans = 0;

  // 景點 / 餐飲
  todays.forEach(s => {
    const cost = estimateCostForStop(s) || 0;
    if (!cost) return;

    if (isFoodStop(s)) todayFood += cost;
    else todaySight += cost;
  });

  // 交通（B.leg）
  for (let i = 1; i < todays.length; i++) {
    const B = todays[i];
    if (B && B.leg) {
      todayTrans += estimateCostForLeg(B.leg) || 0;
    }
  }

  const todayTotal = todaySight + todayFood + todayTrans;

  // ⭐ Debug log 只在 TS_DEBUG=true 時印
  if (window.TS_DEBUG) {
    console.log('[BUDGET DEBUG]', {
      curDay,
      sight: todaySight,
      food: todayFood,
      trans: todayTrans,
      total: todayTotal
    });
  }

  // ✦ 顯示的全部都當作「目前 Day」 ✦
  if (elTotal)  elTotal.textContent  = formatCurrency(todayTotal);
  if (elToday)  elToday.textContent  = formatCurrency(todayTotal);
  if (elSights) elSights.textContent = formatCurrency(todaySight);
  if (elFood)   elFood.textContent   = formatCurrency(todayFood);
  if (elTrans)  elTrans.textContent  = formatCurrency(todayTrans);
  if (elPlaces) elPlaces.textContent = formatCurrency(todaySight + todayFood);
}


function ensureStopId(s){
  if (!s) return null;
  if (!s.id || String(s.id).trim()==='') {
    // 優先用 placeId；沒有就隨機
    s.id = s.placeId || (crypto.randomUUID?.() || ('stop-' + Math.random().toString(36).slice(2)));
  }
  return s.id;
}

// === 開啟某個 stop 的卡片（可平移、切日、縮放、固定卡片） ===
async function openStopCard(s, opts = {}) {
  if (!s) return false;

  const {
    pan = true,                 // 是否平移到該點
    zoom = null,                // 例如 13；不設代表不改變縮放
    focusDay = true,            // 自動切到 s.day
    pin = true,                 // 以固定狀態開啟卡片
    highlightTimeline = true    // 高亮 Timeline 上對應的卡片
  } = opts || {};

  // 等地圖就緒
  if (typeof whenMapsReady === 'function') {
    await new Promise(function(resolve){ whenMapsReady(resolve); });
  }

  // 切換到該天
  if (focusDay && typeof getCurrentDay === 'function' && typeof setDay === 'function') {
    const d = Number(s.day ?? 1);
    if (getCurrentDay() !== d) setDay(d);
  }

  // 先確保這個 stop 有 marker（同時計算 label：A/B/C…）
  if (typeof ensureMarker === 'function') ensureMarker(s);
  if (s.marker) s.marker.setVisible(true);

  // 平移 / 縮放
  try {
    if (pan) {
      if (typeof safePanTo === 'function') safePanTo(map, s.position);
      else if (map && map.panTo) map.panTo(s.position);
    }
    if (typeof zoom === 'number' && map && map.setZoom) map.setZoom(zoom);
  } catch {}

  // 取消前一個釘選
  try {
    if (window.__TS_PINNED_MARKER && window.__TS_PINNED_MARKER !== s.marker) {
      window.__TS_PINNED_MARKER.__pinned = false;
    }
  } catch {}

  // 顯示 Hover Card（用同一個 stop 物件），並設定釘選狀態
  try {
    try { if (typeof ensurePlaceDetails === 'function') await ensurePlaceDetails(s); } catch(_) {}
    if (typeof showHoverCard === 'function') showHoverCard(s, { compact:false, pin });
    if (s.marker) {
      s.marker.__pinned = !!pin;
      window.__TS_PINNED_MARKER = s.marker;
    }
  } catch {}

  // 在 Timeline 上高亮
  try {
    if (highlightTimeline) {
      const sid = (typeof ensureStopId === 'function') ? ensureStopId(s) : s.id;
      if (sid) {
        document.querySelectorAll('.trow.event.active').forEach(el => el.classList.remove('active'));
        const row = document.querySelector(`.trow.event[data-id="${sid}"]`);
        if (row) row.classList.add('active');
      }
    }
  } catch {}

  return true;
}

function setCurrentDay(d){
  window.currentDay = Number(d) || 1;
}

function fitToRoute() {
  if (!window.google || !google.maps || !map) return;
  const todays = (typeof getStopsOfDay === 'function')
    ? getStopsOfDay(Number(window.currentDay || 1))
    : (window.stops || []);
  const b = getStopsBoundsSafe((todays && todays.length) ? todays : window.stops);
  if (b) safeFitBounds(map, b);
  else safeSetCenterZoom(map, {
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    fallbackCenter: DEFAULT_CENTER,
    fallbackZoom: DEFAULT_ZOOM
  });
}

// === 把所有 stops 的 marker 建起來（或更新樣式） ===
function buildMarkersForAllStops() {
  if (!isMapsReady() || !window.map) return;

  console.debug('[buildMarkersForAllStops] total stops =', (window.stops || []).length);
  (window.stops || []).forEach(s => {
    const ok = ensureMarker(s);
    if (!ok) {
      console.warn('[buildMarkersForAllStops] ensureMarker returned false for stop:', s);
    }
  });
}

// ✅ 讓舊程式呼叫 drawMarkersForStops 也會走到新的建 marker 流程
if (typeof window.drawMarkersForStops !== 'function') {
  window.drawMarkersForStops = function () {
    try { buildMarkersForAllStops(); } catch (e) {
      console.warn('[drawMarkersForStops] failed:', e);
    }
  };
}

// 啟動時：完全不要自動找推薦
if (!window.TS_DISABLE_AUTO_RECO) {
  window.applySuggestionVisibility?.();
  if (!(window.suggestionMarkers?.length > 0)) {
    window.findRecommendations?.();
  }
}

function ensureServices(){
  const gmap = nowMap();
  if (!isGMap(gmap)) return false;

  if (!window.placesService)     window.placesService     = new google.maps.places.PlacesService(gmap);
  if (!window.directionsService) window.directionsService = new google.maps.DirectionsService();
  if (!window.directionsRenderer){
    window.directionsRenderer = new google.maps.DirectionsRenderer({ suppressMarkers:true, preserveViewport:false });
  }
  if (window.directionsRenderer.getMap?.() !== gmap){
    window.directionsRenderer.setMap(gmap);
  }
  return true;
}

function setDirectionsSafe(directionsRenderer, result) {
  try {
    // 允許 {raw}/ {payload} / 原始物件
    const r = (result && result.routes) ? result
            : (result?.raw?.routes ? result.raw
            : (result?.payload?.routes ? result.payload : null));

    if (!r || !Array.isArray(r.routes) || r.routes.length === 0) {
      try { directionsRenderer?.set('directions', null); } catch {}
      return false;
    }
    directionsRenderer?.safeSetDirections(r);
    return true;
  } catch (e) {
    console.warn('[setDirectionsSafe] invalid result', e, result);
    try { directionsRenderer?.set('directions', null); } catch {}
    return false;
  }
}

// 單一、完整版：安全設定中心/縮放（含 stops fitBounds、指定 center+zoom、保底值）
function safeSetCenterZoom(
  map,
  {
    center,
    zoom,
    stops,
    fallbackCenter = DEFAULT_CENTER,
    fallbackZoom   = DEFAULT_ZOOM,
    // 可選：fitBounds padding（不想用可拿掉）
    padding = { top: 32, right: 32, bottom: 32, left: 32 },
  } = {}
) {
  if (!map) return;

  // A) 若有 stops：優先縮放到所有點
  try {
    if (Array.isArray(stops) && stops.length) {
      const b = getStopsBoundsSafe(stops); // 你已有的工具：回傳 google.maps.LatLngBounds 或 null
      if (b && typeof map.fitBounds === 'function') {
        // map.fitBounds(b); // 若無 padding 需求就用這行
        if (typeof google !== 'undefined' && google.maps && google.maps.geometry && map.fitBounds.length >= 2) {
          // 某些版本支援帶第二參 padding
          map.fitBounds(b, padding);
        } else {
          map.fitBounds(b);
        }
        return;
      }
    }
  } catch (e) {
    console.warn('[safeSetCenterZoom] fitBounds failed:', e);
  }

  // B) 其次用指定中心 + zoom（若給了 zoom 才同時設定）
  try {
    const c = toLatLngLiteral(center); // 你已有的工具：把 LatLng/LatLngLiteral 轉成合法 literal
    if (c && Number.isFinite(zoom)) {
      if (typeof map.setCenter === 'function') map.setCenter(c);
      if (typeof map.setZoom   === 'function') map.setZoom(zoom);
      return;
    }
    // 若只給了 center（沒給 zoom），至少先移到該中心
    if (c && typeof map.setCenter === 'function') {
      map.setCenter(c);
      return;
    }
  } catch (e) {
    console.warn('[safeSetCenterZoom] set center/zoom failed:', e);
  }

  // C) 保底（避免 InvalidValueError）
  try {
    const fb = toLatLngLiteral(fallbackCenter) || DEFAULT_CENTER;
    if (typeof map.setCenter === 'function') map.setCenter(fb);
    const z = Number.isFinite(fallbackZoom) ? fallbackZoom : DEFAULT_ZOOM;
    if (typeof map.setZoom === 'function') map.setZoom(z);
  } catch (e) {
    console.warn('[safeSetCenterZoom] fallback failed:', e);
  }
}

function authHeaders(extra = {}) {
  return Object.assign({ 'X-UID': _getUID() }, extra || {});
}


//小工具
function getCurrentDay(){
  return Number(window.currentDay || 1);
}

// ===== 安全中心/縮放工具（新增） =====
function isFiniteNumber(n){ 
  return typeof n === 'number' && Number.isFinite(n); 
}

function isValidLatLng(v){
  const p = toLatLngLiteral(v);
  return !!(p && Number.isFinite(p.lat) && Number.isFinite(p.lng));
}

//檢查座標是否有效(座標檢查＋球面距離)
function isValidPos(p){
  if (!p) return false;
  const lat = Number(p.lat ?? p.position?.lat), lng = Number(p.lng ?? p.position?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) return false; // 0,0
  if (lat < -89.999 || lat > 89.999) return false;
  if (lng < -179.999 || lng > 179.999) return false;
  return true;
}

function getStopsBoundsSafe(stops){
  if (!window.google || !google.maps) return null;
  const b = new google.maps.LatLngBounds();
  let has = false;
  (stops || []).forEach(s=>{
    const c = toLatLngLiteral(s?.position || s);
    if (c){ b.extend(c); has = true; }
  });
  return has ? b : null;
}

// === 單一且相容的 safeFitBounds（請保留這一支，刪掉其它重複定義） ===
function safeFitBounds(a, b, c) {
  // 參數解析：支援兩種呼叫型式
  let map, target, opts = {};
  if (a && typeof a.getCenter === 'function' && typeof a.fitBounds === 'function') {
    // 形式：safeFitBounds(map, boundsOrStops, opts)
    map   = a;
    target = b;
    opts   = c || {};
  } else {
    // 形式：safeFitBounds(boundsOrStops)（legacy）
    map   = window.map;
    target = a;
    opts   = (b && typeof b === 'object' && !b.getNorthEast) ? b : {};
  }

  const padding        = Number.isFinite(opts.padding) ? opts.padding : 60;
  const fallbackCenter = toLatLngLiteral(opts.fallbackCenter) || DEFAULT_CENTER;
  const fallbackZoom   = Number.isFinite(opts.fallbackZoom) ? opts.fallbackZoom : DEFAULT_ZOOM;

  try {
    // ---- 1) 直接給 LatLngBounds ----
    if (target && typeof target.getNorthEast === 'function' && typeof target.getSouthWest === 'function') {
      // 若提供 isEmpty 就檢查一下
      if (typeof target.isEmpty === 'function' && target.isEmpty()) {
        throw new Error('empty bounds');
      }
      map.fitBounds(target, padding);
      return true;
    }

    // ---- 2) 傳的是 stops 陣列 / 單一點 ----
    const bounds = new google.maps.LatLngBounds();
    let n = 0;

    const pushPoint = (pt) => {
      const ll = toLatLngLiteral(pt?.position ?? pt);
      if (ll && Number.isFinite(ll.lat) && Number.isFinite(ll.lng)) {
        bounds.extend(ll); n++;
      }
    };

    if (Array.isArray(target)) {
      target.forEach(pushPoint);
    } else if (target) {
      pushPoint(target);
    }

    if (n > 0) {
      map.fitBounds(bounds, padding);
      return true;
    }

    // ---- 3) 什麼都沒有：走 fallback ----
    map.setCenter(fallbackCenter);
    map.setZoom(fallbackZoom);
    return false;

  } catch (e) {
    console.warn('[safeFitBounds] failed, fallback used:', e);
    try {
      map.setCenter(fallbackCenter);
      map.setZoom(fallbackZoom);
    } catch(_) {}
    return false;
  }
}


function safePanTo(map, center, fallbackCenter = DEFAULT_CENTER){
  try{
    const c = toLatLngLiteral(center);
    if (c){ map.panTo(c); return; }
  }catch(_){}
  try{
    const fb = toLatLngLiteral(fallbackCenter) || DEFAULT_CENTER;
    map.setCenter(fb);
  }catch(__){}
}

function clampRangeKm(value, minKm, maxKm){
  const n = Number(value);
  if (!Number.isFinite(n)) return minKm;
  return Math.min(Math.max(n, minKm), maxKm);
}

// 小工具：把相對路徑轉為實際可呼叫的 URL（同時相容 REST 與 ?path=）
function apiUrl(path){
  const b = (API_BASE || '').replace(/\/+$/,'');
  const p = String(path||'').replace(/^\/+/,'');
  // 如果 base 以 /api 結尾 → 用 REST；否則用 ?path=
  if (/\/api$/i.test(b)) return `${b}/${p}`;
  // 若 base 本身已經帶 ?path= 用者很少，這裡就統一補
  const sep = b.includes('?') ? '&' : '?';
  return `${b}${sep}path=${p}`;
}

(async () => {
  // === (1) 原本的 API_BASE 偵測邏輯 ===
  for (const base of CANDIDATES) {
    try {
      const tryUrls = [
        base.endsWith('/api') ? `${base}/ping` : `${base}?path=ping`,
        base.includes('?') ? base : `${base}?path=`
      ];
      const r = await fetch(tryUrls[0], { cache: 'no-store' })
        .catch(() => fetch(tryUrls[1], { cache: 'no-store' }));
      if (r && r.ok) {
        API_BASE = base;
        console.log('[API] use', base);
        break;
      }
    } catch (_) {}
  }
  window.API_BASE = API_BASE;

  // === (2) 舊行程補全流程 ===
  // 目標：只補「少量」缺 details 的點，避免一口氣打爆 Google API & 卡畫面
  window.__OLD_DETAILS_FIX_RAN__ = window.__OLD_DETAILS_FIX_RAN__ || false;
  if (window.__OLD_DETAILS_FIX_RAN__) return;   // 已跑過就不要再跑
  window.__OLD_DETAILS_FIX_RAN__ = true;

  // 沒有 ensurePlaceDetails 或 stops 還沒準備好就直接略過
  if (typeof window.ensurePlaceDetails !== 'function' || !Array.isArray(window.stops)) {
    if (window.TS_DEBUG) {
      console.warn('⚠️ 無法補全行程資料：地圖尚未初始化或 ensurePlaceDetails 未定義');
    }
    return;
  }

  // 實際執行補全的函式（等瀏覽器比較閒再跑）
  const runFix = async () => {
    try {
      const candidates = (window.stops || []).filter(s => s && s.place_id && !s.details);

      if (!candidates.length) {
        if (window.TS_DEBUG) console.log('🧩 舊行程補全：沒有缺 details 的地點，略過');
        return;
      }

      // 🟡 一次最多處理幾個舊點（避免一次打太多 API）
      const MAX_PER_RUN = 5;
      const targets = candidates.slice(0, MAX_PER_RUN);

      if (window.TS_DEBUG) {
        console.groupCollapsed('🧩 舊行程地點資料補全開始（輕量版）');
        console.table(targets.map((s, i) => ({
          i,
          name: s.name,
          place_id: s.place_id
        })));
      } else {
        console.log(`🧩 舊行程補全：共 ${candidates.length} 筆缺 details，本次處理前 ${targets.length} 筆`);
      }

      let count = 0;

      for (const s of targets) {
        try {
          await window.ensurePlaceDetails(s);
          count++;
          // 小延遲，避免瞬間打太多 request
          await new Promise(res => setTimeout(res, 120));
        } catch (err) {
          if (window.TS_DEBUG) {
            console.warn('補全失敗', s.name || s.place_id, err);
          }
        }
      }

      console.log(`✅ 舊行程補全完成：本次成功 ${count}/${targets.length} 筆（尚餘 ${
        candidates.length - targets.length > 0 ? candidates.length - targets.length : 0
      } 筆保留日後再處理）`);

      if (window.TS_DEBUG) {
        console.groupEnd?.();
      }
    } catch (err) {
      console.warn('🧩 舊行程補全發生錯誤：', err);
    }
  };

  // 等瀏覽器比較空閒或延遲一段時間再跑，避免跟初始載入搶資源
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(() => { runFix(); }, { timeout: 6000 });
  } else {
    setTimeout(runFix, 2500);
  }
})();


function isMapsReady(){
  return !!(window.google && google.maps && window.map);
}

function isRealMap(obj){
  return !!(window.google && google.maps && obj instanceof google.maps.Map);
}

// 🔍 依 Google Directions 的 step 內容判斷真正的交通模式
// 只在 step = FERRY 或指令文字明確含「渡輪」才算 FERRY，
// 其次才看是否整段都是 WALKING，否則一律視為 DRIVING
function detectLegModeFromDirections(res){
  try {
    const legs  = res?.routes?.[0]?.legs || [];
    const steps = legs.flatMap(l => l.steps || []);

    const modes = steps.map(s => String(s.travel_mode || '').toUpperCase());

    // 1) 有任何一步是 FERRY → 一律算 FERRY（最優先）
    if (modes.includes('FERRY')) return 'FERRY';

    // 2) 指令/提示出現渡輪關鍵詞（多語）
    const txt = steps.map(s =>
      (s.maneuver || s.instructions || s.html_instructions || '') + ''
    ).join(' ').toLowerCase();

    const ferryWordsStrict = ['ferry','渡輪','渡船','輪渡','penyeberangan','kapal ferry'];
    if (ferryWordsStrict.some(w => txt.includes(w))) return 'FERRY';

    // 3) 沒有 FERRY，但所有 step 幾乎都是 WALKING → 當作步行
    if (modes.length && modes.every(m => m === 'WALKING')) {
      return 'WALKING';
    }

    // 4) 其餘一律視為道路交通（DRIVING）
    return 'DRIVING';
  } catch(_){
    return 'DRIVING';
  }
}

// ============= Tigerair-style Timeline Renderer =============
(function(){
  const MODE_ICON = {
    DRIVING:'🚗', CAR:'🚗', TAXI:'🚕',
    WALKING:'🚶', BICYCLING:'🚲',
    TRANSIT:'🚌', BUS:'🚌', TRAIN:'🚆', RAIL:'🚆', SUBWAY:'🚇', TRAM:'🚊', FERRY:'⛴️',
    FLIGHT:'✈️', PLANE:'✈️', MANUAL:'⋯'
  };

  function mm(sec){ const m = Math.max(1, Math.round((Number(sec)||0)/60)); return `${m} 分`; }
  function timeText(s, fallback=''){ return s.timeText || s.arrivalTimeText || s.arriveTimeText || fallback || ''; }
  function titleHTML(s){ const label = (s.label||s.tag||'').trim(); const name=(s.name||s.title||'').trim(); return `${label?`<span class="muted">${label}</span> `:''}${name}`; }
  function addrLine(s){
    if (s.address) return s.address;
    const lat = s.position?.lat ?? s.lat, lng = s.position?.lng ?? s.lng;
    return (lat!=null && lng!=null) ? `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}` : '';
  }

  function stayBadge(s) {
    const v = s.stayMin ?? s.stay ?? s.stay_min;
    if (v == null || isNaN(v)) return '';

  // 自動換算 hr / min
    const hours = Math.floor(v / 60);
    const mins  = v % 60;
    let text = '';

    if (hours > 0 && mins > 0) {
      text = `${hours} hr ${mins} min`;
    } else if (hours > 0) {
      text = `${hours} hr`;
    } else {
      text = `${v} min`;
    }

    return `<span class="badge">Stay ${text}</span>`;
  }

  function toDurTextByLeg(leg) {
    if (!leg) return '';
    if (typeof leg.durationText === 'string' && leg.durationText) return leg.durationText;
    if (typeof leg.manualDurationMin === 'number') return `約 ${Math.max(1, Math.round(leg.manualDurationMin))} 分`;
    if (typeof leg.seconds === 'number') return `約 ${Math.max(1, Math.round(leg.seconds / 60))} 分`;
    return '';
  }
  if (typeof window.toDurTextByLeg !== 'function') window.toDurTextByLeg = toDurTextByLeg;

  // transport modes
  window.LEG_MODE_META = {
    DRIVING:   { icon: '🚗',  color: '#3498db', text: 'Driving' },
    WALKING:   { icon: '🚶‍♂️', color: '#27ae60', text: 'Walking' },
    BICYCLING: { icon: '🚴‍♂️', color: '#2ecc71', text: 'Cycling' },
    TRANSIT:   { icon: '🚌',  color: '#e67e22', text: 'Transit' },
    FERRY:     { icon: '⛴️', color: '#1abc9c', text: 'Ferry' },
    FLIGHT:    { icon: '✈️',  color: '#9b59b6', text: 'Flight' },
    TRAIN:     { icon: '🚆',  color: '#f39c12', text: 'Train' },
    BUS:       { icon: '🚌',  color: '#d35400', text: 'Bus' },
    TAXI:      { icon: '🚖',  color: '#f1c40f', text: 'Taxi' },
    CARPOOL:   { icon: '🚘',  color: '#16a085', text: 'Carpool' },
    MANUAL:    { icon: '⚙️',  color: '#95a5a6', text: 'Manual' },
    UNKNOWN:   { icon: '❓',  color: '#7f8c8d', text: 'Unknown' }
  };

  // 取得交通段的距離文字（km）
  function legDistanceText(leg) {
    if (!leg) return '';

    let meters = 0;
    if (typeof leg.distanceM === 'number') {
      meters = leg.distanceM;
    } else if (typeof leg.distance === 'number') {
      meters = leg.distance;           // 兼容舊欄位
    } else if (typeof leg.manualDistanceKm === 'number') {
      meters = leg.manualDistanceKm * 1000;
    }

    if (!meters || !Number.isFinite(meters)) return '';

    const km = meters / 1000;
    // < 10km 顯示 1 位小數，>=10km 取整數
    const text =
      km < 10 ? `${km.toFixed(1)} km`
              : `${Math.round(km)} km`;

    return text;
  }

  // 若需要在別處使用，也可以掛到 window
  if (typeof window.legDistanceText !== 'function') {
    window.legDistanceText = legDistanceText;
  }

  function legRowHTML(data) {
    const leg = data || {};
    const mode = String(leg.mode || '').toUpperCase();
    const meta = window.LEG_MODE_META?.[mode] || window.LEG_MODE_META?.UNKNOWN || { icon: '❓', color: '#7f8c8d', text: mode };

    const label = leg.label || '';
    const mins  = typeof leg.seconds === 'number'
      ? Math.round(leg.seconds / 60)
      : null;
    const timeText = mins != null ? `${Math.max(1, mins)} min` : '';

    // 距離文字
    const distText = legDistanceText(leg);

    // 時間 & 距離合併（例如 "29 min · 18 km"）
    const timeAndDist = [timeText, distText].filter(Boolean).join(' · ');

    // 只顯示人工標籤（排除 auto: 開頭）
    const showLabel = (label && !/^auto:/i.test(label)) ? ' · ' + label : '';

    return `
      <div class="tl-leg" data-mode="${mode}" style="--leg-color:${meta.color}">
        <div class="tl-leg-line"></div>
        <div class="tl-leg-chip" style="color:${meta.color}">
          ${meta.icon} ${meta.text}${showLabel}
        </div>
        <div class="tl-leg-time">${timeAndDist}</div>
      </div>
    `;
  }


  // 兼容：renderTimeline(plan) 或 renderTimeline()
  window.renderTimeline = function renderTimeline(plan) {
    const day = getCurrentDay() || 1;
    const host = ensureTimeline(day);
    
    if (!host) return;
    host.style.setProperty('--day-color', colorForDay(day));
    host.innerHTML = '<div class="tl-line"></div>';

    const todays = getTodaysStops(day);
    if (window.TS_DEBUG) {
      console.debug('[TL] day=', day, 'stops(today)=', todays.length, { todays, allStopsByDay: window.allStopsByDay, stops: window.stops });
    }

    const items = buildItemsForDay(day, todays);
    const frag = document.createDocumentFragment();
    items.forEach(it => {
      const wrap = document.createElement('div');
      wrap.innerHTML = it.type === 'STOP' ? stopRowHTML(it.data) : legRowHTML(it.data);
      frag.appendChild(wrap.firstElementChild);
    });
    host.appendChild(frag);

    if (host.__tlHandler) host.removeEventListener('click', host.__tlHandler);
    host.__tlHandler = async e => {
      // === 1) 處理按鈕（定位 / 刪除等） ===
      const btn = e.target.closest('button[data-action]');
      if (btn) {
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        const s = (window.stops || []).find(x => String(x.id ?? '') === String(id));
        if (!s) return;

        if (['pan-to', 'fly'].includes(action)) {
          openStopCard(s, { pan: true, focusDay: false, pin: true, zoom: null });
        } else if (['remove-stop','del'].includes(action)) {
          removeStop && removeStop(s.id);
        }
        return;
      }

      // === 2) 點整張卡：平移 + 開卡片（不固定）
      cardEl = e.target.closest('.trow.event .card');
      if (!cardEl) return;
      const row = cardEl.closest('.trow.event');
      const stopId = row?.dataset.id ?? row?.dataset.stopId;
      const s = (window.stops || []).find(x => String(x.id ?? x._id ?? x.place_id ?? x.pid) === String(stopId));
      if (!s) return;

      if (typeof ensurePlaceDetails === 'function') await ensurePlaceDetails(s);
      openStopCard(s, { pan: true, focusDay: false, pin: false, zoom: null });
    };
    host.addEventListener('click', host.__tlHandler);

    // === 3) 自動插入「移至」按鈕（若尚未存在） ===
    try {
      const rows = host.querySelectorAll('.trow.event[draggable][data-id]');
      rows.forEach(row => {
        if (row.querySelector('button[data-action="move"]')) return;
        const id = row.dataset.id;
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.dataset.action = 'move';
        btn.dataset.id = id;
        btn.textContent = 'Move';
        // 優先插到刪除按鈕前面，否則就加到尾端
        const del = row.querySelector('button[data-action="del"], button[data-action="remove-stop"]');
        if (del && del.parentNode) del.parentNode.insertBefore(btn, del);
        else {
          const actions = row.querySelector('.row-actions, .hc-actions, .actions, .card') || row;
          actions.appendChild(btn);
        }
      });
    } catch(err) {
      console.warn('inject move buttons failed', err);
    }
  };


  function stopRowHTML(s) {
    const t  = timeText(s, s.at || '');
    const tt = titleHTML(s);
    const addr = addrLine(s);
    const sid = ensureStopId(s);

    const d = s.day ?? window.currentDay ?? 1;        // 這一列屬於第幾天
    const dayColor = colorForDay(d);                  // 用既有的配色函式

    return `
      <div class="trow event" draggable="true" data-id="${sid}" data-day="${d}" style="--day-color:${dayColor}">
        <div class="tcol">${t || ''}</div>
        <span class="dot">${labelForStop(s)}</span>
        <div class="card" data-stop-id="${sid}">
          <div class="title">${tt}</div>
          ${addr ? `<div class="addr">${addr}</div>` : ''}
          ${stayBadge(s)}
          <div class="row-actions" style="margin-top:.5rem;gap:.5rem">
            <button class="btn btn-ghost" data-action="pan-to"      data-id="${sid}">Locate</button>
            <button class="btn btn-ghost" data-action="remove-stop" data-id="${sid}">Delete</button>
          </div>
        </div>
      </div>
    `;
  }

  function buildItemsForDay(day, todays) {
    const out = [];
    const curDay = Number(day) || 1;

    for (let i = 0; i < todays.length; i++) {
      const B = todays[i];
      const A = i > 0 ? todays[i - 1] : null;

      // === 1) 先插入「A→B 的交通段」（leg 掛在目的地 B；保留相容 fallback）
      if (A) {
        const legRaw =
          (B && (B.leg || B.prevLeg)) ||   // ✅ 優先用目的地 B 身上的 leg
          (A && A.leg) ||                  // 兼容：如果還有人把 leg 放在起點 A
          null;

        const hasLeg = !!legRaw && (
          legRaw.durationText != null ||
          legRaw.duration     != null ||
          legRaw.durationMin  != null ||
          legRaw.seconds      != null ||
          legRaw.mode         != null
        );

        if (hasLeg) {
          const legDay = Number(
            (legRaw.day != null ? legRaw.day :
             (B && B.day != null ? B.day : A.day))
          ) || curDay;

          const leg = {
            ...legRaw,
            day: legDay,
            mode: (legRaw.mode || '').toString().toUpperCase() || undefined
          };

          // 補齊時間字串
          leg.durationText = leg.durationText || toDurTextByLeg(leg);
          if (leg.seconds == null && typeof leg.manualDurationMin === 'number') {
            leg.seconds = Math.round(leg.manualDurationMin * 60);
          }

          out.push({ type: 'LEG', data: leg });
        }
      }

      // === 2) 再插入 B 這個地點卡
      out.push({ type: 'STOP', data: B });
    }
    return out;
  }
})();

// --- global helper: duration text by leg (idempotent) ---
if (typeof window.toDurTextByLeg !== 'function') {
  window.toDurTextByLeg = function toDurTextByLeg(leg) {
    if (!leg) return '';
    if (typeof leg.durationText === 'string' && leg.durationText) return leg.durationText;
    if (typeof leg.manualDurationMin === 'number') {
      const m = Math.max(1, Math.round(leg.manualDurationMin));
      return `約 ${m} 分`;
    }
    if (typeof leg.seconds === 'number') {
      const m = Math.max(1, Math.round(leg.seconds / 60));
      return `約 ${m} 分`;
    }
    return '';
  };
}

// 方向結果正規化：把各種包裝型態轉成 { routes: [...] }
function normalizeDirectionsResult(res) {
  if (!res) return null;

  // 已是標準 DirectionsResult
  if (Array.isArray(res.routes)) return res;

  // 常見包裝：res.result / res.data
  if (res.result && Array.isArray(res.result.routes)) return res.result;
  if (res.data   && Array.isArray(res.data.routes))   return res.data;

  // 某些 wrapper 只放單一路線在 routes（非陣列）
  if (res.routes && typeof res.routes === 'object' && res.routes.legs) {
    return { routes: [res.routes] };
  }

  // 少數情況：直接就是一條路線物件（有 legs）
  if (res.legs && Array.isArray(res.legs)) {
    return { routes: [res] };
  }

  // 無法辨識
  return null;
}

// DirectionsRenderer 安全建立＋設定
window.ensureDirectionsRenderer = function ensureDirectionsRenderer() {
  if (window.directionsRenderer && typeof window.directionsRenderer.setDirections === 'function') {
    return window.directionsRenderer;
  }
  if (!window.map) return null;
  try {
    window.directionsRenderer = new google.maps.DirectionsRenderer({
      map: window.map,
      suppressMarkers: true,
      preserveViewport: true
    });
  } catch (e) { console.warn('[DIR] new DirectionsRenderer failed', e); }
  return window.directionsRenderer;
};

window.setDirectionsSafe = function setDirectionsSafe(rendererOrResult, maybeResult) {
  let renderer = null, res = null;

  // 允許 setDirectionsSafe(res) 或 setDirectionsSafe(renderer, res)
  if (maybeResult === undefined) {
    res = rendererOrResult;
    renderer = ensureDirectionsRenderer();
  } else {
    renderer = rendererOrResult || ensureDirectionsRenderer();
    res = maybeResult;
  }

  try {
    const r = normalizeDirectionsResult(res);
    if (!renderer || typeof renderer.setDirections !== 'function') return;
    if (!r) {
      // 清空
      try { renderer.set('directions', null); } catch(_) {}
      return;
    }
    renderer.setDirections(r);
  } catch (e) {
    console.warn('[DIR] setDirectionsSafe failed', e, res);
  }
};

// --- Directions 安全工具 ---
window.ensureDirectionsRenderer = function ensureDirectionsRenderer() {
  if (window.directionsRenderer && typeof window.directionsRenderer.setDirections === 'function') {
    return window.directionsRenderer;
  }
  if (!window.map) return null;
  try {
    window.directionsRenderer = new google.maps.DirectionsRenderer({
      map: window.map,
      suppressMarkers: true,     // 不蓋掉自訂標記
      preserveViewport: true     // 不自動移動畫面
    });
  } catch (e) { console.warn('[DIR] new DirectionsRenderer failed', e); }
  return window.directionsRenderer;
};

window.setDirectionsSafe = function setDirectionsSafe(renderer, res){
  try {
    const r = renderer || ensureDirectionsRenderer();
    if (!r || typeof r.setDirections !== 'function') return;
    if (res && res.routes && res.routes.length) {
      r.setDirections(res);
    } else {
      // ★ res 無效就確實清空
      r.set('directions', null);
    }
  } catch(e){ console.warn('[DIR] setDirectionsSafe failed', e); }
};

// === Directions Core：節流 + 快取 + 併發合併 ===
window.__DIR = window.__DIR || {
  svc: null,
  lastTs: 0,
  rateMs: 500,                  // ★ 每次請求間隔（越大越省）
  ttlMs: 12*60*60*1000,         // ★ 快取 TTL（12 小時）
  cache: new Map(),             // key -> {ts, res|null}
  inflight: new Map()           // key -> Promise<res|null>
};

// 產生穩定 key（四捨五入到 1e-5 ≈ 1.1m）
function __key(a, b, opt){
  // 若 a/b 是 LatLng 物件，這裡會失敗；你的流程已先轉 literal，故正常
  const r = v => (Math.round(v * 1e5) / 1e5).toFixed(5);

  // 🔸 根據 travelMode 區分不同快取
  let m = 'DR';
  const tm = String(opt?.travelMode || '').toUpperCase();

  if (tm === 'WALKING' || tm === (google.maps.TravelMode?.WALKING || 'WALKING')) {
    m = 'WK';
  } else if (opt?.avoidFerries) {
    m = 'DR_NOFERRY';
  }

  return `${r(a.lat)},${r(a.lng)}|${r(b.lat)},${r(b.lng)}|${m}`;
}

async function routeOnceThrottledCached(req){
  const a = req.origin, b = req.destination;
  const key = __key(a,b,req);

  // 1) 快取
  const hit = __DIR.cache.get(key);
  if (hit && (Date.now() - hit.ts) < __DIR.ttlMs) return hit.res;

  // 2) 併發合併
  if (__DIR.inflight.has(key)) return __DIR.inflight.get(key);

  if (!__DIR.svc) __DIR.svc = new google.maps.DirectionsService();

  // 3) 節流
  const now = Date.now();
  const wait = Math.max(0, __DIR.rateMs - (now - __DIR.lastTs));
  if (wait) await new Promise(r=>setTimeout(r, wait));
  __DIR.lastTs = Date.now();

  // 4) 實發
  const p = new Promise(resolve=>{
    __DIR.svc.route(req, (res, status)=>{
      const ok  = (status === 'OK' && res?.routes?.length);
      const out = ok ? res : null;
      __DIR.cache.set(key, { ts: Date.now(), res: out });
      __DIR.inflight.delete(key);
      resolve(out);
    });
  });
  __DIR.inflight.set(key, p);
  return p;
}

function rebuildDaysFromStops(stops) {
  const arr = Array.isArray(stops) ? stops : [];
  arr.forEach(s => s.day = Math.max(1, Number(s.day) || 1));

  const maxFromStops = Math.max(1, ...arr.map(s => s.day));

  // 以前已有的 window.days 也要保留（使用者手動加的空白天）
  const prevDays = Array.isArray(window.days) ? window.days.map(n => Number(n)||1) : [];
  const baseDays = Array.from({ length: maxFromStops }, (_, i) => i + 1);
  const days = Array.from(new Set([...prevDays, ...baseDays])).sort((a,b)=>a-b);

  // 分組 stops → allStopsByDay（至少到 maxFromStops）
  const byDay = Array.from({ length: Math.max(maxFromStops, days[days.length-1] || 1) }, () => []);
  arr.forEach(s => {
    const idx = s.day - 1;
    if (!byDay[idx]) byDay[idx] = [];
    byDay[idx].push(s);
  });

  window.days = days;
  window.allStopsByDay = byDay;

  if (!window.currentDay || !days.includes(Number(window.currentDay))) {
    window.currentDay = 1;
  }
}

function renderDayTabs() {
  const host = document.getElementById('day-tabs');
  if (!host) return;

  // 先確保 days 列表
  const maxFromStops = Math.max(1, ...((window.stops || []).map(s => Number(s.day) || 1)));
  const curDays = Array.isArray(window.days) ? window.days.map(n=>Number(n)||1) : [];
  const needDays = Array.from({ length: maxFromStops }, (_, i) => i + 1);
  window.days = Array.from(new Set([...curDays, ...needDays])).sort((a,b)=>a-b);

  host.innerHTML = '';

  // 建 Day 1, Day 2, ... 按鈕
  window.days.forEach(d => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.day = d;
    btn.textContent = `Day ${d}`;

    // 🔹 套用原本的樣式
    btn.className = 'btn btn-ghost';
    if (Number(window.currentDay) === d) btn.classList.add('active');

    btn.addEventListener('click', () => setDay(d));
    host.appendChild(btn);
  });

  // 建「+ Add Day」按鈕
  const add = document.createElement('button');
  add.type = 'button';
  add.id = 'btn-add-day';
  add.textContent = '+ Add Day';

  // 🔹 這裡也加上 btn 樣式（你可以改成 'btn small' 之類）
  add.className = 'btn';

  add.addEventListener('click', () => {
    const next = Math.max(...window.days, 0) + 1;

    if (!window.days.includes(next)) window.days.push(next);
    window.days.sort((a,b)=>a-b);

    if (!Array.isArray(window.allStopsByDay)) window.allStopsByDay = [];
    const idx = next - 1;
    if (!Array.isArray(window.allStopsByDay[idx])) window.allStopsByDay[idx] = [];

    renderDayTabs();
    setDay(next);
  });
  host.appendChild(add);
}


// === 分日顏色與 Renderer 管理===
// 顏色配置（Day1 藍、Day2 黃、Day3 綠、Day4 紫、Day5 橘...）
window.getDayColor = function(day){
  const palette = ['#1E90FF','#FFC107','#2ECC71','#8E44AD','#FF7F50',
                   '#00B8D9','#E91E63','#795548','#9C27B0','#607D8B'];
  const i = Math.max(1, Number(day||1));
  return palette[(i-1)%palette.length];
};

// 全域 renderer 與 polyline 管理
window.DAY_RENDERERS = {};
window.SEG_overlays  = [];

// 僅顯示當天，隱藏其他天
window.hideOtherDays = function(day){
  Object.entries(window.DAY_RENDERERS).forEach(([d,r])=>{
    if (Number(d)!==Number(day)) { try{ r.set('directions', null);}catch(_){ } r.setMap(null); }
  });
  (window.SEG_overlays||[]).forEach(p=>{
    p.setMap && p.setMap(Number(p.__day)===Number(day) ? window.map : null);
  });
};

// 清除指定天的線；day==null 代表全部清除
window.clearOverlaysOfDay = function(day){
  (window.SEG_overlays||[]).forEach(p=>{
    if (day==null || Number(p.__day)===Number(day)) { try{ p.setMap(null); }catch(_){ } }
  });
  window.SEG_overlays = (window.SEG_overlays||[]).filter(p=> !(day==null || Number(p.__day)===Number(day)));
};

// 取得該天的 DirectionsRenderer（自動依日上色）
window.getRendererForDay = function(day, color){
  day = Number(day||1);
  let r = window.DAY_RENDERERS[day];
  if (!r) {
    r = new google.maps.DirectionsRenderer({
      map: window.map,
      suppressMarkers: true,
      preserveViewport: true,
      polylineOptions: { strokeColor: color, strokeOpacity: .95, strokeWeight: 4 }
    });
    window.DAY_RENDERERS[day] = r;
  } else {
    r.setOptions({ polylineOptions: { strokeColor: color, strokeOpacity: .95, strokeWeight: 4 }});
    r.setMap(window.map);
  }
  return r;
};

// 每次切換或重算日行程前都應呼叫
window.__prepDay = function(day){
  const color = getDayColor(day);
  hideOtherDays(day);
  clearOverlaysOfDay(day);
  try { getRendererForDay(day, color).set('directions', null); } catch(_){}
};

// 統一 setDirectionsSafe：永遠使用分日 Renderer + 顏色
(function(){
  const norm = window.normalizeDirectionsResult || (r=>r);
  window.setDirectionsSafe = function(_maybe, res){
    if (window.directionsRenderer) {
      try { window.directionsRenderer.set('directions', null); } catch(_){}
      try { window.directionsRenderer.setMap(null); } catch(_){}
      window.directionsRenderer = null;
    }
    const day   = (typeof getCurrentDay==='function' ? Number(getCurrentDay()) : Number(window.currentDay||1)) || 1;
    const color = getDayColor(day);
    const r = getRendererForDay(day, color);
    const n = norm(res);
    Object.entries(window.DAY_RENDERERS).forEach(([d,dr])=>{
      if (Number(d)!==day){ try{ dr.set('directions', null);}catch(_){ } dr.setMap(null); }
    });
    try { n ? r.setDirections(n) : (r.set('directions',null), r.setMap(null)); } catch(_){}
    return r;
  };
})();

// 隱藏「非當天」的 renderer 與 overlays
window.hideOtherDays = function(day){
  Object.entries(window.DAY_RENDERERS).forEach(([d, r])=>{
    if (Number(d)!==Number(day)) { try{ r.set('directions', null); }catch(_){ } r.setMap(null); }
  });
  window.SEG_overlays.forEach(p=>{
    p.setMap && p.setMap(Number(p.__day)===Number(day) ? window.map : null);
  });
};

// 讓任何舊的 setDirectionsSafe 都走「當天 renderer + 顏色」
//（若你專案已有 normalizeDirectionsResult，沿用即可）
window.normalizeDirectionsResult = window.normalizeDirectionsResult || function(res){
  if (!res) return null;
  if (Array.isArray(res.routes)) return res;
  if (res.result && Array.isArray(res.result.routes)) return res.result;
  if (res.data   && Array.isArray(res.data.routes))   return res.data;
  if (res.routes && res.routes.legs) return { routes: [res.routes] };
  if (res.legs && Array.isArray(res.legs)) return { routes: [res] };
  return null;
};

window.setDirectionsSafe = function(_renderer, res){
  const day = (typeof getCurrentDay==='function' ? Number(getCurrentDay()) : Number(window.currentDay||1)) || 1;
  const color = getDayColor(day);
  const r = getRendererForDay(day, color);
  const norm = normalizeDirectionsResult(res);
  try {
    if (norm) r.setDirections(norm);
    else { r.set('directions', null); r.setMap(null); }
  } catch(e){ console.warn('[setDirectionsSafe]', e); }
};

// 產生一圈微移點（~300m），用來把海上點推回陸地附近再試路徑
function nudgeRing(latlng, meters=300){
  const R = 6371000;
  const lat = latlng.lat * Math.PI/180, lng = latlng.lng * Math.PI/180;
  const d   = meters / R;
  const out = [{lat: latlng.lat, lng: latlng.lng}]; // 原點也試一次
  for (let k=0;k<8;k++){
    const brg = (k*45) * Math.PI/180;
    const lat2 = Math.asin(Math.sin(lat)*Math.cos(d) + Math.cos(lat)*Math.sin(d)*Math.cos(brg));
    const lng2 = lng + Math.atan2(Math.sin(brg)*Math.sin(d)*Math.cos(lat), Math.cos(d)-Math.sin(lat)*Math.sin(lat2));
    out.push({ lat: lat2*180/Math.PI, lng: lng2*180/Math.PI });
  }
  return out;
}

// 嘗試用微移後的點再跑一次「不搭船」的 Directions（成功就回傳 res）
async function routeDrivingNoFerryWithNudges(o, d){
  const Os = nudgeRing(o, 300);
  const Ds = nudgeRing(d, 300);
  for (let i=0;i<Os.length;i++){
    for (let j=0;j<Ds.length;j++){
      const res = await routeOnceThrottledCached({
        origin: Os[i], destination: Ds[j],
        travelMode: google.maps.TravelMode.DRIVING,
        avoidFerries: true
      });
      if (res) return res;
    }
  }
  return null;
}

// === 省費版：優先走陸地、少打 API、依當天顏色繪線（含分日清理/顏色） ===
async function recomputeRouteSmart(day){
  __prepDay(day);
  if (window.__SMART_BUSY) return;
  window.__SMART_BUSY = true;
  try {
    // 0) 取 day
    if (typeof day === 'undefined') {
      try { if (typeof getCurrentDay === 'function') day = Number(getCurrentDay()) || 1; } catch(_) {}
      if (!day) day = Number(window.currentDay || 1) || 1;
    }
    day = Number(day);

    // 1) 等地圖/服務
    try { if (typeof whenMapsReady === 'function') await new Promise(r=>whenMapsReady(r)); } catch(_){}
    try { if (typeof ensureServices === 'function') ensureServices(); } catch(_){}

    // ★★★ 分日顏色 + 分日清理（放在讀取 stops 之前）★★★
    const dayColor = (typeof getDayColor==='function') ? getDayColor(day) : '#1E90FF';
    try { typeof hideOtherDays==='function' && hideOtherDays(day); } catch(_){}
    try { typeof clearOverlaysOfDay==='function' && clearOverlaysOfDay(day); } catch(_){}
    try { typeof getRendererForDay==='function'
            ? getRendererForDay(day, dayColor).set('directions', null)
            : ensureDirectionsRenderer()?.set('directions', null);
    } catch(_) {}

    // 2) 取 stops & 驗座標（只取當天）
    const todays = (typeof getStopsOfDay==='function')
      ? (getStopsOfDay(day)||[])
      : ((window.stops||[]).filter(s => (s?.day ?? 1) === day));
    const valid = (todays||[]).filter(s=>{
      const p = s && (s.position || s.location || s);
      const ll = (typeof toLatLngLiteral === 'function') ? toLatLngLiteral(p) : p;
      if (ll && typeof ll.lat === 'number' && typeof ll.lng === 'number') s.position = ll;
      return isValidPos(s?.position);
    });

    if (!Array.isArray(valid) || valid.length < 2) {
      try { refreshTimeline && refreshTimeline(); } catch(_){}
      return;
    }

    // 參數/統計
    const islandHints = ['penida','nusa','gili','lombok','harbor','harbour','port','碼頭','ferry','sanur','padang bai','padangbai'];
    const FORCE_DIRECTIONS_UNDER_KM = 300;
    let sumMeters = 0, sumSeconds = 0;
    const byMode = {};
    const segRoutes = new Array(valid.length).fill(null);

    function addFromDirections(res,label){
      const L = res.routes[0].legs || [];
      const m = L.reduce((a,x)=>a+(x.distance?.value||0),0);
      const s = L.reduce((a,x)=>a+(x.duration?.value||0),0);
      sumMeters += m; sumSeconds += s;
      (byMode[label] ||= { meters:0, seconds:0 });
      byMode[label].meters += m; byMode[label].seconds += s;
    }

    // 3) 逐段（每段最多 2 次；使用快取節流）
    for (let i = 1; i < valid.length; i++) {
      const A = valid[i - 1], B = valid[i];
      ensureLegFields && ensureLegFields([B]);
      let mode   = String(B?.leg?.mode || 'DRIVING').toUpperCase();
      const locked = !!(B?.leg?.locked || B?.leg?.fromUser);

      // 未鎖定且是手動/渡輪 → 先嘗試救回 DRIVING
      if (!locked && ['MANUAL','FERRY'].includes(mode)) mode = 'DRIVING';

      if (mode === 'DRIVING') {
        const distKm = haversineKm(A.position, B.position);   // 兩點直線距離
        const preferWalk = distKm <= 0.8;                     // ★ 0.8km 以內優先走路

        const mainMode = preferWalk
          ? google.maps.TravelMode.WALKING
          : google.maps.TravelMode.DRIVING;

        // 先用「偏好的模式」（近距離＝WALKING，遠距離＝DRIVING）
        let res = await routeOnceThrottledCached({
          origin: A.position,
          destination: B.position,
          travelMode: mainMode,
          avoidFerries: !preferWalk   // 走路不需要避渡輪，開車時才避
        });

        // 若步行失敗，退回開車（有些國家 Directions 沒提供 WALKING）
        if (!res && preferWalk) {
          res = await routeOnceThrottledCached({
            origin: A.position,
            destination: B.position,
            travelMode: google.maps.TravelMode.DRIVING,
            avoidFerries: true
          });
        }

        // 若仍失敗，且距離不遠 → 再給一次「不避渡輪」的開車機會
        if (!res && distKm <= FORCE_DIRECTIONS_UNDER_KM) {
          res = await routeOnceThrottledCached({
            origin: A.position,
            destination: B.position,
            travelMode: google.maps.TravelMode.DRIVING
          });
        }

        if (res) {
          segRoutes[i] = res;

          const L = res.routes[0].legs || [];
          const m = L.reduce((a,x) => a + (x.distance?.value || 0), 0);
          const s = L.reduce((a,x) => a + (x.duration?.value || 0), 0);

          let detected = detectLegModeFromDirections(res);
          if (!detected) detected = preferWalk ? 'WALKING' : 'DRIVING';

          // 若先前是自動推斷的 FERRY（auto:ferry），而這次偵測到不是 FERRY，就把 label 清掉
          if (detected !== 'FERRY' && B.leg?.label === 'auto:ferry') {
            try { delete B.leg.label; } catch (_) {}
          }

          B.leg = Object.assign(B.leg || {}, {
            mode: detected,
            seconds: s,
            distanceM: m,
            durationText: `約 ${Math.max(1, Math.round(s/60))} 分`,
            // 只有真的 FERRY 才補上 auto:ferry 標籤
            label: (detected === 'FERRY' ? (B.leg?.label || 'auto:ferry') : B.leg?.label)
          });

          sumMeters  += m;
          sumSeconds += s;
          (byMode[detected] ||= { meters:0, seconds:0 });
          byMode[detected].meters  += m;
          byMode[detected].seconds += s;

          continue;
        }
      }

      //（判斷跨海 → FERRY / MANUAL）照原本的就好，不需要改
      const nameA = (A.name||'').toLowerCase();
      const nameB = (B.name||'').toLowerCase();
      const hintHit = islandHints.some(k => nameA.includes(k) || nameB.includes(k));
      const distKm  = haversineKm(A.position, B.position);

      if (hintHit && distKm > 15) {
        B.leg = Object.assign(B.leg || {}, {
          mode: 'FERRY',
          manualDistanceKm: Math.round(distKm * 10) / 10,
          manualDurationMin: Math.round((distKm / 35) * 60) + 30,
          cruiseKmh: 35, bufferMin: 30, label: B.leg?.label || 'auto:ferry'
        });
        B.leg.durationText = B.leg.durationText || toDurTextByLeg(B.leg);
        const incM = distKm * 1000, incS = (B.leg.manualDurationMin || 0) * 60;
        sumMeters += incM; sumSeconds += incS;
        (byMode['FERRY'] ||= { meters:0, seconds:0 });
        byMode['FERRY'].meters += incM; byMode['FERRY'].seconds += incS;
      } else {
        // MANUAL（不畫線）
        const minutes = Math.round((distKm / guessCruiseKmh('BUS')) * 60) + guessBufferMin('BUS');
        B.leg = Object.assign(B.leg || {}, {
          mode: 'MANUAL',
          manualDistanceKm: Math.round(distKm * 10) / 10,
          manualDurationMin: minutes,
          cruiseKmh: guessCruiseKmh('BUS'),
          bufferMin: guessBufferMin('BUS'),
          label: B.leg?.label || 'fallback:manual'
        });
        B.leg.durationText = B.leg.durationText || toDurTextByLeg(B.leg);
        sumMeters += distKm * 1000; sumSeconds += minutes * 60;
        (byMode['MANUAL'] ||= { meters:0, seconds:0 });
        byMode['MANUAL'].meters += distKm * 1000;
        byMode['MANUAL'].seconds += minutes * 60;
      }
    }

    // 4) 視覺層：只用已取得的分段結果畫，依「當天顏色」上色
    if (!Array.isArray(window.SEG_overlays)) window.SEG_overlays = [];
    for (let i=1;i<valid.length;i++){
      const A = valid[i-1], B = valid[i];
      const mode = String(B?.leg?.mode || '').toUpperCase();

      if (mode === 'DRIVING' && segRoutes[i]) {
        const route = segRoutes[i].routes[0];
        const path  = route.overview_path || route.overviewPath;
        if (path && path.length) {
          const poly = new google.maps.Polyline({
            path,
            strokeOpacity: 0.95,
            strokeWeight: 4,
            strokeColor: dayColor,      // ← 當天顏色
            map: window.map
          });
          poly.__day = day;             // ← 標記天數，之後可精準清除
          window.SEG_overlays.push(poly);
        }
      } else if (['FERRY','FLIGHT'].includes(mode)) {
        const poly = new google.maps.Polyline({
          geodesic: true,
          strokeOpacity: 0.95,
          strokeWeight: 4,
          strokeColor: dayColor,        // ← 當天顏色
          path: [A.position, B.position],
          map: window.map
        });
        poly.__day = day;
        window.SEG_overlays.push(poly);
      }
    }

    // 5) UI
    try { updateRouteSummary && updateRouteSummary({ meters: sumMeters, seconds: sumSeconds }); } catch(_){}
    try { renderModeBreakdown && renderModeBreakdown(byMode); } catch(_){}
    try { refreshTimeline && refreshTimeline(); } catch(_){}
    try { fitToRoute && fitToRoute(); } catch(_){}
    try { buildMarkersForAllStops && buildMarkersForAllStops(); } catch(_){}
    try { recalcBudgetForCurrentDay && recalcBudgetForCurrentDay(); } catch(_){}

  } finally {
    window.__SMART_BUSY = false;
  }
}


function refreshTimeline(){
  renderTimeline();
  // 每次時間軸更新，順便重算預算
  try { recalcBudgetForCurrentDay(); } catch(_) {}
}

// ===================== AI 規劃交通段（可只補缺） =====================
async function applyAiLegsFromServer({ onlyMissing = false } = {}) {
  if (!Array.isArray(stops) || stops.length < 2) return;

  // 只補缺：看「起點格」是否有缺 (index 0..N-2)
  if (onlyMissing) {
    const hasGap = stops.some((s, i) => {
      if (i >= stops.length - 1) return false;  // 最後一格不是起點
      const leg = s.leg;
      return !(leg && (leg.mode || leg.manualDurationMin || leg.manualDistanceKm));
    });
    if (!hasGap) {
      console.log('[applyAiLegs] 已無缺少的交通段，跳過 AI 計算');
      return;
    }
  }

  const payload = {
    stops: stops.map(s => ({
      name: s.name || '',
      lat:  s.position?.lat ?? s.lat,
      lng:  s.position?.lng ?? s.lng
    }))
  };
  console.log('[ai/legs] payload stops =', payload.stops);

  const res  = await fetch(apiUrl('ai/legs'), {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(()=> ({}));
  if (data?.ok && Array.isArray(data.legs)) {
    // 先清舊的，避免殘留
    stops.forEach(s => { delete s.leg; });

    data.legs.forEach(leg => {
      const j = Number(leg.index);     // 伺服器回的 index 是 B 的索引
      if (!Number.isInteger(j)) return;

      const B = (stops && stops[j]) ? stops[j] : null;
      if (!B) return;

      // 如果不是 FERRY，就清掉先前的 auto:ferry 標籤
      if (leg.mode !== 'FERRY' && B.leg?.label === 'auto:ferry') {
        try { delete B.leg.label; } catch (_){}
      }

      // 合併/覆蓋這段的 leg（掛在 B）
      B.leg = Object.assign({}, B.leg || {}, leg);
    });

    if (window.TS_DEBUG) {
      console.table(stops.map((s,i)=>({i, hasLeg: !!s.leg, to: s.leg?.toIndex })));
    }

    // 重新畫線/摘要
    recomputeRouteSmart?.();
  } else {
    console.warn('[ai/legs] unexpected data', data);
    alert('AI 規劃失敗：伺服器未回傳有效資料');
  }
}

// 臨時 monkey-patch：保留原函式，同時把 item 存到全域
(function(){
  if (!window._origShowHoverCard && typeof window.showHoverCard === 'function') {
    window._origShowHoverCard = window.showHoverCard;
    window.showHoverCard = function(it, opts){
      window.__lastHoverItem = it;
      window.__lastHoverPid  = it?.place_id || it?.placeId || it?.details?.place_id || null;
      console.log('[HC] show', it?.name, 'pid=', window.__lastHoverPid);
      return window._origShowHoverCard.apply(this, arguments);
    };
    console.log('✅ showHoverCard 已掛勾，移到任一地點卡片即可在 console 看到 pid');
  } else {
    console.log('ℹ️ 已掛勾或找不到 showHoverCard');
  }
})();

// === 輕量版：缺 placeId 自動修復（限制每次最多處理 N 筆，且只跑一次） ===

// 防止在同一輪使用中重複跑太多次
window.__PLACEID_FIX_RAN__ = window.__PLACEID_FIX_RAN__ || false;

async function safeFixMissingPlaceIdsForToday(options){
  // 若已經跑過一次，就不要再跑（避免重複打 API）
  if (window.__PLACEID_FIX_RAN__) return;
  window.__PLACEID_FIX_RAN__ = true;

  const opts = Object.assign({
    maxPerRun: 5,      // 🟡 每次最多處理幾筆缺 placeId 的點（可依需要調整）
    timeoutMs: 8000
  }, options || {});

  // 等待 google.maps 可用
  function waitGoogleReady(timeout = opts.timeoutMs){
    return new Promise((resolve, reject)=>{
      const t0 = Date.now();
      (function check(){
        if (window.google && google.maps && google.maps.places) return resolve(true);
        if (Date.now() - t0 > timeout) return reject(new Error('google maps 尚未載入'));
        setTimeout(check, 200);
      })();
    });
  }

  try {
    await waitGoogleReady();
    if (window.TS_DEBUG) console.log('✅ Google Maps 已可用，開始輕量修復 placeId…');
  } catch(e){
    console.warn('❌ Google Maps 尚未載入，略過 placeId 自動修復');
    return;
  }

  // ---- 以下是 fixMissingPlaceIdsForToday 主體（輕量化） ----
  const map = window.map;
  const svc = window.placesService || (map ? new google.maps.places.PlacesService(map) : null);
  if (!svc) {
    console.warn('❌ placesService 尚未初始化，略過 placeId 自動修復');
    return;
  }

  const day = (typeof getCurrentDay === 'function') ? getCurrentDay() : 1;
  const arr = (typeof getStopsOfDay === 'function') ? getStopsOfDay(day) : (window.stops || []);
  if (!arr || !arr.length) {
    if (window.TS_DEBUG) console.warn('⚠️ 今天沒有 stops，可略過 placeId 修復');
    return;
  }

  const toGLL = (p)=>{
    if (!p) return null;
    if (p instanceof google.maps.LatLng) return p;
    const lat = Number(p.lat ?? p.position?.lat);
    const lng = Number(p.lng ?? p.position?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return new google.maps.LatLng(lat, lng);
  };

  const need = arr.filter(s => !(s.place_id || s.placeId));
  if (!need.length) {
    if (window.TS_DEBUG) console.log('👌 今天所有 stops 都已經有 placeId，無需修復');
    return;
  }

  // 🟡 一次只處理前 maxPerRun 筆，避免一次打太多 API
  const targets = need.slice(0, opts.maxPerRun);

  if (window.TS_DEBUG) {
    console.table(targets.map((s,i)=>({i,name:s.name})));
  } else {
    console.log(`🔍 placeId 自動修復：共 ${need.length} 筆缺失，本次處理前 ${targets.length} 筆`);
  }

  let fixed = 0;

  const nearby = (s) => new Promise(res=>{
    const loc = toGLL(s.position);
    if (!loc) return res(false);
    svc.nearbySearch({ location: loc, radius: 1200, keyword: s.name }, (r, st)=>{
      if (st === google.maps.places.PlacesServiceStatus.OK && r?.length) {
        const best = r[0];
        s.place_id = best.place_id;
        s.placeId  = best.place_id;
        if (window.TS_DEBUG) {
          console.log('✅ nearby 補到', s.name, '→', s.place_id);
        }
        return res(true);
      }
      res(false);
    });
  });

  const findq = (s) => new Promise(res=>{
    const loc = toGLL(s.position);
    svc.findPlaceFromQuery({
      query: s.name,
      fields: ['place_id','name','geometry'],
      locationBias: loc ? { radius: 1500, center: loc } : undefined
    }, (r, st)=>{
      if (st === google.maps.places.PlacesServiceStatus.OK && r?.length) {
        const best = r[0];
        s.place_id = best.place_id;
        s.placeId  = best.place_id;
        if (!s.position && best.geometry?.location) {
          s.position = best.geometry.location.toJSON();
        }
        if (window.TS_DEBUG) {
          console.log('✅ findPlace 補到', s.name, '→', s.place_id);
        }
        return res(true);
      }
      res(false);
    });
  });

  for (const s of targets) {
    if (await nearby(s)) { fixed++; }
    else if (await findq(s))  { fixed++; }
    else if (window.TS_DEBUG) {
      console.warn('🔸 無法自動補到 placeId：', s.name);
    }

    // 每一筆之間稍微休息一下，避免瞬間壓力太大
    await new Promise(r => setTimeout(r, 120));
  }

  console.info(
    `📌 placeId 輕量修復完成：本次成功 ${fixed}/${targets.length} 筆（尚餘 ${
      need.length - targets.length > 0 ? need.length - targets.length : 0
    } 筆保留日後再處理）`
  );
}

// === 自動排程：等瀏覽器比較閒、地圖載完後再跑一次 ===
(function scheduleAutoPlaceIdFix(){
  if (window.__PLACEID_FIX_SCHEDULED__) return;
  window.__PLACEID_FIX_SCHEDULED__ = true;

  function start(){
    safeFixMissingPlaceIdsForToday({ maxPerRun: 5 }).catch(err=>{
      console.warn('placeId 自動修復發生錯誤：', err);
    });
  }

  // 若瀏覽器支援 requestIdleCallback，等比較空閒再跑
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(start, { timeout: 6000 });
  } else {
    // 否則簡單延遲個 2.5 秒，避免和初始載入打架
    setTimeout(start, 2500);
  }
})();

// 時間軸的點擊（定位/刪除）與拖曳排序（同日排序；跨日用 Move）
(function bindTimelineEvents(){
  const host = getTimelineHost();
  if (!host || host.dataset.bound) return;
  host.dataset.bound = '1';

  // ===== 工具：判斷/清除腿(LEG) =====
  function isLegLike(x){
    if (!x) return false;
    if (x.type === 'LEG' || x.kind === 'LEG' || x.category === 'LEG' || x.isLeg === true) return true;
    if (!x.position && (x.fromId && x.toId)) return true;
    if (!x.position && typeof x.mode === 'string') return true;
    return false;
  }
  function purgeLegsForDay(day){
    const d = Number(day)||1;
    window.stops = (window.stops || []).filter(x => !(isLegLike(x) && Number(x.day||1) === d));
  }

  // 給 resequenceAndRelabelDay 用：依 day / A,B,C 產生「圓點」 icon
  function buildLetterIcon(letter, day) {
    const d = Number(day || 1);

    // 如果專案有 getDayColor 就用，沒有就退回 colorForDay
    const color = (typeof getDayColor === 'function')
      ? getDayColor(d)
      : (typeof colorForDay === 'function' ? colorForDay(d) : '#38bdf8');

    return {
      path: google.maps.SymbolPath.CIRCLE,   // ★ 圓點
      scale: 14,                             // 大小可以自己改
      fillColor: color,
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 2,
      labelOrigin: new google.maps.Point(0, 0)
    };
  } 

  // ===== 工具：依當天順序重編 A/B/C 與 seq，並更新 marker 標籤 =====
  function resequenceAndRelabelDay(day){
    const d = Number(day)||1;
    const arr = window.stops || [];
    const todays = arr.filter(s => Number(s.day||1) === d && !isLegLike(s));
    todays.forEach((s, i) => {
      s.seq   = i + 1;
      s.label = String.fromCharCode(65 + i); // 'A' = 65
      if (s.marker) {
        // 1) 標準 Marker.setLabel
        if (typeof s.marker.setLabel === 'function') {
          try { s.marker.setLabel({ text: s.label, fontWeight: '700' }); } catch(_) {}
        }
        // 2) 自訂 DOM label
        if (s.marker.__labelEl) { try { s.marker.__labelEl.textContent = s.label; } catch(_) {} }
        // 3) 若有自訂 icon 生成器
        if (typeof buildLetterIcon === 'function') {
          try { s.marker.setIcon(buildLetterIcon(s.label, d)); } catch(_) {}
        }
      }
    });
  }

  // ====== Move menu (建一次) ======
  let __moveMenu = null, __moveTargetId = null;
  function ensureMoveMenu(){
    if (__moveMenu) return __moveMenu;
    const menu = document.createElement('div');
    menu.id = 'day-move-menu';
    Object.assign(menu.style, {
      position:'fixed', zIndex:10000, display:'none',
      background:'#fff', color:'#111', border:'1px solid #e5e7eb',
      borderRadius:'10px', boxShadow:'0 8px 30px rgba(0,0,0,.15)',
      overflow:'hidden', minWidth:'160px', maxHeight:'352px'
    });
    document.body.appendChild(menu);
    __moveMenu = menu;

    // 點外面關閉
    document.addEventListener('mousedown', (ev)=>{
      if (menu.style.display === 'none') return;
      if (!menu.contains(ev.target)) { menu.style.display='none'; __moveTargetId = null; }
    });

    // 點選單項目 → 移動（放到該日最後）
    document.addEventListener('click', (e)=>{
      const item = e.target.closest && e.target.closest('#day-move-menu button[data-to-day]');
      if (!item || menu.style.display === 'none') return;

      const toDay   = Number(item.dataset.toDay);
      const stopId  = __moveTargetId;

      try{
        // 1) 先真的把 stop 移到指定 day 的最後一個位置
        if (typeof moveStop === 'function' && moveStop.length >= 3) {
          const lastIdx = (getStopsOfDay?.(toDay) || []).length;
          moveStop(stopId, lastIdx, toDay);
        } else {
          const arr = window.stops || [];
          const i = arr.findIndex(x => String(x.id) === String(stopId));
          if (i >= 0){
            const it = arr.splice(i,1)[0];
            it.day = toDay;

            // 插在該日最後（轉成全域索引）
            const dayIdxs = arr
              .map((s,idx)=> Number(s.day||1) === toDay ? idx : -1)
              .filter(i => i >= 0);
            const ins = dayIdxs.length
              ? dayIdxs[dayIdxs.length-1] + 1
              : arr.length;
            arr.splice(ins, 0, it);
          }
        }

        // 2) 🔁 把「所有天」的 seq / A,B,C… 都重排一次
        (window.days || [getCurrentDay?.() || 1]).forEach(d => {
          resequenceAndRelabelDay(d);
        });

        // 3) 只針對目標日清舊 legs、重算路線 & 重畫 UI
        purgeLegsForDay(toDay);
        recomputeRouteSmart?.(toDay);
        (renderTimeline || refreshTimeline)?.();
        restyleMarkersForDay?.(toDay);

      } finally {
        menu.style.display='none';
        __moveTargetId = null;
      }
    });

    return menu;
  }

  function showMoveMenuFor(buttonEl, stopId){
    const menu = ensureMoveMenu();
    __moveTargetId = stopId;

    // 1) 先組出所有有的天數
    let daysList = Array.isArray(window.days) && window.days.length
      ? window.days.map(d => Number(d) || 1)
      : [];

    if (!daysList.length) {
      const fromStops = (window.stops || []).map(s => Number(s.day || 1));
      const maxDay = Math.max(1, ...(fromStops.length ? fromStops : [1]), Number(getCurrentDay?.() || 1));
      daysList = Array.from({ length: maxDay }, (_, i) => i + 1);
    }

    // 2) 把「目前所在的 day」排除掉
    const curDay = (typeof getCurrentDay === 'function')
      ? (Number(getCurrentDay()) || 1)
      : (Number(window.currentDay || 1) || 1);

    daysList = Array.from(new Set(daysList))
      .sort((a, b) => a - b)
      .filter(d => d !== curDay);        // 👈 這行就是不顯示自己的 Day

    // 如果沒有其它天數可移，就直接關閉選單
    if (!daysList.length) {
      menu.style.display = 'none';
      __moveTargetId = null;
      return;
    }

    // 3) 產生按鈕
    menu.innerHTML = '';
    daysList.forEach(d => {
      const item = document.createElement('button');
      item.type = 'button';
      item.textContent = `Move to Day ${d}`;
      item.dataset.toDay = String(d);
      Object.assign(item.style, {
        display:'block', width:'100%', textAlign:'left',
        padding:'10px 12px', border:'0', background:'transparent', cursor:'pointer'
      });
      item.onmouseenter = () => item.style.background = '#f5f5f5';
      item.onmouseleave = () => item.style.background = 'transparent';
      menu.appendChild(item);
    });

    // 4) 設定選單位置
    const r  = buttonEl.getBoundingClientRect();
    const vw = innerWidth, vh = innerHeight;
    const w  = Math.max(160, menu.offsetWidth||160);
    const h  = Math.min(menu.scrollHeight||0, 352);
    let x = r.left, y = r.bottom + 6;
    if (x + w > vw) x = vw - w - 8;
    if (y + h > vh) y = r.top - 6 - h;
    Object.assign(menu.style, { left:`${x}px`, top:`${y}px`, display:'block' });
  }


  // ===== 點擊：定位 / 刪除 / 移至 =====
  host.addEventListener('click', (e)=>{
    const btn = e.target.closest && e.target.closest('button[data-action]');
    if (!btn) return;
    const id  = btn.dataset.id;
    const act = btn.dataset.action;
    const s   = (window.stops || []).find(x => String(x.id) === String(id));
    if (!s) return;

    if (act === 'fly') {
      try {
        safePanTo(s.position, { zoom: 14 });
        map.setZoom(16);
        if (typeof bounce === 'function' && s.marker) bounce(s.marker);
      } catch(_) {}
      return;
    }
    if (act === 'del') {
      if (typeof removeStop === 'function') removeStop(s.id);
      return;
    }
    if (act === 'move') {
      e.preventDefault();
      showMoveMenuFor(btn, id);
      return;
    }
  });

  // ===== 拖曳狀態 =====
  let dragId  = null;
  let fromDay = null;

  host.addEventListener('dragstart', (e)=>{
    const row = e.target.closest('.trow[draggable][data-id]');
    if (!row) return;
    dragId  = row.dataset.id;
    fromDay = Number(row.dataset.day || getCurrentDay());
    window.__dragStopId = dragId;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dragId);
    }
  });

  // 只允許同日拖曳
  host.addEventListener('dragover', (e)=>{
    if (!dragId) return;
    const row  = e.target.closest('.trow[draggable][data-id]');
    const tl   = e.target.closest && e.target.closest('.timeline-day');
    if (!row && !tl) return;
    const dayEl = (row && row.closest('[data-day]')) || tl;
    const toDay = Number(dayEl?.dataset?.day || getCurrentDay());
    const sameDay = (Number(fromDay)||1) === (toDay||1);
    if (!sameDay) {
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'none';
      return; // 不 preventDefault，顯示不可放
    }
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  });

  // 只允許同日排序：drop
  host.addEventListener('drop', async (e)=>{
    if (!dragId) return;

    // 目標 DOM 與 day
    const row   = e.target.closest('.trow[draggable][data-id]');
    const dayEl = (row && row.closest('[data-day]')) || e.target.closest('.timeline-day');
    const toDay = Number((row?.dataset.day) || dayEl?.dataset?.day || getCurrentDay());
    const tl    = ensureTimeline(toDay);
    if (!tl) { dragId=null; return; }

    const sameDay = (Number(fromDay)||1) === (toDay||1);
    if (!sameDay) {
      dragId = null; fromDay = null; window.__dragStopId = null; return;
    }
    e.preventDefault();

    // 1) DOM 目標索引
    const stopRows = Array.from(tl.querySelectorAll('.trow[draggable][data-id]'));
    let toIndex = row ? stopRows.indexOf(row) : stopRows.length;

    // 2) DOM 來源索引
    let fromIndex = -1;
    for (let i = 0; i < stopRows.length; i++) {
      if (String(stopRows[i].dataset.id) === String(dragId)) { fromIndex = i; break; }
    }

    // 3) 調整目標索引（往下拖要 -1）
    let adjToIndex = toIndex;
    if (fromIndex >= 0 && toIndex > fromIndex) adjToIndex = toIndex - 1;
    if (fromIndex >= 0 && adjToIndex === fromIndex) {
      dragId = null; fromDay = null; window.__dragStopId = null; return;
    }

    // 4) 直接在 window.stops 內重排（不呼叫 moveStop）
    try {
      const arr = window.stops || [];

      // 找來源全域索引
      const srcGlobalIdx = arr.findIndex(x => String(x.id) === String(dragId));
      if (srcGlobalIdx < 0) throw new Error('drag source not found in array');
      const srcItem = arr[srcGlobalIdx];

      // 先從全域移除
      arr.splice(srcGlobalIdx, 1);

      // 重新蒐集該日元素的全域索引
      const dayIdxs = [];
      for (let i = 0; i < arr.length; i++) {
        if (Number(arr[i].day || 1) === toDay && !isLegLike(arr[i])) dayIdxs.push(i);
      }
      adjToIndex = Math.max(0, Math.min(adjToIndex, dayIdxs.length));

      const insertGlobalIdx =
        dayIdxs.length === 0
          ? arr.length
          : (adjToIndex === dayIdxs.length ? dayIdxs[dayIdxs.length - 1] + 1
                                           : dayIdxs[adjToIndex]);

      srcItem.day = toDay;
      arr.splice(insertGlobalIdx, 0, srcItem);

      // 5) 重編 A/B/C + seq
      resequenceAndRelabelDay(toDay);

      // 6) 清舊腿 → 重新算路 → 清除成功腿的 fallback
      purgeLegsForDay(toDay);
      if (!window.TS_DISABLE_AUTO_ROUTE && typeof recomputeRouteSmart === 'function') {
        await Promise.resolve(recomputeRouteSmart(toDay));
      }
      (window.stops || []).forEach(x=>{
        if (!isLegLike(x) || Number(x.day||1) !== toDay) return;
        const hasRoute = !!(x.polyline || (Array.isArray(x.path) && x.path.length>1) || (x.route && x.route.status === 'OK'));
        if (hasRoute) {
          if (x.meta && x.meta.fallback) delete x.meta.fallback;
          if (x.fallback) x.fallback = '';
          if (x.mode && typeof x.mode === 'string') x.mode = x.mode.toUpperCase();
        }
      });

      // 7) 重畫
      (renderTimeline || refreshTimeline)?.();
      try { restyleMarkersForDay?.(toDay); } catch (_) {}
      } catch (err) {
      console.error('same-day reorder error:', err);
      } finally {
      dragId = null;
      fromDay = null;
      window.__dragStopId = null;
    }
  });

})();

// 讓 Day 分頁支援拖放：把卡片拖到分頁上 → 移到該日「最後」
(function bindDayTabDrop(){
  const tabs = document.getElementById('day-tabs');
  if (!tabs || tabs.dataset.dropbound) return;
  tabs.dataset.dropbound = '1';

  function fallbackMoveToDayEnd(stopId, toDay){
    const arr = window.stops || [];
    const idx = arr.findIndex(x => String(x.id) === String(stopId));
    if (idx < 0) return false;
    const item = arr.splice(idx, 1)[0];
    item.day = Number(toDay) || 1;
    arr.push(item);
    // 重新標 seq（同日遞增）
    const seqMap = {};
    arr.forEach(s => {
      const d = Number(s.day||1);
      seqMap[d] = (seqMap[d]||0) + 1;
      s.seq = seqMap[d];
    });
    return true;
  }

  tabs.addEventListener('dragover', (e)=>{
    if (!window.__dragStopId) return;
    const btn = e.target.closest('[data-day]');
    if (!btn) return;
    e.preventDefault();
    btn.classList.add('drop-target');
  });

  tabs.addEventListener('dragleave', (e)=>{
    const btn = e.target.closest('[data-day]');
    if (btn) btn.classList.remove('drop-target');
  });

  tabs.addEventListener('drop', (e)=>{
    const stopId = window.__dragStopId;
    if (!stopId) return;
    const btn = e.target.closest('[data-day]');
    if (!btn) return;
    e.preventDefault();

    const toDay   = Number(btn.dataset.day || 1);
    const toIndex = (getStopsOfDay?.(toDay) || []).length; // 末尾

    try {
      if (typeof moveStop === 'function' && moveStop.length >= 3) {
        moveStop(stopId, toIndex, toDay);
      } else {
        fallbackMoveToDayEnd(stopId, toDay);
      }

      // 切換到目標日
      setDay?.(toDay);

      // 🟡 重算路線改成「可關閉」，平常為了不卡就先關掉
      if (!window.TS_DISABLE_AUTO_ROUTE && typeof recomputeRouteSmart === 'function') {
        recomputeRouteSmart(toDay);
      }

      // 重畫 timeline
      (renderTimeline || refreshTimeline)?.();
    } catch (err) {
      console.error('drop on day tab failed:', err);
    } finally {
      btn.classList.remove('drop-target');
      window.__dragStopId = null;
    }
  });
})();

// ===== 拖曳自動捲動（靠近上下緣就自動滾） =====
(function bindAutoScrollWhileDrag(){
  const host = getTimelineHost?.();
  if (!host || host.dataset.autoscrollBound) return;
  host.dataset.autoscrollBound = '1';

  let ticking = null;
  function onDragOver(e){
    const box = host.getBoundingClientRect();
    const y   = e.clientY;
    const pad = 48;         // 觸發邊界寬度
    const step= 16;         // 每幀滾動量
    let dy = 0;
    if (y < box.top + pad)   dy = -step;
    else if (y > box.bottom - pad) dy =  step;
    if (!dy) return;

    if (!ticking){
      ticking = requestAnimationFrame(()=>{
        host.scrollTop += dy;
        ticking = null;
      });
    }
  }
  function onEnd(){ if (ticking){ cancelAnimationFrame(ticking); ticking=null; } }

  host.addEventListener('dragover', onDragOver);
  host.addEventListener('drop', onEnd);
  host.addEventListener('dragend', onEnd);
})();

function setDay(d) {
  // --- 0) 決定新的一天 ---
  const newDay = Number(d) || 1;

  // === NEW #1：確保 window.days 存在，且把 newDay 補進去（避免少 Day3） ===
  if (!Array.isArray(window.days)) window.days = [];
  if (!window.days.includes(newDay)) window.days.push(newDay);
  window.days = Array.from(new Set(window.days.map(n => Number(n) || 1))).sort((a, b) => a - b);

  // --- 0.1) 把目前 stops 快照回存到 allStopsByDay（以免切日後丟失） ---
  if (!Array.isArray(window.allStopsByDay)) window.allStopsByDay = [];
  const prevDay = Number(window.currentDay || 0);
  if (prevDay > 0) {
    const prevIdx = prevDay - 1;
    if (!Array.isArray(window.allStopsByDay[prevIdx])) window.allStopsByDay[prevIdx] = [];
    const prevStops = (window.stops || []).filter(s => Number(s.day ?? 1) === prevDay);
    window.allStopsByDay[prevIdx] = prevStops;
  }

  // --- 1) 更新全域目前天數 ---
  setCurrentDay(newDay);
  const cur = newDay;

  // === 保證新的一天有自己的空 bucket（避免沿用上一天） ===
  if (!Array.isArray(window.allStopsByDay)) window.allStopsByDay = [];
  const curIdx = cur - 1;
  if (!Array.isArray(window.allStopsByDay[curIdx])) window.allStopsByDay[curIdx] = [];

  // === 重建 Day Tabs（用 window.days → 會補出 Day3 按鈕） ===
  if (typeof renderDayTabs === 'function') renderDayTabs();

  // --- 2) 視覺預處理 ---
  if (typeof __prepDay === 'function') __prepDay(cur);

  // --- 3) 只顯示當天 timeline（若你有多個 .timeline[data-day] 容器）
  const host = document.getElementById('timeline-host') || document;
  host.querySelectorAll('.timeline[data-day]').forEach(el => {
    el.style.display = (Number(el.dataset.day) === cur) ? 'block' : 'none';
  });

  // --- 4) Day Tabs 樣式（renderDayTabs 之後再保險一次） ---
  document.querySelectorAll('#day-tabs [data-day]').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.day) === cur);
  });

  // --- 5) Timeline 標題上的 Day 編號 ---
  const tlNum = document.getElementById('tl-day-num');
  if (tlNum) tlNum.textContent = String(cur);

  // --- 6) 只顯示當天的行程點（Marker） ---
  (window.stops || []).forEach(s => {
    const dnum = Number(s?.day ?? 1);
    if (s?.marker) s.marker.setVisible(dnum === cur);
  });

  // --- 7) 分日路線可見性 ---
  if (window.dayRoutes && typeof window.dayRoutes === 'object') {
    Object.entries(window.dayRoutes).forEach(([day, route]) => {
      if (route && typeof route.setMap === 'function') {
        route.setMap(Number(day) === cur ? window.map : null);
      }
    });
  }

  // --- 8) 單一 renderer 的顏色（若仍在用） ---
  if (window.directionsRenderer) {
    window.directionsRenderer.setOptions({
      polylineOptions: {
        strokeColor: getDayColor(cur),
        strokeOpacity: 0.95,
        strokeWeight: 6
      }
    });
  }

  // --- 9) 只用當天 stops 重算路線（可關閉） ---
  try {
    if (!window.TS_DISABLE_AUTO_ROUTE && window.MAP_READY && typeof recomputeRouteSmart === 'function') {
      const todays = (window.stops || []).filter(s => Number(s.day ?? 1) === cur);
      const __origStops = window.stops;
      window.stops = todays;
      try { recomputeRouteSmart(cur); } finally { window.stops = __origStops; }
    }
  } catch (e) {
    console.warn('[setDay] recomputeRouteSmart error', e);
  }

  // --- 10) 視野 & UI ---
  try { typeof safeFitBoundsForDay === 'function' ? safeFitBoundsForDay(cur) : 0; } catch (_) { }
  try { typeof renderTimeline === 'function' && renderTimeline(); } catch (_) { }
  try { typeof renderList === 'function' && renderList(); } catch (_) { }

  // --- 11) 捲回頂端 ---
  try {
    const tlBox = typeof ensureTimeline === 'function' ? ensureTimeline(cur) : null;
    if (tlBox) tlBox.scrollTop = 0;
  } catch (_) { }

  // ==============================
  // 12) 推薦點：切換日 → 清掉舊星星
  // ==============================
  try {
    console.debug('[setDay] clearing recommendations for day', cur);

    if (typeof window.hardClearRecommendations === 'function') {
      window.hardClearRecommendations();
    } else if (typeof window.clearRecommendations === 'function') {
      window.clearRecommendations();
    } else if (typeof window.clearSuggestions === 'function') {
      window.clearSuggestions();
    } else {
      // 最後保險方案：直接清掉已知的星星陣列
      (window.suggestionMarkers || []).forEach(m => { try { m.setMap && m.setMap(null); } catch(_){} });
      (window.RECO_MARKERS      || []).forEach(m => { try { m.setMap && m.setMap(null); } catch(_){} });
      window.suggestionMarkers = [];
      window.RECO_MARKERS      = [];
    }
  } catch (err) {
    console.warn('[setDay] clearRecommendations failed:', err);
  }

  // ==============================
  // 13) 推薦點：自動重新搜尋（等同按下 Find Recommendations）
  // ==============================
  try {
    const canAutoReco =
      window.TS_ENABLE_DAY_AUTO_RECO &&
      !window.TS_DISABLE_AUTO_RECO &&
      typeof window.findRecommendations === 'function';

    if (canAutoReco) {
      console.debug('[setDay] auto findRecommendations for day', cur);
      window.findRecommendations();

      setTimeout(() => {
        try {
          console.debug('[setDay] delayed auto findRecommendations for day', cur);
          window.findRecommendations();
        } catch (e) {
          console.warn('[setDay] delayed auto findRecommendations error', e);
        }
      }, 300);
    } else {
      console.debug('[setDay] auto reco disabled (perf)',
                    'TS_DISABLE_AUTO_RECO=', window.TS_DISABLE_AUTO_RECO,
                    'TS_ENABLE_DAY_AUTO_RECO=', window.TS_ENABLE_DAY_AUTO_RECO,
                    'findRecommendations=', typeof window.findRecommendations);
    }
  } catch (err) {
    console.warn('[setDay] auto findRecommendations failed:', err);
  }

  // === 切換日後，重算預算 ===
  try { recalcBudgetForCurrentDay && recalcBudgetForCurrentDay(); } catch (_) { }

  // === NEW #3：保險，最後再把 active 套一次（避免外部重建後沒套到） ===
  document.querySelectorAll('#day-tabs [data-day]').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.day) === cur);
  });

  try { restyleMarkersForDay(getCurrentDay()); } catch (_) { }
}

// 檢查某座標是否落在「任一行程點的推薦半徑」內
function isInsideSuggestArea(latLng) {
  const R = suggestRadiusKm * 1000; // 目前 UI 的公里數
  for (const s of stops) {
    const center = new google.maps.LatLng(s.position);
    const d = google.maps.geometry.spherical.computeDistanceBetween(latLng, center);
    if (d <= R) return true;
  }
  return false;
}

function safeComputeCenter(arr){
  const pts = (arr||[]).map(s => toLatLngLiteral(s?.position)).filter(Boolean);
  if (!pts.length) return DEFAULT_CENTER;
  const lat = pts.reduce((a,b)=>a+b.lat,0)/pts.length;
  const lng = pts.reduce((a,b)=>a+b.lng,0)/pts.length;
  return { lat, lng };
}

function ensureOriginDest(req){
  // 將 origin/destination 強轉為 LatLngLiteral，避免 InvalidValueError
  const o = toLatLngLiteral(req?.origin);
  const d = toLatLngLiteral(req?.destination);
  if (!o || !d) return null;
  const out = { ...req, origin:o, destination:d };
  return out;
}

// === 安全 setMap 防呆（一次性） ===
let __SETMAP_PATCHED__ = false;
function patchSetMapGuardOnce() {
  if (__SETMAP_PATCHED__) return;
  __SETMAP_PATCHED__ = true;

  const classes = [
    google.maps.Marker,
    google.maps.Polyline,
    google.maps.Polygon,
    google.maps.Circle,
    google.maps.Rectangle,
    google.maps.InfoWindow
  ];

  classes.forEach(C => {
    if (!C || !C.prototype || typeof C.prototype.setMap !== 'function') return;
    const orig = C.prototype.setMap;
    C.prototype.setMap = function(m) {
      // 允許 null（隱藏）與 StreetViewPanorama
      const ok =
        (m == null) ||
        (m instanceof google.maps.Map) ||
        (m instanceof google.maps.StreetViewPanorama);

      if (!ok) {
        console.warn('[setMap-guard] 非法的 map 參數，已自動修正：', m, ' for ', this);
        // 優先使用你掛在全域的地圖參照
        m = nowMap() || null;
      }
      return orig.call(this, m);
    };
  });
}

// === Safe patch: DirectionsRenderer.setDirections（只貼一次） ===
window.patchDirectionsRouteOnce = function () {
  try {
    if (typeof google === 'undefined' || !google.maps || !google.maps.DirectionsRenderer) return;
    const proto = google.maps.DirectionsRenderer.prototype;
    if (!proto || proto.__patchedOnce__) return;

    const _orig = proto.setDirections;
    proto.setDirections = function (result) {
      try {
        // 這裡可視需要加上你的修飾邏輯
      } catch (e) { console.warn('[patchDR] setDirections failed', e); }
      return _orig.call(this, result);
    };
    proto.__patchedOnce__ = true;
    console.log('[patchDR] DirectionsRenderer.setDirections patched');
  } catch (err) {
    console.error('[patchDR] failed', err);
  }
};

// === Safe patch: DirectionsService.route（單一版本、可重複呼叫不衝突） ===
function patchDirectionsRouteGlobal() {
  try {
    const DS = google?.maps?.DirectionsService;
    if (!DS) return;

    const proto = DS.prototype;
    if (proto.__SMART_WRAPPED__) return;        // 🛡️ 防重貼
    proto.__SMART_WRAPPED__ = true;

    const raw = proto.route;

    proto.route = function routeSmart(req, cb) {
      // ---- 正規化 origin/destination（支援 stop/location/LatLng/Literal/waypoint）----
      const norm = (v) => {
        if (!v) return null;
        // Waypoint {location, stopover}
        if (v.location) return norm(v.location);
        // stop 物件 { position: {lat,lng} }
        if (v.position) return norm(v.position);

        // google.maps.LatLng
        if (typeof v.lat === 'function' && typeof v.lng === 'function') {
          const la = Number(v.lat()), ln = Number(v.lng());
          return (Number.isFinite(la) && Number.isFinite(ln)) ? { lat: la, lng: ln } : null;
        }
        // Literal {lat,lng}
        if (typeof v.lat !== 'undefined' && typeof v.lng !== 'undefined') {
          const la = Number(v.lat), ln = Number(v.lng);
          return (Number.isFinite(la) && Number.isFinite(ln)) ? { lat: la, lng: ln } : null;
        }
        return null;
      };

      let safeReq = { ...req };
      try {
        const o = norm(req?.origin), d = norm(req?.destination);
        if (!o || !d) {
          // ⚠️ 端點無效：不中斷應用，回傳 INVALID_REQUEST
          if (typeof cb === 'function') {
            try { cb(null, google.maps.DirectionsStatus.INVALID_REQUEST); } catch(_) {}
            return;
          }
          return Promise.resolve(null);
        }
        const modeStr = String(req?.travelMode || 'DRIVING').toUpperCase();
        const mode    = google.maps.TravelMode[modeStr] || google.maps.TravelMode.DRIVING;
        safeReq = { ...req, origin: o, destination: d, travelMode: mode };
      } catch(_) {}

      // ---- 支援 callback 與 Promise 兩種寫法 ----
      if (typeof cb === 'function') {
        try {
          return raw.call(this, safeReq, (res, status) => {
            // ZERO_RESULTS / 非 OK 都「傳回去讓上層 fallback」，不丟例外
            try { cb(res, status); } catch(_) {}
          });
        } catch (err) {
          try { cb(null, google.maps.DirectionsStatus.UNKNOWN_ERROR); } catch(_) {}
          return;
        }
      }

      // Promise 版（若呼叫者沒給 cb）
      return new Promise((resolve) => {
        try {
          raw.call(this, safeReq, (res, status) => {
            // 保持寬鬆：不論狀態如何，都 resolve，讓上層決定要不要 fallback
            resolve(res || null);
          });
        } catch (e) {
          resolve(null);
        }
      });
    };

    console.log('[SMART] DirectionsService.route patched');
  } catch (err) {
    console.error('[SMART] patchDirectionsRouteGlobal failed', err);
  }
}

async function waitForMap() {
  await new Promise(resolve => whenMapsReady(resolve));
}

// === 安全數值/座標工具 ===
function toFiniteNumber(v){
  const n = (typeof v === 'string') ? parseFloat(v) : (typeof v === 'number' ? v : NaN);
  return Number.isFinite(n) ? n : NaN;
}
// 支援 LatLngLiteral / google.maps.LatLng / {lat(),lng()} / {lat,lng}
function toLatLngLiteral(any){
  if (!any) return null;
  if (typeof any.lat === 'function' && typeof any.lng === 'function'){
    const lat = toFiniteNumber(any.lat());
    const lng = toFiniteNumber(any.lng());
    return (Number.isFinite(lat) && Number.isFinite(lng)) ? {lat, lng} : null;
  }
  const lat = toFiniteNumber(any.lat);
  const lng = toFiniteNumber(any.lng);
  return (Number.isFinite(lat) && Number.isFinite(lng)) ? {lat, lng} : null;
}
// 從 stop/location/details 盡量提取合法座標
function getStopLatLng(stop){
  if (!stop) return null;
  let ll = toLatLngLiteral(stop); if (ll) return ll;
  if (stop.location){ ll = toLatLngLiteral(stop.location); if (ll) return ll; }
  const geo = stop.geometry?.location || stop.place?.geometry?.location || stop.details?.geometry?.location;
  return geo ? toLatLngLiteral(geo) : null;
}

// === Directions 小工具與估算 ===
function haversineKm(a,b){
  if(!isValidPos(a)||!isValidPos(b)) return 0;
  const R=6371, toRad=x=>x*Math.PI/180;
  const dLat=toRad(b.lat-a.lat), dLng=toRad(b.lng-a.lng);
  const s1=Math.sin(dLat/2), s2=Math.sin(dLng/2);
  const t=s1*s1 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*s2*s2;
  return R*2*Math.atan2(Math.sqrt(t),Math.sqrt(1-t));
}

function guessCruiseKmh(mode){ switch(String(mode).toUpperCase()){
  case 'FERRY': return 35; case 'FLIGHT': return 650; case 'TRAIN': return 90; case 'BUS': return 45; default: return 40;
}}

function guessBufferMin(mode){ switch(String(mode).toUpperCase()){
  case 'FERRY': return 30; case 'FLIGHT': return 120; case 'TRAIN': return 15; case 'BUS': return 10; default: return 5;
}}

// 給 zoom 用的保險
function safeZoom(z, fallback=10){
  const n = toFiniteNumber(z);
  return Number.isFinite(n) ? Math.max(0, Math.min(22, n)) : fallback;
}

// 支援：LatLngLiteral、google.maps.LatLng、{lat(),lng()}、或 {lat,lng}（字串或數字）
function toLatLngLiteral(any){
  if (!any) return null;

  // google.maps.LatLng 物件
  if (typeof any.lat === 'function' && typeof any.lng === 'function'){
    const lat = toFiniteNumber(any.lat());
    const lng = toFiniteNumber(any.lng());
    return (Number.isFinite(lat) && Number.isFinite(lng)) ? {lat, lng} : null;
  }

  // 具備 lat/lng 屬性的 literal 或自訂物件（可能是字串）
  const lat = toFiniteNumber(any.lat);
  const lng = toFiniteNumber(any.lng);
  return (Number.isFinite(lat) && Number.isFinite(lng)) ? {lat, lng} : null;
}

// 專給 stop 用：從 stop/location/place 盡量找出合法座標
function getStopLatLng(stop){
  if (!stop) return null;

  // 常見結構 1：stop.lat / stop.lng
  let ll = toLatLngLiteral(stop);
  if (ll) return ll;

  // 常見結構 2：stop.location = {lat,lng} 或 google.maps.LatLng
  if (stop.location){
    ll = toLatLngLiteral(stop.location);
    if (ll) return ll;
  }

  // 常見結構 3：Places Details 結構：stop.place / stop.details / stop.geometry?.location
  const geo = stop.geometry?.location || stop.place?.geometry?.location || stop.details?.geometry?.location;
  if (geo){
    ll = toLatLngLiteral(geo);
    if (ll) return ll;
  }

  return null;
}

// 保險：給 zoom 用，避免 NaN 進 setZoom
function safeZoom(z, fallback=10){
  const n = toFiniteNumber(z);
  return Number.isFinite(n) ? Math.max(0, Math.min(22, n)) : fallback;
}

// --- UID utilities (front-end) ---
function _getUID() {
  const KEY = 'planner.uid.v1';
  try {
    let uid = localStorage.getItem(KEY);
    if (!uid) {
      // 產生穩定匿名 UID
      const hasCrypto = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function';
      uid = hasCrypto ? crypto.randomUUID()
                      : (Date.now().toString(36) + Math.random().toString(36).slice(2));
      localStorage.setItem(KEY, uid);
    }
    // 備援寫入 cookie，讓後端也讀得到
    document.cookie = `uid=${uid}; path=/; max-age=31536000; samesite=lax`;
    return uid;
  } catch (e) {
    // 極端情境（禁用 localStorage）下的退路
    return (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : (Date.now().toString(36) + Math.random().toString(36).slice(2));
  }
}


// === PATCH: 行程點 Marker 的穩定 Hover 綁定（只綁一次） ===
function bindStopMarkerHover(marker){
  if (!marker || marker.__hoverBound) return;
  marker.__hoverBound = true;

  marker.addListener('mouseover', () => {
    // 以前這裡是 if (marker.__pinned) return; 會導致滑不出卡片
    // 讓 pinned 也能顯示 hover（若你想完全禁止，可改成只擋住當前被固定的那一顆）
    // if (marker.__pinned && window.__TS_PINNED_MARKER === marker) return;

    clearTimeout(marker._hoverTimer);
    marker._hoverTimer = setTimeout(async () => {
      const src = marker.place || marker.details || marker.item || {};
      const pos = marker.getPosition?.();

      // ✅ 僅接受像 Google Place ID 的 PID，不用 src.id（避免 UUID 誤判）
      let pid = src.place_id || src.placeId || null;
      if (typeof placeIdLooksValid === 'function' && !placeIdLooksValid(pid)) pid = null;

      const s = {
        place_id: pid,
        name: src.name || src.title || 'Place',
        position: pos ? (pos.toJSON?.() || pos) : null,
        rating: (typeof src.rating === 'number') ? src.rating
              : (typeof src.details?.rating === 'number') ? src.details.rating : undefined,
        user_ratings_total: (typeof src.user_ratings_total === 'number') ? src.user_ratings_total
                            : (typeof src.userRatingsTotal === 'number') ? src.userRatingsTotal
                            : (typeof src.details?.user_ratings_total === 'number') ? src.details.user_ratings_total
                            : undefined,
        formatted_address: src.formatted_address || src.vicinity || src.address || src.details?.formatted_address || ''
      };
      if (src.details) s.details = src.details;

      try { if (typeof ensurePlaceDetails === 'function') await ensurePlaceDetails(s); } catch(_) {}

      // 回寫關鍵欄位，讓卡片一定有料
      if (s.details) {
        if (typeof s.rating !== 'number' && typeof s.details.rating === 'number') s.rating = s.details.rating;
        if (!s.formatted_address && s.details.formatted_address) s.formatted_address = s.details.formatted_address;
        try {
          const u = pickBestPhotoUrlFromDetails(s.details);
          if (u) s.photoUrl = u;
        } catch(_) {}
      }

      try { if (typeof showHoverCard === 'function') showHoverCard(s, { compact:false, anchor: marker }); } catch(_) {}
      window.__lastHoverItem = s;
      window.__lastHoverPid  = s.place_id || null;
      window.__hcShownAt     = Date.now();
    }, 80);
  });

  marker.addListener('mouseout', () => {
    clearTimeout(marker._hoverTimer);
    try { if (typeof hideHoverCard === 'function') hideHoverCard(180); } catch(_) {}
  });
}

// 統一幫「行程點的 marker」綁 click 事件，只綁一次
function bindStopMarkerEvents(s) {
  if (!s || !s.marker) return;
  const marker = s.marker;

  // 已經綁過就不要重複綁
  if (marker.__tsStopBound) return;
  marker.__tsStopBound = true;

  marker.addListener('click', () => {
    console.debug('[bindStopMarkerEvents] marker clicked for stop:', s.name || s.id || s.seq);

    try {
      if (typeof openStopCard === 'function') {
        openStopCard(s, {
          pan: true,
          focusDay: false,
          pin: true,
          zoom: null,
          highlightTimeline: true
        });
      } else if (typeof showHoverCard === 'function') {
        // 保底：至少直接打開 hover card
        showHoverCard(s, { compact: false, pin: true, anchor: marker });
      }
    } catch (e) {
      console.warn('[bindStopMarkerEvents] click handler failed', e, s);
    }
  });
}

// 1) 確保 s 有 marker
// 2) 點擊 marker → 呼叫 openStopCard(s, {...})
// 3) icon / label 交給 updateMarkerLabel(s) 統一處理
// 依 day 上色 + 圓點標記：
// 行程點 marker → 一律用 bindStopMarkerEvents(s) 綁 click 行為
function ensureMarker(s) {
  console.debug('[ensureMarker] try for', s?.name, 'pos=', s?.position, 'day=', s?.day, 'seq=', s?.seq);
  if (!s || !isMapsReady() || !window.map) return false;

  // 🔹 保底 position：如果只有 lat/lng，幫他組成 position
  if (!s.position && s.lat != null && s.lng != null) {
    s.position = {
      lat: Number(s.lat),
      lng: Number(s.lng)
    };
  }
  if (!s.position) return false;

  const dayNum = Number(s.day ?? 1);
  const seq0   = (s.seq != null ? Number(s.seq) - 1 : 0);
  const letter = String.fromCharCode(65 + ((seq0 >= 0 ? seq0 : 0) % 26)); // A,B,C...

  let marker = s.marker;

  // 🔹 第一次建立 marker：只建立，不綁事件（事件統一在 bindStopMarkerEvents 裡綁）
  if (!marker) {
    marker = new google.maps.Marker({
      map: window.map,
      position: s.position,
      optimized: true,
      title: (s.name || s.details?.name || "")
    });

    marker.place = s.details || s;
    s.marker = marker;
  }

  // ✨ 統一幫這個行程點綁 click → openStopCard
  if (typeof bindStopMarkerEvents === 'function') {
    bindStopMarkerEvents(s);
  }

  // 🔹 icon / label / visible 一律交給 updateMarkerLabel 處理
  try {
    if (typeof updateMarkerLabel === 'function') {
      updateMarkerLabel(s);
    } else {
      marker.setIcon({
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: colorForDay(dayNum),
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2
      });
      marker.setLabel({
        text: letter,
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: '12px'
      });
    }
  } catch (e) {
    console.warn('[ensureMarker] updateMarkerLabel failed', e);
  }

  s.label = letter;
  return true;
}

// 顏色可換成你現有的 Day 色票
function dayColor(d){
  const pal = ['#2bb0ed','#22c55e','#f59e0b','#ef4444','#a855f7','#06b6d4'];
  return pal[(Number(d||1)-1) % pal.length];
}

// 產出「水滴 + 字母」的 SVG Symbol
function waterDropIcon(d){
  return {
    path: "M12 2C8 2 5 5 5 9c0 4.8 7 13 7 13s7-8.2 7-13c0-4-3-7-7-7z",
    fillColor: dayColor(d),
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 2,
    scale: 1.4,
    anchor: new google.maps.Point(12, 24),
    labelOrigin: new google.maps.Point(12, 10)
  };
}

function letterFor(seq0){
  const i = Math.max(0, Number(seq0||0));
  return String.fromCharCode(65 + (i % 26)); // A..Z
}

// 讓 Timeline 也能自動算字母
function labelForStop(s){
  if (!s) return '';

  // 1) 若本來就有 label（例如從 DB 載入）就直接用
  if (s.label) return s.label;

  // 2) 依照「當日順序」算出 0-based index
  let zeroBased = null;
  if (s._seqInDay != null && !Number.isNaN(Number(s._seqInDay))) {
    zeroBased = Number(s._seqInDay) - 1;
  } else if (s.seq != null && !Number.isNaN(Number(s.seq))) {
    zeroBased = Number(s.seq) - 1;
  }

  if (zeroBased == null || zeroBased < 0) return '';

  // 3) 用既有的 letterFor 轉成 A/B/C...
  return letterFor(zeroBased);
}

function applyStopMarkerStyle(s, idxWithinDay){
  if (!s) return;

  // 沒有 position，就試著用 lat/lng 補一個
  if (!s.position && s.lat != null && s.lng != null) {
    s.position = { lat: Number(s.lat), lng: Number(s.lng) };
  }
  if (!s.position) return;

  // 確保有 marker
  if (!s.marker) {
    s.marker = new google.maps.Marker({
      map: window.map,
      position: s.position,
      optimized: true
    });
  } else {
    try { s.marker.setPosition(s.position); } catch (_) {}
  }

  if (typeof bindStopMarkerEvents === 'function') {
    bindStopMarkerEvents(s);
  }

  const d = Number(s.day || 1);
  const letter = letterFor(idxWithinDay);

  // 讓 marker 顏色與 timeline 一致
  const color = getDayColor(d);

  s.marker.setIcon({
    path: google.maps.SymbolPath.CIRCLE,
    scale: 12,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 2,
    labelOrigin: new google.maps.Point(0, 0)
  });

  s.marker.setLabel({
    text: letter,
    fontWeight: "700",
    color: "#ffffff"
  });

  s.marker.setZIndex(1000 + d*100 + idxWithinDay);
}

// 針對某一天的所有 stop，按 day 內順序重算字母並重繪水滴
function restyleMarkersForDay(day){
  const d = Number(day||1);
  const arr = (window.stops || []).filter(x => Number(x.day||1) === d);
  arr.sort((a,b)=> (Number(a.seq||0)-Number(b.seq||0)));
  arr.forEach((s, i)=> applyStopMarkerStyle(s, i));
}

// 一次把所有天都重繪（保險用）
function restyleAllMarkers(){
  const days = new Set((window.stops||[]).map(s => Number(s.day||1)));
  days.forEach(d => restyleMarkersForDay(d));
}


// 讓其他檔也能呼叫
window.openStopCard = openStopCard;

// === 全域狀態===
// 若別的檔案已建立，就沿用；沒有才建立
if (!('stops' in window)) replaceStopsInPlace([]);
if (!('suggestionMarkers' in window)) window.suggestionMarkers = [];

// 這些是本檔案用的捷徑（不會重新宣告全域陣列）
placesService, directionsService, directionsRenderer, autocomplete;
const stops = window.stops;
const suggestionMarkers = window.suggestionMarkers; // 推薦點（可點擊加入行程） // { place_id, marker }

let dragSrcId = null;
let hoverHideTimer = null; // hover 卡片隱藏用的計時器

//推薦點
const SUGGEST_MIN_ZOOM = 12; // 調小（10 或 8）能更早看到星星
const SUGGEST_DEBUG    = false;  // 設 true 可無條件顯示，方便排錯
window.SUGGEST_MIN_ZOOM = SUGGEST_MIN_ZOOM; // 單一訊息來源


function ensureMinZoom(minZ = (typeof window.SUGGEST_MIN_ZOOM === 'number' ? window.SUGGEST_MIN_ZOOM : 12)) {
  try {
    const gmap = nowMap();
    if (!gmap || typeof gmap.getZoom !== 'function') return;
    const z = gmap.getZoom?.() || 0;
    if (z < minZ) gmap.setZoom(minZ);
  } catch(_) {}
}

function clearSuggestionMarkers() {
  try { (window.suggestionMarkers || []).forEach(sm => sm?.marker?.setMap(null)); } catch(_) {}
  window.suggestionMarkers = [];
}

function removeSuggestionMarker(marker) {
  try { marker?.setMap?.(null); } catch(_) {}
  if (Array.isArray(window.suggestionMarkers)) {
    window.suggestionMarkers = window.suggestionMarkers.filter(sm => sm?.marker !== marker);
  }
}

window.allStopsByDay = [];   // 每個元素是一日的 stops 陣列

function rebuildAllStopsByDay(){
  const arr = Array.isArray(window.stops) ? window.stops : [];
  const maxDay = Math.max(1, ...arr.map(s => Number(s.day ?? 1)));
  window.allStopsByDay = Array.from({ length: maxDay }, () => []);
  arr.forEach(s => {
    const d = Number(s.day ?? 1);
    if (!Array.isArray(window.allStopsByDay[d-1])) window.allStopsByDay[d-1] = [];
    window.allStopsByDay[d-1].push(s);
  });
}

// 這個安全封裝：任何地方叫舊名字，我們都呼叫新路由器。
// 就算 recomputeRouteSmart 尚未被宣告，也會等它準備好再執行。
async function __callSmartRouter(...args){
  // 等待 recomputeRouteSmart 可用（若你把它寫在檔案後面也 OK）
  let tries = 0;
  while (typeof window.recomputeRouteSmart !== 'function' && tries < 50){
    await new Promise(r=>setTimeout(r,0)); // 下一個事件循環
    tries++;
  }
  if (typeof window.recomputeRouteSmart === 'function') {
    console.log('[SMART] use recomputeRouteSmart', { from: __callSmartRouter.caller?.name || 'unknown' });
    return await window.recomputeRouteSmart(...args);
  } else {
    console.warn('[SMART] recomputeRouteSmart not ready; skip');
  }
}

// 將所有常見舊函式名接管到新流程
window.recomputeRoute = async (...args) => { console.log('[SMART] recomputeRoute → SMART'); return __callSmartRouter(...args); };
window.recomputeRouteFast = async (...args) => { console.log('[SMART] recomputeRouteFast → SMART'); return __callSmartRouter(...args); };
window.computeRoute = async (...args) => { console.log('[SMART] computeRoute → SMART'); return __callSmartRouter(...args); };
window.computeRouteBetweenStops = async (...args) => { console.log('[SMART] computeRouteBetweenStops → SMART'); return __callSmartRouter(...args); };

// Directions 的輕量安全呼叫（沿用你已經有的 patch 也可）
async function routeOnce(req){
  return new Promise((resolve)=> {
    try{
      directionsService.route(req,(r,status)=>{
        if(status==='OK'||status===google.maps.DirectionsStatus.OK){ resolve(r); }
        else{ console.warn('[routeOnce]', status); resolve(null); }
      });
    }catch(e){ console.warn('[routeOnce] failed', e); resolve(null); }
  });
}
window.routeOnce = window.routeOnce || routeOnce;

async function routeLegSmart(A, B){
  if (window.DEBUG_STEPS) {
    console.log('[debug steps]', primaryResp?.routes?.[0]?.legs?.[0]?.steps);
  }
  // 先校驗座標
  const aPos = toLatLngLiteral(A?.position);
  const bPos = toLatLngLiteral(B?.position);
  if (!aPos || !bPos){
    console.warn('[routeLegSmart] invalid positions', A, B);
    return { mode:'MANUAL', distanceKm:0, durationMin:0, note:'invalid_points' };
  }

  const nameA = String(A.name||'').toLowerCase();
  const nameB = String(B.name||'').toLowerCase();
  const distKm = haversineKm(aPos, bPos);
  const hintFerry = /penida|nusa|gili|lombok|sanur|padang bai|port|harbor|harbour|碼頭|港/.test(nameA + ' ' + nameB);

  // 若已指定 mode → 直接估算
  const preset = (B.leg && B.leg.mode) || null;
  if (preset && ['FERRY','FLIGHT','TRAIN','BUS','MANUAL'].includes(preset)){
    const cruise = B.leg.cruiseKmh || guessCruiseKmh(preset);
    const buf    = B.leg.bufferMin || guessBufferMin(preset);
    const dKm    = B.leg.manualDistanceKm ?? distKm;
    const mins   = B.leg.manualDurationMin ?? Math.round((dKm/cruise)*60) + buf;
    return { mode:preset, distanceKm:dKm, durationMin:mins, note:'preset' };
  }

  // 試走路網（僅在 google 可用時）
  if (isGoogleReady()){
    const res = await routeOnce({
      origin: aPos, destination: bPos,
      travelMode: google.maps.TravelMode.DRIVING
    });
    if (res && res.routes && res.routes[0]){
      const legs = res.routes[0].legs || [];
      const distanceKm = legs.reduce((s,x)=> s + ((x.distance?.value||0)/1000), 0);
      const durationMin= Math.round(legs.reduce((s,x)=> s + (x.duration?.value||0), 0) / 60);
      return { mode:'DRIVING', distanceKm, durationMin, note:'ok' };
    }
  }

  // 路網不通 → 推斷 FERRY 或 MANUAL
  if (hintFerry && distKm > 10){
    const cruise = 35, buf = 30;
    const mins = Math.round((distKm/cruise)*60) + buf;
    return { mode:'FERRY', distanceKm:distKm, durationMin:mins, cruiseKmh:cruise, bufferMin:buf, note:'fallback:ferry' };
  }
  return { mode:'MANUAL', distanceKm:distKm, durationMin: Math.round(distKm/40*60), note:'fallback:manual' };
}

// 嘗試走路網；不行就改成 FERRY / MANUAL 並估時
async function routeLegSmart(A, B){
  const nameA = String(A.name||'').toLowerCase();
  const nameB = String(B.name||'').toLowerCase();
  const distKm = haversineKm(A.position, B.position);
  const hintFerry = /penida|nusa|gili|lombok|sanur|padang bai|port|harbor|harbour|碼頭|港/.test(nameA + ' ' + nameB);

  // 若使用者/AI 已指定 mode（FERRY/FLIGHT…），直接用手動估算
  const preset = (B.leg && B.leg.mode) || null;
  if (preset && ['FERRY','FLIGHT','TRAIN','BUS','MANUAL'].includes(preset)){
    const cruise = B.leg.cruiseKmh || guessCruiseKmh(preset);
    const buf    = B.leg.bufferMin || guessBufferMin(preset);
    const dKm    = B.leg.manualDistanceKm ?? distKm;
    const mins   = B.leg.manualDurationMin ?? Math.round((dKm/cruise)*60) + buf;
    return { mode:preset, distanceKm:dKm, durationMin:mins, note:'preset' };
  }

  // 先試 Directions（預設 DRIVING）
  const req = {
    origin: A.position,
    destination: B.position,
    travelMode: google.maps.TravelMode.DRIVING
  };
  const res = await routeOnce(req);
  if (res && res.routes && res.routes[0]){
    const legs = res.routes[0].legs || [];
    const distanceKm = legs.reduce((s,x)=> s + ((x.distance?.value||0)/1000), 0);
    const durationMin= Math.round(legs.reduce((s,x)=> s + (x.duration?.value||0), 0) / 60);
    return { mode:'DRIVING', distanceKm, durationMin, note:'ok' };
  }

  // 路網不通 → 推斷 FERRY 或 MANUAL
  if (hintFerry && distKm > 10){
    const cruise = 35, buf = 30;
    const mins = Math.round((distKm/cruise)*60) + buf;
    return { mode:'FERRY', distanceKm:distKm, durationMin:mins, cruiseKmh:cruise, bufferMin:buf, note:'fallback:ferry' };
  }
  // 一般備援
  return { mode:'MANUAL', distanceKm:distKm, durationMin: Math.round(distKm/40*60), note:'fallback:manual' };
}

// 嘗試走路網；不行就改成 FERRY / MANUAL 並估時
async function routeLegSmart(A, B){
  const nameA = String(A.name||'').toLowerCase();
  const nameB = String(B.name||'').toLowerCase();
  const distKm = haversineKm(A.position, B.position);
  const hintFerry = /penida|nusa|gili|lombok|sanur|padang bai|port|harbor|harbour|碼頭|港/.test(nameA + ' ' + nameB);

  // 若使用者/AI 已指定 mode（FERRY/FLIGHT…），直接用手動估算
  const preset = (B.leg && B.leg.mode) || null;
  if (preset && ['FERRY','FLIGHT','TRAIN','BUS','MANUAL'].includes(preset)){
    const cruise = B.leg.cruiseKmh || guessCruiseKmh(preset);
    const buf    = B.leg.bufferMin || guessBufferMin(preset);
    const dKm    = B.leg.manualDistanceKm ?? distKm;
    const mins   = B.leg.manualDurationMin ?? Math.round((dKm/cruise)*60) + buf;
    return { mode:preset, distanceKm:dKm, durationMin:mins, note:'preset' };
  }

  // 先試 Directions（預設 DRIVING）
  const req = {
    origin: A.position,
    destination: B.position,
    travelMode: google.maps.TravelMode.DRIVING
  };
  const res = await routeOnce(req);
  if (res && res.routes && res.routes[0]){
    const legs = res.routes[0].legs || [];
    const distanceKm = legs.reduce((s,x)=> s + ((x.distance?.value||0)/1000), 0);
    const durationMin= Math.round(legs.reduce((s,x)=> s + (x.duration?.value||0), 0) / 60);
    return { mode:'DRIVING', distanceKm, durationMin, note:'ok' };
  }

  // 路網不通 → 推斷 FERRY 或 MANUAL
  if (hintFerry && distKm > 10){
    const cruise = 35, buf = 30;
    const mins = Math.round((distKm/cruise)*60) + buf;
    return { mode:'FERRY', distanceKm:distKm, durationMin:mins, cruiseKmh:cruise, bufferMin:buf, note:'fallback:ferry' };
  }
  // 一般備援
  return { mode:'MANUAL', distanceKm:distKm, durationMin: Math.round(distKm/40*60), note:'fallback:manual' };
}

// 讓 itinerary(JSON) → window.stops（保證 day 為數字）
function hydrateStopsFromItinerary(itin){
  replaceStopsInPlace([]);
  if (!itin) return false;

  // 可能是字串
  if (typeof itin === 'string') {
    try { itin = JSON.parse(itin); } catch { return false; }
  }

  const addStop = (raw, dayNum = 1) => {
    if (!raw) return;
    const s = { ...raw };

    // --- 正規化 Day ---
    s.day = Number(s.day ?? dayNum) || 1;

    // --- 正規化座標 ---
    // 若沒 position 但有 lat/lng → 建立 position
    if (!s.position && s.lat != null && s.lng != null) {
      s.position = { lat: Number(s.lat), lng: Number(s.lng) };
    }

    // 若已有 position，但是字串或含 NaN → 強制轉型 / 檢查
    if (s.position) {
      const la = Number(s.position.lat);
      const ln = Number(s.position.lng);
      if (Number.isFinite(la) && Number.isFinite(ln) && Math.abs(la) <= 90 && Math.abs(ln) <= 180) {
        s.position = { lat: la, lng: ln };
      } else {
        console.warn('[addStop] 無效座標已忽略', s);
        s.position = null;
      }
    }

    // 若仍無效座標，先不 push（避免 Directions 報錯）
    if (!s.position) return;
    window.stops.push(s);
  };

  // ✅ 支援多日格式（itinerary.days）
  if (Array.isArray(itin.days)) {
    itin.days.forEach((dayObj, idx)=>{
      const dayNum = Number(dayObj.day ?? (idx+1));
      const items = Array.isArray(dayObj.items) ? dayObj.items : [];
      items.forEach(item => addStop(item, dayNum));
    });
  }

  // ✅ 兼容舊格式（直接就是 stops 陣列）
  if (Array.isArray(itin.stops)) {
    itin.stops.forEach(s => addStop(s, Number(s.day ?? 1)));
  }

  // ✅ 更新 allStopsByDay 結構
  rebuildAllStopsByDay();

  // ✅ 重畫
  if (typeof renderList === 'function') renderList();
  if (typeof renderTimeline === 'function') renderTimeline();
  setDay(getCurrentDay() || 1);
  return true;
}

//小工具
// 同時兼容多個 ID，誰存在就回傳誰
function $id(...ids) {
  for (const i of ids) {
    const el = document.getElementById(i);
    if (el) return el;
  }
  return null;
}

// — 基本：UID / API_BASE / headers（全域一次就好）
const UID_KEY = 'planner.uid.v1';
function getUID() {
  let id = localStorage.getItem(UID_KEY);
  if (!id) {
    if (crypto?.randomUUID) id = crypto.randomUUID();
    else id = 'dev-' + Math.random().toString(36).slice(2);
    localStorage.setItem(UID_KEY, id);
  }
  // 同步 cookie（後端 current_user_token() 也會讀）
  document.cookie = 'uid=' + id + ';path=/;max-age=' + (60*60*24*365);
  return id;
}
window.API_BASE = window.API_BASE || '/planner/planner_api.php';

// --- 統一的 fetch helper：自動帶 X-UID 與 credentials ---
async function postJson(path, data){
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type':'application/json', ...authHeaders(), 'Accept':'application/json' },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  return res;
}

// DOM 已就緒就立即執行；否則等 DOMContentLoaded
function onDomReady(fn){
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  } else {
    fn();
  }
}

function isUuidLike(s){
  return typeof s === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function placeIdLooksValid(pid){
  if (typeof pid !== 'string') return false;
  if (isUuidLike(pid)) return false;                 // 你的 DB/UUID 直接排除
  // 新/常見的 Google Place ID 多為 ChIJ… 或 GhIJ…
  if (/^(ChIJ|GhIJ)[A-Za-z0-9_-]{10,}$/.test(pid)) return true;
  // 兼容其他較舊樣式：長度夠長、只含可見 token，且非 UUID
  return /^[A-Za-z0-9_-]{20,}$/.test(pid);
}


function latLngOf(item){
  if (!item) return null;
  const p = item.position || item.geometry?.location || null;
  if (!p) return null;
  if (typeof p.lat === 'function') return p; // google.maps.LatLng
  if (p.lat != null && p.lng != null) return new google.maps.LatLng(p.lat, p.lng);
  return null;
}

// 載入 / 建構 stops 時就正規化（資料入口處理）
function normalizeStop(o){
  if (!o) return o;
  o.day = Number(o.day ?? 1) || 1;
  ensureStopId(o);
  const pid = o.place_id || o.placeId || o.id || o.place?.place_id || null;
  if (pid){ o.place_id = o.placeId = pid; }
  o.needsPidFix = !placeIdLooksValid(o.place_id);
  // 位置與其他欄位維持原本邏輯
  return o;
}

// ✅ 正常版：會把點塞進 stops，並建立 marker
function addStop(item, opts = {}) {
  if (!item) return null;

  // 1) 先決定 day / seq
  const dayFromOpt = (typeof opts === 'number') ? opts : opts.day;
  const day = Number(dayFromOpt ?? item.day ?? window.currentDay ?? 1) || 1;

  // 這一天目前已有幾個 stop，用來推 seq
  const stopsOfDay = (window.stops || []).filter(s => Number(s.day ?? 1) === day);
  const seq = Number(
    item.seq ??
    (typeof opts.seq !== 'undefined' ? opts.seq : (stopsOfDay.length + 1))
  ) || (stopsOfDay.length + 1);

  // 2) 套進 normalizeStop，補齊標準欄位
  let o = Object.assign({}, item, { day, seq });
  if (typeof normalizeStop === 'function') {
    o = normalizeStop(o) || o;
  }

  // 3) 一定要有座標才處理
  if (!o.position && o.lat != null && o.lng != null) {
    o.position = { lat: Number(o.lat), lng: Number(o.lng) };
  }
  if (!o.position || !isFinite(o.position.lat) || !isFinite(o.position.lng)) {
    console.warn('[addStop] skip invalid position', o);
    return null;
  }

  // 4) 推進全域 stops 陣列
  if (!Array.isArray(window.stops)) window.stops = [];
  window.stops.push(o);

  // 5) 建立 / 更新 marker
  try {
    if (typeof ensureMarker === 'function') {
      ensureMarker(o);
    }
  } catch (e) {
    console.warn('[addStop] ensureMarker failed', e, o);
  }

  // 6) 視情況更新 UI（舊程式有時會自己呼叫 renderTimeline，所以這裡不強迫）
  try { if (opts.refreshList && typeof renderList === 'function') renderList(); } catch (_) {}
  try { if (opts.refreshTimeline && typeof renderTimeline === 'function') renderTimeline(); } catch (_) {}

  return o;
}

// 這是個保險函式，確保 stops 內的每個點都有基本欄位結構
function ensureLegFields(items){
  (items || []).forEach(s => normalizeStop(s));
}

// 回傳當天要渲染的 stops
function getStopsOfDay(d){
  const day = Number(d) || 1;
  return (window.stops || []).filter(s => Number(s.day ?? 1) === day);
}

// === Tigerair-style Timeline Utilities ===
const LEG_ICON = {
  DRIVING:'🚗', WALKING:'🚶', BICYCLING:'🚲', TRANSIT:'🚌',
  FLIGHT:'✈️', TRAIN:'🚆', BUS:'🚌', FERRY:'⛴️', MANUAL:'🧭'
};

// 將 "HH:MM" 轉成 Date
function timeInputToDate(hhmm){
  if(!hhmm) return null;
  const [h,m]=hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h||0,m||0,0,0);
  return d;
}

// 建立當天時間軸資料（安全版：Maps 未載入時不碰 google.*）
async function buildDayTimelinePlan(day, startAt){
  // 在地小工具：推估停留時間（分鐘）
  function localDefaultStayMinutes(x){
    const types = [];
    (x?.types || x?.badges || []).forEach(t => { if (t) types.push(String(t).toLowerCase()); });
    const T = t => types.some(s => s.includes(t));

    let base =
      T('lodging') ? 8*60 :
      T('airport') || T('aerodrome') ? 120 :
      T('train') || T('subway') || T('bus_station') ? 20 :
      T('museum') || T('art_gallery') ? 120 :
      T('temple') || T('church') || T('shrine') ? 90 :
      T('park') || T('beach') || T('national_park') ? 120 :
      T('shopping_mall') || T('market') || T('night_market') ? 90 :
      T('amusement_park') || T('zoo') || T('aquarium') ? 150 :
      T('restaurant') ? 75 :
      T('cafe') || T('bakery') ? 45 :
      T('tourist_attraction') || T('point_of_interest') ? 60 : 45;

    const rating = Number(x?.rating ?? x?.details?.rating ?? NaN);
    const urt    = Number(x?.userRatingsTotal ?? x?.user_ratings_total ?? x?.details?.user_ratings_total ?? NaN);
    if (!isNaN(rating)) {
      if (rating >= 4.6) base += 15;
      else if (rating <= 3.5) base -= 10;
    }
    if (!isNaN(urt)) {
      if (urt > 5000) base += 20;
      else if (urt > 1500) base += 10;
    }
    const isFood = T('restaurant') || T('cafe');
    const [mn, mx] = isFood ? [30, 120] : [20, 240];
    base = Math.max(mn, Math.min(mx, base));
    return Math.round(base / 5) * 5;
  }

  // ===== 安全旗標 =====
  const gmReady = !!(window.google && google.maps);
  const todays  = getStopsOfDay(day);
  const plan    = { day, startAt, rows:[] };
  if (!todays.length) return plan;

  // 開始時間
  let cursor = startAt ? new Date(startAt) : null;
  plan.rows.push({ type:'stop', at: cursor ? new Date(cursor) : null, stop: todays[0] });

  // 輔助：haversine 與預設巡航 / 緩衝
  const R = 6371;
  const haversineKm = (a,b)=>{
    const la1=a.lat*Math.PI/180, la2=b.lat*Math.PI/180;
    const dLa=(b.lat-a.lat)*Math.PI/180, dLo=(b.lng-a.lng)*Math.PI/180;
    const s=Math.sin(dLa/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLo/2)**2;
    return 2*R*Math.asin(Math.sqrt(s));
  };
  const guessCruiseKmh = (m)=> m==='FLIGHT'?800 : m==='TRAIN'?120 : m==='BUS'?60 : m==='FERRY'?35 : 40;
  const guessBufferMin = (m)=> m==='FLIGHT'?90  : m==='TRAIN'?20  : m==='BUS'?10 : m==='FERRY'?30 : 0;

  for (let i = 1; i < todays.length; i++) {
    const A = todays[i-1], B = todays[i];
    const leg = B.leg || {};
    const modeRaw = (leg.mode || window.travelMode || 'DRIVING').toUpperCase();
    const mode = modeRaw; // 不直接取 google.TravelMode，避免未載入時觸發錯誤
    let legSeconds = 0;

    // 1) 已指定交通工具（FLIGHT/ TRAIN / BUS / FERRY / MANUAL）→ 全離線估算
    if (['FLIGHT','TRAIN','BUS','FERRY','MANUAL'].includes(mode)) {
      const dKm = (leg.manualDistanceKm != null)
        ? leg.manualDistanceKm
        : (A.position && B.position ? haversineKm(A.position, B.position) : 0);
      const minutes = (leg.manualDurationMin != null)
        ? leg.manualDurationMin
        : Math.round((dKm / (leg.cruiseKmh || guessCruiseKmh(mode))) * 60) + (leg.bufferMin ?? guessBufferMin(mode));
      legSeconds = Math.max(0, minutes) * 60;
    } else {
      // 2) 常見地面交通（DRIVING/WALKING/BICYCLING/TRANSIT）
      if (gmReady) {
        // Map 可用 → 走 Directions
        const req = {
          origin: A.position,
          destination: B.position,
          travelMode: (google.maps.TravelMode[mode] || google.maps.TravelMode.DRIVING)
        };
        if (mode === 'TRANSIT' && leg.departAt instanceof Date) {
          req.transitOptions = { departureTime: leg.departAt };
        } else if (mode === 'TRANSIT' && cursor) {
          req.transitOptions = { departureTime: new Date(cursor) };
        }
        const res = await routeOnce(req);
        if (res && res.routes && res.routes[0]) {
          const secs = (res.routes[0].legs || []).reduce((s,x)=> s + (x.duration?.value||0), 0);
          legSeconds = secs;
        } else {
          // Directions 失敗 → 離線估算
          const dKm = (A.position && B.position) ? haversineKm(A.position, B.position) : 0;
          const kmh = mode==='WALKING'?5 : mode==='BICYCLING'?15 : 40; // 粗估
          legSeconds = Math.round((dKm/kmh)*3600);
        }
      } else {
        // Map 尚未就緒 → 直接離線估算，避免觸碰 google.*
        const dKm = (A.position && B.position) ? haversineKm(A.position, B.position) : 0;
        const kmh = mode==='WALKING'?5 : mode==='BICYCLING'?15 : 40;
        legSeconds = Math.round((dKm/kmh)*3600);
      }
    }

    plan.rows.push({ type:'leg', mode, seconds: legSeconds, notes: leg.notes || null });
    if (cursor) cursor = new Date(cursor.getTime() + legSeconds * 1000);

    plan.rows.push({ type:'stop', at: cursor ? new Date(cursor) : null, stop: B });

    const stayMin = (B.stayMin != null) ? B.stayMin : localDefaultStayMinutes(B);
    if (cursor) cursor = new Date(cursor.getTime() + (stayMin * 60 * 1000));
  }

  return plan;
}

// === [DB Trip API helpers] ===
async function fetchTrip(tripId){
  const url = `${apiUrl('trips/' + encodeURIComponent(tripId))}/points`;
  console.log('Trip URL ->', url);
  const res = await fetch(url, { headers: authHeaders?.() || {} });
  if (!res.ok) throw new Error(`Trip API error: ${res.status} ${res.statusText}`);
  return res.json();
}

function toPlanArrayFromApi(resp) {
  const pts = Array.isArray(resp.points) ? resp.points
            : Array.isArray(resp.items)  ? resp.items : [];

  return pts.map((p, idx) => {
    let meta = {};
    try { meta = p.meta_json ? JSON.parse(p.meta_json) : {}; } catch {}

    const base = {
      id: p.id ?? ('db-' + Math.random().toString(36).slice(2)),  // 後端 points.id
      name: p.name ?? '',
      position: { lat: Number(p.lat), lng: Number(p.lng) },
      day: Number(p.day ?? 1),
      seq: p.seq ?? (idx + 1),
      leg: meta.leg || null,
      stayMin: (typeof meta.stayMin === 'number') ? meta.stayMin : 60,

      // ★ 關鍵：把 DB 的點位 id 帶上
      point_id: p.point_id || p.id || null,
      db_point_id: p.point_id || p.id || null,
      source: 'points',
    };

    // 若 normalizeStop 會丟欄位，先正規化再把關鍵欄位塞回
    const n = normalizeStop(base);
    return { ...n, point_id: base.point_id, db_point_id: base.db_point_id, source: 'points' };
  });
}

async function loadTrip(tripId, opts = {}) {
  try {
    const base = opts.base ?? API_BASE;
    const resp = await fetchTrip(tripId, base);
    const plan = toPlanArrayFromApi(resp);
    if (!plan.length) throw new Error('此行程沒有地點');

    clearAll();

    // === 這一步會把地點塞進 stops (你原本就有的) ===
    loadRecommendedPlan(plan);

    // === 修正 lat/lng、legs、推估距離與時間 ===
    normalizeStopsInPlace(window.stops);       // 舊的 (修 lat/lng)
    normalizeStopsDeepInPlace(window.stops);   // 新的 (修 legs 與估時)

    // === 把 plan 裡的 point_id / source 對齊回 stops（避免在流程中遺失） ===
    (function attachPointIdBackToStops(){
      function keyOf(o){
        const n = (o.name || '').trim().toLowerCase();
        const pos = o.position || o;
        const lat = Number(typeof pos.lat === 'function' ? pos.lat() : pos.lat).toFixed(6);
        const lng = Number(typeof pos.lng === 'function' ? pos.lng() : pos.lng).toFixed(6);
        return `${n}|${lat},${lng}`;
      }
      const planMap = new Map(plan.map(p => [keyOf(p), p]));
      (window.stops || []).forEach(s => {
        const src = planMap.get(keyOf(s));
        if (src) {
          s.point_id = s.point_id || src.point_id || src.id;
          s.source   = s.source   || 'points';
        }
      });
    })();

    (function attachDbIdsBackToStops(){
      (window.stops || []).forEach((s, i) => {
        const src = (plan[i]) || plan.find(p => p.seq === s.seq) || {};
        s.point_id = s.point_id || src.point_id || src.db_point_id || src.id || null;
        s.id       = s.id       || s.point_id;  // 讓 patch 的 "point_id || id" 一定有值
        s.source   = s.source   || 'points';
      });
    })();

    // 先跑「海上/飛機/碼頭」等特殊點判斷（修正：用 window.stops）
    if (typeof markSpecialStops === 'function') markSpecialStops(window.stops);

    whenMapsReady(() => {
      try {
        if (typeof setCurrentDay === 'function') setCurrentDay(1);
        if (window.currentDay == null) window.currentDay = 1;

        // 先更新目前是第幾天
        setDay(1); // setDay 會處理當日路線與視野

        // ⭐ 關鍵：行程點全部重建 Marker，再依當天顯示
        if (typeof buildMarkersForAllStops === 'function') {
          buildMarkersForAllStops();
        }

        // 順便讓推薦星星的顯示狀態也更新一下（可選）
        if (typeof applySuggestionVisibility === 'function') {
          applySuggestionVisibility();
        }
      } catch (e) {
        console.warn('[loadTrip] boot day 1 failed', e);
      }
    });

    // （移除：不要在這裡對「全部 stops」跑 recomputeRouteSmart，避免跨日長線）
    // whenMapsReady(() => recomputeRouteSmart()?.catch?.(console.warn));
    // fitToRoute(); // 視野交給 setDay(1) 的 safeFitBoundsForDay 處理

  } catch (err) {
    console.error('loadTrip error', err);
    alert('載入行程失敗: ' + err.message);
  }
}

// === Boot Day 1: 一開頁就渲染 Day 1 ===
(function bootDayOne(){
  try {
    if (typeof setCurrentDay === 'function') setCurrentDay(1);
    // 如果你沒有 setCurrentDay，就用全域變數：
    if (window.currentDay == null) window.currentDay = 1;

    // 先把 Day Tabs 樣式切到 Day 1（若有 #day-tabs）
    const d1 = document.querySelector('#day-tabs [data-day="1"]');
    if (d1) {
      document.querySelectorAll('#day-tabs [data-day]').forEach(b=> b.classList.toggle('active', b === d1));
    }

    // 觸發你原本會在「點 Day x」時做的事情
    if (typeof setDay === 'function') {
      setDay(1);               // 你的專案中 setDay() 會呼叫 renderTimeline / recomputeRouteSmart 等
    } else {
      // 如果沒有 setDay，就至少渲染一次時間軸與地圖
      if (typeof renderTimeline === 'function') renderTimeline(window.plan || null);
      if (typeof safeFitBoundsForDay === 'function') safeFitBoundsForDay(1);
    }
  } catch(e){ console.warn('[BootDayOne] failed:', e); }
})();


// Overlay：用於將 hover-card 放在地圖 pane 中並取得投影
// （統一使用 window.overlayView）

// 路線 / 推薦 預設
let travelMode = 'DRIVING'; // google.maps.TravelMode[travelMode]
let suggestRadiusKm = 3; // 推薦搜尋半徑（公里）
let suggestTypes = ['tourist_attraction','cafe','restaurant']; // 預設搜尋類型
const placeDetailsCache = new Map(); // 地點細節快取（避免重複打 API）
let debouncedSuggest = null; // 防抖器

const _sleep = (ms)=> new Promise(r=>setTimeout(r, ms));

async function nearbySearchSafe(req) {
  return new Promise(resolve => {
    window.placesService.nearbySearch(req, (arr, status) => {
      resolve(status === google.maps.places.PlacesServiceStatus.OK ? (arr || []) : []);
    });
  });
}

async function textSearchSafe(req) {
  return new Promise(resolve => {
    window.placesService.textSearch(req, (arr, status) => {
      resolve(status === google.maps.places.PlacesServiceStatus.OK ? (arr || []) : []);
    });
  });
}


const $ = (sel)=>document.querySelector(sel);

// === Confirm modal helper ===
// 掛到 window，任何地方都叫得到
window.confirmAddPlace = function(place){
  return new Promise((resolve)=> {
    const modal = document.getElementById('add-confirm');
    const nameEl = document.getElementById('add-name');
    const btnYes = document.getElementById('add-yes');
    const btnNo  = document.getElementById('add-no');

    // 沒有自訂 modal 時，退回瀏覽器內建 confirm
    if (!modal || !nameEl || !btnYes || !btnNo) {
      const ok = window.confirm(`要把「${place?.name ?? '這個地點'}」加入行程嗎？`);
      resolve(ok);
      return;
    }

    nameEl.textContent = `要把「${place?.name ?? '這個地點'}」加入行程嗎？`;
    modal.style.display = 'flex';

    const cleanup = () => {
      btnYes.onclick = btnNo.onclick = null;
      modal.style.display = 'none';
    };
    btnYes.onclick = () => { cleanup(); resolve(true);  };
    btnNo.onclick  = () => { cleanup(); resolve(false); };
  });
};

// === 載入「我的行程」清單（含自動標籤與 marker 顯示） ===
async function loadMyTripList() {
  try {
    const res = await fetch(apiUrl('user_trips'), {
      headers: authHeaders(),
      credentials: 'include'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const sel = $id('mytrip-select', 'trip-select');
    if (!sel) return;

    sel.innerHTML = (data.items || [])
      .map(it => `<option value="${it.id}">#${it.id} ${it.title || '(untitled)'}</option>`)
      .join('');

    if (data.items?.length) sel.value = data.items[0].id;

    // 自動載入最近一筆
    const lastId = localStorage.getItem('planner.lastUserTripId.v1') || sel.value;
    if (!lastId) return;

    const tripRes = await fetch(apiUrl('user_trips/' + encodeURIComponent(lastId)), {
      headers: authHeaders(),
      cache: 'no-store'
    });
    const tripData = await tripRes.json();
    if (!tripRes.ok || tripData?.ok === false) throw new Error(tripData?.error || `HTTP ${tripRes.status}`);

    const points = Array.isArray(tripData.points) ? tripData.points : [];
    if (!points.length) return;

    clearAll?.();

    // 轉 stops + 給每個點編號（label），但先不建 marker
    const plan = points.map((p, idx) => {
      let meta = {};
      try { meta = typeof p.meta_json === 'string' ? JSON.parse(p.meta_json) : (p.meta_json || {}); } catch {}
      const s = normalizeStop({
        id: crypto.randomUUID(),
        name: p.name || '未命名地點',
        position: { lat: Number(p.lat), lng: Number(p.lng) },
        day: Number(p.day ?? meta.day ?? 1),
        seq: Number(p.seq ?? meta.seq ?? (idx + 1)),
        stayMin: typeof meta.stayMin === 'number' ? meta.stayMin : 60,
        leg: meta.leg || null
      });
      s.label = String(idx + 1);
      return s;
    });

    window.stops = plan;
    rebuildAllStopsByDay?.();
    renderTimeline?.();

    // 地圖好了就建 marker；若尚未好，等一下再補建
    if (isMapsReady()) {
      buildMarkersForAllStops();
      fitToRoute?.();
      applySuggestionVisibility?.();
    } else {
      const t = setInterval(() => {
        if (isMapsReady()) {
          clearInterval(t);
          buildMarkersForAllStops();
          fitToRoute?.();
          applySuggestionVisibility?.();
        }
      }, 50);
      // 最多等 5 秒
      setTimeout(()=>clearInterval(t), 5000);
    }
  } catch (err) {
    console.error('[loadMyTripList] failed:', err);
  }
  
  // === 自動補所有行程點的 Google Place 詳細資料（避免金額不一致） ===
  //為了效能，只先補「前幾個」常用點，其餘交給 hover / 舊行程補全
  if (Array.isArray(window.stops)) {
    let remain = 8;  // ⭐ 最多先補 8 個就好（可以依需求調整）

    for (const s of window.stops) {
      if (remain <= 0) break;
      if (!s.details && s.place_id) {
        remain--;
        ensurePlaceDetails(s);  // 非 await：讓它在背景慢慢跑就好
      }
    }
  }

  // 預算先用目前已知資料算一版，之後補完 details 會再觸發重算
  if (typeof recalcBudgetForCurrentDay === 'function') {
    recalcBudgetForCurrentDay();
  }
}

// === 兼容舊版名稱：有人叫 loadTripList() 就轉到新版 ===
window.loadTripList = function() {
  console.log('[Shim] loadTripList() 被呼叫，轉向 loadMyTripList()');
  return loadMyTripList();
};

function normalizeStopsPositions() {
  if (!Array.isArray(window.stops)) return;
  window.stops.forEach(s => {
    if (!s.position && s.lat != null && s.lng != null) {
      s.position = { lat: Number(s.lat), lng: Number(s.lng) };
    }
  });
}

// 載入一筆 user_trip，並把 stops 套進現在的地圖
async function loadMyTrip(id) {
  // 先從後端把 trip 內容抓回來
  const res = await fetch(apiUrl('user_trips/' + encodeURIComponent(id)), {
    headers: authHeaders(),
    credentials: 'include',
    cache: 'no-store'
  });
  const data = await res.json();
  if (!res.ok || data?.ok === false) {
    throw new Error(data?.error || `HTTP ${res.status}`);
  }

  const trip = data.trip || data;

  // 1) 來源優先順序：
  //    trip.points → trip.stops → trip.notes_obj.stops → trip.notes 裡的 stops/points
  let arr = Array.isArray(trip.points) ? trip.points : [];

  // 舊版可能直接放在 trip.stops
  if (!arr.length && Array.isArray(trip.stops)) {
    arr = trip.stops;
  }

  // 你現在 /api/user_trips/{id} 的格式：真正的行程點都在 notes_obj.stops 裡
  if (!arr.length && trip.notes_obj && Array.isArray(trip.notes_obj.stops)) {
    arr = trip.notes_obj.stops;
  }

  // 最後再從 notes（字串 JSON）裡 fallback 一次，兼容更舊版本
  if (!arr.length && trip?.notes) {
    let notes = trip.notes;
    try {
      if (typeof notes === 'string') notes = JSON.parse(notes);
    } catch {}
    arr = Array.isArray(notes?.points) ? notes.points
        : Array.isArray(notes?.stops)  ? notes.stops
        : [];
  }

  if (!arr.length) throw new Error('此行程沒有地點');

  // arr 是你從後端拿到、或 notes 轉出的 points 陣列
  const toNumber = v => (v === null || v === undefined || v === '') ? null : Number(v);

  const parsedStops = arr
    .map((row, idx) => {
      // 解析 meta / meta_json
      let meta = {};
      try {
        meta = row.meta ? row.meta : (row.meta_json ? JSON.parse(row.meta_json) : {});
      } catch {}

      // 取座標（相容各種欄位）
      const lat = row.lat ?? row.latitude ?? row.position?.lat;
      const lng = row.lng ?? row.longitude ?? row.position?.lng;

      const stopRaw = {
        id:      row.id || row.point_id || row.pid,
        name:    row.name || row.title || row.label || '未命名地點',
        position:{ lat: Number(lat), lng: Number(lng) },
        day:     Number(row.day ?? meta.day ?? 1),
        seq:     Number(row.seq ?? meta.seq ?? (idx + 1)),
        stayMin: toNumber(row.stayMin ?? row.stay_min ?? meta.stayMin) ?? 60,
        placeId: row.place_id || row.placeId || meta.placeId || null,
        icon:    row.icon || meta.icon || null,
        leg:     row.leg || meta.leg || {}
      };

      // 若有 normalizeStop 就用，沒有就直接回傳
      const out = (typeof normalizeStop === 'function') ? normalizeStop(stopRaw) : stopRaw;
      ensureStopId(out);
      return out;
    })
    .filter(st => isFinite(st?.position?.lat) && isFinite(st?.position?.lng));

  if (!parsedStops.length) throw new Error('行程點沒有有效座標');

  // 把 stops 套進現在的全域狀態
  replaceStopsInPlace(parsedStops);
  drawMarkersForStops?.();
  window.currentDay = parsedStops[0].day || 1;

  // 重畫清單、時間軸、marker、路線
  if (typeof renderList === 'function') renderList();
  if (typeof renderTimeline === 'function') renderTimeline();
  if (typeof drawMarkersForStops === 'function') drawMarkersForStops();
  if (typeof recomputeRouteSmart === 'function') await recomputeRouteSmart();
  if (typeof fitToRoute === 'function') fitToRoute();

  // === 推薦點：在地圖與 stops 準備好之後自動觸發一次 ===
  whenMapsReady(async () => {
    try {
      await waitUntil(
        () => Array.isArray(window.stops) && window.stops.length > 0,
        4000
      );
    } catch (_) {}

    // 放大到顯示門檻（你預設 15，給 16 比較保險）
    try {
      const g = nowMap();
      if (g?.getZoom?.() < 16) g.setZoom(16);
    } catch (_) {}

    window.showRangeCircles = true;
    window.applySuggestionVisibility?.();

    //尊重 TS_DISABLE_AUTO_RECO，只在開啟自動推薦時才會跑
    if (!window.TS_DISABLE_AUTO_RECO && typeof suggestNearbyAroundStops === 'function') {
      await suggestNearbyAroundStops({
        types: ['tourist_attraction', 'cafe', 'restaurant'],
        radius: 3000,
        perStop: 6
      });
    }
  });

  return parsedStops;
}
// 只檢查指定天數內的行程點（含 geometry 備援）
function isInsideSuggestAreaForDay(latLng, day) {
  const todays = getStopsOfDay(day);
  const R = (window.suggestRadiusKm || 3) * 1000;
  const g = p => (p instanceof google.maps.LatLng ? p : new google.maps.LatLng(p));
  const pt = g(latLng);

  // ✅ 若今天沒有任何 stop，退而求其次：用地圖中心做一個圈
  if (!todays.length) {
    try {
      const c = map?.getCenter?.();
      if (!c) return true; // 最寬鬆：沒有中心就直接放過
      const d = (google.maps.geometry?.spherical?.computeDistanceBetween)
        ? google.maps.geometry.spherical.computeDistanceBetween(pt, c)
        : (()=>{
            // fallback 簡單 Haversine
            const a = { lat: pt.lat(), lng: pt.lng() };
            const b = { lat: c.lat(),  lng: c.lng()  };
            const toRad = x => x*Math.PI/180, Rk=6371000;
            const dLa = toRad(b.lat - a.lat), dLn = toRad(b.lng - a.lng);
            const L1=toRad(a.lat), L2=toRad(b.lat);
            const s = Math.sin(dLa/2)**2 + Math.cos(L1)*Math.cos(L2)*Math.sin(dLn/2)**2;
            return 2*Rk*Math.asin(Math.sqrt(s));
          })();
      return d <= R;
    } catch { return true; } // 安全：有例外就放過
  }

  // 原邏輯：今天有 stop → 以每個 stop 為圓心
  for (const s of todays) {
    const center = g(s.position);
    const d = (google.maps.geometry?.spherical?.computeDistanceBetween)
      ? google.maps.geometry.spherical.computeDistanceBetween(pt, center)
      : (()=>{
          const a = { lat: pt.lat(), lng: pt.lng() };
          const b = { lat: center.lat(), lng: center.lng() };
          const toRad = x => x*Math.PI/180, Rk=6371000;
          const dLa = toRad(b.lat - a.lat), dLn = toRad(b.lng - a.lng);
          const L1=toRad(a.lat), L2=toRad(b.lat);
          const s2 = Math.sin(dLa/2)**2 + Math.cos(L1)*Math.cos(L2)*Math.sin(dLn/2)**2;
          return 2*Rk*Math.asin(Math.sqrt(s2));
        })();
    if (d <= R) return true;
  }
  return false;
}

// --- 小工具：等待條件成立（避免時序太早） ---
function waitUntil(pred, timeout = 5000, interval = 80){
  return new Promise((resolve, reject)=>{
    const t0 = Date.now();
    const tick = ()=>{
      try{
        if (pred()) return resolve(true);
        if (Date.now() - t0 > timeout) return reject(new Error('waitUntil timeout'));
        setTimeout(tick, interval);
      }catch(e){ reject(e); }
    };
    tick();
  });
}
const stopsReady = ()=> Array.isArray(window.stops) && window.stops.length>0;
const placesReady = ()=> !!window.placesService;

// ===== Minimal setupSuggestControls (UI 綁定 → 呼叫全域版) =====
function setupSuggestControls(){
  const btnSuggest = document.getElementById('btn-suggest');
  const btnClear   = document.getElementById('btn-clear-suggest');
  const rangeInput = document.getElementById('range-km');
  const rangeOut   = document.getElementById('range-km-out');
  const typeChecks = Array.from(document.querySelectorAll('input[name="types"]'));

  // 若畫面沒有這些控制，就安靜離開
  if (!btnSuggest && !rangeInput && !typeChecks.length) {
    console.warn('[suggest] controls not found'); 
    return;
  }

  // 半徑（km）狀態
  window.suggestRadiusKm = Number(rangeInput?.value) || window.suggestRadiusKm || 3;
  const clamp = (v,mn,mx)=> Math.max(mn, Math.min(mx, v));
  const kmToM = km => Math.max(100, Math.min(50000, (km||3)*1000));

  // 讀取選中的 types
  const getTypes = () => {
    const t = typeChecks.filter(c=>c.checked).map(c=>c.value);
    return t.length ? t : ['tourist_attraction'];
  };

  // 觸發一次推薦（呼叫全域唯一版）
  const trigger = async () => {
    const types  = getTypes();
    const radius = kmToM(window.suggestRadiusKm);
    try {
      await new Promise(resolve => whenMapsReady(resolve));
      await window.suggestNearbyAroundStops({
        types,
        radius,
        perStop: 6
      });
    } catch (e) {
      console.warn('[suggest trigger] not ready', e);
    }
  };

  // 半徑輸入
  rangeInput?.addEventListener('input', e=>{
    const v = Number(e.target.value);
    window.suggestRadiusKm = clamp(isNaN(v)?3:v, 0.5, 30);
    if (rangeOut) rangeOut.textContent = `${window.suggestRadiusKm} km`;
  });

  // 推薦按鈕
  btnSuggest?.addEventListener('click', async ()=>{
    // 等 stops & places ready（簡易版）
    const waitUntil = (pred, timeout=6000, interval=80)=>new Promise((res,rej)=>{
      const t0=Date.now(); (function tick(){ try{
        if (pred()) return res(true);
        if (Date.now()-t0>timeout) return rej(new Error('waitUntil timeout'));
        setTimeout(tick, interval);
      }catch(e){ rej(e); } })();
    });
    try { 
      await waitUntil(()=> (Array.isArray(window.stops)&&window.stops.length>0) && window.placesService, 6000);
      trigger();
    } catch(e) {
      console.warn('[suggest] not ready', e);
    }
  });

  // 清除按鈕
  btnClear?.addEventListener('click', ()=>{
    (window.suggestionMarkers||[]).forEach(s=> s.marker?.setMap?.(null));
    window.suggestionMarkers = [];
  });

  // 預設初始化一次顯示
  if (rangeOut) rangeOut.textContent = `${window.suggestRadiusKm} km`;
}

// 判斷是否像跨海（啟發式）
function looksOverWater(A, B) {
  const toRad = d => d*Math.PI/180;
  const lat1 = toRad(A.lat), lon1 = toRad(A.lng);
  const lat2 = toRad(B.lat), lon2 = toRad(B.lng);
  const dLat = lat2-lat1, dLon = lon2-lon1;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
  const meters = 2*6371000*Math.asin(Math.sqrt(a));
  return meters > 3000 && A.lat !== B.lat && A.lng !== B.lng;
}

// 從 Google Directions 的 leg.steps 判斷「實際」交通方式
function detectLegMode(rawLeg, reqMode, Apos, Bpos) {
  const steps = Array.isArray(rawLeg?.steps) ? rawLeg.steps : [];
  const km = (rawLeg?.distance?.value || 0) / 1000;

  let hasTransit=false, hasBus=false, hasRail=false, hasSubway=false, hasTram=false, hasFerry=false;
  let hasDriving=false, hasWalking=false, hasBicycling=false;

  const ferryWords = ['ferry','渡輪','渡船','フェリー','페리','fähre'];
  const isFerryWord = s => ferryWords.some(w => s.includes(w));

  const visit = (arr=[]) => {
    for (const st of arr) {
      const tm   = String(st.travel_mode || '').toUpperCase();
      const man  = String(st.maneuver || '').toLowerCase();
      const html = String(st.html_instructions || st.instructions || '').toLowerCase();
      const veh  = String(st.transit?.line?.vehicle?.type || '').toUpperCase();

      if (tm === 'DRIVING')   hasDriving   = true;
      if (tm === 'WALKING')   hasWalking   = true;
      if (tm === 'BICYCLING') hasBicycling = true;
      if (tm === 'TRANSIT')   hasTransit   = true;

      if (veh === 'BUS')        hasBus    = true;
      if (veh === 'RAIL' || veh === 'TRAIN' || veh === 'HEAVY_RAIL' || veh === 'COMMUTER_TRAIN') hasRail = true;
      if (veh === 'SUBWAY' || veh === 'METRO_RAIL') hasSubway = true;
      if (veh === 'TRAM')      hasTram   = true;
      if (veh === 'FERRY')     hasFerry  = true;

      if (man.includes('ferry') || (html && isFerryWord(html))) hasFerry = true;

      if (Array.isArray(st.steps) && visit(st.steps)) return true;
    }
    return false;
  };
  visit(steps);

  // 1) 明確的渡輪
  if (hasFerry) return { mode: 'FERRY', reason: 'steps: ferry' };

  // 2) 只有 TRANSIT 且沒看到巴士/鐵路 → 高機率是船
  if (hasTransit && !hasBus && !hasRail && !hasSubway && !hasTram) {
    return { mode: 'FERRY', reason: 'transit-without-bus-rail' };
  }

  // 3) 全步行 or 距離很短
  const straightLooksWater = (Apos && Bpos) ? looksOverWater(Apos, Bpos) : false;
  if (hasWalking && !hasDriving && !hasBicycling && !hasTransit) return { mode: 'WALKING', reason: 'steps-all-walking' };
  if (!hasTransit && !hasDriving && km <= 1.2) return { mode: 'WALKING', reason: 'short-distance' };

  // 4) 自行車
  if (hasBicycling && !hasDriving && !hasTransit) return { mode: 'BICYCLING', reason: 'steps-bicycling' };

  // 5) 大眾運輸（有 bus/rail/subway/tram 任一）
  if (hasTransit) return { mode: 'TRANSIT', reason: 'steps-transit' };

  // 6) 開車 + 可能跨海 → 仍用 DRIVING 畫，但給後續有需要可覆寫成 FERRY
  if (hasDriving) {
    if (straightLooksWater && km > 3) return { mode: 'FERRY', reason: 'driving-over-water-heuristic' };
    return { mode: 'DRIVING', reason: 'steps-driving' };
  }

  // 7) 都判不到：退回請求模式或 DRIVING
  const fallback = String(reqMode || 'DRIVING').toUpperCase();
  return { mode: fallback, reason: 'fallback' };
}

// --- Directions.setDirections 容錯補丁（只打一次） ---
function patchDirectionsRouteOnce(){
  const proto = google.maps.DirectionsRenderer && google.maps.DirectionsRenderer.prototype;
  if (!proto || proto.__ts_patched) return;

  const orig = proto.setDirections;
  proto.setDirections = function(result){
    // 允許 null/undefined：等於清空
    if (!result) return orig.call(this, { routes: [] });

    // 1) 正常的 DirectionsResult
    if (Array.isArray(result.routes)) {
      return orig.call(this, result);
    }

    // 2) 誤傳了「DirectionsRoute」(單一路線) → 包成 DirectionsResult
    if (result.legs || result.bounds || result.overview_path || result.overview_polyline) {
      return orig.call(this, { routes: [result] });
    }

    // 3) 某些包裝器用 {result, status}
    if (result.result) {
      const r = result.result;
      if (Array.isArray(r.routes)) return orig.call(this, r);
      if (r.legs || r.bounds || r.overview_path || r.overview_polyline) {
        return orig.call(this, { routes: [r] });
      }
    }

    console.warn('[patch] setDirections: unknown shape, fall back to empty', result);
    return orig.call(this, { routes: [] });
  };

  proto.__ts_patched = true;
}

// --- 額外給你一個可單獨呼叫的保險函式（可不改既有呼叫點） ---
function safeSetDirections(renderer, result){
  try{
    if (!renderer) return;
    // 交給上面的 patched setDirections 去判斷
    renderer.setDirections(result);
  }catch(e){
    console.warn('[safeSetDirections] failed, forcing empty', e, result);
    try { renderer.safeSetDirectionss(dirRenderer, { routes: [] }); } catch(_) {}
  }
}

// 🆕 讓物件同時擁有 placeId 與 place_id（有一個就補另一個）
function ensurePlaceIdBoth(obj){
  const pid = obj?.place_id || obj?.placeId || null;
  if (!pid) return obj;
  obj.placeId  = pid;
  obj.place_id = pid;
  return obj;
}

// === 共用：補齊 placeId / place_id（任一有值就同步另一個） ===
function ensurePlaceIdBoth(o){
  const pid = o?.place_id || o?.placeId || o?.pid || null;
  if (!pid) return o;
  o.placeId  = pid;
  o.place_id = pid;
  return o;
}

// === 共用：等 Google Maps/Places 就緒 ===
function waitGoogleReady(timeout = 8000){
  return new Promise((resolve, reject)=>{
    const t0 = Date.now();
    (function tick(){
      if (window.google?.maps?.places) return resolve(true);
      if (Date.now() - t0 > timeout) return reject(new Error('google maps not ready'));
      setTimeout(tick, 120);
    })();
  });
}

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

// === 共用：小型快取（避免重複查同一點） ===
window.__pidCache = window.__pidCache || new Map(); // key: `${name}|${lat.toFixed(5)},${lng.toFixed(5)}`
function pidCacheKey(s){
  const lat = Number(s?.position?.lat ?? s?.lat);
  const lng = Number(s?.position?.lng ?? s?.lng);
  return `${(s?.name||'').trim()}|${isFinite(lat)?lat.toFixed(5):'?'},${isFinite(lng)?lng.toFixed(5):'?'}`;
}

// === 自動修復：為當前 stops 補齊缺少 placeId / place_id ===
// 只更新前端記憶體（不寫回後端）；避免打太多 API，做了節流與上限
async function fixMissingPlaceIdsAuto({ maxFix = 8, perDelay = 220 } = {}){
  try{
    await waitGoogleReady();

    // 確保 placesService
    if (!window.placesService && window.map) {
      window.placesService = new google.maps.places.PlacesService(window.map);
    }
    const svc = window.placesService;
    if (!svc) { console.warn('[pid-fix] placesService not ready'); return; }

    const arr = Array.isArray(window.stops) ? window.stops : [];
    if (!arr.length) return;

    // 先同步已有 pid 的物件
    arr.forEach(s => ensurePlaceIdBoth(s));

    // 篩出真的缺 pid 的
    const targets = arr.filter(s => !(s.place_id || s.placeId));
    if (!targets.length) { console.debug('[pid-fix] all good, no missing pid'); return; }

    let fixed = 0;
    for (const s of targets){
      if (fixed >= maxFix) break; // 控制每次上限，避免爆額度

      // 快取命中直接補
      const k = pidCacheKey(s);
      const cached = k && __pidCache.get(k);
      if (cached) {
        s.place_id = s.placeId = cached;
        fixed++;
        continue;
      }

      // 需要位置才能做 nearby / findPlace
      const lat = Number(s?.position?.lat ?? s?.lat);
      const lng = Number(s?.position?.lng ?? s?.lng);
      const loc = (isFinite(lat) && isFinite(lng)) ? new google.maps.LatLng(lat, lng) : null;

      // 先 nearbySearch（通常較準）
      const pid = await new Promise(res=>{
        if (!loc) return res(null);
        svc.nearbySearch({ location: loc, radius: 1200, keyword: (s.name||'').trim() }, (r, st)=>{
          if (st === google.maps.places.PlacesServiceStatus.OK && r?.length) {
            return res(r[0].place_id);
          }
          res(null);
        });
      });

      let got = pid;
      // nearby 失敗 → 再用 findPlaceFromQuery 當備援
      if (!got) {
        got = await new Promise(res=>{
          svc.findPlaceFromQuery({
            query: (s.name||'').trim(),
            fields: ['place_id','geometry'],
            locationBias: loc ? { radius: 1500, center: loc } : undefined
          }, (r, st)=>{
            if (st === google.maps.places.PlacesServiceStatus.OK && r?.length) {
              // 若沒座標，順便補回 position
              if (!s.position && r[0].geometry?.location) {
                s.position = r[0].geometry.location.toJSON?.() || s.position;
              }
              return res(r[0].place_id);
            }
            res(null);
          });
        });
      }

      if (got) {
        s.place_id = s.placeId = got;
        if (k) __pidCache.set(k, got);     // 記快取
        fixed++;
      }

      await sleep(perDelay);               // 節流，避免 QPS 過高
    }

    if (fixed) {
      console.info(`[pid-fix] fixed ${fixed} / ${targets.length} stops`);
      // 若你想立即刷新 hover 卡片細節，可選擇重新 render 或補叫一次 renderList/renderTimeline
      try { renderList && renderList(); } catch {}
      try { renderTimeline && renderTimeline(); } catch {}
    } else {
      console.debug('[pid-fix] nothing fixed');
    }
  } catch(err){
    console.warn('[pid-fix] error:', err);
  }
}


// 點擊卡片外 anywhere → 解除 sticky 並立即關閉
document.addEventListener('click', (e) => {
  const cardEl = document.getElementById('hover-card');
  if (!cardEl) return;
  if (cardEl.contains(e.target)) return; // 點在卡片內不關
  cardEl.dataset.sticky = '0';
  hideHoverCard(0, { force: true, forceFromReco: true });
}, true);

window.hoverHideTimer = null;


function getHoverCardEl(){ 
  return document.getElementById('hover-card'); 
}

(function wireHoverCardButtons(){
  const navBtn = document.getElementById('hc-navigate');
  const addBtn = document.getElementById('hc-add');
  if (navBtn) {
    navBtn.addEventListener('click', () => {
      const it = window.__lastHoverItem;
      const loc = it?.geometry?.location || it?.position;
      if (!loc) return;
      const lat = (typeof loc.lat === 'function') ? loc.lat() : loc.lat;
      const lng = (typeof loc.lng === 'function') ? loc.lng() : loc.lng;
      const q = it?.place_id ? `&destination_place_id=${it.place_id}` : '';
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}${q}`, '_blank');
    });
  }
  if (addBtn) {
    addBtn.addEventListener('click', async () => {
      const it = window.__lastHoverItem;
      if (!it) return;
      try {
        await (window.addPlaceToPlan?.(it) || Promise.resolve());
        // 成功後把卡片取消 sticky 並關閉
        const cardEl = document.getElementById('hover-card');
        if (cardEl) cardEl.dataset.sticky = '0';
        hideHoverCard(0, { force:true });
      } catch(e){ console.warn(e); }
    });
  }
})();

// 地圖就緒後執行一次
whenMapsReady(() => { try{ patchSetMapGuardOnce(); }catch(e){ console.warn(e); } });


// 讓舊的 #timeline 變成 host（容器），裡面會放多個 data-day 的 timeline
function getTimelineHost(){
  let host = document.getElementById('timeline-host');
  if (!host) {
    // 先嘗試拿舊的 #timeline 當作 host
    const orig = document.getElementById('timeline');
    if (orig) {
      orig.id = 'timeline-host';
      host = orig;
    } else {
      host = document.createElement('div');
      host.id = 'timeline-host';
      // 放回原本應該在的位置：如果有 timeline 區塊的父容器就插回去
      const asideCard = document.querySelector('.card.section') || document.body;
      asideCard.appendChild(host);
    }
  }
  return host;
}

function getAllDays(){
  // 優先從 stops 中推算（保證載入後有資料也能運作）
  if (Array.isArray(window.stops) && window.stops.length) {
    const max = Math.max(1, ...window.stops.map(s => Number(s.day ?? 1)));
    return Array.from({length: max}, (_, i) => i + 1);
  }

  // 若 stops 尚未建立，退回用現有 tabs 推算
  const tabs = [...document.querySelectorAll('#day-tabs .btn[data-day]')]
    .map(b => Number(b.dataset.day))
    .filter(n => !isNaN(n))
    .sort((a,b) => a - b);

  return tabs.length ? tabs : [1];
}

function showDay(day){
  // 1) 切換地圖：只顯示該日的 marker、換路線顏色…（既有的 setDay 已經會做）
  setDay(day);

  // 2) 同步左側時間軸顯示
  getAllDays().forEach(d=>{
    const tl = ensureTimeline(d);
    tl.style.display = (d === day) ? 'block' : 'none';
  });

  // 3) 同步「Day x」標題
  const n = document.getElementById('tl-day-num');
  if (n) n.textContent = String(day);
}

/* ==========================
 * 顧客行程儲存／載入（user_trips）
 * ========================== */

// 打包單一 stop（含 meta_json：leg / stayMin）
function toApiPoint(s){
  return {
    name: s.name,
    lat:  s.position.lat,
    lng:  s.position.lng,
    placeId: s.placeId ?? null,
    meta_json: JSON.stringify({
      rating: s.rating ?? null,
      userRatingsTotal: s.userRatingsTotal ?? null,
      photoUrl: s.photoUrl ?? null,
      badges: s.badges ?? [],
      leg: s.leg || null,
      stayMin: (typeof s.stayMin === 'number') ? s.stayMin : 60
    })
  };
}

function buildUserTripPayloadForSave(title) {
  // ---- 收集所有 stops ----
  const allStops = [];
  if (Array.isArray(window.allStopsByDay)) {
    for (const arr of window.allStopsByDay) allStops.push(...arr);
  } else if (Array.isArray(window.stops)) {
    allStops.push(...window.stops);
  }

  // ---- 清除 Google Maps 循環物件 ----
  const cleanStops = allStops.map(s => {
    const clean = {
      name: s.name || "",
      lat: s.lat ?? s.position?.lat ?? s.marker?.getPosition?.()?.lat?.() ?? null,
      lng: s.lng ?? s.position?.lng ?? s.marker?.getPosition?.()?.lng?.() ?? null,
      day: s.day ?? 1,
      seq: s._seqInDay ?? s.seq ?? 1,
      placeId: s.placeId || null,
      rating: s.rating ?? null,
      userRatingsTotal: s.userRatingsTotal ?? null,
      photoUrl: s.photoUrl ?? null,
      stayMin: s.stayMin ?? null,
      leg: s.leg ?? null,
      meta_json: s.meta_json ?? null
    };
    return clean;
  });

  // ---- 依 day 分組 ----
  const daysMap = new Map();
  for (const s of cleanStops) {
    const d = s.day ?? 1;
    if (!daysMap.has(d)) daysMap.set(d, []);
    daysMap.get(d).push(s);   // ← 原本是 push(s.name)
  }

  const daysArr = [...daysMap.entries()].map(([day, items]) => ({
    day,
    title: `Day ${day}`,
    items
}));

  // ---- 最終 payload ----
  return {
    title: (title || '未命名行程').trim(),
    notes: document.getElementById('trip-notes')?.value || null,
    stops: cleanStops,
    days: daysArr
  };
}

// === Flask 後端 API：三個操作 ===
async function apiSaveTrip(payload){
  const r = await fetch('/api/user_trips', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload)
  });
  return r;
}

async function apiUpdateTrip(tripId, payload){
  const r = await fetch(`/api/user_trips/${encodeURIComponent(tripId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload)
  });
  return r;
}

async function apiDuplicateTrip(tripId, newTitle){
  const r = await fetch(`/api/user_trips/${encodeURIComponent(tripId)}/duplicate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ title: newTitle || '' })
  });
  return r;
}

// === 共用：從畫面組 payload（你原本就有就用你的；沒有就用這版） ===
function buildUserTripPayload(){
  const title = (document.querySelector('#trip-title')?.value || '').trim();
  const note  = (document.querySelector('#trip-notes')?.value || '').trim();
  const days  = collectTimelineData(); // 你已有的函式：把 Day1~N 的卡片順序轉成 {day,title,items}

  return {
    trip: {
      title: title || 'My Trip',
      country: 'Indonesia',   // 依你的 UI 需要調整
      region:  'Bali',        // 依你的 UI 需要調整
      note: note,
      days
    }
  };
}

// === 從畫面收集行程資料 ===
// 會讀取每個 Day 的 Timeline 區塊 (#timeline) 裡的卡片順序
function collectTimelineData(){
  const days = [];

  // 假設你的 day-tabs 裡的按鈕是 data-day="1" / "2" 這種
  const dayButtons = document.querySelectorAll('#day-tabs .btn[data-day]');
  if (!dayButtons.length) {
    console.warn('⚠️ 沒有任何 day-tabs，回傳空陣列');
    return days;
  }

  for (const btn of dayButtons) {
    const dayNum = Number(btn.dataset.day);
    const timeline = document.querySelector(`#timeline[data-day="${dayNum}"]`) || document.querySelector('#timeline');
    if (!timeline) continue;

    // 找出這一天的所有景點卡片
    const stopCards = timeline.querySelectorAll('.trow.event .card, .stop-card');
    const items = [];
    for (cardEl of stopCards) {
      // 讀取名稱（在 Timeline 卡片裡通常是 .title 或 .name）
      const cardEl = document.getElementById('hover-card');
      const nameEl = cardEl?.querySelector('.title, .name');
      const name = (nameEl?.textContent || '').trim();
      if (name) items.push(name);
    }

    days.push({
      day: dayNum,
      title: `Day ${dayNum}`,
      items
    });
  }

  console.log('📦 collectTimelineData() days =', days);
  return days;
}

async function onSaveClick(){
  const curStops = Array.isArray(window.stops) ? window.stops : [];
  if (!curStops.length) {
    alert('請先建立行程');
    return;
  }

  const title = (document.querySelector('#trip-title')?.value || '').trim() || 'My Trip';
  const payload = buildUserTripPayloadForSave(title);

  try{
    const res  = await fetch(apiUrl('user_trips'), {
      method:'POST',
      credentials:'include',
      headers:{ 'Content-Type':'application/json', ...authHeaders() },
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); }
    catch(e){ throw new Error(`HTTP ${res.status} ${text}`); }

    if (!res.ok || data.ok === false || data.error){
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    // 儲存成功
    window.currentUserTripId = data.user_trip_id;
    localStorage.setItem('planner.lastUserTripId.v1', String(data.user_trip_id));

    alert(`✅ 已儲存行程 (#${data.user_trip_id})`);

    // ⭐ 儲存成功後自動跳回首頁
    window.location.href = "/index.html";  

  } catch(err) {
    console.error('[onSaveClick] failed:', err);
    alert('儲存失敗：' + err.message);
  }
}


// ===== Day Tabs 綁定 =====
(function bindDayTabsOnce(){
  const tabs = document.getElementById('day-tabs');
  if (!tabs || tabs.dataset.bound) return;
  tabs.dataset.bound = '1';

  // 既有按鈕（Day 1, Day 2, ...）
  tabs.querySelectorAll('.btn[data-day]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      tabs.querySelectorAll('.btn[data-day]').forEach(b=> b.classList.toggle('active', b===btn));
      setDay(Number(btn.dataset.day));
    });
  });

  // 新增一天
  const add = document.getElementById('add-day-btn');
  if (add){
    add.addEventListener('click', ()=>{
      const days = getAllDays();
      const next = days.length ? Math.max(...days)+1 : 1;
      // 1) 產生按鈕
      const nb = document.createElement('button');
      nb.type = 'button';
      nb.className = 'btn btn-ghost';
      nb.dataset.day = String(next);
      nb.textContent = `Day ${next}`;
      add.before(nb);
      nb.addEventListener('click', ()=>{
        tabs.querySelectorAll('.btn[data-day]').forEach(b=> b.classList.toggle('active', b===nb));
        setDay(next);
      });
      // 2) 產生對應 timeline 容器並切過去
      ensureTimeline(next);
      tabs.querySelectorAll('.btn[data-day]').forEach(b=> b.classList.remove('active'));
      nb.classList.add('active');
      showDay(next);
    });
  }

  // 初次顯示 Day1
  ensureTimeline(1);
  setDay(1);
})();


// ——— 綁定三顆按鈕（只綁一次，避免「Cannot redeclare」） ———
(function bindDbButtonsOnce(){
  const saveBtn   = document.getElementById('btn-save-db');
  const updateBtn = document.getElementById('btn-update-db');
  const dupBtn    = document.getElementById('btn-duplicate-db');

  if (saveBtn && !saveBtn.dataset.bound) {
    saveBtn.dataset.bound = '1';
    saveBtn.addEventListener('click', onSaveClick);
  }
  if (updateBtn && !updateBtn.dataset.bound) {
    updateBtn.dataset.bound = '1';
    updateBtn.addEventListener('click', onUpdateClick);
  }
  if (dupBtn && !dupBtn.dataset.bound) {
    dupBtn.dataset.bound = '1';
    dupBtn.addEventListener('click', onDuplicateClick);
  }
})();

async function onUpdateClick(){
  const id = window.currentUserTripId || localStorage.getItem('planner.lastUserTripId.v1');
  if (!id) { alert('找不到可更新的行程（尚未儲存過）。請先按「儲存行程」。'); return; }
  if (!confirm(`確定要更新行程 #${id} 嗎？`)) return;

  const title = (document.getElementById('trip-title')?.value || '我的行程').trim();
  const payload = buildUserTripPayloadForSave(title);
  try{
    const res = await fetch(apiUrl('user_trips/' + encodeURIComponent(id)), {
      method:'PUT',
      headers:{ 'Content-Type':'application/json', ...authHeaders() },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || data.error || data.success === false) throw new Error(data.error || `HTTP ${res.status}`);

    alert('✅ 已更新行程！');
    if (typeof loadMyTripList === 'function') loadMyTripList();
  }catch(err){
    console.error(err);
    alert('更新失敗：' + err.message);
  }
}

async function onDuplicateClick(){
  const curStops = Array.isArray(window.stops) ? window.stops : [];
  if (!curStops.length) {
    alert('請先建立行程');
    return;
  }

  const title = prompt('另存新檔名稱：','我的行程（複本）');
  if (!title) return;
  if (!confirm(`要另存為新行程「${title}」嗎？`)) return;

  const payload = buildUserTripPayloadForSave(title);
  try{
    const res = await fetch(apiUrl('user_trips'), {
      method:'POST',
      credentials:'include',
      headers:{ 'Content-Type':'application/json', ...authHeaders() },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(()=> ({}));

    // 後端回傳格式：{ ok: true, user_trip_id: ... }
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    window.currentUserTripId = data.user_trip_id;
    localStorage.setItem('planner.lastUserTripId.v1', String(data.user_trip_id));

    alert(`✅ 已另存（#${data.user_trip_id}）`);
    if (typeof loadMyTripList === 'function') loadMyTripList();
  } catch (err) {
    console.error('[onDuplicateClick] failed:', err);
    alert('另存失敗：' + err.message);
  }
}



/* ==========================
 * 行程點維護
 * =========================*/
function addStopFromPlace(p, opts = {}) {
  const pos = p.geometry?.location
    ? { lat: p.geometry.location.lat(), lng: p.geometry.location.lng() }
    : (p.position || null);
  if (!pos) return;

  const photoUrl = (p.photos?.length ? p.photos[0].getUrl({maxWidth:800, maxHeight:600}) : placeholderImage());
  const item = {
    id: crypto.randomUUID(),
    placeId: p.place_id || null,
    name: p.name || '未命名地點',
    position: pos,
    rating: (typeof p.rating==='number' ? p.rating : null),
    userRatingsTotal: (typeof p.user_ratings_total==='number' ? p.user_ratings_total : null),
    photoUrl,
    badges: inferBadgesFromTypes(p.types||[]),
    stayMin: defaultStayMinutesFromPlace(p)
  };
  ensurePlaceIdBoth(item);
  ensurePlaceIdBoth(p);
  addStop(item, opts);
}

function addStop(item, opts = {}) {
  const kind = opts.kind || 'plan';

  // === 1️⃣ 決定當前的正確 Day（永遠以 getCurrentDay 為準） ===
  const curDay = (typeof getCurrentDay === 'function')
    ? getCurrentDay()
    : (Number(window.currentDay) || 1);

  // 強制這個新地點屬於目前 Day（不允許自動 +1）
  item.day = Number(item.day || curDay || 1);

  // === 2️⃣ 取得當日的序號（同日內第幾個點） ===
  const todaysStops = (window.stops || []).filter(s => Number(s.day) === item.day);
  item.seq = Number(item.seq) || (todaysStops.length + 1);

  // === 3️⃣ 若還沒有位置，轉換 lat/lng → position ===
  if (!item.position && item.lat != null && item.lng != null) {
    item.position = { lat: Number(item.lat), lng: Number(item.lng) };
  }

  // === 4️⃣ 寫入全域 stops（唯一真實來源） ===
  if (!Array.isArray(window.stops)) window.stops = [];
  window.stops.push(item);

  // === 5️⃣ 立即同步天數與 Tab ===
  rebuildDaysFromStops(window.stops);
  renderDayTabs?.();

  // === 6️⃣ 建立 Marker ===
  item.marker = new google.maps.Marker({
    position: item.position,
    map: window.map,
    title: item.name,
    zIndex: kind === 'plan' ? 100 : 10
  });
  item.marker.place = item.details || item;
  item.marker.setVisible(item.day === curDay);

  // Hover 卡片
  item.marker.addListener('mouseover', () => {
    if (item.marker.__pinned) return;
    clearTimeout(item.marker._hoverTimer);
    item.marker._hoverTimer = setTimeout(async () => {
      let updated = false;
      try { if (typeof ensurePlaceDetails === 'function') updated = await ensurePlaceDetails(item); } catch {}
      if (typeof showHoverCard === 'function') {
        showHoverCard(item, { compact:false, anchor:item.marker });
        if (updated) setTimeout(() => showHoverCard(item, { compact:false, anchor:item.marker }), 0);
      }
    }, 80);
  });
  item.marker.addListener('mouseout', () => {
    clearTimeout(item.marker._hoverTimer);
    hideHoverCard && hideHoverCard(400);
  });

  // 點擊卡片
  item.marker.addListener('click', async () => {
    const el = document.getElementById('hover-card');
    const pin = !(el?.dataset.sticky === '1');
    if (typeof ensurePlaceDetails === 'function') { try { await ensurePlaceDetails(item); } catch {} }
    showHoverCard && showHoverCard(item, { anchor:item.marker, pin });
  });

  // === 7️⃣ 刷新 UI（照順序） ===
  try { relabelStops?.(); stops.forEach(updateMarkerLabel || (()=>{})); } catch {}
  try { renderList?.(); } catch {}
  try { renderTimeline?.(); } catch {}
  try { recomputeRouteSmart?.(item.day); } catch {}
  try { fitToRoute?.(); } catch {}
  try { updateRangeCircles?.(); } catch {}
  try { restyleMarkersForDay?.(item.day); } catch {}
  try { debouncedSuggest?.(); } catch {}

  console.groupCollapsed(`🗓️ allStopsByDay after addStop (Day ${item.day})`);
  console.log(window.days, window.allStopsByDay);
  console.groupEnd();
}


function removeStop(id){
  // 一律用 window.stops 當唯一來源
  const arr = Array.isArray(window.stops) ? window.stops : (window.stops = []);

  const idx = arr.findIndex(s =>
    String(s.id ?? s._id ?? s.place_id ?? s.pid) === String(id)
  );
  if (idx < 0) return;

  const day = Number(arr[idx].day ?? getCurrentDay?.() ?? 1);
  const it  = arr[idx];

  // 把 marker 從地圖上移除
  if (it.marker && it.marker.setMap) {
    it.marker.setMap(null);
    it.marker = null;
  }

  // 從 stops 陣列刪掉
  arr.splice(idx, 1);

  // 重新算天數 / Day Tabs
  try { rebuildDaysFromStops?.(arr); } catch {}
  try { renderDayTabs?.(); } catch {}

  // 更新當天的 A/B/C 與 Marker 樣式
  try {
    const todays = arr.filter(s => Number(s.day || 1) === day);
    todays.forEach((s, i) => {
      s.seq   = i + 1;
      s.label = String.fromCharCode(65 + i); // A,B,C...
      if (typeof updateMarkerLabel === 'function') updateMarkerLabel(s);
    });
  } catch {}

  // 重算路線、Timeline、推薦
  try { recomputeRouteSmart?.(day); } catch {}
  try { renderTimeline?.(); } catch {}
  try { debouncedSuggest?.(); } catch {}
}

function moveStop(fromId, toIndexInDay, toDayOpt){
  const arr = Array.isArray(window.stops) ? window.stops : (window.stops = []);

  const fromIdx = arr.findIndex(x => String(x.id) === String(fromId));
  if (fromIdx < 0) return;

  const item    = arr[fromIdx];
  const fromDay = Number(item.day ?? 1);
  const toDay   = (toDayOpt != null ? Number(toDayOpt) : fromDay) || 1;

  // 先把原本的位置拔掉
  arr.splice(fromIdx, 1);

  // 設為目標天
  item.day = toDay;

  // 計算這一天目前所有點的索引
  const dayIdxs = arr
    .map((st, i) => ({ st, i }))
    .filter(o => Number(o.st.day ?? 1) === toDay)
    .map(o => o.i);

  const safeIndex = Math.max(0, Math.min(dayIdxs.length, toIndexInDay || 0));
  const insertIdx = dayIdxs[safeIndex] ?? arr.length;

  // 插回去
  arr.splice(insertIdx, 0, item);

  // 重新標號、重畫 marker
  try {
    const days = new Set(arr.map(s => Number(s.day || 1)));
    days.forEach(d => {
      const todays = arr.filter(s => Number(s.day || 1) === d);
      todays.forEach((s, i) => {
        s.seq   = i + 1;
        s.label = String.fromCharCode(65 + i);
        if (typeof updateMarkerLabel === 'function') updateMarkerLabel(s);
      });
    });
  } catch {}

  // 更新天數 / Tabs / 路線 / Timeline
  try { rebuildDaysFromStops?.(arr); } catch {}
  try { renderDayTabs?.(); } catch {}
  try { recomputeRouteSmart?.(toDay); } catch {}
  try { renderTimeline?.(); } catch {}
}


function clearAll(){
  const arr  = Array.isArray(window.stops) ? window.stops : (window.stops = []);
  const sugg = Array.isArray(window.suggestionMarkers) ? window.suggestionMarkers : (window.suggestionMarkers = []);

  // 清掉行程點的 marker
  arr.forEach(s => {
    if (s.marker && s.marker.setMap) {
      s.marker.setMap(null);
      s.marker = null;
    }
  });
  arr.length = 0;

  // 清掉推薦點 star
  sugg.forEach(m => {
    if (!m) return;
    const mk = m.marker || m;
    try { mk.setMap && mk.setMap(null); } catch {}
  });
  sugg.length = 0;

  try { rebuildDaysFromStops?.(arr); } catch {}
  try { renderDayTabs?.(); } catch {}
  try { renderTimeline?.(); } catch {}
  try { recomputeRouteSmart?.(); } catch {}
  try { debouncedSuggest?.(); } catch {}
}

// 1 -> A, 27 -> AA
function numToLetters(n){
  let s = '';
  while(n > 0){
    n--;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}

// ✅ 不排序；照 stops 當前順序、依 day 各自編號
function relabelStops(){
  const arr = Array.isArray(window.stops) ? window.stops : [];
  const counter = new Map(); // day -> next number

  arr.forEach(s => {
    const d = Number(s.day ?? 1);
    const n = (counter.get(d) || 0) + 1;
    counter.set(d, n);
    s._seqInDay = n;               // 當日序號 1,2,3...
    s.label     = numToLetters(n); // A,B,C...
  });
}

// ✅ 統一使用「圓點」風格的 Marker，並修正有些點沒被重畫的問題
function updateMarkerLabel(s) {
  if (!s) return;

  // 1) 確保一定有 position（有些舊資料只有 lat / lng）
  if (!s.position && s.lat != null && s.lng != null) {
    s.position = { lat: Number(s.lat), lng: Number(s.lng) };
  }
  if (!s.position) return; // 真的沒有座標才放棄

  // 2) 確保有 marker
  if (!s.marker) {
    s.marker = new google.maps.Marker({
      map: window.map,
      position: s.position,
      optimized: true
    });
  } else {
    // 座標可能有變，順便同步一下
    try { s.marker.setPosition(s.position); } catch (_) {}
  }

  const dayNum = Number(s.day || 1);

  // 3) 判斷是不是交通段中繼點（LEG）
  const isLegPoint =
    (typeof isLegLike === 'function' && isLegLike(s)) ||
    s.type === 'LEG' ||
    ['FLIGHT', 'TRAIN', 'BUS', 'FERRY', 'MANUAL'].includes(s.leg?.mode);

  if (isLegPoint) {
    // 👉 中繼點：小圓點（沒有文字）
    const color = getDayColor(dayNum);
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
        <circle cx="12" cy="12" r="6" fill="${color}" stroke="#0b1220" stroke-width="2" />
      </svg>`;
    s.marker.setIcon({
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
      scaledSize: new google.maps.Size(24, 24),
      anchor: new google.maps.Point(12, 12)
    });
    s.marker.setLabel(null);
    return;
  }

  // 4) 一般停留點：用 applyStopMarkerStyle 畫「有字母的圓點」
  // _seqInDay 是 1-based，轉成 0-based index 給 idx 用
  let idxWithinDay = 0;
  if (s._seqInDay != null && !Number.isNaN(Number(s._seqInDay))) {
    idxWithinDay = Math.max(0, Number(s._seqInDay) - 1);
  } else if (s.seq != null && !Number.isNaN(Number(s.seq))) {
    idxWithinDay = Math.max(0, Number(s.seq) - 1);
  }

  if (typeof applyStopMarkerStyle === 'function') {
    applyStopMarkerStyle(s, idxWithinDay);
  }
}


// —— 取得同一天上一個停留點 —— 
function getPrevStopInDay(s){
  const day = Number(s.day ?? 1);
  const todays = (window.stops || [])
    .filter(x => Number(x.day ?? 1) === day)
    .sort((a,b)=> (a._seqInDay||a.seq||0) - (b._seqInDay||b.seq||0));
  const idx = todays.findIndex(x => String(x.id) === String(s.id));
  return (idx > 0) ? todays[idx-1] : null;
}


function renderList(){
  relabelStops();
  stops.forEach(updateMarkerLabel);

  const list = document.getElementById('list');
  if (!list) return;
  list.innerHTML = '';

  // 只渲染當天 + 依 _seqInDay 排序，確保是 A,B,C...
  const todays = getStopsOfDay(getCurrentDay())
    .slice()
    .sort((a,b)=>(a._seqInDay||0) - (b._seqInDay||0));

  let dragSrcId = null;

  // ===== 「移至 Day…」選單（按鈕觸發，整頁只建一次） =====
  if (!window.__moveMenu) {
    const menu = document.createElement('div');
    menu.id = 'day-move-menu';
    Object.assign(menu.style, {
      position:'fixed', zIndex:10000, display:'none',
      background:'#fff', color:'#111', border:'1px solid #e5e7eb',
      borderRadius:'10px', boxShadow:'0 8px 30px rgba(0,0,0,.15)',
      overflow:'hidden', minWidth:'160px', maxHeight:'352px'
    });
    document.body.appendChild(menu);
    window.__moveMenu = menu;
    window.__moveTargetId = null;

    // 點選單內的項目 → 移動
    document.addEventListener('click', (e)=>{
      const item = e.target.closest && e.target.closest('#day-move-menu button[data-to-day]');
      if (!item || menu.style.display === 'none') return;

      const toDay   = Number(item.dataset.toDay);
      const stopId  = window.__moveTargetId;
      const toIndex = (getStopsOfDay?.(toDay) || []).length; // 放該日最後

      try{
        if (typeof moveStop === 'function' && moveStop.length >= 3) {
          moveStop(stopId, toIndex, toDay);
        } else {
          // fallback：簡單末尾移動
          const arr = window.stops || [];
          const i = arr.findIndex(x => String(x.id) === String(stopId));
          if (i >= 0){ const it = arr.splice(i,1)[0]; it.day = toDay; arr.push(it); }
        }
        setDay?.(toDay);
        recomputeRouteSmart?.(toDay);
        (renderTimeline || refreshTimeline || renderList)?.();
        restyleMarkersForDay?.(toDay);
      } finally {
        menu.style.display = 'none';
        window.__moveTargetId = null;
      }
    });

    // 點外面關閉
    document.addEventListener('mousedown', (ev)=>{
      if (menu.style.display === 'none') return;
      if (!menu.contains(ev.target)) {
        menu.style.display = 'none';
        window.__moveTargetId = null;
      }
    });
  }

  function showMoveMenuFor(buttonEl, stopId){
    const menu = window.__moveMenu;
    window.__moveTargetId = stopId;

    // 目前總 Day 數（至少包含現有 stops 的最大 day）
    const maxDay = Math.max(
      ...(window.stops||[]).map(s => Number(s.day||1)),
      Number(getCurrentDay?.()||1)
    );

    // 產生選單項目
    menu.innerHTML = '';
    for (let d=1; d<=maxDay; d++){
      const item = document.createElement('button');
      item.type='button';
      item.textContent = `Move to Day ${d}`;
      item.dataset.toDay = String(d);
      Object.assign(item.style, {
        display:'block', width:'100%', textAlign:'left',
        padding:'10px 12px', border:'0', background:'transparent', cursor:'pointer'
      });
      item.onmouseenter = ()=> item.style.background = '#f5f5f5';
      item.onmouseleave = ()=> item.style.background = 'transparent';
      menu.appendChild(item);
    }

    // 位置：貼齊按鈕下方
    const r  = buttonEl.getBoundingClientRect();
    const vw = innerWidth, vh = innerHeight;
    const w  = Math.max(160, menu.offsetWidth||160);
    const h  = Math.min(menu.scrollHeight||0, 352);
    let x = r.left, y = r.bottom + 6;
    if (x + w > vw) x = vw - w - 8;
    if (y + h > vh) y = r.top - 6 - h;
    Object.assign(menu.style, { left:`${x}px`, top:`${y}px`, display:'block' });
  }

  todays.forEach((s, i)=>{
    const el = document.createElement('div');
    el.className = 'stop';
    el.draggable = true;
    el.dataset.id = s.id;
    el.innerHTML = `
      <div class="drag" title="拖曳調整順序">☰</div>
      <div>
        <div class="title">${s.label}. ${s.name}</div>
        <div class="sub">${s.position.lat.toFixed(5)}, ${s.position.lng.toFixed(5)}</div>
      </div>
      <div>
        <button data-action="fly">Locate</button>
        <button class="btn" data-action="move" data-id="${s.id}">Move</button>
        <button data-action="del">Delete</button>
      </div>`;

    // ---- 拖曳排序（同日） ----
    el.addEventListener('dragstart', e=>{
      dragSrcId = s.id;
      e.dataTransfer.effectAllowed = 'move';
    });
    el.addEventListener('dragover', e=>{
      e.preventDefault();
      e.dataTransfer.dropEffect='move';
    });
    el.addEventListener('drop', e=>{
      e.preventDefault();
      if (dragSrcId){
        // 只計算 .stop 的索引，避免被 .leg-toolbar 影響
        const stopsEls = Array.from(list.querySelectorAll('.stop'));
        const targetIndexInDay = stopsEls.indexOf(el);
        if (typeof moveStop === 'function' && moveStop.length >= 3) {
          moveStop(dragSrcId, targetIndexInDay, getCurrentDay());
        } else {
          moveStop(dragSrcId, targetIndexInDay);
        }
        recomputeRouteSmart?.();
        restyleMarkersForDay?.(getCurrentDay());
      }
      dragSrcId = null;
    });
    el.addEventListener('dragend', ()=> dragSrcId=null);

    // ---- 按鈕 ----
    el.addEventListener('click', (e)=>{
      const ac = e.target.getAttribute('data-action');
      if (ac === 'del') removeStop(s.id);
      if (ac === 'fly') {
        openStopCard(s, { pan: true, focusDay: false, pin: true, zoom: null });
      }
      if (ac === 'move') {
        e.preventDefault();
        showMoveMenuFor(e.target, String(s.id));
      }
    });

    // === 在地點卡片上方插入分段工具列（第2個點起才需要） ===
    if (i > 0) {
      const bar = document.createElement('div');
      bar.className = 'leg-toolbar';
      bar.dataset.afterId = s.id;
      bar.innerHTML = `
        <select class="leg-mode">
          <option value="SAME">跟上方模式</option>
          <option value="DRIVING">開車</option>
          <option value="WALKING">步行</option>
          <option value="BICYCLING">單車</option>
          <option value="TRANSIT">大眾運輸</option>
          <option value="FLIGHT">飛機</option>
          <option value="TRAIN">火車</option>
          <option value="BUS">巴士</option>
          <option value="FERRY">渡輪</option>
          <option value="MANUAL">手動</option>
        </select>
        <input type="time" class="leg-depart" title="出發時間（僅 TRANSIT 使用）">
        <input type="number" class="leg-dist" placeholder="距離km(手動)" min="0" step="0.1">
        <input type="number" class="leg-dur" placeholder="時長min(手動)" min="0" step="5">
      `;
      list.appendChild(bar);

      // 回填現有值
      ensureLegFields([s]);
      const leg = s.leg || {};
      bar.querySelector('.leg-mode').value = leg.mode || 'SAME';

      const dep = bar.querySelector('.leg-depart');
      if (leg.departAt instanceof Date) {
        const hh = String(leg.departAt.getHours()).padStart(2,'0');
        const mm = String(leg.departAt.getMinutes()).padStart(2,'0');
        dep.value = `${hh}:${mm}`;
      }
      const dst = bar.querySelector('.leg-dist');
      if (leg.manualDistanceKm != null) dst.value = leg.manualDistanceKm;
      const dur = bar.querySelector('.leg-dur');
      if (leg.manualDurationMin != null) dur.value = leg.manualDurationMin;
    }

    list.appendChild(el);
  });

  // —— 列表容器事件委派（只掛一次，避免重複） —— 
  if (!list.dataset.legBound) {
    list.dataset.legBound = '1';
    list.addEventListener('change', (e) => {
      const row = e.target.closest('.leg-toolbar');
      if (!row) return;
      const id = row.dataset.afterId;
      const s = (window.stops || []).find(x => String(x.id) === String(id));
      if (!s) return;
      ensureLegFields([s]);

      const A = (() => {
        const idx = (window.stops || []).findIndex(x => x.id === id);
        return idx > 0 ? window.stops[idx - 1] : null;
      })();

      const M = (v) => String(v || '').toUpperCase();
      const needManual = (m) => ['FLIGHT','TRAIN','BUS','FERRY','MANUAL'].includes(M(m));

      if (e.target.classList.contains('leg-mode')) {
        const v = e.target.value;
        s.leg.mode = (v === 'SAME') ? null : v;

        if (A && needManual(v)) {
          const dKm = haversineKm(A.position, s.position);
          const cruise = guessCruiseKmh(M(v));
          const buffer = guessBufferMin(M(v));
          s.leg.manualDistanceKm = Math.round(dKm * 10) / 10;
          s.leg.cruiseKmh = cruise;
          s.leg.bufferMin = buffer;
          s.leg.manualDurationMin = Math.round((dKm / cruise) * 60) + buffer;
        } else if (!needManual(v)) {
          delete s.leg.manualDistanceKm;
          delete s.leg.manualDurationMin;
          delete s.leg.cruiseKmh;
          delete s.leg.bufferMin;
        }
      }
      if (e.target.classList.contains('leg-depart')) {
        s.leg.departAt = e.target.value ? new Date(`1970-01-01T${e.target.value}:00`) : null;
      }
      if (e.target.classList.contains('leg-dist')) {
        s.leg.manualDistanceKm = e.target.value ? Number(e.target.value) : null;
      }
      if (e.target.classList.contains('leg-dur')) {
        s.leg.manualDurationMin = e.target.value ? Number(e.target.value) : null;
      }

      // 即時重算 + 重畫
      try { typeof recomputeRouteSmart === 'function' && recomputeRouteSmart(); } catch(_) {}
      try { (renderTimeline || renderList)?.(); } catch(_) {}
    });
  }
}


function bounce(marker){
  marker.setAnimation(google.maps.Animation.BOUNCE);
  setTimeout(()=> marker.setAnimation(null), 700);
}

/* ==========================
 * 懸浮卡片（以地圖 pane 座標定位）
 * =========================*/

// 從 details.photos 裡挑出「最適合」的一張照片
function pickBestPhotoUrlFromDetails(details) {
  if (!details) return null;
  const arr = details.photos;
  if (!Array.isArray(arr) || !arr.length) return null;

  // 這裡簡單做法：挑寬度最大的那一張（你之後想改規則就改這裡）
  let best = arr[0];
  for (let i = 1; i < arr.length; i++) {
    const p = arr[i];
    const wBest = Number(best.width || 0);
    const wCur  = Number(p.width  || 0);
    if (wCur > wBest) best = p;
  }

  // 支援 getUrl / createUrl 兩種寫法
  if (typeof best.getUrl === 'function') {
    return best.getUrl({ maxWidth: 720, maxHeight: 480 });
  }
  if (typeof best.createUrl === 'function') {
    return best.createUrl({ maxWidth: 720, maxHeight: 480 });
  }
  return null;
}

function fromLatLngToPanePixel(latlng){
  if(!window.overlayView) return {x:-9999,y:-9999};
  const proj = window.overlayView.getProjection();
  if(!proj) return {x:-9999,y:-9999};
  const gLatLng = latlng instanceof google.maps.LatLng ? latlng : new google.maps.LatLng(latlng);
  const pt = proj.fromLatLngToDivPixel(gLatLng); // 相對於 pane 左上角
  return { x: pt.x, y: pt.y };
}

// ✅ 更穩的版本：找不到 #hc-photo-wrap 也能工作，而且不會把既有 src 清掉
function updateCardPhoto(item, opts = {}) {
  const { allowBlank = false, forceClear = false } = opts;
  cardEl = document.getElementById('hover-card');
  const img  = document.getElementById('hc-img') || card?.querySelector('img');
  const wrap = document.getElementById('hc-photo-wrap') || img?.parentElement || card;
  if (!img || !wrap) return;

  const current   = img.getAttribute('src') || '';
  const candidate = (item?.photoUrl && String(item.photoUrl)) || '';
  const url = forceClear ? '' : (candidate || current);

  if (url) {
    if (img.getAttribute('src') !== url) img.src = url;
    img.style.removeProperty('display');
    wrap.classList.remove('no-photo');
    wrap.style.removeProperty('display');
  } else if (allowBlank) {
    img.removeAttribute('src');
    img.style.display = 'none';      // 只隱藏 img，保留容器留白
    wrap.classList.add('no-photo');
    wrap.style.removeProperty('display');
  }
}

// 用名稱＋座標幫舊 UUID 補回真正的 Google place_id
async function resolvePlaceIdForItem(item){
  try {
    const name = item.name || item.title || '';
    const pos  = item.position || (item.lat!=null && item.lng!=null ? {lat:Number(item.lat), lng:Number(item.lng)} : null);
    const svc  = new google.maps.places.PlacesService(window.map);

    // ❶ Find Place *from Query*（JS 版用 query，不是 input）
    if (name) {
      const req1 = { query: name, fields: ['place_id','name','geometry'] };
      const [res1, st1] = await new Promise(r => svc.findPlaceFromQuery(req1, (rs, st) => r([rs, st])));
      if (st1 === google.maps.places.PlacesServiceStatus.OK && res1?.length){
        item.place_id = res1[0].place_id; item.placeId = item.place_id;
        return item.place_id;
      }
    }

    // ❷ Text Search 搭配座標 bias
    if (name && pos){
      const req2 = { query: name, location: pos, radius: 5000 };
      const [res2, st2] = await new Promise(r => svc.textSearch(req2, (rs, st) => r([rs, st])));
      if (st2 === google.maps.places.PlacesServiceStatus.OK && res2?.length){
        item.place_id = res2[0].place_id; item.placeId = item.place_id;
        return item.place_id;
      }
    }

    // ❸ 近距離兜底（沒有名稱時，抓最近的一個 POI）
    if (!name && pos){
      const req3 = { location: pos, rankBy: google.maps.places.RankBy.DISTANCE };
      const [res3, st3] = await new Promise(r => svc.nearbySearch(req3, (rs, st) => r([rs, st])));
      if (st3 === google.maps.places.PlacesServiceStatus.OK && res3?.length){
        item.place_id = res3[0].place_id; item.placeId = item.place_id;
        return item.place_id;
      }
    }
  } catch (e) {
    console.warn('resolvePlaceIdForItem fail', e);
  }
  return null;
}

// 補圖：若官方 details 沒照片，就用文字搜尋找同名的有照片候選，回填 photoUrl
async function enrichPhotosBySearch(item){
  try {
    const svc = window.placesService;
    if (!svc) return false;

    // 取定位與查詢字串
    const loc = item.position
      || item.details?.geometry?.location?.toJSON?.()
      || (item.details?.geometry?.location
            ? { lat:item.details.geometry.location.lat(), lng:item.details.geometry.location.lng() }
            : null);
    const query = (item.name || item.details?.name || '').trim();
    if (!query) return false;

    // TextSearch 找附近同名候選
    const arr = await new Promise(resolve => {
      svc.textSearch({ query, location: loc, radius: 2500 }, (res, st) =>
        resolve(st === google.maps.places.PlacesServiceStatus.OK ? (res || []) : [])
      );
    });
    const cand = arr.find(x => Array.isArray(x.photos) && x.photos.length);
    if (!cand) return false;

    // 取第一張照片 URL，並回寫到 item / item.details
    const ph  = cand.photos[0];
    const url = typeof ph.getUrl === 'function'
      ? ph.getUrl({ maxWidth: 720, maxHeight: 480 })
      : null;

    item.details = item.details || {};
    if (!Array.isArray(item.details.photos) || !item.details.photos.length) {
      item.details.photos = cand.photos;
    }
    if (url) {
      item.details.photoUrl  = url;
      item.details.__photoUrl = url;
      item.photoUrl = url;
      return true;
    }
    return false;
  } catch (e) {
    console.debug('[enrichPhotosBySearch] failed', e);
    return false;
  }
}

// ✅ 新版 ensurePlaceDetails：
// 1) 會把真正的地名回寫到 item.name（不再卡在 Loading...）
// 2) 優先用新版 Place.fetchFields，失敗再走 getDetails
// 3) 只合併有值欄位，並盡量補 photoUrl / rating / address
async function ensurePlaceDetails(item){
  if (!item) return;

  // ---- helpers ----
  const isUuidLike = (s) =>
    typeof s === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

  // 僅接受「看起來像 Google Place ID」且不是 UUID
  const looksGPlaceId = (pid) =>
    typeof pid === 'string' &&
    /^[A-Za-z0-9_-]{20,}$/.test(pid) &&   // place_id 通常為 20+ 的 a-zA-Z0-9_- 組合
    !isUuidLike(pid);                     // 明確排除 UUID

  const detailsRichEnough = (d) => {
    if (!d) return false;
    const hasRating = typeof d.rating === 'number';
    const hasPhotos = Array.isArray(d.photos) && d.photos.length > 0;
    return hasRating || hasPhotos;
  };

  const normLoc = (x) => {
    try { if (typeof g === 'function') return g(x); } catch(_){}
    if (!x) return null;
    if (typeof x.lat === 'function' && typeof x.lng === 'function') return { lat:x.lat(), lng:x.lng() };
    if (x?.toJSON) return x.toJSON();
    if (typeof x?.lat === 'number' && typeof x?.lng === 'number') return x;
    return null;
  };

  // 只把「有值的欄位」合併，避免 undefined 蓋掉舊值
  function mergeDefined(dst, src){
    dst = dst || {};
    if (!src) return dst;
    for (const k of Object.keys(src)) {
      const v = src[k];
      if (v !== undefined && v !== null) dst[k] = v;
    }
    return dst;
  }

  // ---- base data ----
  let pid   = item.place_id || item.placeId || null;
  const name = item.name || item.title || item.details?.name || '';
  let loc   = normLoc(item.position || item.details?.geometry?.location || item.marker?.getPosition?.());

  // ★ 先把不合法/UUID 的 pid 清掉，強迫走搜尋補正
  if (!looksGPlaceId(pid)) {
    pid = null;
    delete item.place_id;
    delete item.placeId;
  }

  // ---- 判斷要不要「再打一次 Google details」----
  //     就算已經有 rating + photo，也要讓後面預算流程跑，
  //     所以這裡只決定「要不要再 call Google」，不能直接 return。
  let skipGetDetails = false;

  if (item.details) {
    const hasRating =
      typeof item.details.rating === 'number' || typeof item.rating === 'number';
    const hasPhotoArr =
      Array.isArray(item.details.photos) && item.details.photos.length > 0;
    const hasPhotoGetUrl =
      hasPhotoArr && typeof item.details.photos?.[0]?.getUrl === 'function';
    const hasPhotoUrlStr =
      !!(item.photoUrl || item.details.photoUrl || item.details.__photoUrl);

    if (hasRating && (hasPhotoGetUrl || hasPhotoUrlStr)) {
      // 已經有足夠資料顯示卡片 → 不必再打 Google 了，但後面照常跑
      skipGetDetails = true;
    }
  }


  let changed = false;

  // ---- 1) resolve PID by name+loc if needed ----
  // 若沒有合法 pid，就用 名稱 + 位置 搜尋回真正的 Google Place
  if (!pid && name) {
    if (!loc) {
      const c = map?.getCenter?.();
      loc = c ? (c.toJSON?.() || c) : { lat: 25.033968, lng: 121.564468 }; // Taipei 保底
    }

    try {
      let arr = null;
      if (typeof textSearchSafe === 'function') {
        arr = await textSearchSafe({ query: name, location: loc, radius: 2000 });
      } else if (window.placesService) {
        arr = await new Promise((resolve) => {
          window.placesService.textSearch(
            { query: name, location: loc, radius: 2000 },
            (res, status)=> resolve(status===google.maps.places.PlacesServiceStatus.OK ? (res||[]) : [])
          );
        });
      }
      if ((!arr || !arr.length) && window.placesService?.findPlaceFromQuery) {
        arr = await new Promise((resolve)=> {
          window.placesService.findPlaceFromQuery(
            {
              query: name,
              fields: ['place_id','name','geometry','formatted_address','rating','user_ratings_total','photos'],
              locationBias: { center: loc, radius: 2000 }
            },
            (res, status)=> resolve(status===google.maps.places.PlacesServiceStatus.OK ? (res||[]) : [])
          );
        });
      }
      const cand = arr && arr[0];
      if (cand && looksGPlaceId(cand.place_id)) {
        pid = cand.place_id;
        item.place_id = pid;
        item.placeId  = pid;

        if (typeof item.rating !== 'number' && typeof cand.rating === 'number')
          item.rating = cand.rating;
        if (typeof item.user_ratings_total !== 'number' && typeof cand.user_ratings_total === 'number')
          item.user_ratings_total = cand.user_ratings_total;

        item.details = mergeDefined(item.details, {
          place_id: pid,
          name: cand.name,
          rating: cand.rating,
          user_ratings_total: cand.user_ratings_total,
          formatted_address: cand.formatted_address || cand.vicinity,
          geometry: cand.geometry,
          photos: cand.photos
        });

        // ★ 若原本 name 是 Loading... 或空，就用 cand.name 覆蓋
        if (!item.name || /^loading\.\.\./i.test(item.name)) {
          item.name = cand.name || item.name;
        }

        changed = true;
      }
    } catch(e){ console.debug('[ensurePlaceDetails] PID resolve failed:', e); }
  }

  // ---- 2) fetchFields (new API) ----
  const Place = google?.maps?.places?.Place;
  if (looksGPlaceId(pid) && typeof Place === 'function' && typeof Place.prototype.fetchFields === 'function') {
    try {
      const p = new Place({ id: pid });
      const got = await p.fetchFields({
        fields: ['id','displayName','location','rating','userRatingCount','formattedAddress','types','photos']
      });

      const det = {
        place_id: got.id || pid,
        name: got.displayName?.toString?.() || got.displayName,
        rating: got.rating,
        user_ratings_total: got.userRatingCount,
        formatted_address: got.formattedAddress,
        types: got.types,
        geometry: got.location ? { location: got.location } : undefined,
        photos: Array.isArray(got.photos) ? got.photos.map(ph => ({
          getUrl: ({maxWidth, maxHeight}={}) => ph.createUrl({maxWidth, maxHeight})
        })) : []
      };

      item.details = mergeDefined(item.details, det);

      // ★ 若原本 name 是 Loading... 或空，就用 details.name 覆蓋
      if (!item.name || /^loading\.\.\./i.test(item.name)) {
        item.name = det.name || item.name;
      }

      if (typeof det.rating === 'number') item.rating = det.rating;
      if (typeof det.user_ratings_total === 'number') item.user_ratings_total = det.user_ratings_total;

      try {
        const u = item.details.photos?.[0]?.getUrl?.({ maxWidth: 720, maxHeight: 480 });
        if (u) { item.photoUrl = u; item.details.photoUrl = u; item.details.__photoUrl = u; }
      } catch(_){}

      changed = true;
    } catch(e){ console.debug('[ensurePlaceDetails] fetchFields failed → fallback to legacy', e); }
  }

  // ---- 3) legacy getDetails fallback ----
  if (looksGPlaceId(pid) && window.placesService?.getDetails) {
    try {
      const req = { placeId: pid, fields:[
        'place_id','name','rating','user_ratings_total','formatted_address','types',
        'photos','url','website','opening_hours','geometry','editorial_summary'
      ]};
      const det = await new Promise((resolve)=> {
        window.placesService.getDetails(req, (res, status)=>
          resolve(status===google.maps.places.PlacesServiceStatus.OK ? res : null));
      });
      if (det) {
        if (Array.isArray(det.photos)) {
          det.photos = det.photos.map(ph =>
            (typeof ph.createUrl === 'function')
              ? { getUrl: ({maxWidth, maxHeight}={}) => ph.createUrl({maxWidth, maxHeight}) }
              : ph
          );
        }
        item.details = mergeDefined(item.details, det);

        // ★ 若原本 name 是 Loading... 或空，就用 det.name 覆蓋
        if (!item.name || /^loading\.\.\./i.test(item.name)) {
          item.name = det.name || item.name;
        }

        if (typeof det.rating === 'number') item.rating = det.rating;
        if (typeof det.user_ratings_total === 'number') item.user_ratings_total = det.user_ratings_total;

        try {
          const u = item.details.photos?.[0]?.getUrl?.({ maxWidth: 720, maxHeight: 480 });
          if (u) { item.photoUrl = u; item.details.photoUrl = u; item.details.__photoUrl = u; }
        } catch(_){}

        if (!item.overview && item.details?.editorial_summary) {
          item.overview = (typeof item.details.editorial_summary === 'object')
            ? item.details.editorial_summary.overview
            : String(item.details.editorial_summary || '');
        }
        changed = true;
      }
    } catch(e){ console.debug('[ensurePlaceDetails] legacy getDetails failed:', e); }
  }

  // ---- 3.5) 若仍無可用照片 → 用文字搜尋補一張封面 ----
  const noUsablePhoto =
    !item.photoUrl && !item.details?.photoUrl &&
    !(Array.isArray(item.details?.photos) && typeof item.details.photos?.[0]?.getUrl === 'function');

  if (noUsablePhoto) {
    try {
      const ok = await enrichPhotosBySearch(item);
      if (ok) changed = true;
    } catch(_) {}
  }

  // ==== 3.7) POI 名稱補救：還是 Loading... → 用座標附近的 POI 來補名字 ====
  if ((item.name && /^loading\.\.\./i.test(item.name)) || !item.name) {
    try {
      const loc2 = normLoc(item.position || item.details?.geometry?.location);
      if (loc2 && window.placesService?.nearbySearch) {
        const nearby = await new Promise(resolve => {
          window.placesService.nearbySearch(
            {
              location: loc2,
              radius: 80,               // 80 公尺內找最近的 POI
              type: 'point_of_interest'
            },
            (res, status) => {
              const ok = status === google.maps.places.PlacesServiceStatus.OK;
              resolve(ok ? (res || []) : []);
            }
          );
        });

        const cand2 = nearby[0];
        if (cand2) {
          // 補上 name
          if (cand2.name) {
            item.name = cand2.name;
          }

          // 順便把一些欄位塞回 details
          item.details = mergeDefined(item.details, {
            name: cand2.name,
            rating: cand2.rating,
            user_ratings_total: cand2.user_ratings_total,
            formatted_address: cand2.vicinity || cand2.formatted_address,
            geometry: cand2.geometry
          });

          changed = true;
        }
      }

      // 如果 nearbySearch 也沒找到名字，就至少不要留下 Loading...
      if (!item.name || /^loading\.\.\./i.test(item.name)) {
        if (loc2) {
          item.name = `Point (${Number(loc2.lat).toFixed(5)}, ${Number(loc2.lng).toFixed(5)})`;
        } else {
          item.name = 'Unnamed place';
        }
      }
    } catch(e) {
      console.debug('[ensurePlaceDetails] nearbySearch name fallback failed', e);
    }
  }

  // ---- 4) final top-level sync ----
  if (item.details) {
    if (!item.formatted_address && item.details.formatted_address)
      item.formatted_address = item.details.formatted_address;

    // ★ 最終保險：還是 Loading... 就用 details.name
    if (!item.name || /^loading\.\.\./i.test(item.name)) {
      if (item.details.name) item.name = item.details.name;
    }

    try {
      const u = pickBestPhotoUrlFromDetails(item.details);
      if (u) { item.photoUrl = item.photoUrl || u; }
    } catch(_){}
  }

  if (item.details && !item.address) {
    item.address = item.details.formatted_address || item.details.vicinity || item.address;
  }

  if (item.marker) item.marker.place = item.details || item;

  // 只跑一次：有任何一個地點拿到 details，就用它當基準載入物價 profile
  try {
    if (!window.__COST_PROFILE_INITED && item.details) {
      window.__COST_PROFILE_INITED = true;
      initCostProfileFromDetails(item.details)
        .catch(err => console.warn('[COST] initCostProfileFromDetails failed', err));
    }
  } catch (e) {
    console.warn('[COST] cost profile guard error', e);
  }

  console.debug('[COST] ensurePlaceDetails bottom', 
    { hasDetails: !!item.details, inited: !!window.__COST_PROFILE_INITED }
  );
  return changed;
}

// 缺圖補抓（安全版）：一定帶 location + 合法半徑
async function enrichPhotosBySearch(item){
  try {
    const svc = window.placesService;
    if (!svc) return false;

    const query = (item?.name || item?.details?.name || '').trim();
    if (!query) return false;

    // ---- normalize / fallback location ----
    const toLL = (p) => {
      if (!p) return null;
      if (typeof p.lat === 'function' && typeof p.lng === 'function') return { lat: p.lat(), lng: p.lng() };
      if (typeof p.toJSON === 'function') return p.toJSON();
      if (typeof p.lat === 'number' && typeof p.lng === 'number') return { lat: Number(p.lat), lng: Number(p.lng) };
      return null;
    };

    let loc =
      toLL(item?.position) ||
      toLL(item?.location) ||
      toLL(item?.details?.geometry?.location) ||
      toLL(item?.marker?.getPosition?.());

    if (!loc) {
      const c = map?.getCenter?.();
      loc = toLL(c) || { lat: 25.033968, lng: 121.564468 }; // 保底：台北
      console.warn('[enrichPhotosBySearch] missing location → auto-filled', loc);
    }

    const radius = 2500;

    // ---- 做 TextSearch（優先用你的 safe 包裝）----
    let arr;
    if (typeof textSearchSafe === 'function') {
      arr = await textSearchSafe({ query, location: loc, radius });
    } else {
      arr = await new Promise(resolve => {
        svc.textSearch({ query, location: loc, radius }, (res, st) => {
          resolve(st === google.maps.places.PlacesServiceStatus.OK ? (res || []) : []);
        });
      });
    }

    const cand = Array.isArray(arr) ? arr.find(x => Array.isArray(x.photos) && x.photos.length) : null;
    if (!cand) return false;

    // 直接使用 cand.photos；新版物件可用 getUrl()
    const ph = cand.photos[0];
    const url = (ph && typeof ph.getUrl === 'function')
      ? ph.getUrl({ maxWidth: 720, maxHeight: 480 })
      : null;

    item.details = item.details || {};
    if (!Array.isArray(item.details.photos) || !item.details.photos.length) {
      item.details.photos = cand.photos;
    }
    if (url) {
      item.details.photoUrl = url;
      item.details.__photoUrl = url;
      item.photoUrl = url;
    }
    return !!url;
  } catch (e) {
    console.debug('[enrichPhotosBySearch] failed', e);
    return false;
  }
}

function applyCardPhoto(placeOrItem) {
  const wrap = document.getElementById('hc-photo-wrap');   // 你的照片容器
  const img  = document.getElementById('hc-photo');        // 你的 <img>
  if (!wrap || !img) return;

  const ph = placeOrItem?._place?.photos || placeOrItem?.photos;
  if (Array.isArray(ph) && ph.length) {
    const url = ph[0].getUrl({ maxWidth: 640, maxHeight: 360 });
    img.src = url;
    img.alt = placeOrItem.name || 'Place';
    wrap.style.display = '';           // 顯示
  } else {
    img.removeAttribute('src');
    img.alt = '';
    wrap.style.display = 'none';       // 🔥 沒照片就整塊收起來，避免空白
  }
}

// ✅ 統一 hover card 顯示邏輯：資料一律以 item.details 為主
function fillFromDetails(res, item) {
  if (!res && !item?.details) return;
  // 如果沒傳 res，直接取 item.details
  res = res || item.details || {};

  // === 1) 寫回 item（確保同步與後續快取）
  if (item) {
    item.details = res;
    item.name   = res.name || item.name || '未命名地點';
    item.rating = (typeof res.rating === 'number') ? res.rating : (item.rating ?? null);
    item.user_ratings_total = (typeof res.user_ratings_total === 'number')
      ? res.user_ratings_total
      : (item.user_ratings_total ?? null);
    item.address = res.formatted_address || item.address || '';
    item.website = res.website || item.website || '';

    const pid = res.place_id || item.place_id || item.placeId || null;
    if (pid) { item.place_id = pid; item.placeId = pid; }
  }

  // === 2) DOM：名稱與評價
  const nameEl = document.getElementById('hc-name');
  if (nameEl) nameEl.textContent = item.name || '未命名地點';

  const ratingEl = document.getElementById('hc-rating');
  const userEl = document.getElementById('hc-user');
  if (ratingEl) ratingEl.textContent =
    (typeof item.rating === 'number') ? `★ ${item.rating}` : '★ N/A';
  if (userEl) userEl.textContent =
    (typeof item.user_ratings_total === 'number') ? `(${item.user_ratings_total})` : '';

  // === 3) 照片處理：容錯與同步回 item.photoUrl
  let photoUrl = '';
  try {
    const ph = res.photos || item.details?.photos;
    if (ph && ph[0] && typeof ph[0].getUrl === 'function') {
      photoUrl = ph[0].getUrl({ maxWidth: 800, maxHeight: 600 });
    }
  } catch {}
  if (photoUrl) item.photoUrl = photoUrl;

  // === 4) 地址
  const addrEl = document.getElementById('hc-addr');
  if (addrEl) addrEl.textContent = item.address || '';

  // === 5) 營業時間
  const oh = res.opening_hours || item.details?.opening_hours;
  const openEl = document.getElementById('hc-open');
  const hoursEl = document.getElementById('hc-hours');
  if (openEl) openEl.innerHTML = '';
  if (hoursEl) hoursEl.textContent = '';

  if (oh) {
    const openNow = (typeof oh.isOpen === 'function') ? oh.isOpen() : (oh.open_now === true);
    if (openEl) openEl.innerHTML = openNow
      ? '<span class="open-ok">營業中</span>'
      : '<span class="open-bad">已打烊</span>';
    const weekday = Array.isArray(oh.weekday_text) ? oh.weekday_text : [];
    const dayIdx = (new Date().getDay() + 6) % 7;
    if (hoursEl) hoursEl.textContent = weekday[dayIdx] || '';
  } else if (openEl) {
    openEl.innerHTML = '<span class="open-unknown">營業時間未提供</span>';
  }

  // === 6) Google Map 與官網連結
  const viewEl = document.getElementById('hc-view');
  const webEl  = document.getElementById('hc-website');
  const pid    = item.place_id || res.place_id || null;
  const gmaps  = res.url || `https://www.google.com/maps/place/?q=place_id:${pid}`;
  if (viewEl) viewEl.href = gmaps;

  if (webEl) {
    if (item.website) {
      webEl.href = item.website;
      webEl.style.display = 'inline-flex';
    } else {
      webEl.removeAttribute('href');
      webEl.style.display = 'none';
    }
  }

  // === 7) 價位與分類徽章
  const pel = document.getElementById('hc-price');
  if (pel) {
    const ptx = (typeof priceText === 'function') ? priceText(res.price_level) : '';
    pel.textContent = ptx || '';
    pel.style.display = ptx ? '' : 'none';
  }

  const badgeBox = document.getElementById('hc-badges');
  if (badgeBox) {
  const rawTypes = (res && Array.isArray(res.types)) ? res.types
                   : (item && item.details && Array.isArray(item.details.types)) ? item.details.types
                   : [];
  const tags = (typeof humanizeTypes === 'function') ? (humanizeTypes(rawTypes) || []) : rawTypes;

  // 安全：把每個 tag 轉字串，避免 null/undefined
  badgeBox.innerHTML = tags.slice(0, 6)
    .map(tag => `<span class="badge">${String(tag)}</span>`)
    .join('');
  }

  // === 8) 照片呈現（有 updateCardPhoto 就用）
  if (typeof updateCardPhoto === 'function') {
    updateCardPhoto(item || { photoUrl });
  } else {
    const card = document.getElementById('hover-card');
    const img  = document.getElementById('hc-img') || card?.querySelector('img');
    const wrap = document.getElementById('hc-photo-wrap') || img?.parentElement || card;
    if (img) {
      if (photoUrl) img.src = photoUrl;
      else img.removeAttribute('src');
    }
    if (wrap) {
      wrap.classList.toggle('no-photo', !photoUrl);
      wrap.style.removeProperty('display');
    }
  }
}

/* ==========================
 * 路線 + 總距離/時間
 * =========================*/
function recomputeRoute(){
  if(!directionsRenderer) return;
  const todaysStops = getValidStopsOfDay(getCurrentDay()); // ✅ 只取有效座標
  if(todaysStops.length < 2){
    directionsRenderer.safeSetDirections(dirRenderer, { routes:[] });
    updateRouteSummary({ status:`Day ${currentDay}：此日沒有足夠的有效座標（請至少兩個點）` });
    return;
  }

  const origin = todaysStops[0].position;
  const destination = todaysStops[todaysStops.length - 1].position;
  const waypoints = todaysStops.slice(1, -1).map(s => ({ location: s.position }));
  const mode = google.maps.TravelMode[travelMode] || google.maps.TravelMode.DRIVING;

  // 🚇 Transit：對 waypoint 支援有限 → 逐段查詢並彙總（僅針對當天）
  if (travelMode === 'TRANSIT' && waypoints.length > 0) {
    const segmentPoints = [origin, ...todaysStops.slice(1).map(s => s.position)];
    routeBySegments(segmentPoints, mode)
      .then(({ lastResult, total }) => {
        if (lastResult) directionsRenderer.safeSetDirections(lastResult);
        updateRouteSummary(total);
        fitToRoute && fitToRoute();
      })
      .catch(() => {
        directionsRenderer.setDirections(dirRenderer, { routes:[] });
        updateRouteSummary({ status:`Day ${currentDay}：大眾運輸無法規劃此路線，請嘗試調整地點或改用其他模式` });
      });
    return;
  }

  // 🚗 其他模式：一次規劃（僅針對當天）
  directionsService.route({
    origin,
    destination,
    waypoints,
    travelMode: mode,
    optimizeWaypoints: false
  }, (res, status) => {
    if (status === google.maps.DirectionsStatus.OK || status === 'OK') {
      const drew = setDirectionsSafe(directionsRenderer, res);
      if (!drew) {
        drawGeodesic(A, B, 'MANUAL'); // 或 'FERRY' / 'FLIGHT' 依你的判斷
      }
      const total = summarizeRoute(res);
      updateRouteSummary(total);
      fitToRoute && fitToRoute();
    } else {
      directionsRenderer.safeSetDirections(dirRenderer, { routes:[] });
      updateRouteSummary({ status:`Day ${currentDay}：此模式無法規劃路線，請改變地點或交通模式` });
    }
  });
}
// === Routing helpers（若缺就補；有的話不會覆蓋） ===
if (typeof window.summarizeLegs !== 'function') {
  window.summarizeLegs = function(legs){
    let meters = 0, seconds = 0;
    (legs || []).forEach(l=>{
      if (l && l.distance && typeof l.distance.value === 'number') meters += l.distance.value;
      if (l && l.duration && typeof l.duration.value === 'number') seconds += l.duration.value;
    });
    return { meters, seconds };
  };
}

async function routeBySegments(points, mode) {
  // points: [p0, p1, p2, ...]
  let total = { meters: 0, seconds: 0 };
  let lastResult = null;

  for (let i = 1; i < points.length; i++) {
    const req = {
      origin: points[i - 1],
      destination: points[i],
      travelMode: mode
    };
    const res = await routeOnce(req);
    if (res && res.routes && res.routes[0] && res.routes[0].legs) {
      const inc = summarizeLegs(res.routes[0].legs);
      total.meters += inc.meters;
      total.seconds += inc.seconds;
      lastResult = res; // 只拿最後一段來畫線（你原本就是這個策略）
    }
  }
  return { lastResult, total };
}

if (typeof window.renderModeBreakdown !== 'function') {
  window.renderModeBreakdown = function(byMode){
    const box = document.getElementById('mode-breakdown');
    if (!box) return;
    const total = Object.values(byMode || {}).reduce((a,b)=> a + (b.seconds||0), 0) || 1;
    const order = ['DRIVING','WALKING','BICYCLING','TRANSIT','FLIGHT','TRAIN','BUS','FERRY','MANUAL'];
    const label = m => ({
      DRIVING:'開車', WALKING:'步行', BICYCLING:'單車', TRANSIT:'大眾',
      FLIGHT:'飛機', TRAIN:'火車', BUS:'巴士', FERRY:'渡輪', MANUAL:'手動'
    }[m] || m);
    const chips = order
      .filter(k => byMode && byMode[k])
      .map(k => {
        const v = byMode[k]; const pct = Math.round((v.seconds||0)/total*100);
        return `<span class="chip">${label(k)}：${pct}%</span>`;
      });
    box.innerHTML = chips.join('') || '<span class="muted">尚無分段資料</span>';
  };
}

if (typeof window.updateRouteSummary !== 'function') {
  window.updateRouteSummary = function({ meters, seconds, status } = {}){
    const el = document.getElementById('route-summary');
    if (!el) return;
    if (status) { el.textContent = status; return; }
    const km = (meters||0)/1000;
    const min = Math.round((seconds||0)/60);
    el.textContent = `總距離 ${km.toFixed(1)} km｜總時間 ${min} 分`;
  };
}

// === 智慧開關：決定跑舊版還是分段 V2 ===
function needV2ForToday(){
  const todays = (stops || []).filter(s => (s.day ?? 1) === getCurrentDay());
  for (let i=1; i<todays.length; i++){
    const m = (todays[i].leg && todays[i].leg.mode) || null;
    if (['FLIGHT','TRAIN','BUS','FERRY','MANUAL'].includes(m)) return true;
  }
  return false;
}

function clearLegacyDirections(){
  try{
    if (window.directionsRenderer?.setMap) {
      window.directionsRenderer.setMap(null);
      console.log('[SMART] cleared directionsRenderer');
    }
    if (Array.isArray(window.directionsRenderers)) {
      window.directionsRenderers.forEach(r => r?.setMap && r.setMap(null));
      window.directionsRenderers = [];
      console.log('[SMART] cleared directionsRenderers[]');
    }
  }catch(e){}
}

// === 小工具 ===
// ===== 通用：海空/渡輪/飛機偵測 + 安全 setDirections =====
function haversineKm(A, B){
  const toRad = d => d * Math.PI/180;
  const R = 6371;
  const dLat = toRad(B.lat - A.lat);
  const dLng = toRad(B.lng - A.lng);
  const lat1 = toRad(A.lat), lat2 = toRad(B.lat);
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
}

// 從 Google Directions 結果中抓出主導模式（特別是渡輪）
function inferModeFromDirectionsResponse(resp){
  try{
    const legs = resp?.routes?.[0]?.legs || [];
    if (!legs.length) return null;

    let hasFerry = false, hasTransit = false, hasDriving = false, hasWalking = false, hasBike = false;
    for (const leg of legs){
      const steps = leg?.steps || [];
      for (const s of steps){
        const tv = s?.transit?.line?.vehicle?.type || s?.transit?.line?.vehicle?.name;
        if (s.travel_mode === 'TRANSIT') {
          hasTransit = true;
          if (String(tv).toUpperCase() === 'FERRY') hasFerry = true;
          // 有些回傳不在 vehicle.type，而是指令字眼
          const ins = (s?.instructions || '').toLowerCase();
          if (ins.includes('ferry') || ins.includes('渡輪') || ins.includes('輪渡')) hasFerry = true;
        }
        if (s.travel_mode === 'DRIVING') hasDriving = true;
        if (s.travel_mode === 'WALKING') hasWalking = true;
        if (s.travel_mode === 'BICYCLING') hasBike = true;

        // 另外補：某些「開車走渡輪」會把 ferry 寫在 instructions 裡
        const ins2 = (s?.instructions || '').toLowerCase();
        if (ins2.includes('ferry') || ins2.includes('渡輪') || ins2.includes('輪渡')) hasFerry = true;
      }
    }
    if (hasFerry)   return 'FERRY';
    if (hasTransit) return 'TRANSIT';
    if (hasDriving) return 'DRIVING';
    if (hasBike)    return 'BICYCLING';
    if (hasWalking) return 'WALKING';
    return null;
  }catch(_){ return null; }
}

// 安全呼叫 setDirections：把整個 response 丟進 renderer
function setDirectionsSafe(renderer, resp){
  // 永久移除 legacy renderer（自動防呆）
  if (window.directionsRenderer) {
    try { window.directionsRenderer.set('directions', null); } catch(_){}
    try { window.directionsRenderer.setMap(null); } catch(_){}
    window.directionsRenderer = null;
    console.log('[auto-clean] removed legacy directionsRenderer');
  }
  try{
    if (renderer && resp) {
      renderer.safeSetDirections(resp);
      return true;
    }
  }catch(e){ console.warn('[setDirectionsSafe] failed', e); }
  return false;
}

function guessCruiseKmh(mode){
  return mode==='TRAIN' ? 120 : mode==='BUS' ? 60 : mode==='FERRY' ? 35 : 800;
}
function guessBufferMin(mode){
  return mode==='FLIGHT' ? 90 : mode==='TRAIN' ? 20 : 10;
}
function routeOnce(req){
  return new Promise((resolve)=>{
    directionsService.route(req, (res, status)=>{
      if (status === 'OK' || status === google.maps.DirectionsStatus.OK) resolve(res);
      else resolve(null);
    });
  });
}

// 自動判斷 A->B 是否「幾乎肯定要搭船」；若是，就把 leg 設成 FERRY 並給估算值
async function maybeDetectFerry(A, B, leg = {}) {
  try {
    const nameA = String(A?.name || '').toLowerCase();
    const nameB = String(B?.name || '').toLowerCase();
    const hints = ['island','港','碼頭','harbor','harbour','port',
               'penida','nusa','gili','lombok','bali','ferry',
               'sanur','padang bai','padangbai','jemeluk','amed'];
    const hit = hints.some(k => nameA.includes(k) || nameB.includes(k));
    const dKm = (typeof leg.manualDistanceKm === 'number')
      ? leg.manualDistanceKm
      : haversineKm(A.position, B.position);

    if (hit && dKm > 15) {
      const cruise = 35;    // km/h
      const buffer = 30;    // 分
      const mins = (typeof leg.manualDurationMin === 'number')
        ? leg.manualDurationMin
        : Math.round((dKm / cruise) * 60) + buffer;

      leg.mode = 'FERRY';
      leg.manualDistanceKm = Math.round(dKm * 10) / 10;
      leg.manualDurationMin = mins;
      leg.cruiseKmh = cruise;
      leg.bufferMin = buffer;
      leg.label = leg.label || 'auto:ferry';
      B.leg = { ...(B.leg || {}), ...leg };
      return true;
    }
  } catch (_) {}
  return false;
}

if (typeof window.summarizeLegs !== 'function') {
  window.summarizeLegs = function(legs){
    let meters = 0, seconds = 0;
    (legs || []).forEach(l=>{
      if (l && l.distance && typeof l.distance.value === 'number') meters += l.distance.value;
      if (l && l.duration && typeof l.duration.value === 'number') seconds += l.duration.value;
    });
    return { meters, seconds };
  };
}

if (typeof window.renderModeBreakdown !== 'function') {
  window.renderModeBreakdown = function(byMode){
    const box = document.getElementById('mode-breakdown');
    if (!box) return;
    const total = Object.values(byMode || {}).reduce((a,b)=> a + (b.seconds||0), 0) || 1;
    const order = ['DRIVING','WALKING','BICYCLING','TRANSIT','FLIGHT','TRAIN','BUS','FERRY','MANUAL'];
    const label = m => ({
      DRIVING:'開車', WALKING:'步行', BICYCLING:'單車', TRANSIT:'大眾',
      FLIGHT:'飛機', TRAIN:'火車', BUS:'巴士', FERRY:'渡輪', MANUAL:'手動'
    }[m] || m);
    const chips = order
      .filter(k => byMode && byMode[k])
      .map(k => {
        const v = byMode[k]; const pct = Math.round((v.seconds||0)/total*100);
        return `<span class="chip">${label(k)}：${pct}%</span>`;
      });
    box.innerHTML = chips.join('') || '<span class="muted">尚無分段資料</span>';
  };
}

if (typeof window.updateRouteSummary !== 'function') {
  window.updateRouteSummary = function({ meters, seconds, status } = {}){
    const el = document.getElementById('route-summary');
    if (!el) return;
    if (status) { el.textContent = status; return; }
    const km = (meters||0)/1000;
    const min = Math.round((seconds||0)/60);
    el.textContent = `總距離 ${km.toFixed(1)} km｜總時間 ${min} 分`;
  };
}

function routeOnce(opts){
  return new Promise(resolve=>{
    directionsService.route(opts, (res, status)=>{
      if (status === 'OK' || status === google.maps.DirectionsStatus.OK) return resolve(res);
      // 後備：把 TRANSIT / WALKING / BICYCLING 改 DRIVING 試一次
      if (opts.travelMode !== google.maps.TravelMode.DRIVING){
        directionsService.route({ ...opts, travelMode: google.maps.TravelMode.DRIVING }, (r2, s2)=>{
          resolve((s2==='OK'||s2===google.maps.DirectionsStatus.OK) ? r2 : null);
        });
      } else {
        resolve(null);
      }
    });
  });
}

// 逐段規劃（主要用於 TRANSIT 彙總距離/時間）
function routeBySegments(points, mode){
  // points: [p0,p1,p2,...]
  const legs = [];
  let lastResult = null;
  const tasks = points.slice(0,-1).map((p,i)=>({ origin:p, destination: points[i+1] }));
  return tasks.reduce((prev, t)=>{
    return prev.then(()=> new Promise((resolve, reject)=>{
      directionsService.route({ origin:t.origin, destination:t.destination, travelMode: mode }, (res, status)=>{
        if(status===google.maps.DirectionsStatus.OK || status==='OK'){
          lastResult = res; // 視覺上僅呈現最後一段（簡化）
          legs.push(...res.routes[0].legs);
          resolve();
        }else{
          reject(status);
        }
      });
    }));
  }, Promise.resolve()).then(()=>({ lastResult, total: summarizeLegs(legs) }));
}

function summarizeLegs(legs){
  let meters = 0, seconds = 0;
  (legs || []).forEach(l=>{
    if (l?.distance?.value) meters += l.distance.value;
    if (l?.duration?.value) seconds += l.duration.value;
  });
  return { meters, seconds };
}

function summarizeRoute(res){
  const legs = res?.routes?.[0]?.legs || [];
  return summarizeLegs(legs);
}

// ===== SAFETY LAYER (5/6): fit helpers =====
function buildBoundsFromStops(stopsArr){
  if (!isGoogleReady()) return null;
  const pts = (stopsArr||[]).map(s => toLatLngLiteral(s?.position)).filter(Boolean);
  if (!pts.length) return null;

  const b = new google.maps.LatLngBounds();
  pts.forEach(p => b.extend(p));
  return b;
}

/* ==========================
 * 其他小工具
 * =========================*/

function safeFitBoundsForDay(day) {
  try {
    const todays = (window.stops || []).filter(s => Number(s.day ?? 1) === Number(day || 1));
    const b = new google.maps.LatLngBounds();
    let n = 0;
    todays.forEach(s => {
      const p = s?.position;
      if (p && typeof p.lat === 'number' && typeof p.lng === 'number') {
        b.extend(new google.maps.LatLng(p.lat, p.lng));
        n++;
      }
    });
    if (n > 0 && window.map) window.map.fitBounds(b, { top: 80, right: 340, bottom: 60, left: 20 });
  } catch (e) {
    console.warn('[safeFitBoundsForDay] fail', e);
  }
}

// legIndex 指「第幾段」（第2個點 = 第1段），從 1 開始
function setLegModeByIndex(day, legIndex, mode, opt={}){
  const todays = (stops||[]).filter(s => (s.day ?? 1) === getCurrentDay());
  if (todays.length < 2) return false;
  const idx = Math.max(1, Math.min(legIndex, todays.length-1));
  const B = todays[idx];
  B.leg = B.leg || {};
  B.leg.mode = String(mode).toUpperCase();

  if (['MANUAL','FERRY','FLIGHT','TRAIN','BUS'].includes(B.leg.mode)){
    const A = todays[idx-1];
    const dKm = haversineKm(A.position, B.position);
    B.leg.manualDistanceKm = (opt.manualDistanceKm != null) ? opt.manualDistanceKm : Math.round(dKm);
    const cruise = opt.cruiseKmh ?? guessCruiseKmh(B.leg.mode);
    const buffer = opt.bufferMin ?? guessBufferMin(B.leg.mode);
    B.leg.cruiseKmh = cruise;
    B.leg.bufferMin = buffer;
    B.leg.manualDurationMin = (opt.manualDurationMin != null)
      ? opt.manualDurationMin
      : Math.round((B.leg.manualDistanceKm / cruise) * 60) + buffer;
      if (B.leg && B.leg.durationText == null) {
        B.leg.durationText = `約 ${Math.max(1, Math.round(B.leg.manualDurationMin || 0))} 分`;
      }
  } else {
    // 清掉手動欄位（變回 Google 規劃）
    delete B.leg.manualDistanceKm;
    delete B.leg.manualDurationMin;
    delete B.leg.cruiseKmh;
    delete B.leg.bufferMin;
  }
  return true;
}

// === 自動判斷是否為跨海段（FERRY） ===
const AUTO_FERRY = true;

async function maybeDetectFerry(A, B, leg) {
  // 0) 先做超快啟發式（不打 API）
  const nameA = (A.name || '').toLowerCase();
  const nameB = (B.name || '').toLowerCase();
  const ISLAND_HINTS = ['island','港','碼頭','harbor','harbour','port','penida','nusa','gili','lombok','bali','ferry'];
  const hasHint = ISLAND_HINTS.some(k => nameA.includes(k) || nameB.includes(k));
  const distKm = haversineKm(A.position, B.position);

  if (hasHint && distKm > 15) { // 15~20km 以上幾乎不可能有橋
    setFerryLeg(leg, distKm);
    return true;
  }

  // 1) 再用「一次 DRIVING 試探」；成功=非跨海、失敗→再試 TRANSIT
  const driveRes = await routeOnce({
    origin: A.position, destination: B.position,
    travelMode: google.maps.TravelMode.DRIVING
  });
  if (driveRes && driveRes.routes && driveRes.routes[0]) return false;

  const transitRes = await routeOnce({
    origin: A.position, destination: B.position,
    travelMode: google.maps.TravelMode.TRANSIT,
    transitOptions: { departureTime: new Date() }
  });
  if (!transitRes || !transitRes.routes || !transitRes.routes[0]) return false;

  // 2) 看到渡輪步驟就自動標記
  for (const L of (transitRes.routes[0].legs || [])) {
    for (const s of (L.steps || [])) {
      if (s.transit?.line?.vehicle?.type === 'FERRY') {
        const sec = (s.duration?.value) || 0;
        setFerryLeg(leg, distKm, sec ? Math.round(sec/60) : null);
        return true;
      }
    }
  }
  return false;
}

function setFerryLeg(leg, distKm, minutesOverride=null){
  const cruise = 35, buffer = 30;
  const minutes = (minutesOverride != null)
    ? minutesOverride
    : Math.round((distKm / cruise) * 60) + buffer;
  leg.mode = 'FERRY';
  leg.manualDistanceKm = Math.round(distKm);
  leg.manualDurationMin = minutes;
  leg.cruiseKmh = cruise;
  leg.bufferMin = buffer;
  leg.label = '自動偵測：渡輪';
}
async function maybeDetectFerry(A, B, leg) {
  // 0) 先做超快啟發式（不打 API）
  const nameA = (A.name || '').toLowerCase();
  const nameB = (B.name || '').toLowerCase();
  const ISLAND_HINTS = ['island','港','碼頭','harbor','harbour','port','penida','nusa','gili','lombok','bali','ferry'];
  const hasHint = ISLAND_HINTS.some(k => nameA.includes(k) || nameB.includes(k));
  const distKm = haversineKm(A.position, B.position);

  if (hasHint && distKm > 15) { // 15~20km 以上幾乎不可能有橋
    setFerryLeg(leg, distKm);
    return true;
  }

  // 1) 再用「一次 DRIVING 試探」；成功=非跨海、失敗→再試 TRANSIT
  const driveRes = await routeOnce({
    origin: A.position, destination: B.position,
    travelMode: google.maps.TravelMode.DRIVING
  });
  if (driveRes && driveRes.routes && driveRes.routes[0]) return false;

  const transitRes = await routeOnce({
    origin: A.position, destination: B.position,
    travelMode: google.maps.TravelMode.TRANSIT,
    transitOptions: { departureTime: new Date() }
  });
  if (!transitRes || !transitRes.routes || !transitRes.routes[0]) return false;

  // 2) 看到渡輪步驟就自動標記
  for (const L of (transitRes.routes[0].legs || [])) {
    for (const s of (L.steps || [])) {
      if (s.transit?.line?.vehicle?.type === 'FERRY') {
        const sec = (s.duration?.value) || 0;
        setFerryLeg(leg, distKm, sec ? Math.round(sec/60) : null);
        return true;
      }
    }
  }
  return false;
}

function setFerryLeg(leg, distKm, minutesOverride=null){
  const cruise = 35, buffer = 30;
  const minutes = (minutesOverride != null)
    ? minutesOverride
    : Math.round((distKm / cruise) * 60) + buffer;
  leg.mode = 'FERRY';
  leg.manualDistanceKm = Math.round(distKm);
  leg.manualDurationMin = minutes;
  leg.cruiseKmh = cruise;
  leg.bufferMin = buffer;
  leg.label = '自動偵測：渡輪';
}

//取「當天、有效座標」的 stops，並標記長距離改 MANUAL
function getValidStopsOfDay(day){
  return (stops || []).filter(s => (s.day ?? 1) === getCurrentDay() && isValidPos(s.position));
}

function sanitizeDayStops(dayStops){
  const MAX_DRIVE_KM  = 500;   // 超過這距離，多半跨城/跨海
  const MAX_TRANSIT_KM= 120;   // 大眾運輸更嚴格
  for (let i=1; i<dayStops.length; i++){
    const A = dayStops[i-1], B = dayStops[i];
    const distKm = haversineKm(A.position, B.position);
    const leg = (B.leg = B.leg || {});
    const mode = (leg.mode || window.travelMode || 'DRIVING').toUpperCase();

    // TRANSIT 容易 ZERO_RESULTS，距離太長就直接 MANUAL
    if ((mode === 'TRANSIT' && distKm > MAX_TRANSIT_KM) ||
        (mode !== 'TRANSIT' && distKm > MAX_DRIVE_KM)) {
      leg.mode = 'MANUAL';
      if (leg.manualDistanceKm == null) leg.manualDistanceKm = Math.round(distKm);
      if (leg.cruiseKmh == null) leg.cruiseKmh = 700; // 飛行等效
      if (leg.bufferMin == null) leg.bufferMin = 90;
      if (leg.manualDurationMin == null) {
        leg.manualDurationMin = Math.round((leg.manualDistanceKm / leg.cruiseKmh) * 60) + leg.bufferMin;
      }
    }
  }
  return dayStops;
}

// === 智慧預估停留時間（分鐘） ===
// 支援：Google types、badges、自訂類別字串；會依熱門程度微調
function defaultStayMinutes(src) {
  // 允許直接餵 string（type 名）或整個 item/place 物件
  const types = []
  ;(src?.types || src?.badges || []).forEach(t => { if (t) types.push(String(t).toLowerCase()) })
  if (typeof src === 'string') types.push(src.toLowerCase())
  if (src?.category) types.push(String(src.category).toLowerCase())

  // 基本對照
  const T = t => types.some(x => x.includes(t))
  let base =
    T('lodging')                ? 8*60  : // 住宿
    T('airport') || T('aerodrome') ? 120   : // 機場/轉機
    T('train') || T('subway') || T('bus_station') ? 20 :
    T('museum') || T('art_gallery') ? 120 :
    T('temple') || T('church') || T('shrine') ? 90 :
    T('park') || T('beach') || T('national_park') ? 120 :
    T('shopping_mall') || T('market') || T('night_market') ? 90 :
    T('amusement_park') || T('zoo') || T('aquarium') ? 150 :
    T('restaurant') ? 75 :
    T('cafe') || T('bakery') ? 45 :
    T('tourist_attraction') || T('point_of_interest') ? 60 :
    45; // 其他一般景點

  // 依熱門程度微調（有評分/評價數時）
  const rating = Number(src?.rating ?? src?.details?.rating ?? NaN)
  const urt    = Number(src?.userRatingsTotal ?? src?.user_ratings_total ?? src?.details?.user_ratings_total ?? NaN)

  if (!isNaN(rating)) {
    if (rating >= 4.6) base += 15
    else if (rating <= 3.5) base -= 10
  }
  if (!isNaN(urt)) {
    if (urt > 5000) base += 20
    else if (urt > 1500) base += 10
  }

  // 範圍限制：餐飲 30–120，景點 20–240
  const cap = T('restaurant') || T('cafe') ? [30, 120] : [20, 240]
  base = Math.max(cap[0], Math.min(cap[1], base))

  // 四捨五入到 5 分鐘倍數
  return Math.round(base / 5) * 5
}

// 給 Google Places 結果使用（p）
function defaultStayMinutesFromPlace(p) {
  return defaultStayMinutes({ 
    types: p?.types || [],
    rating: p?.rating,
    userRatingsTotal: p?.user_ratings_total
  })
}

// 給你內部 stop 物件使用（s）
function defaultStayMinutesFromItem(s) {
  return defaultStayMinutes({
    types: s?.types || s?.badges || [],
    rating: s?.rating,
    userRatingsTotal: s?.userRatingsTotal,
    category: s?.category
  })
}

// Safe version: build itinerary info line
function fillItinInfoLine(item) {
  const box = document.getElementById('hc-itin');
  if (!box || !item || !item.position) return;

  const day = item.day ?? currentDay;
  const todays = getStopsOfDay(day);
  const idx = todays.findIndex(s => String(s.id) === String(item.id));

  // Start with "Day X · Label"
  let line = `Day ${day}${item.label ? ` · ${item.label}` : ''}`;

  if (idx > 0) {
    const prev = todays[idx - 1];
    const km = haversineKm(prev.position, item.position);
    const leg = item.leg || {};
    const mode = (leg.mode || travelMode || 'DRIVING').toUpperCase();
    const icon = LEG_ICON[mode] || '🧭';

    // Estimate duration
    let minutes = 0;
    if (['FLIGHT','TRAIN','BUS','FERRY','MANUAL'].includes(mode)) {
      const dKm = leg.manualDistanceKm ?? km;
      minutes = leg.manualDurationMin
        ?? Math.round((dKm / guessCruiseKmh(mode)) * 60)
        + (leg.bufferMin ?? guessBufferMin(mode));
    } else {
      const kmh = (mode === 'WALKING') ? 4.5 : (mode === 'BICYCLING' ? 15 : 40);
      minutes = Math.max(1, Math.round((km / kmh) * 60));
    }

    // Optional stay time
    const stay = (typeof item.stayMin === 'number') ? ` | Suggested stay: ${item.stayMin} min` : '';

    // Compose full line
    line += ` | Distance from previous: ${km.toFixed(1)} km · ~${minutes} min (${icon})${stay}`;
  }

  box.textContent = line;
}

// === Tigerair：價位 / 類別人話化 ===
function priceText(level){
  return (typeof level === 'number' && level > 0) ? '$'.repeat(Math.min(4, level)) : '';
}

// 你可以按需求調整對照表
function humanizeTypes(types = []){
  const map = {
    restaurant:'餐廳', cafe:'咖啡', bakery:'烘焙', bar:'酒吧', meal_takeaway:'外帶',
    tourist_attraction:'景點', museum:'博物館', park:'公園', temple:'寺廟',
    lodging:'住宿', shopping_mall:'購物', night_club:'夜店'
  };
  const out = [];
  types.forEach(t => {
    const k = String(t || '').toLowerCase();
    if (map[k] && !out.includes(map[k])) out.push(map[k]);
  });
  return out;
}

function setElText(id, txt, {showWhenHasText=true} = {}){
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = txt || '';
  if (showWhenHasText) el.style.display = txt ? '' : 'none';
}


// ==== AI 規劃交通：把 stops 與偏好打包丟給後端 ====

function buildAiLegsPayload(){
  // 你可視需要加入更多偏好（預算、避免夜車、行李、同行成員等）
  return {
    day: currentDay,
    stops: getStopsOfDay(getCurrentDay()).map((st, i) => ({
      id: st.id,
      name: st.name,
      lat: st.position.lat,
      lng: st.position.lng,
      leg: st.leg || null,
      stayMin: st.stayMin ?? 60,
      kind: st.kind || null,
      isAirport: !!st.isAirport,
    })),
    prefs: {
      budgetLevel: 'mid',             // 'low' | 'mid' | 'high'
      avoidOvernight: true,
      maxWalkMin: 15,
      traveler: { adults: 2, kids: 0, seniors: 0, largeLuggage: false }
    }
  };
}

// 將 AI 回傳的每段計畫套回 stops（只處理當天第2點起）
function applyAiLegsToStops(plan){
  if (!plan || !Array.isArray(plan.legs)) return;
  const todays = getStopsOfDay(getCurrentDay());
  // legs[i] 是 (todays[i-1] -> todays[i])
  for (let i=1; i<todays.length; i++){
    const s = todays[i];
    const leg = plan.legs[i-1];      // 與上段對齊
    if (!leg) continue;
    s.leg = s.leg || {};
    // 標準欄位（和你現有 UI 對齊）
    s.leg.mode = leg.mode || null;   // 'DRIVING' | 'WALKING' | 'TRANSIT' | 'FLIGHT' | 'TRAIN' | 'BUS' | 'FERRY' | 'MANUAL'
    s.leg.manualDistanceKm = leg.manualDistanceKm ?? null;
    s.leg.manualDurationMin = leg.manualDurationMin ?? null;
    s.leg.departAt = leg.departAt ? new Date(leg.departAt) : null;
    s.leg.bufferMin = leg.bufferMin ?? null;
    s.leg.cruiseKmh = leg.cruiseKmh ?? null;
    // 附註（可用於 tooltip 顯示理由）
    s.leg.notes = leg.notes || null;
  }
  renderList();
  recomputeRouteSmart(); // 讓你的 V2 邏輯馬上生效

  // === Compat shim B: 讓 applyAiLegs(plan) 轉呼叫 ToStops 版 ===
  window.applyAiLegs = (function(prev){
    return function(arg){
      // 若傳入的是 AI 計畫（帶 legs），就直接套用
      if (arg && Array.isArray(arg.legs)) {
        return applyAiLegsToStops(arg);
     }
      // 否則維持原本（A 補丁）行為：呼叫 server 版
      return applyAiLegsFromServer(arg);
    };
  })(window.applyAiLegs);
}

// === 1) 產生並保存使用者 UID（給 PHP current_user_token() 用） ===
(function ensureUid(){
  let uid = localStorage.getItem('uid');
  if (!uid) {
    uid = 'dev-' + Math.random().toString(36).slice(2);
    localStorage.setItem('uid', uid);
  }
  // 同步設置 cookie（你的 PHP 也會讀 cookie['uid']）
  document.cookie = 'uid=' + uid + ';path=/;max-age=' + (60*60*24*365);
  window.USER_UID = uid;
})();

// === 2) 把一個 stop 打包成 API 要的點（含 meta_json） ===
// 依目前 stops 直接產生存檔用的 points（含 meta_json）
function toApiPoint(stop) {
  if (!stop) return null;
  const lat = stop.lat ?? stop.position?.lat ?? stop.marker?.getPosition?.()?.lat?.();
  const lng = stop.lng ?? stop.position?.lng ?? stop.marker?.getPosition?.()?.lng?.();
  if (!(isFinite(lat) && isFinite(lng))) return null;

  const meta = Object.assign({}, stop.meta || {}, {
    rating: stop.rating ?? stop.meta?.rating ?? null,
    userRatingsTotal: stop.userRatingsTotal ?? stop.meta?.userRatingsTotal ?? null,
    photoUrl: stop.photoUrl ?? stop.meta?.photoUrl ?? null,
    badges: Array.isArray(stop.badges) ? stop.badges : (stop.meta?.badges || []),
    leg: stop.leg || null,
    stayMin: typeof stop.stayMin === 'number' ? stop.stayMin : 60,
    placeId: stop.placeId || stop.meta?.placeId || null,
  });

  return {
    name: stop.name || '未命名地點',
    lat: Number(lat),
    lng: Number(lng),
    day: Number(stop.day ?? 1),
    seq: Number(stop.seq ?? stop._seqInDay ?? 1),
    placeId: stop.placeId ?? null,
    meta_json: JSON.stringify(meta)
  };
}

// ★ 最終版：真正送到後端的 payload（一定含 stops + days）
function buildUserTripPayloadForSave(title) {
  const allStops = Array.isArray(window.stops) ? window.stops : [];
  const cleanStops = allStops.map(toApiPoint).filter(Boolean);

  // 依 day 分組，days.items 用名稱（給清單快速瀏覽用）
  const daysMap = new Map();
  for (const s of cleanStops) {
    const d = s.day || 1;
    if (!daysMap.has(d)) daysMap.set(d, []);
    daysMap.get(d).push(s);
  }
  const days = [...daysMap.entries()]
    .sort((a,b)=>a[0]-b[0])
    .map(([day, items]) => ({
      day,
      title: `Day ${day}`,
      items: items
        .sort((a,b)=> (a.seq||0)-(b.seq||0))
        .map(it => it.name || '未命名地點')
    }));

  return {
    title: (title || document.getElementById('trip-title')?.value || '未命名行程').trim(),
    notes: document.getElementById('trip-notes')?.value || null,
    stops: cleanStops,   // 後端會讀 data.get("stops") or data.get("points")
    days,                // 一併存，之後載入可還原 Day 結構
    meta: {}             // 保留擴充位
  };
}

// === 3) 建立整體 payload ===
function buildUserTripPayload(){
  return {
    title: (document.getElementById('trip-title')?.value || '未命名行程').trim(),
    notes: document.getElementById('trip-notes')?.value || null,
    points: (window.stops || []).map(toApiPoint)
  };
}

// === 4) 主流程：第一次 POST，之後自動走 PUT ===
window.currentUserTripId = window.currentUserTripId || null;  // 記住目前這筆的 id

// === Python Flask 版 Save / Update 行程 ===
async function saveOrUpdateUserTrip(){
  const payload = buildUserTripPayload();

  // 嘗試從全域或 localStorage 取出上次儲存的行程 id
  const lastId = window.currentUserTripId || localStorage.getItem('planner.lastUserTripId.v1');
  const isUpdate = !!lastId;

  const url = isUpdate
    ? `/api/user_trips/${encodeURIComponent(lastId)}`
    : `/api/user_trips/save`;     // Flask 版 POST 用 /api/user_trips/save
  const method = isUpdate ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // 讓 session cookie 帶上（Flask 用這個判斷登入）
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      console.error('❌ Save/Update failed:', data);
      alert('儲存失敗：' + (data.error || res.status));
      return;
    }

    // 初次儲存成功，後續改為更新
    if (!isUpdate && data.trip_id) {
      window.currentUserTripId = data.trip_id;
      localStorage.setItem('planner.lastUserTripId.v1', String(data.trip_id));

      const btn = document.getElementById('btnSaveDb') || document.getElementById('btn-save-db');
      if (btn) btn.textContent = '更新我的行程';
    }

    alert(isUpdate ? '✅ 已更新行程！' : '💾 已儲存行程！');
    console.log('✅ Trip saved/updated:', data);

  } catch (err) {
    console.error('⚠️ SaveOrUpdate error:', err);
    alert('發生錯誤：' + err.message);
  }
}

// 把一個 stop 轉成後端要的格式（含 meta_json）
function toApiPoint(stop){
  return {
    name: stop.name,
    lat:  stop.position.lat,
    lng:  stop.position.lng,
    // 後端 user_trip_points 沒 day 欄位也無妨，帶了也不會用
    day:  stop.day ?? 1,
    seq:  stop.seq ?? null,
    placeId: stop.placeId ?? null,
    // 直接打包 meta_json：rating/badges 你有就帶，沒有也沒關係
    meta_json: JSON.stringify({
      ...(stop.meta || {}),
      rating: stop.rating ?? (stop.meta?.rating ?? null),
      userRatingsTotal: stop.userRatingsTotal ?? (stop.meta?.userRatingsTotal ?? null),
      photoUrl: stop.photoUrl ?? (stop.meta?.photoUrl ?? null),
      badges: stop.badges ?? (stop.meta?.badges ?? []),
      // 這兩個是關鍵
      leg: stop.leg || null,
      stayMin: stop.stayMin ?? 60
    })
  };
}

function buildUserTripPayload(){
  return {
    title: (document.getElementById('trip-title')?.value || '未命名行程').trim(),
    notes: document.getElementById('trip-notes')?.value || null,
    points: (window.stops || []).map(toApiPoint)
  };
}


//用「有效 stops」來規劃路線 分段彙總 + TRANSIT 出發時間
function recomputeRoute(){
  if(!directionsRenderer) return;

  const todaysStops = getValidStopsOfDay(getCurrentDay());
  if(todaysStops.length < 2){
    directionsRenderer.safeSetDirections(dirRenderer, { routes:[] });
    updateRouteSummary({ status:`Day ${currentDay}：此日沒有足夠的有效座標（請先選至少兩個有位置的點）` });
    return;
  }

  const origin = todaysStops[0].position;
  const destination = todaysStops[todaysStops.length - 1].position;
  const waypoints = todaysStops.slice(1, -1).map(s => ({ location: s.position }));
  const mode = google.maps.TravelMode[travelMode] || google.maps.TravelMode.DRIVING;

  // TRANSIT 跨城常會 ZERO_RESULTS：退回逐段 + DRIVING 當後備
  if (travelMode === 'TRANSIT' && waypoints.length > 0) {
    const segmentPoints = [origin, ...todaysStops.slice(1).map(s => s.position)];
    routeBySegments(segmentPoints, google.maps.TravelMode.TRANSIT)
      .then(({ lastResult, total }) => {
        if (lastResult) {
          directionsRenderer.safeSetDirections(lastResult);
          updateRouteSummary(total);
          fitToRoute && fitToRoute();
        } else {
          // 後備
          return routeBySegments(segmentPoints, google.maps.TravelMode.DRIVING)
            .then(({ lastResult: r2, total: t2 }) => {
              if (r2) directionsRenderer.safeSetDirections(r2);
              updateRouteSummary(t2);
              fitToRoute && fitToRoute();
            });
        }
      })
      .catch(() => {
        directionsRenderer.safeSetDirections(dirRenderer, { routes:[] });
        updateRouteSummary({ status:`Day ${currentDay}：此路線無法以大眾運輸規劃（已嘗試後備亦失敗）` });
      });
    return;
  }

  directionsService.route({
    origin, destination, waypoints,
    travelMode: mode, optimizeWaypoints: false
  }, (res, status) => {
    if (status === google.maps.DirectionsStatus.OK || status === 'OK') {
      const drew = setDirectionsSafe(directionsRenderer, res);
        if (!drew) {
        drawGeodesic(A, B, 'MANUAL'); // 或 'FERRY' / 'FLIGHT' 依你的判斷
      }
      const total = summarizeRoute(res);
      updateRouteSummary(total);
      fitToRoute && fitToRoute();
    } else {
      // 後備：ZERO_RESULTS → 改 DRIVING 試一次
      if (mode !== google.maps.TravelMode.DRIVING) {
        directionsService.route({
          origin, destination, waypoints,
          travelMode: google.maps.TravelMode.DRIVING, optimizeWaypoints: false
        }, (r2, st2) => {
          if (st2 === 'OK' || st2 === google.maps.DirectionsStatus.OK) {
            directionsRenderer.safeSetDirections(r2);
            updateRouteSummary(summarizeRoute(r2));
            fitToRoute && fitToRoute();
          } else {
            directionsRenderer.safeSetDirections(dirRenderer, { routes:[] });
            updateRouteSummary({ status:`Day ${currentDay}：此模式無法規劃（後備也失敗）` });
          }
        });
      } else {
        directionsRenderer.safeSetDirections(dirRenderer, { routes:[] });
        updateRouteSummary({ status:`Day ${currentDay}：此模式無法規劃` });
      }
    }
  });
}

function routeOnce(req){
  return new Promise((resolve)=>{
    directionsService.route(req, (res, status)=>{
      if (status === 'OK' || status === google.maps.DirectionsStatus.OK) resolve(res);
      else resolve(null);
    });
  });
}

// 產生透明 PNG 當作 marker icon（只提供點擊範圍與錨點）
function transparentIcon(size = 36) {
  const s = size;
  // 一個全透明的 1x1 PNG；我們用 scaledSize 控制點擊範圍
  return {
    url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIW2P4//8/AwAI/AL+7x9mVwAAAABJRU5ErkJggg==',
    scaledSize: new google.maps.Size(s, s),
    anchor: new google.maps.Point(s/2, s/2)
  };
}

// === SVG 工具：把字串變成 data URL ===
function svgUrl(svg) {
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

// === 產生「行程點」水滴徽章（Glow Flat） ===
// 注意：輸出尺寸為 44x58，錨點預設對準底尖（後面會在 updateMarkerLabel 設 anchor）
function makeStopBadgeSVG({ label = 'A', color = '#38bdf8', width = 44, height = 58 }) {
  const w = width, h = height;
  return svgUrl(`
  <svg width="${w}" height="${h}" viewBox="0 0 44 58" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- 柔光陰影 -->
      <filter id="pinGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="${color}" flood-opacity=".45"/>
      </filter>
      <!-- 水滴漸層（上亮下深） -->
      <linearGradient id="pinGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"  stop-color="#bfeaff"/>
        <stop offset="35%" stop-color="${color}"/>
        <stop offset="100%" stop-color="#0ea5e9"/>
      </linearGradient>
      <!-- 內圈高光 -->
      <radialGradient id="innerHL" cx="50%" cy="30%" r="60%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity=".35"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
    </defs>

    <!-- 水滴外形：圓頂＋底部尖點；外圈白描邊看起來更清楚 -->
    <path d="M22,2 C32,2 40,10 40,20 C40,30 32,40 22,56 C12,40 4,30 4,20 C4,10 12,2 22,2 Z"
          fill="url(#pinGrad)" stroke="#ffffff" stroke-width="3" filter="url(#pinGlow)"/>

    <!-- 內部高光，讓質感更立體 -->
    <ellipse cx="22" cy="18" rx="13" ry="11" fill="url(#innerHL)"/>

    <!-- 文字：白字 + 黑描邊（小地圖縮放下仍清楚） -->
    <text x="50%" y="26" text-anchor="middle"
          font-family="system-ui, Segoe UI, Arial" font-weight="900" font-size="18"
          fill="#ffffff" stroke="#000000" stroke-width="2" paint-order="stroke fill">
      ${label}
    </text>
  </svg>`);
}

function inferBadgesFromTypes(types){
  const out=[];
  if(types.includes('lodging')) out.push('住宿');
  if(types.includes('restaurant')||types.includes('cafe')) out.push('餐飲');
  if(types.includes('tourist_attraction')) out.push('景點');
  return out;
}

function placeholderImage(){
  return 'https://picsum.photos/seed/gmtrip/640/400';
}

// ======= Special markers for difficult stops =======
function markSpecialStops(stops){
  for (const s of stops){
    const name = (s.name||'').toLowerCase();
    // 海上/水上活動點：不丟給 Directions
    if (/manta|snorkel|snorkeling|dive|reef|point|offshore|boat/.test(name)) {
      s.noRoute = true;
    }
    // 碼頭/港口：可能是渡輪錨點
    if (/harbor|harbour|port|pier|marina|jetty|ferry/.test(name)) {
      s.isHarbor = true;
    }
  }
}

// ======= Route Smart helpers =======
let SMART_dirRenderers = [];
let SMART_manualPolylines = [];

function clearSmartOverlays(){
  if (!Array.isArray(window.SMART_dirRenderers)) window.SMART_dirRenderers = [];
  if (!Array.isArray(window.SMART_markers))      window.SMART_markers = [];

  window.SMART_dirRenderers.forEach(r=>{ try{ r.setMap(null); }catch{} });
  window.SMART_dirRenderers.length = 0;

  window.SMART_markers.forEach(m=>{ try{ m.setMap(null); }catch{} });
  window.SMART_markers.length = 0;
}


function distKm(a,b){
  const toRad = d=>d*Math.PI/180;
  const R=6371, dLat=toRad(b.lat-a.lat), dLng=toRad(b.lng-a.lng);
  const lat1=toRad(a.lat), lat2=toRad(b.lat);
  const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}

function estimateFerry(A,B){
  const d = distKm(A,B);
  const avgKmh = 28, bufferMin = 30;
  const mins = Math.round(d/avgKmh*60 + bufferMin);
  return { distanceKm: d, durationMin: mins, note: 'Ferry (est.)' };
}
function estimateFlight(A,B){
  const d = distKm(A,B);
  const cruiseKmh = 650, airportBufferMin = 120;
  const mins = Math.round(d/cruiseKmh*60 + airportBufferMin);
  return { distanceKm: d, durationMin: mins, note: 'Flight (est.)' };
}
function estimateManual(A,B){
  const d = distKm(A,B);
  const kmh = d <= 2 ? 4.5 : 20;
  const mins = Math.round(d/kmh*60);
  return { distanceKm: d, durationMin: Math.max(5, mins), note: 'Manual (est.)' };
}

function drawGeodesic(A,B,modeLabel='MANUAL'){
  const p = new google.maps.Polyline({
    path: [ {lat:A.lat, lng:A.lng}, {lat:B.lat, lng:B.lng} ],
    geodesic: true,
    strokeOpacity: 0.9,
    strokeWeight: 4,
    strokeColor: modeLabel==='FERRY' ? '#00bcd4' : modeLabel==='FLIGHT' ? '#ff9800' : '#9e9e9e',
    map
  });
  SMART_manualPolylines.push(p);
  return p;
}

function directionsTryOnce(A, B, mode) {
  return new Promise(resolve => {
    directionsService.route(
      { origin: A, destination: B, travelMode: google.maps.TravelMode[mode] },
      (res, status) => {
        if (status === 'OK' && res?.routes?.[0]?.legs?.[0]) {
          const leg0 = res.routes[0].legs[0];
          resolve({
            ok: true,
            raw: res,  // ← setDirectionsSafe 需要這個
            payload: {
              seconds: leg0.duration?.value ?? null,
              distanceKm: (leg0.distance?.value ?? 0)/1000,
              durationText: leg0.duration?.text ?? null,
              distanceText: leg0.distance?.text ?? null
            }
          });
        } else {
          resolve({ ok:false, status, raw: res });
        }
      }
    );
  });
}

function pickMode(A,B){
  const nameA=(A.name||'').toLowerCase();
  const nameB=(B.name||'').toLowerCase();
  const d = distKm(A,B);
  if (A.noRoute || B.noRoute) return 'MANUAL';
  if (d > 120) return 'FLIGHT';
  if (d <= 1.8) return 'WALKING';
  const looksHarbor = /harbor|harbour|port|pier|marina|jetty|ferry/;
  if (looksHarbor.test(nameA) || looksHarbor.test(nameB)) return 'FERRY';
  return 'DRIVING';
}

// ========== 幫手：地理 & 時長 ==========
function haversineMeters(a, b) {
  const toRad = d => d*Math.PI/180;
  const R = 6371000;
  const dLat = toRad((b.lat||b.latitude) - (a.lat||a.latitude));
  const dLng = toRad((b.lng||b.longitude) - (a.lng||a.longitude));
  const lat1 = toRad(a.lat||a.latitude), lat2 = toRad(b.lat||b.latitude);
  const s = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(s));
}
const sec2min = s => Math.max(1, Math.round(s/60));

function detectFerryFromSteps(steps = []) {
  const ferryWords = ['ferry', '渡輪', '渡船', 'フェリー', '페리', 'fähre']; // 可再補語言

  // 有沒有 TRANSIT，但不是 Bus/Rail 類型（常見就是 Ferry）
  let seenTransit = false, seenNonFerryTransit = false;

  const isFerryWord = (s) => ferryWords.some(w => s.includes(w));

  const visit = (arr=[]) => {
    for (const st of arr) {
      const tm  = String(st.travel_mode || '').toUpperCase();
      const man = String(st.maneuver || '').toLowerCase();
      const html = String(st.html_instructions || st.instructions || '').toLowerCase();
      const veh = String(st.transit?.line?.vehicle?.type || '').toUpperCase();

      if (veh === 'FERRY') return true;                 // 官方標示
      if (man.includes('ferry')) return true;           // maneuver 有 ferry
      if (html && isFerryWord(html)) return true;       // 指令文字提到 ferry
      if (tm === 'TRANSIT') {
        seenTransit = true;
        const nonFerryTypes = ['BUS','SUBWAY','TRAM','RAIL','TRAIN','HEAVY_RAIL','METRO_RAIL','COMMUTER_TRAIN'];
        if (veh && nonFerryTypes.includes(veh)) seenNonFerryTransit = true;
      }

      // 巢狀子步驟
      if (Array.isArray(st.steps) && visit(st.steps)) return true;
    }
    return false;
  };

  const hasFerry = visit(steps);
  if (hasFerry) return true;

  // 保底：有 TRANSIT，但完全沒看到巴士/鐵路類型 → 高機率是船
  if (seenTransit && !seenNonFerryTransit) return true;

  return false;
}

// ========== 把 Directions 的一段轉成統一 leg ==========
function normalizeDirLeg(dirLeg, reqMode, meta={}) {
  const seconds = Number(dirLeg?.duration?.value);
  const distM   = Number(dirLeg?.distance?.value);
  let mode = (reqMode || 'DRIVING').toUpperCase();

  if (detectFerryFromSteps(dirLeg?.steps)) mode = 'FERRY';

  return {
    mode,
    seconds: Number.isFinite(seconds) ? seconds : null,
    durationMin: Number.isFinite(seconds) ? sec2min(seconds) : null,
    distanceKm: Number.isFinite(distM) ? (distM/1000) : null,
    durationText: dirLeg?.duration?.text || null,
    distanceText: dirLeg?.distance?.text || null,
    transfers: (dirLeg?.steps || []).filter(s => s.travel_mode === 'TRANSIT').length - 1,
    _meta: meta
  };
}

// ========== Directions 包裝（Promise 版） ==========
function routeOnce({origin, destination, mode}) {
  return new Promise(resolve => {
    directionsService.route({
      origin, destination, travelMode: google.maps.TravelMode[mode],
      // 可加 avoidFerries/avoidHighways 之類參數，這裡先不要
    }, (res, status) => {
      if (status === google.maps.DirectionsStatus.OK && res?.routes?.[0]?.legs?.[0]) {
        const leg0 = res.routes[0].legs[0];
        resolve({ok:true, dirLeg: leg0, res});
      } else {
        resolve({ok:false, status});
      }
    });
  });
}

// ========== 評分器：越小越好（時間為主、附帶懲罰） ==========
function scoreLeg(leg, straightMeters) {
  // 基準：分鐘
  const min = Number.isFinite(leg.durationMin) ? leg.durationMin : 9999;

  // 懲罰/獎勵（依你偏好調整）
  let penalty = 0;

  // 走路：超過 1.2 公里重罰；小於 700m 反而小獎勵
  if (leg.mode === 'WALKING') {
    if (straightMeters > 1200) penalty += 200;
    if (straightMeters < 700) penalty -= 20;
  }

  // 自行車：>10km 罰，<3km 小獎勵
  if (leg.mode === 'BICYCLING') {
    if (leg.distanceKm > 10) penalty += 40;
    if (leg.distanceKm < 3)  penalty -= 10;
  }

  // 大眾運輸：轉乘越多罰越多
  if (leg.mode === 'TRANSIT') penalty += Math.max(0, (leg.transfers||0))*15;

  // 渡輪：如果偵測到，給輕微獎勵，因為通常比繞路開車好
  if (leg.mode === 'FERRY') penalty -= 15;

  // 開車：如果直線穿海且距離不短，稍微罰（避免「藍線開車穿海」）
  if (leg.mode === 'DRIVING' && straightMeters > 3000 && leg._meta?.looksOverWater) {
    penalty += 50;
  }

  return min + penalty;
}

// ========== 粗略判斷是否「看起來跨海」 ==========
function looksOverWater(A, B) {
  // 沒有地理資料庫就做啟發式：距離>3km 且 中點在海面機率大（無可靠 API 時，只作“提示”）
  // 這裡僅做布林旗標供 score 使用；真正的「海上」會靠 detectFerryFromSteps 校正。
  const d = haversineMeters(A, B);
  return d > 3000 && (A.lat !== B.lat) && (A.lng !== B.lng);
}

// ========== 核心：挑選最佳模式 ==========
async function pickBestModeAndRoute(A, B) {
  const origin = A.position || A;
  const destination = B.position || B;
  const straight = haversineMeters(origin, destination);

  // 1) 極近距離：直接回傳 WALKING（無須打 API）
  if (straight < 250) {
    return {
      leg: {
        mode: 'WALKING',
        seconds: Math.round(straight/1.2), // 1.2 m/s 粗估
        durationMin: sec2min(straight/1.2),
        distanceKm: straight/1000,
        durationText: `約 ${sec2min(straight/1.2)} 分（步行）`
      },
      source: 'heuristic'
    };
  }

  // 2) 要嘗試的模式清單（按常見偏好順序）
  const tryModes = [];
  // 步行：<=1200m 才嘗試（避免多餘請求）
  if (straight <= 1200) tryModes.push('WALKING');
  // 開車通常最普遍
  tryModes.push('DRIVING');
  // 大眾運輸
  tryModes.push('TRANSIT');
  // 自行車（若你沒開 Bicycling，就拿掉）
  tryModes.push('BICYCLING');

  const looksWater = looksOverWater(origin, destination);

  // 3) 逐一嘗試，收集候選
  const candidates = [];
  for (const mode of tryModes) {
    const r = await routeOnce({origin, destination, mode});
    if (!r.ok) continue;
    const leg = normalizeDirLeg(r.dirLeg, mode, {looksOverWater: looksWater});
    candidates.push({mode, leg, res: r.res});
  }

  // 4) 沒有任何候選：遠距 or 真跨海 → FERRY / FLIGHT 估算
  if (!candidates.length) {
    // 距離>30km 且看起來跨海 → 優先給 FERRY（若地點像港口-離島）
    if (looksWater && straight > 30000) {
      const estMin = Math.round(straight/500); // 粗估：船 30km ≈ 60 分（~25-35kn），你可依地區調
      return {
        leg: {
          mode: 'FERRY',
          seconds: estMin*60,
          durationMin: estMin,
          distanceKm: straight/1000,
          durationText: `約 ${estMin} 分（船）`
        },
        source: 'estimate'
      };
    }
    // 超長距離：建議飛機
    if (straight > 120000) {
      const km = straight/1000;
      const estMin = Math.round((km/750)*60 + 90); // 750km/h + 90 分地面流程
      return {
        leg: {
          mode: 'FLIGHT',
          seconds: estMin*60,
          durationMin: estMin,
          distanceKm: km,
          durationText: `約 ${estMin} 分（飛機）`
        },
        source: 'estimate'
      };
    }
    // 仍無 → 回傳一個保底的 DRIVING 估算
    const estMin = sec2min(straight/13.9); // 50 km/h 粗估
    return {
      leg: {
        mode: 'DRIVING',
        seconds: estMin*60,
        durationMin: estMin,
        distanceKm: straight/1000,
        durationText: `約 ${estMin} 分（車）`
      },
      source: 'estimate'
    };
  }

  // 5) 有候選 → 用評分器挑最優
  let best = null, bestScore = Infinity;
  for (const c of candidates) {
    const s = scoreLeg(c.leg, straight);
    if (s < bestScore) { bestScore = s; best = c; }
  }

  return { leg: best.leg, source: 'directions' };
}

// 取 LatLngLiteral（容錯：支援 {lat,lng} 或 {position:{lat,lng}})
function _toLL(p){
  const o = p?.position ? p.position : p;
  const lat = Number(o?.lat), lng = Number(o?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return {lat, lng};
  return null;
}

async function routeLegSmart(A,B){
  try{
    // 先確保座標
    const a = A?.position || A, b = B?.position || B;
    if (!(a && b && typeof a.lat==='number' && typeof a.lng==='number' && typeof b.lat==='number' && typeof b.lng==='number')){
      B.leg = Object.assign(B.leg || {}, { mode:'SKIP' });
      return B.leg;
    }

    // 粗略距離做快速判斷
    const distKm = haversineKm(a, b);
    // 超長距離：推飛機（可視需求調整）
    const FLIGHT_THRESHOLD_KM = 450;

    // 1) 先試 TRANSIT（能抓到 ferry）
    let primaryResp = null, primaryStatus = null;
    try{
      primaryResp = await new Promise((resolve, reject)=>{
        directionsService.route({
          origin: a, destination: b, travelMode: google.maps.TravelMode.TRANSIT
        }, (r, status)=> (status==='OK'||status===google.maps.DirectionsStatus.OK) ? resolve(r) : reject(status));
      });
      primaryStatus = 'OK';
    }catch(e){ primaryStatus = String(e||''); }

    if (primaryResp){
      const m = inferModeFromDirectionsResponse(primaryResp) || 'TRANSIT';
      B.leg = Object.assign(B.leg || {}, {
        mode: m,
        // 你原本有的其他欄位可以保留/覆寫
      });
      return B.leg;
    }

    // 2) TRANSIT 不行 → 試 DRIVING
    let drivingResp = null, drivingStatus = null;
    try{
      drivingResp = await new Promise((resolve, reject)=>{
        directionsService.route({
          origin: a, destination: b, travelMode: google.maps.TravelMode.DRIVING
        }, (r, status)=> (status==='OK'||status===google.maps.DirectionsStatus.OK) ? resolve(r) : reject(status));
      });
      drivingStatus = 'OK';
    }catch(e){ drivingStatus = String(e||''); }

    if (drivingResp){
      // 即便是 DRIVING，也可能包含 ferry（instructions 會出現 ferry 字樣）
      const m = inferModeFromDirectionsResponse(drivingResp) || 'DRIVING';
      B.leg = Object.assign(B.leg || {}, { mode: m });
      return B.leg;
    }

    // 3) 若兩種都不行：以距離推論（跨海近距離 → FERRY；超長距離 → FLIGHT；否則 MANUAL）
    if (distKm >= FLIGHT_THRESHOLD_KM){
      B.leg = Object.assign(B.leg || {}, { mode:'FLIGHT' });
      return B.leg;
    }

    // 近距離但 Directions 無法給路徑（多半隔水域） → FERRY 優先
    if (distKm >= 2){  // 2km 以上才有意義
      B.leg = Object.assign(B.leg || {}, { mode:'FERRY' });
      return B.leg;
    }

    // 其他 fallback
    B.leg = Object.assign(B.leg || {}, { mode:'MANUAL' });
    return B.leg;

  }catch(e){
    console.warn('[routeLegSmart] failed', e);
    B.leg = Object.assign(B.leg || {}, { mode:'MANUAL' });
    return B.leg;
  }
}

function gmReady(){
  return !!(window.google && google.maps && window.map && window.directionsService && typeof window.directionsService.route === 'function');
}

normalizeStopsInPlace(stops);      // 你原本那個（修 lat/lng）
normalizeStopsDeepInPlace(stops);  // 新增（修 legs/估時）

// 舊名 → 導向新函式（避免舊呼叫壞掉）
window.recomputeRoute      = (...a)=> recomputeRouteSmart(...a);
window.recomputeRouteFast  = (...a)=> recomputeRouteSmart(...a);
window.computeRoute        = (...a)=> recomputeRouteSmart(...a);
window.computeRouteBetweenStops = (...a)=> recomputeRouteSmart(...a);


/* ==========================
 * 載入 GPT 推薦行程
 * =========================*/
async function loadRecommendedPlan(plan){
  clearAll();

  plan.forEach((p)=>{
    const item = { 
      id: crypto.randomUUID(), 
      placeId: null, 
      name: p.name, 
      position: p.position, 
      rating: null, 
      userRatingsTotal: null, 
      photoUrl: placeholderImage(), 
      badges: [] 
    };
    addStop(item, { kind:'plan' });
  });

  // 標記海上、碼頭等特殊地點
  if (typeof markSpecialStops === 'function') markSpecialStops(stops);

  // 耐錯路線重算（跨海自動⛴️）
  if (typeof recomputeRouteSmart === 'function') whenMapsReady(()=> recomputeRouteSmart()?.catch?.(console.warn));

  // 最後再自動縮放地圖
  fitToRoute();
}

function fromPlaceToItem(place){
  return {
    id: 'suggest-'+(place.place_id||Math.random()),
    placeId: place.place_id||null,
    name: place.name,
    position: { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() },
    rating: place.rating||null,
    userRatingsTotal: place.user_ratings_total||null,
    photoUrl: (place.photos&&place.photos[0])? place.photos[0].getUrl({maxWidth:800,maxHeight:600}) : placeholderImage(),
    badges: inferBadgesFromTypes(place.types||[]),
  };
}

// 小工具：簡單的 debounce
function debounce(fn, wait){
  let t=null; return function(){ clearTimeout(t); t=setTimeout(fn, wait); };
}


document.addEventListener('DOMContentLoaded', () => {
  loadMyTripList();
  document.getElementById('btn-load-trip')?.addEventListener('click', () => {
    const id = document.getElementById('trip-select').value;
    if (id) loadTrip(id, { base: API_BASE });
  });
});

// === 5) 綁定「存到資料庫」按鈕（只綁一次） ===
(function bindSaveBtn(){
  const btn = document.getElementById('btnSaveDb');
  if (!btn || btn.dataset.bound) return;
  btn.dataset.bound = '1';
  btn.addEventListener('click', saveOrUpdateUserTrip);
})();

async function fetchAiLegs(stopsArg = null, prefs = {}, day = (window.currentDay || 1)) {
  // ➊ 若沒傳 stops，從當天時間軸自動取，用有效座標
  const todays = (Array.isArray(stopsArg) && stopsArg.length)
    ? stopsArg
    : (getStopsOfDay ? getStopsOfDay(day) : (window.stops || []).filter(s => (s.day ?? 1) === getCurrentDay()))
        .filter(s => isValidPos(s.position))
        .map(s => ({ name: s.name, lat: s.position.lat, lng: s.position.lng }));

  if (todays.length < 2) {
    console.warn('[ai/legs] not enough stops for day', day, todays);
    return { ok: true, legs: [] };
  }

  // （可觀察用）把實際送出的 payload 印出來
  console.log('[ai/legs] payload stops =', todays);

  const res = await fetch(apiUrl('ai/legs'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(authHeaders?.() || {}) },
    body: JSON.stringify({ stops: todays, prefs, day })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ai/legs HTTP ${res.status}: ${text}`);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : { ok: true, legs: [] };
}

// 讀後端 user_trip（含 notes / itinerary）→ 建立 stops + 時間軸
async function loadUserTripFromNotes(id){
  const res = await fetch(apiUrl('user_trips/' + encodeURIComponent(id)), {
    headers: authHeaders(),
    credentials: 'include',
    cache: 'no-store'
  });
  const data = await res.json();
  if (!res.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${res.status}`);

  const trip = data.trip || data;

  // ---------- 解析 stops：notes.days 優先，沒有才退回 ----------

  let rawPoints = [];
  let notesObj = null;

  // 先解析 notes
  if (trip?.notes) {
    notesObj = trip.notes;
    try { if (typeof notesObj === 'string') notesObj = JSON.parse(notesObj); } catch {}
  }

  // A) 優先：notes.days（含 day / seq / leg / stayMin）
  if (Array.isArray(notesObj?.days) && notesObj.days.some(d => Array.isArray(d.items) && d.items.length)) {
    notesObj.days.forEach((d, i) => {
      const dayNum = Number(d.day ?? i + 1);
      (Array.isArray(d.items) ? d.items : []).forEach((it, j) => {
        rawPoints.push({
          ...it,
          day: Number(it.day ?? dayNum) || dayNum,
          seq: Number(it.seq ?? j + 1) || (j + 1)
        });
      });
    });
  }

  // B) 其次：user_trip_points（若有 meta_json，把 day/seq/leg 補回）
  if (!rawPoints.length && Array.isArray(data.points)) {
    rawPoints = data.points.map((p, i) => {
      let meta = {};
      try { meta = typeof p.meta_json === 'string' ? JSON.parse(p.meta_json) : (p.meta_json || {}); } catch {}
      return {
        name: p.name,
        lat:  Number(p.lat), lng: Number(p.lng),
        day:  Number(p.day ?? meta.day ?? 1),
        seq:  Number(p.seq ?? meta.seq ?? i + 1),
        leg:  meta.leg ?? null,
        stayMin: (typeof meta.stayMin === 'number') ? meta.stayMin : null,
        placeId: p.place_id ?? null
      };
    });
  }

  // C) 再退：notes.points / notes.stops（較簡單的備援）
  if (!rawPoints.length && notesObj) {
    rawPoints = Array.isArray(notesObj.points) ? notesObj.points
              : Array.isArray(notesObj.stops)  ? notesObj.stops
              : [];
  }

  // D) 最後：itinerary（若存在）
  if (!rawPoints.length && trip?.itinerary) {
    let itin = trip.itinerary;
    try { if (typeof itin === 'string') itin = JSON.parse(itin); } catch {}
    if (itin?.days?.length) {
      itin.days.forEach((d, i) => {
        const dayNum = Number(d.day ?? i + 1);
        (Array.isArray(d.items) ? d.items : []).forEach((p, j) => {
          rawPoints.push({
            ...p,
            day: Number(p.day ?? dayNum) || dayNum,
            seq: Number(p.seq ?? j + 1) || (j + 1)
          });
        });
      });
    } else if (Array.isArray(itin?.items)) {
      rawPoints = itin.items;
    } else if (Array.isArray(itin)) {
      rawPoints = itin;
    }
  }
  if (!rawPoints.length) throw new Error('此行程沒有地點');
  
  // ---------- 轉成前端 stops 結構 ----------
  const plan = rawPoints.map((p, idx) => {
    ensurePlaceIdBoth(p); // 🆕 先把來源 p 的 placeId / place_id 補齊

    const s = normalizeStop({
      id: p.id || p._id || p.pid || (crypto.randomUUID && crypto.randomUUID()) || ('s_' + Math.random().toString(36).slice(2)),
      placeId: p.placeId || p.place_id || null,
      name: p.name || p.title || '未命名地點',
      position: {
        lat: Number(p.position?.lat ?? p.lat),
        lng: Number(p.position?.lng ?? p.lng)
      },
      day: Number(p.day ?? 1),
      seq: Number(p.seq ?? (idx + 1)),
      rating: (typeof p.rating === 'number') ? p.rating : null,
      userRatingsTotal: (typeof p.userRatingsTotal === 'number') ? p.userRatingsTotal : null,
      photoUrl: p.photoUrl || placeholderImage?.(),
      badges: Array.isArray(p.badges) ? p.badges : [],
      stayMin: (typeof p.stayMin === 'number') ? p.stayMin : (typeof p.stay_min === 'number' ? p.stay_min : defaultStayMinutesFromItem?.(p)),
      leg: p.leg || null
    });

    ensurePlaceIdBoth(s); // 🆕 產出的 stop 也補一次（確保前端一致）
    return s;
  });

  // ---------- 清空畫面並載入 ----------
  clearAll();
  if (typeof loadRecommendedPlan === 'function') {
    loadRecommendedPlan(plan);
  } else {
    plan.forEach(s => addStop(s, { kind: 'plan' }));
  }

  // ---------- 建 allStopsByDay，顯示當天 ----------
  if (typeof rebuildAllStopsByDay === 'function') rebuildAllStopsByDay();

  // 取最小的 day 當起始；若網址指定 day 可用你的參數覆蓋
  const firstDay = Math.min(...plan.map(s => Number(s.day || 1)));
  if (typeof setDay === 'function') setDay(firstDay || 1);

  // 重新貼標 A/B/C… 並更新 marker 標籤
  if (typeof relabelStops === 'function') relabelStops();
  (window.stops || []).forEach(s => { try { updateMarkerLabel && updateMarkerLabel(s); } catch {} });

  // 左欄重畫
  try { renderList && renderList(); } catch {}
  try { renderTimeline && renderTimeline(); } catch {}

  fixMissingPlaceIdsAuto({ maxFix: 8, perDelay: 220 });

  // （可選）除錯看看 Day2 是否有資料
  console.debug('[user_trip loaded] stops=', window.stops?.length, 'byDay=', window.allStopsByDay);

  if (typeof debouncedSuggest === 'function') debouncedSuggest();
}

// 將 stops 內的 lat/lng 正規化，避免後面 NaN
function normalizeStopsInPlace(arr){
  (arr || []).forEach(s => {
    const ll = getStopLatLng(s);
    if (ll){
      s.lat = ll.lat;
      s.lng = ll.lng;
      s.location = { lat: ll.lat, lng: ll.lng }; // 讓 Places/Nearby 也可直接用
    }else{
      // 若無效，至少標記一下，後面就跳過此點的路線/搜尋
      s._invalidLL = true;
    }
  });
}

// ==== PATCH-2: 深層正規化（修 legs、估時） ====
// notes → stops 後立刻呼叫
function normalizeStopsDeepInPlace(stops){
  if (!Array.isArray(stops)) return;

  // 依天分組、排序、補序號；清 UI-only 欄位
  const byDay = new Map();
  stops.forEach(s=>{
    s.day = Number.isFinite(+s.day) ? +s.day : 1;
    if (!byDay.has(s.day)) byDay.set(s.day, []);
    byDay.get(s.day).push(s);

    if (!s.leg || typeof s.leg !== 'object') s.leg = {};
    if ('label'        in s.leg) delete s.leg.label;        // 移除純 UI
    if ('durationText' in s.leg) delete s.leg.durationText; // 移除純 UI
  });
  for (const [day, arr] of byDay){
    arr.sort((a,b)=> (a.seq ?? 9999) - (b.seq ?? 9999));
    arr.forEach((s,i)=> s._seqInDay = i + 1);
  }

  // 逐段修復
  for (const s of stops){
    // 確保 position
    const lat = Number(s?.position?.lat ?? s?.lat);
    const lng = Number(s?.position?.lng ?? s?.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)){
      s.position = { lat, lng };
      s.lat = lat; s.lng = lng;
    }else{
      s._invalidLL = true;
      continue;
    }

    const M = String(s.leg.mode || '').toUpperCase();
    const prev = byDay.get(s.day)?.find(x => x._seqInDay === (s._seqInDay - 1)) || null;

    // 粗估距離
    let dKm = 0;
    if (prev && prev.position){
      dKm = Math.round(haversineKm(prev.position, s.position) * 10) / 10;
      if (!Number.isFinite(dKm)) dKm = 0;
    }

    const isManualLike = ['FLIGHT','TRAIN','BUS','FERRY','MANUAL'].includes(M);
    const lackNumbers  = (s.leg.manualDurationMin == null || s.leg.manualDistanceKm == null);

    // 人工/航運但缺數值 → 立即估值
    if (isManualLike && lackNumbers){
      const cruise = guessCruiseKmh(M);
      const buf    = guessBufferMin(M);
      const vKm    = (s.leg.manualDistanceKm == null) ? dKm : Number(s.leg.manualDistanceKm);
      s.leg.manualDistanceKm = Number.isFinite(vKm) ? vKm : 0;

      if (s.leg.manualDurationMin == null){
        const mins = Math.max(1, Math.round((s.leg.manualDistanceKm / cruise) * 60) + buf);
        s.leg.manualDurationMin = Number.isFinite(mins) ? mins : 1;
      }
    }

    // 若仍完全沒有可用時間 → 交回 Directions
    if (isManualLike &&
        s.leg.manualDurationMin == null &&
        s.leg.seconds == null){
      s.leg.mode = null;
    }

    // departAt 若是 "HH:MM" 字串 → Date
    if (typeof s.leg.departAt === 'string' && /^\d{2}:\d{2}/.test(s.leg.departAt)){
      s.leg.departAt = new Date(`1970-01-01T${s.leg.departAt}:00`);
    }
  }
}

// 只綁一次
(function bindAiBtn(){
  const btn = document.getElementById('btnAiLegs');
  if (!btn || btn.dataset.bound) return;
  btn.dataset.bound = '1';

  // 固定英文標籤，避免被其他程式或瀏覽器翻譯
  btn.setAttribute('translate', 'no');
  btn.dataset.labelEn = btn.dataset.labelEn || (btn.textContent || 'AI Plan Transport');
  btn.dataset.busyEn  = btn.dataset.busyEn  || 'Planning…';

  try {
    const g = typeof nowMap === 'function' ? nowMap() : null;
    if (g && typeof g.getZoom === 'function' && typeof MINZ !== 'undefined' && g.getZoom() < MINZ) {
      g.setZoom(MINZ);
    }
  } catch(_) {}

  btn.addEventListener('click', async () => {
    try{
      btn.disabled = true;
      btn.textContent = btn.dataset.busyEn;       
      const plan = await fetchAiLegs();
      await applyAiLegsFromServer(plan);
      btn.textContent = btn.dataset.labelEn;      
    }catch(err){
      console.error(err);
      alert('AI planning failed: ' + (err?.message || err));
      btn.textContent = btn.dataset.labelEn;      
    }finally{
      btn.disabled = false;
    }
  });
})();

(function bindTimeline(){
  const input = document.getElementById('tl-start');
  if (!input) return;

  async function refresh(){
    const startAt = timeInputToDate(input.value);
    const plan = await buildDayTimelinePlan(currentDay, startAt);
    renderTimeline(plan);
  }

  input.addEventListener('change', refresh);

  // 首次載入
  refresh();

  const _recompute = window.recomputeRouteSmart;
  window.recomputeRouteSmart = async function(){
    await (_recompute?.apply(this, arguments));
    const startAt = timeInputToDate(document.getElementById('tl-start')?.value || '');
    const plan = await buildDayTimelinePlan(currentDay, startAt);
    renderTimeline(plan);
  };
})();

// === 讓「切換 Day、增刪排」都會刷新時間軸（不改原函式，統一包裝） ===
(function autoRefreshTimelineHooks(){
  // 小工具：安全包裝指定函式，執行原本邏輯後追加 refreshTimeline()
  function after(name){
    const fn = window[name];
    if (typeof fn !== 'function') return;   // 沒有就略過，不會報錯
    window[name] = function(){
      const out = fn.apply(this, arguments);
      try { refreshTimeline(); } catch(e){ console.warn('refreshTimeline failed after', name, e); }
      return out;
    };
  }

  // 你程式裡常見會「改變當天內容」的函式名
  // 有就包；沒有就自動略過
  [
    'setDay',          // 切換 Day
    'addStop',         // 新增點
    'removeStop',      // 刪除點
    'moveStop',        // 重新排序（A/B/C/D）
    'clearAll',        // 清空
  ].forEach(after);

  // 路線重算完成後也刷新一次（避免只改交通模式時沒更新時間軸）
  (function wrapRecompute(){
    const fn = window.recomputeRouteSmart || window.recomputeRoute || null;
    if (!fn) return;
    const name = window.recomputeRouteSmart ? 'recomputeRouteSmart' : 'recomputeRoute';
    window[name] = async function(){
      const out = await fn.apply(this, arguments);
      try { await refreshTimeline(); } catch(e){ console.warn('refreshTimeline failed after', name, e); }
      return out;
    };
  })();

  // 進頁面先渲染一次時間軸
  try { refreshTimeline(); } catch(e){}
})();


/* ===== TIMELINE TRANSPORT COMPAT PATCH (2025-10-31) =====
   Ensure routeLegSmart accepts stop objects ({position:{lat,lng}}) or LatLngLiteral.
   It normalizes inputs, then delegates to the latest underlying lat/lng-based implementation.
*/
(function(){
  try{
    if (!Array.isArray(window.SEG_dirRenderers)) window.SEG_dirRenderers = [];
    const _orig = window.routeLegSmart || (typeof routeLegSmart === 'function' ? routeLegSmart : null);
    window.routeLegSmart = async function(A,B){
      // Normalize to LatLngLiteral
      const pick = (x)=> (x && (x.position || x.location || x)) || null;
      const a0 = pick(A), b0 = pick(B);
      const toLL = (p)=> {
        if (!p) return null;
        if (typeof p.lat === 'number' && typeof p.lng === 'number') return { lat:Number(p.lat), lng:Number(p.lng) };
        if (typeof toLatLngLiteral === 'function') return toLatLngLiteral(p);
        return null;
      };
      const a = toLL(a0), b = toLL(b0);
      if (!_orig || !a || !b){
        // Fallback: simple estimate
        const d = (typeof haversineKm === 'function' && a && b) ? haversineKm(a,b) : 0;
        const mins = Math.round((d/40)*60);
        return { mode:'MANUAL', distanceKm:d, durationMin:mins, note:'compat-fallback' };
      }
      return await _orig(a,b);
    };
  }catch(e){ console.warn('[compat routeLegSmart] patch failed', e); }
})();

function getSegRenderer(idx, opts={}) {
  // 若已存在就拿現成的，否則新建
  let r = window.SEG_dirRenderers[idx];
  if (!r) {
    r = new google.maps.DirectionsRenderer(Object.assign({
      map: nowMap(),
      preserveViewport: true,
      suppressMarkers: true,
      polylineOptions: { strokeOpacity: 0.95, strokeWeight: 5 }
    }, opts));
    window.SEG_dirRenderers[idx] = r;
  }
  return r;
}

function clearSegRenderers() {
  (window.SEG_dirRenderers || []).forEach(r => {
    try { r.set('directions', null); r.setMap(null); } catch(_) {}
  });
  window.SEG_dirRenderers.length = 0;
}

/* ================================================
 * TrailSeeker — Hover Card + Recommended (Unified v5)
 * - ⭐ only, invisible hitbox, stable hover card
 * - TextSearch (keyword) + NearbySearch(types) merge
 * - No modern operators (no ||=, no ??, no catch {})
 * ================================================ */
(function(){
  /* ---------- tiny utils & boot ---------- */
  function isFn(f){ return typeof f === 'function'; }
  function g(p){ return (p instanceof google.maps.LatLng) ? p : new google.maps.LatLng(p); }
  function byId(id){ return document.getElementById(id); }

  if (!Array.isArray(window._mapsReadyQueue)) window._mapsReadyQueue = [];
  if (typeof window.MAP_READY !== 'boolean') window.MAP_READY = false;

  if (typeof window.whenMapsReady !== 'function') {
    window.whenMapsReady = function(cb){
      if (window.MAP_READY && window.map && window.placesService) {
        try { cb && cb(); } catch(e){ console.warn(e); }
      } else {
        window._mapsReadyQueue.push(cb);
      }
    };  
  }

  if (!isFn(window.whenMapsReady)) {
    window.whenMapsReady = function(cb){
      if (window.MAP_READY && window.map && window.placesService) {
        try { cb && cb(); } catch(e){ console.warn(e); }
      } else {
        window._mapsReadyQueue.push(cb);
      }
    };
  }
  if (!isFn(window._signalMapReady)) {
    window._signalMapReady = function(){
      window.MAP_READY = true;
      var q = window._mapsReadyQueue || [];
      while(q.length){
        var fn = q.shift();
        try { fn && fn(); } catch(e){ console.warn('[whenMapsReady cb]', e); }
      }
    };
  }

  function ensureOverlay() {
    // 還沒載好就先不要碰 google，等地圖好再執行
    if (!(window.google && google.maps && google.maps.OverlayView)) return null;

    if (!window.overlayView) {
      const ov = new google.maps.OverlayView();
      ov.onAdd = function() {};
      ov.draw = function() {};
      ov.onRemove = function() {};
      // 這裡 map 也可能尚未 set 成功，容錯一下
      const mm = nowMap();
      if (isGMap(mm)) { try { ov.setMap(mm); } catch(_) {} }
      window.overlayView = ov;
    }
    return window.overlayView;
  }

  // 任何會動到 google.maps 的初始化，都包在 whenMapsReady 裡
  whenMapsReady(() => {
    try {
      // 只有在 google 載好後才呼叫
      ensureOverlay();
      patchSetMapGuardOnce && patchSetMapGuardOnce();
      patchDirectionsRouteGlobal && patchDirectionsRouteGlobal();
      ensureServices && ensureServices();
    } catch (e) { console.warn('[init-after-ready] failed', e); }
  });


  /* ---------- Hover Card (stable wrapper) ---------- */
  var _origShowHover = isFn(window.showHoverCard) ? window.showHoverCard : null;
  var $card = function(){ return byId('hover-card'); };

  window.hoverHideTimer && clearTimeout(window.hoverHideTimer);
  window.hoverHideTimer = null;

  window.hideHoverCard = function(ms, opt){
    ms = (typeof ms === 'number') ? ms : 0;
    opt = opt || {};
    var force = !!opt.force;
    var el = $card(); 
    if (!el) return;

    // 避免剛顯示就收掉
    if (!force && window.__hcShownAt && (Date.now() - window.__hcShownAt) < 120) return;

    // sticky 與 hover 中不收
    if (!force && el.dataset?.sticky === '1') return;
    if (!force && el.dataset?.hover  === '1') return;

    // 每次 hide 前一定清掉舊的 timer（避免殘留 timer 在下一輪亂關卡片）
    if (window.hoverHideTimer) {
      clearTimeout(window.hoverHideTimer);
      window.hoverHideTimer = null;
    }

    var doHide = function(){
      var c = $card(); 
      if (!c) return;
      c.style.opacity = 0;
      c.style.display = 'none';
    };

    window.hoverHideTimer = (ms > 0)
      ? setTimeout(doHide, ms)
      : (doHide(), null);
  };

  window.showHoverCard = function(item, opts){
    opts = opts || {};

    // 🧩 清掉上一輪的 hide timer
    if (window.hoverHideTimer) {
      clearTimeout(window.hoverHideTimer);
      window.hoverHideTimer = null;
    }
    var el = $card(); if (!el) return;
    
    // === 正規化 place 對象，避免 ReferenceError ===
    const place = (item && item.details) ? item.details : (item || {});

    // 改成掛在 body 上，避免被地圖容器裁切高度
    try{
      if (el.parentNode !== document.body) {
        document.body.appendChild(el);
      }
    }catch(_){}

    // 填內容（沿用你的欄位 id）
    
    var $ = function(id){ return byId(id); };
    if ($('hc-name')) $('hc-name').textContent = place.name || item?.name || item?.title || 'Place';
    const rating = (typeof place.rating === 'number') ? place.rating
                  : (typeof item?.rating === 'number' ? item.rating : null);
    const urt = (typeof place.user_ratings_total === 'number') ? place.user_ratings_total
                : (typeof item?.userRatingsTotal === 'number' ? item.userRatingsTotal : null);

    if ($('hc-rating')) $('hc-rating').textContent = (rating != null) ? ('★ ' + Math.round(rating*10)/10) : '★ N/A';
    if ($('hc-user'))   $('hc-user').textContent   = (urt != null) ? ('(' + urt + ')') : '';
    if ($('hc-addr')) $('hc-addr').textContent =
       place.formatted_address || place.vicinity || item?.address || '';

    // 1) 圖片
    (function(){
      const imgEl =
        document.getElementById('hc-photo') ||
        document.querySelector('.hc-photo, #hc-img, .hover-photo');
      if (!imgEl) return;

      // 來源優先序：
      // 1) item.photoUrl（多半是 ensurePlaceDetails / 其他地方已經挑好的）
      // 2) 如果沒有，就從 details.photos 裡挑一張「最佳照片」
      let url = (item && item.photoUrl) ||
                pickBestPhotoUrlFromDetails(item && item.details) ||
                null;

      // Street View 當作最後備援（若你沒有暴露 API key，就略過這段）
      if (!url && item.position && typeof item.position.lat === 'number') {
        const lat = item.position.lat, lng = item.position.lng;
        url = `https://maps.googleapis.com/maps/api/streetview?size=640x360&location=${lat},${lng}&key=YOUR_API_KEY`;
      }

      if (url) {
        imgEl.src = url;
        imgEl.alt = item.name || item.details?.name || 'Photo';
        imgEl.style.display = '';
      } else {
        // 沒圖就隱藏圖片容器，避免空白區
        imgEl.style.display = 'none';
      }
    })();

    // 2) 簡介（editorial summary / overview）
    (function(){
      const descEl =
        document.getElementById('hc-summary') ||
        document.getElementById('hc-desc') ||
        document.querySelector('.hc-summary, .hc-desc');
      if (!descEl) return;

      const summary =
        item.overview ||
        (typeof item.details?.editorial_summary === 'object'
          ? item.details.editorial_summary.overview
          : (item.details?.editorial_summary || ''));
      if (summary) {
        descEl.textContent = String(summary);
        descEl.style.display = '';
      } else {
        // 沒有官方簡介時，可退而顯示 types/keyword 或直接收起
        const types = item.details?.types;
        if (Array.isArray(types) && types.length) {
          descEl.textContent = `Type: ${types[0].replaceAll('_',' ')}`;
          descEl.style.display = '';
        } else {
          descEl.style.display = 'none';
        }
      }
    })();

    // === 顯示 Keyword/Type 與 推薦理由（安全版） ===
    try {
      // 1) 取插槽（若沒有就動態建立，插在地址下面）
      var tagEl    = document.getElementById('hc-reco-tag');
      var reasonEl = document.getElementById('hc-reco-reason');

      function ensureSlot(id){
        var x = document.getElementById(id);
        if (!x) {
          x = document.createElement('div');
          x.id = id;
          x.style.cssText = 'font-size:12px;color:#555;margin-top:4px;';
          var addrEl = document.getElementById('hc-addr');
          (addrEl && addrEl.parentElement ? addrEl.parentElement : el).appendChild(x);
        }
        return x;
      }
      tagEl    = tagEl    || ensureSlot('hc-reco-tag');
      reasonEl = reasonEl || ensureSlot('hc-reco-reason');

      // 2) 從多個來源嘗試讀 reco
      var reco = (item && item.__reco)
              || (item && item.marker && item.marker.__reco)
              || (item && item.details && item.details.__reco)
              || null;

      // 3) 寫入內容（沒有就清空）
      tagEl.textContent    = (reco && reco.tag)    ? ('Keyword/Type：' + reco.tag) : '';
      reasonEl.textContent = (reco && reco.reason) ?  reco.reason                   : '';
    } catch (e) {
      console.debug('[hover/reco] skip', e);
    }

    // 位置：水平盡量靠近 marker，垂直放在「地圖中間」
    var anchor = opts.anchor 
                || (place && place.geometry && place.geometry.location) 
                || ((item && item.position) ? new google.maps.LatLng(item.position) : null);

    (function placeCardClamped(){
      var margin = 16;
      var vw = window.innerWidth  || document.documentElement.clientWidth  || 1024;
      var vh = window.innerHeight || document.documentElement.clientHeight || 768;

      if (!el.style.width) el.style.width = '340px';

      // 先暫時顯示，量寬高
      el.style.position   = 'fixed';
      el.style.display    = 'block';
      el.style.visibility = 'hidden';

      var w = el.offsetWidth  || 340;
      var h = el.offsetHeight || 260;

      // 以「地圖容器」為基準
      var mapDiv = (window.map && window.map.getDiv) ? window.map.getDiv() : null;
      var rect   = mapDiv ? mapDiv.getBoundingClientRect() : { left:0, top:0, right:vw, bottom:vh };

      var mapLeft   = rect.left;
      var mapTop    = rect.top;
      var mapRight  = rect.right;
      var mapBottom = rect.bottom;
      var mapWidth  = mapRight  - mapLeft;
      var mapHeight = mapBottom - mapTop;

      // 預設：先放在地圖中間（居中）
      var left = mapLeft + (mapWidth  - w) / 2;
      var top  = mapTop  + mapHeight * 0.15;

      // 有 anchor 的話，用 anchor 的 X 來靠近 marker 右邊（高度保持在中間）
      if (anchor && window.overlayView && typeof window.overlayView.getProjection === 'function') {
        try{
          var proj = window.overlayView.getProjection();
          var pt   = proj && proj.fromLatLngToDivPixel(anchor);
          if (pt) {
            left = mapLeft + pt.x + 16;   // X 跟著 marker 走
          }
        }catch(e){}
      }

      // ---- 在「地圖範圍」內夾緊，避免跑出去 ----
      if (left < mapLeft + margin) left = mapLeft + margin;
      if (left + w > mapRight - margin) left = mapRight - w - margin;

      if (top < mapTop + margin) top = mapTop + margin;
      if (top + h > mapBottom - margin) top = mapBottom - h - margin;

      el.style.left       = Math.round(left) + 'px';
      el.style.top        = Math.round(top)  + 'px';
      el.style.visibility = 'visible';
    })();


    // === 照片處理（安全版） ===
    (function setHoverPhoto(){
      var img  = byId('hc-img');
      var wrap = byId('hc-photo-wrap'); // 若沒有這個容器就忽略 class 操作
      if (!img) return;

      // 1) 從 details 或 item.photos 取第一張
      var ph = (item && item.details && Array.isArray(item.details.photos) && item.details.photos[0])
            || (item && Array.isArray(item.photos) && item.photos[0])
            || null;

      // 2) 能 getUrl() 就拿正式 URL；否則就當作沒有圖片
      var url = null;
      try {
        if (ph && typeof ph.getUrl === 'function') {
          // 依你卡片尺寸取一個合理大小，避免超大： 
          url = ph.getUrl({ maxWidth: 640, maxHeight: 400 });
        }
      } catch(_) {}

      if (url) {
          console.debug('[photo]', {
          hasImgEl: !!img,
          detailsPhotos: item?.details?.photos?.length || 0,
          urlPreview: url ? url.slice(0,80) + '…' : null
        });

        // 有圖 → 設 src 並移除 no-photo 樣式
        img.src = url;
        if (wrap && wrap.classList) wrap.classList.remove('no-photo');
        // 若你之前有把 img 設為 hidden / display:none，可一併移除
        img.removeAttribute('hidden');
        img.style.display = ''; // 交給 CSS
      } else {
        // 沒圖 → 移除 src 讓 CSS 規則自動隱藏 <img>，並套 no-photo 背景
        img.removeAttribute('src');     // 關鍵：讓規則 #hc-img:not([src]) 生效
        if (wrap && wrap.classList) wrap.classList.add('no-photo');
      }
    })();


    // 顯示
    el.style.display = 'block';
    el.style.opacity = 1;
    el.style.visibility = 'visible';
    el.style.zIndex = '999999';

    window.__hcShownAt = Date.now();
    if (opts.pin && el.dataset) el.dataset.sticky = '1';
    window.__lastHoverItem = item;

    if (_origShowHover) { try { _origShowHover.apply(this, arguments); } catch(e){ console.warn(e); } }
  };

  (function bindCardHover(){
    var el = $card();
    if (!el || el.dataset.bound) return;
    el.dataset.bound = '1';
    el.addEventListener('mouseenter', function(){
      var c = $card(); if (!c) return;
      c.dataset.hover = '1';
      clearTimeout(window.hoverHideTimer);
    });
    el.addEventListener('mouseleave', function(){
      var c = $card(); if (!c) return;
      c.dataset.hover = '0';
      if (c.dataset.sticky !== '1') window.hideHoverCard(180);
    });
  })();

  /* ---------- Stars (emoji) + hitbox ---------- */
  function suggestionMarkerStyleByType(types){
    return {
      icon: {
        path: google.maps.SymbolPath.CIRCLE, // 透明圈只當 hitbox
        scale: 12,
        fillOpacity: 0,
        strokeWeight: 0,
        labelOrigin: new google.maps.Point(0, 0),
        anchor: new google.maps.Point(0, 0)
      },
      label: { text: '⭐', fontSize: '20px' }
    };
  }

  function makeStarMarker(place, tagTypes){
    tagTypes = tagTypes || [];
    var pos = place && place.geometry && place.geometry.location;
    if (!pos) return null;

    var sty = suggestionMarkerStyleByType(tagTypes);
    var m = new google.maps.Marker({
      position: pos,
      map: window.map,
      title: place.name || 'Suggested',
      icon: sty.icon,
      label: sty.label,
      clickable: true,
      optimized: false,
      zIndex: 100
    });
    m.__types = tagTypes.slice();
    place.__types = tagTypes.slice();

    // hover / click
    m.addListener('mouseover', function(){ try { window.showHoverCard(place, { anchor: pos }); } catch(_){ } });
    m.addListener('mouseout',  function(){ try { window.hideHoverCard(200); } catch(_){ } });
    m.addListener('click',     function(){
      try{
        var el = $card();
        var pin = !(el && el.dataset && el.dataset.sticky === '1');
        if (pin && el) el.dataset.sticky = '1';
        window.showHoverCard(place, { anchor: pos, pin: true });
      }catch(_){}
    });

    if (!Array.isArray(window.suggestionMarkers)) window.suggestionMarkers = [];
    window.suggestionMarkers.push({ place: place, marker: m });
    return m;
  }

  /* ---------- Places wrappers ---------- */
  function nearbySearchSafe(req){
    return new Promise(function(resolve){
      if (!window.placesService) return resolve([]);
      window.placesService.nearbySearch(req, function(arr, status){
        var ok = (status === google.maps.places.PlacesServiceStatus.OK);
        resolve(ok ? (arr || []) : []);
      });
    });
  }
  function textSearchSafe(req){
    return new Promise(function(resolve){
      if (!window.placesService) return resolve([]);
      window.placesService.textSearch(req, function(arr, status){
        var ok = (status === google.maps.places.PlacesServiceStatus.OK);
        resolve(ok ? (arr || []) : []);
      });
    });
  }

  /* ---------- clear & visibility ---------- */
  function clearSuggestions(){
    try {
      (window.suggestionMarkers || []).forEach(function(o){ o.marker && o.marker.setMap(null); });
      if (Array.isArray(window.suggestionMarkers)) window.suggestionMarkers.length = 0;
    } catch(_){}
    console.debug('[suggest] cleared.');
  }
  window.clearSuggestions = clearSuggestions;

  try {
    var mp = nowMap();
  } catch(_){}

  window.__forceShowSuggestions = function(on){
    on = (on !== false);
    var list = window.suggestionMarkers || [];
    for (var i=0;i<list.length;i++){
      try{
        var mk = list[i].marker;
        if (!mk) continue;
        mk.setVisible(on);
        if (on && !mk.getMap()) mk.setMap(window.map);
      }catch(_){}
    }
    console.debug('[suggest] force visible =', !!on, 'count=', list.length);
  };

  // 預設品質門檻（可依需求調整）：
  window.SUGGEST_MIN_RATING  = window.SUGGEST_MIN_RATING  ?? 3.8; // 最低星等
  window.SUGGEST_MIN_REVIEWS = window.SUGGEST_MIN_REVIEWS ?? 10;  // 最少評論數

  function passesQuality(p, opts){
    opts = opts || {};
    const minR = typeof opts.minRating  === 'number' ? opts.minRating  : (window.SUGGEST_MIN_RATING  || 0);
    const minN = typeof opts.minReviews === 'number' ? opts.minReviews : (window.SUGGEST_MIN_REVIEWS || 0);
    const r = Number(p.rating);
    const n = Number(p.user_ratings_total || p.userRatingsTotal);
    // 沒有 rating（= N/A）直接剔除；或星等/評論數未達門檻則剔除
    if (!(r >= minR)) return false;
    if (minN > 0 && !(n >= minN)) return false;
    return true;
  }

  /* ---------- suggestNearbyAroundStops (keyword + types) ---------- */
  window.suggestNearbyAroundStops = function(opts){
    // 1) 標準化 opts，門檻寫回去，後面都只用 opts.xxx
    opts = Object.assign({
      perStop: window.SUGGEST_MAX_PER_STOP,
      maxTotal: window.SUGGEST_MAX_TOTAL,
      types: ['tourist_attraction','cafe','restaurant'],
      radius: 3000,
      keyword: '',
      minRating:  (typeof window.SUGGEST_MIN_RATING  === 'number' ? window.SUGGEST_MIN_RATING  : 0),
      minReviews: (typeof window.SUGGEST_MIN_REVIEWS === 'number' ? window.SUGGEST_MIN_REVIEWS : 0),
    }, opts || {});

    var perStop   = opts.perStop;
    var maxTotal  = opts.maxTotal;
    var types     = opts.types;
    var radius    = (typeof opts.radius === 'number') ? opts.radius
                : (typeof opts.rangeKm === 'number' ? (opts.rangeKm * 1000) : 3000);
    var keyword   = (opts.keyword || '').trim();

    if (!window.map || !window.placesService) { console.warn('[suggest] not ready'); return; }

    clearSuggestions();

    var day = isFn(window.getCurrentDay) ? window.getCurrentDay() : 1;
    var todays = isFn(window.getStopsOfDay)
      ? (window.getStopsOfDay(day) || [])
      : ((window.stops || []).filter(function(s){ return (s.day || 1) === day; }));
    if (!todays.length) { console.warn('[suggest] no stops today'); return; }

    var existingIds = new Set((window.stops || []).map(function(s){ return s.placeId; }).filter(Boolean));
    var addedIds    = new Set();
    let pool = [];


    function matchesKeyword(place){
      if (!keyword) return true;
      var s = keyword.toLowerCase();
      var bag = [];
      if (place && place.name) bag.push(place.name);
      if (place && place.vicinity) bag.push(place.vicinity);
      if (place && place.formatted_address) bag.push(place.formatted_address);
      if (place && place.types && place.types.length) bag = bag.concat(place.types);
      bag = bag.join(' ').toLowerCase();
      return bag.indexOf(s) !== -1;
    }

    function pushUnique(p, tagType){
      var pid = p && p.place_id;
      if (!pid) return;
      if (existingIds.has(pid) || addedIds.has(pid)) return;
      if (!matchesKeyword(p)) return;

      if (!passesQuality(p, { minRating: opts.minRating, minReviews: opts.minReviews })) return;

      p.__reco = keyword
        ? { tag: keyword, source: 'keyword', reason: `Matches keyword "${keyword}"` }
        : { tag: (tagType || (p.types && p.types[0]) || 'recommended'),
            source: 'type',
            reason: `Nearby result for type "${tagType || (p.types && p.types[0]) || 'recommended'}` };

      addedIds.add(pid);
      pool.push(p);
    }

    (function loop(i){
      if (i >= todays.length) { window.applySuggestionVisibility?.(); console.debug('[suggest] done, markers=', (window.suggestionMarkers||[]).length, 'kw=', keyword); return; }
      var S = todays[i];
      if (!S || !S.position) { loop(i+1); return; }
      var loc = g(S.position);
      pool = [];

      var doNearby = function(tIdx){
        if (tIdx >= types.length) {
          for (var k = 0; k < pool.length; k++) {
          if (typeof window.addRecoMarker === 'function') {
            // 👇 改用全域 addRecoMarker（讓它幫你掛上 __reco 與 hover card）
            window.addRecoMarker(pool[k], { 
              keyword: keyword,
              types: types,
              anchorLatLng: loc
            });
          } else {
            // 👇 若 addRecoMarker 尚未載入，改用 makeStarMarker 並手動補 reco 資料
            pool[k].__reco = pool[k].__reco || {
              tag: keyword || (pool[k].types && pool[k].types[0]) || 'recommended',
              source: keyword ? 'keyword' : 'type',
              reason: keyword 
                ? `Matches keyword "${keyword}"`
                : `Nearby result for type "${(pool[k].types && pool[k].types[0]) || 'recommended'}"`
              };
              (window.makeStarMarker || window._makeStarMarker || function(){})(pool[k]);
            }
          }
          loop(i+1);
          return;
        }
        var req = { location: loc, radius: radius, type: types[tIdx] };
        if (keyword) req.keyword = keyword;
        nearbySearchSafe(req).then(function(arr){
          arr = arr || [];
          for (var b=0; b<arr.length; b++) pushUnique(arr[b], types[tIdx]);
          doNearby(tIdx+1);
        });
      };

      // 先 TextSearch，後 Nearby 補齊
      if (keyword) {
        textSearchSafe({ query: keyword, location: loc, radius: radius }).then(function(arrT){
          arrT = arrT || [];
          for (var a=0; a<arrT.length && pool.length<perStop; a++) pushUnique(arrT[a], null);
          doNearby(0);
        });
      } else {
        doNearby(0);
      }
    })(0);
  };

  /* ---------- wire UI (容錯, 沒就略) ---------- */
  (function wireSuggestUI(){
    var byId    = (typeof window.byId === 'function') ? window.byId : (id => document.getElementById(id));
    var rangeEl = byId('range-km') || byId('suggest-range') || byId('recommend-range');
    // 🔸 不再使用任何 keyword input
    var btnFind   = byId('btn-suggest') || byId('btn-find-reco') || byId('find-recommendations');
    var btnSearch = byId('btn-suggest-search') || byId('btn-reco-search');
    var btnClear  = byId('btn-suggest-clear') || byId('btn-reco-clear') || byId('clear-recommendations');

    var cap = byId('range-cap'); 
    if (cap) cap.textContent = '30';

    function clamp(v,mn,mx){ return Math.max(mn, Math.min(mx, v)); }

    function hardClearRecoFallback(){
      // 兼容不同版本命名；最後保險直接清 marker
      if (typeof window.hardClearRecommendations === 'function') return window.hardClearRecommendations();
      if (typeof window.clearRecommendations    === 'function') return window.clearRecommendations();
      if (typeof window.clearSuggestions        === 'function') return window.clearSuggestions();
      (window.suggestionMarkers || []).forEach(sm => { try { (sm.marker||sm)?.setMap?.(null); } catch{} });
      if (Array.isArray(window.suggestionMarkers)) window.suggestionMarkers.length = 0;
      if (Array.isArray(window.RECO_MARKERS))      window.RECO_MARKERS.length = 0;
    }

    function run(){
      // 1) 讀取半徑
      var rangeKm = 3;
      if (rangeEl && rangeEl.value) {
        var v = Number(rangeEl.value);
        if (!isNaN(v)) rangeKm = clamp(v, 0.5, 30);
      }

      // 2) 讀取 types（checkbox）
      var typeChecks = Array.prototype.slice.call(
        document.querySelectorAll('input[name="types"]:checked')
      );
      var types = typeChecks.length 
        ? typeChecks.map(function(c){ return c.value; }) 
        : ['tourist_attraction','cafe','restaurant'];

      // 3) 先清掉舊星星（不論之前怎麼命名）
      hardClearRecoFallback();

      // 4) 視需要把地圖縮放到最低門檻
      if (typeof window.ensureMinZoom === 'function') {
        window.ensureMinZoom(window.SUGGEST_MIN_ZOOM || 15);
      }

      // 5) 依半徑 / 類型發出查詢（✅ 不再使用 keyword）
      window.suggestNearbyAroundStops && window.suggestNearbyAroundStops({
        types: types,
        radius: rangeKm * 1000,
        perStop: 6
        // 不再傳 keyword
      });

      // 如有其他可見性邏輯，讓它自己決定（可有可無）
      window.applySuggestionVisibility && window.applySuggestionVisibility();
    }

    if (btnFind   && !btnFind.dataset.bound) {
      btnFind.dataset.bound = '1';
      btnFind.addEventListener('click', run);
    }
    if (btnSearch && !btnSearch.dataset.bound) {
      btnSearch.dataset.bound = '1';
      btnSearch.addEventListener('click', run);
    }
    if (btnClear  && !btnClear.dataset.bound)  {
      btnClear.dataset.bound = '1';
      btnClear.addEventListener('click', function(){
        // 🔸 不再處理 __recoFilterKw，只單純清掉推薦星星
        hardClearRecoFallback();
        window.applySuggestionVisibility && window.applySuggestionVisibility();
      });
    }

    // 🔸 不再綁 keywordEl 的 keydown 事件（整個拿掉）

    try {
      var mp = (typeof nowMap === 'function') ? nowMap() : window.map;
      if (mp && !mp.__suggestZoomHook) {
        mp.__suggestZoomHook = mp.addListener('zoom_changed', function () {
          try { window.applySuggestionVisibility?.(); } catch(_) {}
          try { window.hideHoverCard?.(0); } catch(_) {}
        });
      }
      if (mp && !mp.__suggestDragHook) {
        mp.__suggestDragHook = mp.addListener('dragstart', function () {
          try { window.hideHoverCard?.(0); } catch(_) {}
        });
      }
    } catch(_) {}

    console.debug('[suggest] controls wired (unified v6, no keyword).');
  })();


  // 舊名 → 新名（轉接）
  window.clearSuggestionMarkers = window.clearSuggestionMarkers || function(){
    try { (window.suggestionMarkers || []).forEach(o => o.marker?.setMap(null)); } catch(_) {}
    window.suggestionMarkers = [];
  };
  window.removeSuggestionMarker = window.removeSuggestionMarker || function(m){
    try { m?.setMap?.(null); } catch(_) {}
    window.suggestionMarkers = (window.suggestionMarkers || []).filter(o => o.marker !== m);
  };
  // 舊程式若還呼叫 ensureMinZoom()，給個 no-op
  window.ensureMinZoom = window.ensureMinZoom || function(){};

})(); 

/* === READY CORE (only-once, put near top) === */
(function(){
  if (!Array.isArray(window._mapsReadyQueue)) window._mapsReadyQueue = [];
  if (typeof window.MAP_READY !== 'boolean') window.MAP_READY = false;

  if (typeof window.waitForMapReady !== 'function') {
    window.waitForMapReady = function(){
      return (window.MAP_READY && window.map)
        ? Promise.resolve()
        : new Promise(function(resolve){ window._mapsReadyQueue.push(resolve); });
    };
  }

  if (typeof window.whenMapsReady !== 'function') {
    window.whenMapsReady = function(cb){
      try { window.waitForMapReady().then(function(){ cb && cb(); }); } catch(e){ console.warn(e); }
    };
  }

  if (typeof window._signalMapReady !== 'function') {
    window._signalMapReady = function(){
      window.MAP_READY = true;
      var q = window._mapsReadyQueue || [];
      while (q.length) { try { (q.shift())(); } catch(e){ console.warn(e); } }
    };
  }
})();

// === Google Maps callback ===
window.initMap = function initMap() {
  if (typeof patchDirectionsRouteOnce   === 'function') patchDirectionsRouteOnce();
  
  // 建地圖
  const host = window.__mapEl || document.getElementById('map');
  const g = new google.maps.Map(host, {
    center: DEFAULT_CENTER,
    zoom:   DEFAULT_ZOOM,
    streetViewControl: false,
    mapTypeControl:    false,
  });
  window.map   = g;
  window.__gmap = g;

  if (window.overlayView) window.overlayView.setMap(g);

  try { _signalMapReady?.(); } catch(e){}
  
  // 標記已就緒
  window.MAP_READY = true;

  // 3) 套用所有需要 google 的 patch
  try { applyGooglePatches(); } catch(e){ console.warn(e); }

  // 4) 觸發你自己排隊的 callback（若有）
  if (Array.isArray(window._mapsReadyQueue)){
    window._mapsReadyQueue.splice(0).forEach(fn => { try{ fn && fn(); }catch{} });
  }

  // 服務
  window.placesService     = new google.maps.places.PlacesService(g);
  window.directionsService = new google.maps.DirectionsService();

  //建立 OverlayView 讓 hover card 可以掛上去
  if (!window.overlayView || !window.overlayView.getPanes) {
    window.overlayView = new google.maps.OverlayView();
    window.overlayView.onAdd = function(){};
    window.overlayView.draw  = function(){};
    window.overlayView.setMap(g);
  }

  // patch (如有)
  try { patchDirectionsRouteOnce?.(); } catch(e){}
  try { patchDirectionsRouteGlobal?.(); } catch(e){}
  try { patchSetMapGuardOnce?.(); } catch(e){}  // 防止 setMap(null) 例外

  // 標示可用 + 初始視野與建議
  try { safeSetCenterZoom?.(g, { stops:(window.stops||[]), fallbackCenter:DEFAULT_CENTER, fallbackZoom:DEFAULT_ZOOM }); } catch(e){}
  try { ensureMinZoom(); applySuggestionVisibility?.(); } catch(e){}

  // DirectionsRenderer（只建一次）
  try {
    window.directionsRenderer = new google.maps.DirectionsRenderer({ suppressMarkers:true, preserveViewport:false });
    window.directionsRenderer.setMap(g);
  } catch(e){ console.warn('directionsRenderer init error', e); }

  // 讀 URL → 載入資料（只保留一份流程）
  try {
    const u = new URL(location.href);
    const userTripId = u.searchParams.get('user_trip')
                     || u.searchParams.get('utrip')
                     || u.searchParams.get('id');
    const tripId     = (u.searchParams.get('trip') || '').trim();

    // ⭐ 重點：
    // - user_trip → 還是走 loadMyTrip()
    // - trip     → 交給 TripPointsByDayPatch(/api/trips/{id}/points) 處理，
    //              這裡不再呼叫舊的 loadTrip()，避免重複讀行程
    let chain;
    if (userTripId) {
      chain = loadMyTrip(userTripId);
    } else if (!tripId) {
      // 沒有 user_trip、也沒有 trip → 用預設 mockPlan
      loadRecommendedPlan(mockPlan);
      chain = Promise.resolve();
    } else {
      // 有 tripId 時，TripPointsByDayPatch 會自己去 applyTripFromAPI(tripId)
      // 這裡就什麼都不載，只做一些共通 UI 後處理
      chain = Promise.resolve();
    }

    chain
      .then(() => {
        // 只有「沒有 tripId」的情況，才在這裡重建 days/tabs，
        // 預設行程由 TripPointsByDayPatch 自己處理
        if (tripId) return;
        rebuildDaysFromStops(window.stops || []);
        renderDayTabs();
        setDay(1);
        renderTimeline?.();
      })
      .then(() => { if (!tripId) applyAiLegsFromServer?.({ onlyMissing: true }); })
      .then(() => { if (!tripId) recomputeRouteSmart?.(); })
      .then(() => { if (!tripId) fitToRoute?.(); })
      .then(() => { 
        // 這些是輕量 UI，可以不管 tripId，一律做
        ensureMinZoom();
        applySuggestionVisibility?.();
      })
      .catch(err => console.error('[initMap] chain error:', err));
  } catch (e) {
    console.warn('URL 參數解析失敗', e);
    loadRecommendedPlan(mockPlan);
    fitToRoute?.();
  }

  // 一次性 UI 綁定（避免重複）
  try { setupSuggestControls?.(); } catch(e){}
  document.getElementById('btn-clear')?.addEventListener('click', clearAll);
  document.getElementById('btn-fit')?.addEventListener('click',  fitToRoute);
  
  try { _signalMapReady && _signalMapReady(); } catch(e){ console.warn(e); }
};

// === 等地圖就緒的小工具 ===
window._mapsReadyQueue = window._mapsReadyQueue || [];
window.MAP_READY = !!window.MAP_READY;

window.whenMapsReady = function(cb){
  if (window.MAP_READY) { try{ cb && cb(); }catch{}; return; }
  window._mapsReadyQueue.push(cb);
};

// === 所有需要 google 的改寫都放進這裡 ===
function applyGooglePatches(){
  // 1) 攔截 PlacesService.getDetails（修正 placeid 大小寫、打 log）
  const PS = google?.maps?.places?.PlacesService;
  if (PS?.prototype?.getDetails){
    const orig = PS.prototype.getDetails;
    console.log('🧩 Patched PlacesService.getDetails');
  }

  // 2) 需要時把 getDetails 轉接到新版 Place.fetchFields（新專案建議開）
  const Place = google?.maps?.places?.Place;
  if (Place && PS?.prototype){
    const fields = ['id','displayName','rating','userRatingCount','formattedAddress','location','photos','googleMapsUri','websiteUri','currentOpeningHours','types','priceLevel'];
    const toLegacy = r => ({
      place_id: r.id,
      name: r.displayName?.text || r.displayName || 'Place',
      rating: r.rating,
      user_ratings_total: r.userRatingCount,
      formatted_address: r.formattedAddress,
      geometry: r.location ? { location: r.location } : undefined,
      url: r.googleMapsUri,
      website: r.websiteUri,
      opening_hours: r.currentOpeningHours,
      types: r.types,
      price_level: r.priceLevel,
      photos: Array.isArray(r.photos) ? r.photos.map(p => ({
        getUrl: ({maxWidth,maxHeight}={}) => p.createUrl({maxWidth,maxHeight})
      })) : []
    });
    console.log('🧩 Shimmed getDetails → fetchFields (with legacy fallback)');
  }
}

async function prefetchTodayDetails(){
  const today = getCurrentDay();
  const todays = (window.stops||[]).filter(s => (s.day ?? 1) === today);
  for (const s of todays){ await ensurePlaceDetails(s); await new Promise(r=>setTimeout(r,300)); }
}

async function fixPlaceIdsInBackground(){
  const svc = window.placesService || new google.maps.places.PlacesService(map);
  for (const s of (window.stops || [])){
    if (!s || s._fixed) continue;
    if (!placeIdLooksValid(s.place_id)){
      await new Promise(res=>{
        const loc = s.position ? new google.maps.LatLng(s.position) : undefined;
        svc.findPlaceFromQuery({
          query: s.name, fields:['place_id','name','geometry'],
          locationBias: loc ? { radius: 1500, center: loc } : undefined
        }, (r, st)=>{
          if (st === google.maps.places.PlacesServiceStatus.OK && r?.length){
            s.place_id = s.placeId = r[0].place_id;
            if (!s.position && r[0].geometry?.location) s.position = r[0].geometry.location.toJSON();
          }
          s._fixed = true; res();
        });
      });
      await new Promise(r=>setTimeout(r, 1500));
    }
  }
}


// === 1️⃣ 篩出可疑 pid（開發時測用）===
function listSuspiciousStops() {
  const suspicious = (window.stops||[]).filter(
    s => !s.place_id || /-|_/.test(s.place_id) || String(s.place_id).length < 20
  );
  if (window.TS_DEBUG) {
    console.table(suspicious.map(s => ({ name: s.name, pid: s.place_id })));
  }
}

// === 2️⃣ 自動修復：補回正確的 place_id + details ===
async function fixInvalidPlaceIds() {
  if (!window.placesService && window.map) {
    window.placesService = new google.maps.places.PlacesService(window.map);
  }

  let fixed = 0;
  for (const s of window.stops || []) {
    const pid = s.place_id || s.placeId;
    const looksGooglePid = pid && !/-/.test(pid) && String(pid).length >= 20;
    if (!looksGooglePid) {
      await ensurePlaceDetails(s);
      if (s.details?.place_id) fixed++;
      await new Promise(r => setTimeout(r, 150)); // 保護配額
    }
  }
  console.log(`✅ 已修復 ${fixed} 筆行程地點 place_id`);
}

// === 3️⃣ （可選）載入完成後自動列出異常 ===
window.addEventListener('load', () => {
  console.log('🔍 開始檢查 place_id');
  listSuspiciousStops();
});


/* ==== FINAL GLUE PATCH — 推荐點 + 可視性 + UI 綁定（只補缺，不覆蓋） ==== */
(function(){

  // -------- 小工具：目前的地圖 --------
  if (typeof window.nowMap !== 'function') {
    window.nowMap = function(){ return window.__gmap || window.map || null; };
  }

  // -------- 建議點容器 --------
  if (!Array.isArray(window.suggestionMarkers)) window.suggestionMarkers = [];

  // --- 保證存在 hover-card DOM（若沒有就建一個簡易版） ---
  (function ensureHoverDom(){
    if (!document.getElementById('hover-card')) {
      const box = document.createElement('div');
      box.id = 'hover-card';
      box.style.cssText = 'position:fixed;right:16px;top:16px;max-width:300px;background:#fff;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.2);padding:12px;z-index:999999;display:none;line-height:1.35';
      box.innerHTML = `
        <div id="hc-name"  style="font-weight:700;margin-bottom:6px">Place</div>
        <div><span id="hc-rating">★ N/A</span> <span id="hc-user"></span></div>
        <div id="hc-addr"  style="color:#555;margin:6px 0 4px 0"></div>
        <div id="hc-reco-tag"    style="font-size:12px;color:#555;margin-top:4px"></div>
        <div id="hc-reco-reason" style="font-size:12px;color:#555;margin-top:2px"></div>
      `;
      document.body.appendChild(box);
    }
  })();

  // ---  showHoverCard（加 log 便於確認是否有被呼叫） ---
  window.showHoverCard = function(item, opts){
    console.debug('[showHoverCard] called with:', item);   // ← 看 console 是否有出現
    opts = opts || {};
    var el = document.getElementById('hover-card'); 
    if (!el) return;

    // 嘗試掛到 floatPane（失敗就忽略）
    try{
      var panes = window.overlayView?.getPanes?.();
      if (panes?.floatPane && el.parentNode !== panes.floatPane) panes.floatPane.appendChild(el);
    }catch(_){}

    // 填基本欄位
    var $ = (id)=>document.getElementById(id);
    $('hc-name')  && ( $('hc-name').textContent  = (item?.name || item?.title || item?.details?.name || 'Place') );
    const rating = (typeof item?.rating === 'number') ? item.rating :
                   (typeof item?.details?.rating === 'number') ? item.details.rating : null;
    const urt    = (typeof item?.userRatingsTotal === 'number') ? item.userRatingsTotal :
                   (typeof item?.user_ratings_total === 'number') ? item.user_ratings_total :
                   (typeof item?.details?.user_ratings_total === 'number') ? item.details.user_ratings_total : null;
    $('hc-rating') && ( $('hc-rating').textContent = (rating!=null) ? ('★ ' + (Math.round(rating*10)/10)) : '★ N/A' );
    $('hc-user')   && ( $('hc-user').textContent   = (urt!=null) ? ('(' + urt + ')') : '' );
    $('hc-addr')   && ( $('hc-addr').textContent   = (item?.formatted_address || item?.vicinity || item?.address || item?.details?.formatted_address || '') );

    // === 顯示 Keyword/Type & 推薦理由（若無插槽就動態建立在地址下方） ===
    try {
      const cardEl = document.getElementById('hover-card');   // ← 用 cardEl
      const addr   = document.getElementById('hc-addr');

      function ensureAfter(refEl, id, cssText){
        let n = document.getElementById(id);
        if (!n) {
          n = document.createElement('div');
          n.id = id;
          n.style.cssText = cssText || 'font-size:12px;color:#555;margin-top:4px';
          (refEl?.parentElement || cardEl).insertBefore(n, refEl?.nextSibling || null);
        }
        return n;
      }

      const tagEl    = ensureAfter(addr, 'hc-reco-tag');
      const reasonEl = ensureAfter(tagEl, 'hc-reco-reason');

      const reco = item?.__reco || item?.marker?.__reco || item?.details?.__reco || null;
      tagEl.textContent    = reco?.tag    ? ('Keyword/Type：' + reco.tag) : '';
      reasonEl.textContent = reco?.reason || '';
    } catch(e){ console.debug('[hover/reco]', e); }

   // === 簡介 / 描述（editorial summary） ===
    try {
      const cardEl = document.getElementById('hover-card');
      const addrEl = document.getElementById('hc-addr');
      const ensureAfter = (refEl, id, cssText) => {
        let n = document.getElementById(id);
       if (!n) {
          n = document.createElement('div');
          n.id = id;
          n.style.cssText = cssText || 'font-size:12px;color:#555;margin-top:6px;';
          (refEl?.parentElement || cardEl).insertBefore(n, refEl?.nextSibling || null);
        }
        return n;
      };
      const descEl = ensureAfter(addrEl, 'hc-desc');
      const d = item?.details;
      const overview = d?.editorial_summary?.overview || d?.editorialSummary || '';
      descEl.textContent = overview || '';
    } catch(_) {}


    // === 照片（新版/舊版 Places 都相容） ===
    try {
      let img = document.getElementById('hc-img') || document.querySelector('#hover-card img');
      if (img) {
        const ph = item?.details?.photos?.[0] || item?.photos?.[0] || null;
        let url = null;
        try {
          if (ph && typeof ph.getUrl === 'function')         url = ph.getUrl({ maxWidth: 640, maxHeight: 400 });
          else if (ph && typeof ph.createUrl === 'function')  url = ph.createUrl({ maxWidth: 640, maxHeight: 400 });
          else if (ph && typeof ph.getURI === 'function')     url = ph.getURI({ maxWidth: 640, maxHeight: 400 });
          else if (ph && ph.url)                              url = ph.url;
        } catch(_) {}
        if (url) { img.src = url; img.style.display = ''; img.removeAttribute('hidden'); }
        else     { img.removeAttribute('src'); img.style.display = 'none'; }
      }
    } catch(_) {}

    // 顯示
    el.style.display   = 'block';
    el.style.opacity   = 1;
    el.style.visibility= 'visible';
    el.style.zIndex    = '999999';
    window.__hcShownAt = Date.now();
  };

  // 簡單的隱藏函式
  window.hideHoverCard = function(ms=0){
    const el = document.getElementById('hover-card'); 
    if (!el) return;
    const doHide = ()=>{ el.style.display='none'; };
    if (ms>0) setTimeout(doHide, ms); else doHide();
  };

  // -------- 清除建議點 --------
  if (typeof window.clearSuggestions !== 'function') {
    window.clearSuggestions = function(){
      try { (window.suggestionMarkers || []).forEach(function(o){ o.marker && o.marker.setMap(null); }); } catch(_){}
      if (Array.isArray(window.suggestionMarkers)) window.suggestionMarkers.length = 0;
      try { console.debug('[suggest] cleared.'); } catch(_){}
    };
  }

  // -------- 只在缺時，補「建立星星 marker」 --------
  function _makeStarMarker(place){
    var mp = window.nowMap();
    var pos = place && place.geometry && place.geometry.location;
    if (!mp || !pos) return null;
    var m = new google.maps.Marker({
      position: pos,
      map: mp,
      title: place.name || 'Suggested',
      icon: {
        url: 'https://maps.gstatic.com/mapfiles/ms2/micons/yellow-dot.png',
        scaledSize: new google.maps.Size(30,30)
      },
      zIndex: 9999,
      optimized: false
    });

    // ★ 把「推薦來源」標記掛在 marker（先讀 place.__reco，沒有就 null）
    m.__reco  = place.__reco || null;
    m.__place = place; //保留原始 place 以便後續使用

    if (m.setTitle) {
      var tag = m.__reco && m.__reco.tag ? (' · ' + m.__reco.tag) : '';
      m.setTitle((place.name || 'Suggested') + tag);
    }

    // ⭐ 推薦點 click → 只在點擊時顯示 hover card
    m.addListener('click', async () => {
      const pos = place.geometry.location;

      // pin 卡片
      const el = document.getElementById('hover-card');
      if (el) el.dataset.sticky = '1';

      // 使用與行程點相同結構
      const stopLike = {
        place_id: place.place_id || place.id || null,
        name: place.name,
        position: pos?.toJSON ? pos.toJSON() : pos,
        details: place,
        marker: m,
        __reco: m.__reco || place.__reco || null,
      };

      // 確保補齊照片、網址、電話、overview 等詳細資訊
      await (window.ensurePlaceDetails?.(stopLike));

      window.showHoverCard?.(stopLike, {
        pin: true,
        anchor: pos
      });
    });

    // 放入全域
    if (!Array.isArray(window.suggestionMarkers)) window.suggestionMarkers = [];
    window.suggestionMarkers.push({ place: place, marker: m });
    return m;
  }

  // === Recommended Places：格子 thinning，避免星星太擠 ===
  function thinRecoMarkers(cellKm, maxPerCell){
    cellKm     = cellKm     || 1; // 每格約幾公里
    maxPerCell = maxPerCell || 3; // 每格最多幾顆星

    var markers = (window.RECO_MARKERS && window.RECO_MARKERS.length)
      ? window.RECO_MARKERS
      : (window.suggestionMarkers || []);

    if (!markers || !markers.length) return;

    var cellDeg = cellKm / 111; // 1° 緯度 ≈ 111km
    var grid = {};
    var keep = [];

    for (var i = 0; i < markers.length; i++) {
      var m = markers[i];
      try {
        if (!m || !m.getPosition) continue;
        var pos = m.getPosition();
        if (!pos) continue;

        var lat = (typeof pos.lat === 'function') ? pos.lat() : pos.lat;
        var lng = (typeof pos.lng === 'function') ? pos.lng() : pos.lng;

        var key = Math.round(lat / cellDeg) + ',' + Math.round(lng / cellDeg);
        var arr = grid[key] || (grid[key] = []);

        if (arr.length < maxPerCell) {
          arr.push(m);
          keep.push(m);
        } else {
          if (m.setMap) m.setMap(null); // 多的就從地圖移除
        }
      } catch(e){}
    }

    if (window.RECO_MARKERS && window.RECO_MARKERS.length) {
      window.RECO_MARKERS = keep;
    } else {
      window.suggestionMarkers = keep;
    }
  }

  // -------- 推薦點安全上限（全域設定）可自調 --------
  window.SUGGEST_MAX_TOTAL     = window.SUGGEST_MAX_TOTAL ?? 120; 
  window.SUGGEST_MAX_PER_STOP  = window.SUGGEST_MAX_PER_STOP ?? 8;
  window.SUGGEST_BATCH_YIELD   = window.SUGGEST_BATCH_YIELD ?? 20;

  // -------- 推薦點（缺時補上一個安全版）--------
  if (typeof window.suggestNearbyAroundStops !== 'function') {
    window.suggestNearbyAroundStops = async function(opts){
      opts = opts || {};
      var perStop = Infinity;
      var radius  = (typeof opts.radius  === 'number') ? opts.radius  : 3000;
      var types   = (opts.types && opts.types.length) ? opts.types : ['tourist_attraction','cafe','restaurant'];
      var keyword = (opts.keyword || '').trim();

      var mp = window.nowMap();
      if (!mp || !window.placesService) { console.warn('[suggest] not ready'); return; }

      window.clearSuggestionMarkers && window.clearSuggestionMarkers();
      if (typeof window.ensureMinZoom === 'function') {
        window.ensureMinZoom(window.SUGGEST_MIN_ZOOM || 15);
      }

      // 取得今天的 stops
      var day = (typeof window.getCurrentDay === 'function') ? window.getCurrentDay() : 1;
      var todays = [];
      if (typeof window.getStopsOfDay === 'function') todays = window.getStopsOfDay(day) || [];
      else todays = (window.stops || []).filter(function(s){ return (s.day || 1) === day; });
      if (!todays.length) { console.warn('[suggest] no stops today'); return; }

      var existing = new Set((window.stops || []).map(function(s){ return s.placeId; }).filter(Boolean));
      var added    = new Set();
      var produced = 0; // 全域已產生幾顆（跨所有 stops）

      function _inferRecoTag(p, opts){
        var kw = (opts.keyword || '').trim();
        var types = Array.isArray(opts.types) ? opts.types : [];

        if (kw) {
          return {
            tag: kw,                  // 顯示用：使用者輸入的 keyword
            source: 'keyword',        // 來源類型
            reason: `Matches keyword "${kw}" via TextSearch${(p.types && p.types.length) ? `; types: ${p.types.slice(0,3).join(', ')}` : ''}`
          };
        }

        // 沒 keyword：試著從 place.types 找到與 opts.types 的交集
        var hit = (p.types || []).find(function(t){ return types.includes(t); });
        if (hit) {
          return {
            tag: hit,
            source: 'type',
            reason: `Nearby result for type "${hit}"`
          };
        }

        return {
          tag: 'recommended',
          source: 'generic',
          reason: 'Nearby result within range'
        };
      }

      function _matchesKeyword(p){
        if (!keyword) return true;
        var s = keyword.toLowerCase();
        var bag = [];
        if (p && p.name) bag.push(p.name);
        if (p && p.vicinity) bag.push(p.vicinity);
        if (p && p.formatted_address) bag.push(p.formatted_address);
        if (p && p.types && p.types.length) bag = bag.concat(p.types);
        return bag.join(' ').toLowerCase().indexOf(s) !== -1;
      }

      function _nearby(req){
        return new Promise(function(resolve){
          window.placesService.nearbySearch(req, function(arr, st){
            if (st === google.maps.places.PlacesServiceStatus.OK) resolve(arr || []);
            else resolve([]);
          });
        });
      }
      function _text(req){
        return new Promise(function(resolve){
          window.placesService.textSearch(req, function(arr, st){
            if (st === google.maps.places.PlacesServiceStatus.OK) resolve(arr || []);
            else resolve([]);
          });
        });
      }

      async function _yieldIfNeeded(){
        // 每畫到一定數量就讓主執行緒喘一下，避免卡死
        return new Promise(requestAnimationFrame);
      }

      for (var i=0;i<todays.length;i++){
        if (produced >= maxTotal) break; // 全域上限到了就收
        var S = todays[i];
        if (!S || !S.position) continue;
        var center = (S.position instanceof google.maps.LatLng) ? S.position : new google.maps.LatLng(S.position);
        
        var pool = [];

        // 先 TextSearch（有 keyword）
        if (keyword) {
          var tArr = await _text({ query: keyword, location: center, radius: radius });
          for (var a=0; a<tArr.length && pool.length<perStop && produced < maxTotal; a++){
            var p1 = tArr[a]; var pid1 = p1 && p1.place_id;
            if (!pid1 || existing.has(pid1) || added.has(pid1)) continue;
            if (!_matchesKeyword(p1)) continue;
            p1.__reco = _inferRecoTag(p1, { keyword: keyword, types: types });
            pool.push(p1); added.add(pid1);
          }
        }

        // 再 nearby(type+keyword) 補齊
        for (var ti=0; ti<types.length && pool.length<perStop; ti++){
          var req = { location: center, radius: radius, type: types[ti] };
          if (keyword) req.keyword = keyword;
          var nArr = await _nearby(req);
          for (var b=0; b<nArr.length && pool.length<perStop && produced < maxTotal; b++){
            var p2 = nArr[b]; var pid2 = p2 && p2.place_id;
            if (!pid2 || existing.has(pid2) || added.has(pid2)) continue;
            if (!_matchesKeyword(p2)) continue;
            p2.__reco = _inferRecoTag(p2, { keyword: keyword, types: types });
            pool.push(p2); added.add(pid2);
          }
        }

        // 生成星星
        for (var k=0; k<pool.length && k<perStop && produced < maxTotal; k++){
          var mk = _makeStarMarker(pool[k]);
          if (mk && typeof window.SUGGEST_MIN_ZOOM === 'number') {
            try {
              var z = window.nowMap()?.getZoom?.() || 0;
              mk.setVisible(z >= window.SUGGEST_MIN_ZOOM);
            } catch(_){}
          }
          produced++;
          if (produced % window.SUGGEST_BATCH_YIELD === 0) await _yieldIfNeeded();
        }
      }

      // ⭐ 先做 thinning 再套一次可見性
      try { thinRecoMarkers(1.4, 2); } catch(_){}
      try { window.applySuggestionVisibility && window.applySuggestionVisibility(); } catch(_){}
      try { console.debug('[suggest] done, markers=', (window.suggestionMarkers||[]).length, 'kw=', keyword); } catch(_){}
    };
  }

  // -------- UI 綁定（按鈕/輸入框；若缺才綁）--------
  (function wireSuggestUI(){
    var byId = function(id){ return document.getElementById(id); };
    var rangeEl   = byId('range-km') || byId('suggest-range') || byId('recommend-range');
    var keywordEl = byId('suggest-keyword') || byId('keyword') || byId('search-keyword');
    var btnFind   = byId('btn-suggest') || byId('btn-find-reco') || byId('find-recommendations');
    var btnSearch = byId('btn-suggest-search') || byId('btn-reco-search');
    var btnClear  = byId('btn-suggest-clear') || byId('btn-reco-clear') || byId('clear-recommendations');

    function clamp(v,mn,mx){ return Math.max(mn, Math.min(mx, v)); }

    function run(){
      var km = 3;
      if (rangeEl && rangeEl.value) {
        var v = Number(rangeEl.value);
        if (!isNaN(v)) km = clamp(v, 1, 30);
      }

      var kw = keywordEl && keywordEl.value ? keywordEl.value.trim() : '';

      // types（checkbox）
      var checks = Array.prototype.slice.call(document.querySelectorAll('input[name="types"]:checked'));
      var types  = checks.length ? checks.map(function(c){ return c.value; }) : ['tourist_attraction','cafe','restaurant'];

      // ✅ 先清除舊星星（兼容各版本命名）
      if (typeof window.hardClearRecommendations === 'function') {
        window.hardClearRecommendations();
      } else if (typeof window.clearRecommendations === 'function') {
        window.clearRecommendations();
      } else if (typeof window.clearSuggestions === 'function') { // ← 你現有的函式名稱
        window.clearSuggestions();
      } else {
        // 最後保險：手動清地圖上的 reco 星星
        (window.suggestionMarkers || []).forEach(sm => { try { sm.marker && sm.marker.setMap(null); } catch {} });
        if (Array.isArray(window.suggestionMarkers)) window.suggestionMarkers.length = 0;
        if (Array.isArray(window.RECO_MARKERS))      window.RECO_MARKERS.length = 0;
      }

      // ✅ 確保縮放到門檻以上
      if (typeof window.ensureMinZoom === 'function') {
        window.ensureMinZoom(window.SUGGEST_MIN_ZOOM || 15);
      }

      // ✅ 呼叫新版推薦搜尋（關鍵字 + 半徑 + 類型）
      window.suggestNearbyAroundStops && window.suggestNearbyAroundStops({
        types: kw ? [] : types,                 // 有 keyword 時不用 types
        radius: km * 1000,
        perStop: 6,                          // 想多顯示就拉高
        keyword: kw || null,
      });

      // ✅ 搜完套一次顯示規則
      window.applySuggestionVisibility && window.applySuggestionVisibility();
    }

    if (btnFind && !btnFind.dataset.bound)   { btnFind.dataset.bound='1';   btnFind.addEventListener('click', run); }
    if (btnSearch && !btnSearch.dataset.bound){ btnSearch.dataset.bound='1'; btnSearch.addEventListener('click', run); }
    if (btnClear && !btnClear.dataset.bound) { btnClear.dataset.bound='1';  btnClear.addEventListener('click', function(){ window.clearSuggestions && window.clearSuggestions(); }); }
    if (keywordEl && !keywordEl.dataset.bound){ keywordEl.dataset.bound='1'; keywordEl.addEventListener('keydown', function(e){ if (e.key === 'Enter') run(); }); }

    // 只綁一次地圖事件（zoom/drag）
    var mp = window.nowMap();
    try{
      if (mp && !mp.__suggestZoomHook)  mp.__suggestZoomHook  = mp.addListener('zoom_changed', function(){ window.applySuggestionVisibility && window.applySuggestionVisibility(); window.hideHoverCard && window.hideHoverCard(0); });
      if (mp && !mp.__suggestDragHook)  mp.__suggestDragHook  = mp.addListener('dragstart',  function(){ window.hideHoverCard && window.hideHoverCard(0); });
    }catch(_){}
  })();
})(); 

window.RECO_PREFS = window.RECO_PREFS || {};
Object.assign(window.RECO_PREFS, {
  minRating: 4.4,
  minReviews: 80,
});

/* ==== /FINAL GLUE PATCH ==== */

// === PATCH: Search Anchor (唯一來源) ===
function getSearchAnchorKm(defaultKm = 2000, hint){
  // 1) 若有外部提示（座標或 marker）
  if (hint) {
    const p = hint.position || hint.location || hint;
    if (p && (typeof p.lat === 'function' || (p.lat != null && p.lng != null))) {
      return { location: (p.toJSON?.() || p), radius: defaultKm };
    }
  }

  // 2) 以「當天行程」的幾何中心當錨點
  try {
    const day = (typeof getCurrentDay === 'function') ? getCurrentDay() : 1;
    const stops = (typeof getTodaysStops === 'function') ? getTodaysStops(day) : (window.stops||[]).filter(s=>Number(s.day)===Number(day));
    const pts = stops.map(s => s.position || s.location).filter(Boolean);
    if (pts.length) {
      let sx=0, sy=0, sz=0;
      for (const p of pts) {
        const ll = (p.toJSON?.() || p);
        const lat = Number(ll.lat), lng = Number(ll.lng);
        const x = Math.cos(lat*Math.PI/180) * Math.cos(lng*Math.PI/180);
        const y = Math.cos(lat*Math.PI/180) * Math.sin(lng*Math.PI/180);
        const z = Math.sin(lat*Math.PI/180);
        sx+=x; sy+=y; sz+=z;
      }
      const hyp = Math.sqrt(sx*sx+sy*sy+sz*sz); sx/=hyp; sy/=hyp; sz/=hyp;
      const lat = Math.asin(sz)*180/Math.PI;
      const lng = Math.atan2(sy, sx)*180/Math.PI;
      return { location: {lat, lng}, radius: defaultKm };
    }
  } catch(e){}

  // 3) 退而求其次：地圖中心
  const c = map?.getCenter?.();
  if (c) return { location: (c.toJSON?.() || c), radius: defaultKm };

  // 4) 最後保底：台北 0km（幾乎不會走到）
  return { location: { lat: 25.033968, lng: 121.564468 }, radius: defaultKm };
}

// ==== Recommended Places 強化：無縮放限制 + 關鍵字分類 + 一鍵找星星 + 推薦理由 ====
// 直接把這段貼到 map.js 的最後面（不會破壞既有行程點邏輯）
// 需要：已存在的 window.map、google.maps、window.placesService（若無會自動建立）
whenMapsReady(() => {
  // === Range circles disabled: keep API, show nothing ===
  (function disableRangeCircles(){
    window.updateRangeCircles = function(){ /* no-op */ };
    window.clearRangeCircles = function(){
      try { (window.__rangeCircles || []).forEach(c => c.setMap && c.setMap(null)); } catch {}
      window.__rangeCircles = [];
    };
    try { window.clearRangeCircles(); } catch {}
  })();

  (function RecommendedPlacesEnhance() {
    if (window.__RECO_V2_READY__) { console.debug('[Reco] v2 already ready'); return; }
    console.debug('[Reco] v2 init');

    try {
      // ---------------- Common helpers ----------------
      window.SUGGEST_MIN_ZOOM = 0;

      function ensurePS() {
        const gmap = window.map;
        if (!window.placesService && gmap) {
          window.placesService = new google.maps.places.PlacesService(gmap);
        }
        return window.placesService;
      }

      function toGLL(v) {
        if (!v) return null;
        if (typeof v.lat === 'function' && typeof v.lng === 'function') {
          return { lat: Number(v.lat()), lng: Number(v.lng()) };
        }
        const la = Number(v.lat ?? v.position?.lat);
        const ln = Number(v.lng ?? v.position?.lng);
        if (Number.isFinite(la) && Number.isFinite(ln)) return { lat: la, lng: ln };
        return null;
      }

      function haversineKm(a, b) {
        const R = 6371, t = x => x * Math.PI / 180;
        const dLat = t(b.lat - a.lat), dLng = t(b.lng - a.lng);
        const s1 = Math.sin(dLat / 2), s2 = Math.sin(dLng / 2);
        const h = s1 * s1 + Math.cos(t(a.lat)) * Math.cos(t(b.lat)) * s2 * s2;
        return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
      }

      const KW_TYPE_MAP = [
        { rx: /(restaurant|餐廳|吃飯|美食)/i, type: 'restaurant' },
        { rx: /(cafe|coffee|咖啡)/i,          type: 'cafe' },
        { rx: /(bar|pub|酒吧)/i,              type: 'bar' },
        { rx: /(bakery|麵包|烘焙)/i,          type: 'bakery' },
        { rx: /(hotel|住宿|旅館|民宿)/i,      type: 'lodging' },
      ];
      function kwToType(kw) {
        if (!kw) return null;
        for (const m of KW_TYPE_MAP) if (m.rx.test(kw)) return m.type;
        return null;
      }

      function dedupePlaces(list) {
        const seen = new Set();
        return (list || []).filter(p => {
          const id = p.place_id || p.id || (p.name + '@' + (p.vicinity || p.formatted_address || ''));
          if (seen.has(id)) return false; seen.add(id); return true;
        });
      }

      // ---- 只取「當天」行程點 + 地圖上的行程 markers 做索引 ----
      function buildStopIndex() {
        const day = (typeof getCurrentDay === 'function') ? getCurrentDay() : 1;

        const norm = (p) => {
          if (!p) return null;
          if (typeof p.lat === 'function' && typeof p.lng === 'function') return { lat: p.lat(), lng: p.lng() };
          if (typeof p.toJSON === 'function') return p.toJSON();
          if (typeof p.lat === 'number' && typeof p.lng === 'number') return { lat: Number(p.lat), lng: Number(p.lng) };
          return null;
        };

        const list = (typeof getStopsOfDay === 'function')
          ? getStopsOfDay(day)
          : (Array.isArray(window.stops) ? window.stops.filter(s => Number(s.day) === Number(day)) : []);

        const idx1 = list.map(s => ({
          pid: s.place_id || s.placeId || s.details?.place_id || null,
          pos: norm(s.position || s.location || s.details?.geometry?.location),
          name: String(s.name || s.details?.name || '').trim().toLowerCase()
        })).filter(x => x.pos);

        const idx2 = Array.isArray(window.stopMarkers) ? window.stopMarkers.map(m => ({
          pid: m.place?.place_id || null,
          pos: norm(m.getPosition?.()),
          name: String(m.place?.name || m.getTitle?.() || '').trim().toLowerCase()
        })).filter(x => x.pos) : [];

        return [...idx1, ...idx2];
      }

      function makeNotInStopsFilter(stopsIdx, meters = 150) {
        const R = 6371000, toRad = d => d * Math.PI / 180;

        const near = (a, b) => {
          const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
          const s1 = Math.sin(dLat / 2), s2 = Math.sin(dLng / 2);
          const h  = s1 * s1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2 * s2;
          const d  = 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
          return d <= meters;
        };

          // 名稱清洗：去括號/非字母數字、轉小寫、去頭尾空白
        const clean = s => String(s || '')
          .toLowerCase()
          .replace(/[()\[\]【】（）]/g, ' ')
          .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
          .trim();

        const posOf = p => {
          const loc = p?.geometry?.location;
          if (!loc) return null;
          if (typeof loc.toJSON === 'function') return loc.toJSON();
          if (typeof loc.lat === 'function' && typeof loc.lng === 'function') return { lat: loc.lat(), lng: loc.lng() };
          if (typeof loc.lat === 'number' && typeof loc.lng === 'number') return { lat: Number(loc.lat), lng: Number(loc.lng) };
          return null;
        };

        return (p) => {
          const pid  = p.place_id || p.id || null;
          const pos  = posOf(p);
          const name = clean(p.name);

          return !stopsIdx.some(st =>
            (pid && st.pid && pid === st.pid) ||          // 同 place_id
            (pos && st.pos && near(pos, st.pos)) ||       // 很近
            (name && st.name && name === clean(st.name))  // 同名（清洗後）
          );
        };
      }

      // ---------------- markers & UI ----------------
      const GOLD_STAR = {
        path: "M12 .587l3.668 7.431 8.207 1.193-5.938 5.79 1.402 8.169L12 18.896 4.661 23.17l1.402-8.169L.125 9.211l8.207-1.193L12 .587z",
        fillColor: "#f6c343",
        fillOpacity: 1,
        strokeColor: "#8a6e20",
        strokeWeight: 1.2,
        scale: 1.2,
        anchor: new google.maps.Point(12, 12),
        labelOrigin: new google.maps.Point(12, -2)
      };

      if (!Array.isArray(window.suggestionMarkers)) window.suggestionMarkers = [];
      window.__ALL_MARKERS__ = window.__ALL_MARKERS__ || [];

      // 產生推薦理由（距離 + keyword + 評分）
      function buildReason({ place, keyword='', anchor }) {
      let distTxt = '';
        try {
          if (anchor && place?.geometry?.location?.toJSON) {
            const a = anchor, b = place.geometry.location.toJSON();
            const R=6371, t=x=>x*Math.PI/180;
            const dLat=t(b.lat-a.lat), dLng=t(b.lng-a.lng);
            const s1=Math.sin(dLat/2), s2=Math.sin(dLng/2);
            const h=s1*s1 + Math.cos(t(a.lat))*Math.cos(t(b.lat))*s2*s2;
            distTxt = `距離行程點約 ${(R*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h))).toFixed(1)} 公里`;
          }
        } catch {}
        const rating = (place?.rating!=null) ? `Google 評分 ${place.rating}★` : '';
        const reviews= (place?.user_ratings_total>0) ? `(${place.user_ratings_total}則)` : '';
        const kwPart = keyword ? `Keyword: 「${keyword}」` : 'Recommended nearby';
        return [kwPart, distTxt, (rating||reviews)?`${rating}${reviews}`:''].filter(Boolean).join(' · ');
      }

      // 統一推入星星（兼容舊容器可能是 [{marker}] 或 [Marker]）
      function pushRecoMarker(mk){
        const arr = (window.suggestionMarkers ||= []);
        if (arr.length && typeof arr[0] === 'object' && 'marker' in arr[0]) {
          arr.push({ marker: mk });
        } else {
          arr.push(mk);
        }
        (window.RECO_MARKERS ||= []).push(mk);
        (window.__ALL_MARKERS__ ||= []).push(mk);
      }

      // 若你的專案沒有 ensurePlaceDetails，提供最小 fallback（不會覆蓋既有的）
      if (typeof window.ensurePlaceDetails !== 'function') {
        window.ensurePlaceDetails = async function ensurePlaceDetails(item) {
          try {
            const pid = item?.place_id || item?.details?.place_id;
            if (!pid || !window.placesService) return;
            const req = { placeId: pid, fields: [
              'place_id','name','rating','user_ratings_total','formatted_address','types',
              'photos','url','website','opening_hours','geometry','editorial_summary'
            ]};
            const det = await new Promise((resolve)=> {
              window.placesService.getDetails(req, (res, status) =>
                resolve(status===google.maps.places.PlacesServiceStatus.OK ? res : null));
            });
            if (det) {
              // 同樣做一次 photos 轉換
              if (Array.isArray(det.photos)) {
                det.photos = det.photos.map(ph =>
                  (typeof ph.createUrl === 'function')
                    ? { getUrl: ({maxWidth, maxHeight}={}) => ph.createUrl({maxWidth, maxHeight}) }
                    : ph
                );
              }
              item.details = Object.assign({}, item.details || {}, det);
              // 把常用欄位也同步一下
              if (det.rating != null) item.rating = det.rating;
              if (det.user_ratings_total != null) item.user_ratings_total = det.user_ratings_total;
            }
          } catch(e) { console.warn('[ensurePlaceDetails] fallback failed', e); }
        };
      }

      // ===== RECO: 全域可調參數 =====
      window.RECO_MIN_DIST_M = window.RECO_MIN_DIST_M ?? 80;   // 推薦與錨點最小距離（原本 300 太嚴）
      window.RECO_MAX_PER_ANCHOR = window.RECO_MAX_PER_ANCHOR ?? 60; // 每個 anchor 上限
      window.RECO_BADTYPE_RX = window.RECO_BADTYPE_RX
        || /^(plus_code|route|political|administrative_area_level_\d*|locality|sublocality)$/i;


      // NearbySearch 取「所有分頁」
      async function nearbyAllPages(req){
        return new Promise((resolve) => {
          const all = [];
          function onRecv(results, status, pagination){
            if (status === google.maps.places.PlacesServiceStatus.OK && Array.isArray(results)) {
              all.push(...results);
            }
            if (pagination && pagination.hasNextPage) {
              // 官方需要小 delay 才能 nextPage()
              setTimeout(()=> pagination.nextPage(), 300);
            } else {
              resolve(all);
            }
          }
          window.placesService.nearbySearch(req, onRecv);
        });
      }
      
      // ==== RECO: 品質門檻（可依需要調整）====
      window.RECO_MIN_RATING     = window.RECO_MIN_RATING     ?? 3.8;  // 最低星等
      window.RECO_MIN_REVIEWS    = window.RECO_MIN_REVIEWS    ?? 10;   // 最少評論數
      window.RECO_REQUIRE_RATING = window.RECO_REQUIRE_RATING ?? true; // 無評分是否剔除
      window.RECO_EXCLUDE_PLUSCODE = window.RECO_EXCLUDE_PLUSCODE ?? true;

      // 已有的壞類型正則（若你之前定義了就沿用）
      window.RECO_BADTYPE_RX = window.RECO_BADTYPE_RX || /^(plus_code|route|political|administrative_area_level_\d*|locality|sublocality)$/i;

      // 以評分/評論/營業狀態/地址型態等做品質判斷
      function passesQuality(p){
        // 非營業直接剔除
        if (p.business_status && p.business_status !== 'OPERATIONAL') return false;

        // 不良類型剔除
        const types = Array.isArray(p.types) ? p.types : [];
        if (types.some(t => window.RECO_BADTYPE_RX.test(t))) return false;

        // Plus Code（像 "PHCR+H75"）通常不是實體景點 → 剔除
        if (window.RECO_EXCLUDE_PLUSCODE) {
          const addr = String(p.formatted_address || p.vicinity || '');
          if (/\b[A-Z0-9]{4,}\+[A-Z0-9]{2,}\b/.test(addr)) return false;
        }

        // 星等/評論數門檻
        const r = Number(p.rating);
        const n = Number(p.user_ratings_total ?? p.userRatingsTotal ?? 0);
        if (window.RECO_REQUIRE_RATING && !(r > 0)) return false; // N/A → 剔除
        if (r && r < window.RECO_MIN_RATING) return false;
        if (window.RECO_MIN_REVIEWS > 0 && !(n >= window.RECO_MIN_REVIEWS)) return false;

        return true;
      }

      // === 1) 定義全域 makeRecoHoverItem（用 generateRecoReason）===
      (function(){
        // 若你沒貼過 generateRecoReason，請先貼我之前給的產生器；這裡假設已存在
        window.makeRecoHoverItem = function makeRecoHoverItem(place, opts = {}) {
          const loc = place?.geometry?.location;
          const pos = loc?.toJSON?.() ||
                      (typeof loc?.lat === 'function' ? { lat: loc.lat(), lng: loc.lng() } : null);
          const keyword = String(opts.keyword || '').trim();

          const reason = (typeof window.generateRecoReason === 'function')
            ? window.generateRecoReason(place, { keyword, anchor: opts.anchorLatLng })
            : 'Recommended nearby';

          const item = {
            name: place?.name || 'Place',
            place_id: place?.place_id || place?.id || null,
            rating: place?.rating,
            user_ratings_total: place?.user_ratings_total,
            formatted_address: place?.formatted_address || place?.vicinity || '',
            types: Array.isArray(place?.types) ? place.types : [],
            position: pos,
            subtitle: reason,
            keyword,
            details: {
            place_id: place?.place_id, name: place?.name,
              rating: place?.rating, user_ratings_total: place?.user_ratings_total,
              formatted_address: place?.formatted_address || place?.vicinity,
              types: Array.isArray(place?.types) ? place.types : [],
              geometry: place?.geometry, url: place?.url, website: place?.website,
              opening_hours: place?.opening_hours,
              editorial_summary: { overview: reason }
            },
            __kind: 'reco',
           __reason: reason,
            reco: { keyword, reason },
            __anchor: opts?.anchorLatLng || null
          };

          try {
            if (Array.isArray(place?.photos)) {
              item.details.photos = place.photos.map(ph =>
                (typeof ph?.createUrl === 'function')
                ? { getUrl: ({maxWidth,maxHeight}={}) => ph.createUrl({maxWidth,maxHeight}) }
                : ph
            );
            }
          } catch {}
          return item;
        };
        console.debug('[reco] makeRecoHoverItem (global) installed');
      })();

      window.addRecoMarker = function addRecoMarker(place, opts = {}) {
        const pos = place?.geometry?.location?.toJSON?.();
        if (!pos) return null;

        const mk = new google.maps.Marker({
          map: window.map,
          position: pos,
          icon: {
            path: "M12 .587l3.668 7.431 8.207 1.193-5.938 5.79 1.402 8.169L12 18.896 4.661 23.17l1.402-8.169L.125 9.211l8.207-1.193L12 .587z",
            fillColor: "#f6c343",
            fillOpacity: 1,
            strokeColor: "#8a6e20",
            strokeWeight: 1.2,
            scale: 1.2,
            anchor: new google.maps.Point(12, 12),
            labelOrigin: new google.maps.Point(12, -2),
          },
          title: place?.name || "",
          zIndex: 1000,
        });

        // === 推入全域容器 ===
        const _sug = Array.isArray(window.suggestionMarkers) ? window.suggestionMarkers : [];
        window.suggestionMarkers = [..._sug, { marker: mk }];

        const _reco = Array.isArray(window.RECO_MARKERS) ? window.RECO_MARKERS : [];
        window.RECO_MARKERS = _reco.includes(mk) ? _reco : [..._reco, mk];
        
        const _all = Array.isArray(window.__ALL_MARKERS__) ? window.__ALL_MARKERS__ : [];
        window.__ALL_MARKERS__ = [..._all, mk];

        mk.place = place;
        mk.__type = 'reco';
        mk.__category = (opts?.keyword || '').trim();
        mk.setVisible(true);

        // === 建立 hoverItem ===
        try {
          if (typeof window.makeRecoHoverItem === 'function') {
            mk.__hoverItem = window.makeRecoHoverItem(place, opts);
          }
          if (mk.__hoverItem) {
            mk.__hoverItem.__anchor = opts?.anchorLatLng || mk.__hoverItem.__anchor || null;
          }
        } catch (e) {
          console.warn('[reco] makeRecoHoverItem failed', e);
        }
        
        // === 點擊後顯示 Hover card，一次只留一張 ===
        mk.addListener('click', async () => {
          const it = mk.__hoverItem;
          if (!it) return;

          try {
            // 1) 先允許關掉「前一個推薦點卡片」
            if (typeof window.hideHoverCard === 'function') {
              // 特別標記：這是我們自己要關的，等一下 patch 會放行
              window.hideHoverCard(0, { forceFromReco: true });
            }

            // 2) 補細節（照片、網址等）
            if (typeof window.ensurePlaceDetails === 'function') {
              await window.ensurePlaceDetails(it);
            }

            // 3) 顯示新的卡片
            if (typeof window.showHoverCard === 'function') {
              window.showHoverCard(it, { compact: false });
            }

            // 4) 記住現在這張卡片是「推薦點」
            window.__lastHoverItem  = it;
            window.__lastHoverPlace = it;

            // ⭐ 5) 自動收起（5 秒）
            if (window.__recoAutoHideTimer) {
              clearTimeout(window.__recoAutoHideTimer);
            }

            window.__recoAutoHideTimer = setTimeout(() => {
              try {
                const card = document.getElementById('hover-card');
                if (!card) return;

                const ds = card.dataset || {};

                // 使用者若 hover 或 sticky，就不要自動收起
                if (ds.hover === '1' || ds.sticky === '1') return;

                window.hideHoverCard(0, { force: true, forceFromReco: true });
              } catch (e) {
                console.warn('[reco] auto-hide hover error', e);
              }
            }, 5000); // 改成 3000 就是 3 秒

          } catch (e) {
            console.warn('[reco] click-only hover error', e);
          }
        });
        return mk;
      };

      (function patchAddRecoMarker(){
        if (typeof window.addRecoMarker !== 'function' || window.addRecoMarker.__recoPatched) return;
        const orig = window.addRecoMarker;

        window.addRecoMarker = function wrappedAddRecoMarker(place, opts={}){
          const mk = orig(place, opts);
          if (!mk) return mk;

          // 強制 suggestionMarkers 成為真正陣列
          try { if (!Array.isArray(window.suggestionMarkers)) { delete window.suggestionMarkers; window.suggestionMarkers = []; } } catch {}

          (window.suggestionMarkers ||= []).push({ marker: mk });
          (window.RECO_MARKERS     ||= []).includes(mk) || window.RECO_MARKERS.push(mk);
          (window.__ALL_MARKERS__  ||= []).push(mk);

          try {
            if (!mk.__hoverItem && typeof window.makeRecoHoverItem === 'function') {
             mk.__hoverItem = window.makeRecoHoverItem(place, opts);
           }
            if (mk.__hoverItem) mk.__hoverItem.__anchor = opts?.anchorLatLng || mk.__hoverItem.__anchor || null;
          } catch {}

          return mk;
        };
        window.addRecoMarker.__recoPatched = true;
      })();


      // ---------------- core: find ----------------
      const $ = (sel) => document.querySelector(sel);
      const rangeInput = document.getElementById('rec-range-km') || $("[data-role='recommend-range']") || $('#recommend-range-km');
      const kwInput    = document.getElementById('rec-keyword')   || $("[data-role='recommend-keyword']") || $('#recommend-keyword');
      
      /* === PATCH: Recommendations helpers & wiring (safe, scoped) === */
      (function(){
        // 1) 取得當天行程的錨點（沒有就用地圖中心）
        if (typeof window.getAnchors !== 'function') {
          window.getAnchors = function getAnchors(){
            try {
              const day = (typeof getCurrentDay === 'function') ? getCurrentDay() : (window.currentDay || 1);
              const stops = (typeof getStopsOfDay === 'function')
                ? getStopsOfDay(day)
                : (window.stops || []).filter(s => Number(s.day || 1) === Number(day));

              const toLL = (v) => {
                if (!v) return null;
                if (typeof v.toJSON === 'function') return v.toJSON();
                if (typeof v.lat === 'function' && typeof v.lng === 'function') return { lat:v.lat(), lng:v.lng() };
                if (typeof v.lat === 'number' && typeof v.lng === 'number') return { lat:Number(v.lat), lng:Number(v.lng) };
                return null;
              };

              const arr = stops.map(s => toLL(s.position || s.location || s.details?.geometry?.location)).filter(Boolean);
              return arr.length ? arr : [ toLL(window.map?.getCenter()) ].filter(Boolean);
            } catch(e) {
              console.warn('[getAnchors] failed:', e);
              return [];
            }
          };
        }

        // 2) 傳回一個「距離 anchors 至少 meters 公尺」的判斷函式
        if (typeof window.notNearAnchors !== 'function') {
          window.notNearAnchors = function notNearAnchors(anchors, meters = 300){
            if (!Array.isArray(anchors) || !anchors.length) return () => true;
            const R=6371000, toRad=d=>d*Math.PI/180;
            const dist=(a,b)=>{
              const dLat=toRad(b.lat-a.lat), dLng=toRad(b.lng-a.lng);
              const s1=Math.sin(dLat/2), s2=Math.sin(dLng/2);
              const h=s1*s1 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*s2*s2;
              return 2*R*Math.atan2(Math.sqrt(h), Math.sqrt(1-h));
            };
            return (place)=>{
              try{
                const L = place?.geometry?.location;
                const pos = L?.toJSON?.() || (typeof L?.lat==='function' ? {lat:L.lat(), lng:L.lng()} : null);
                if   (!pos) return true;
              return anchors.every(a => dist(pos, a) > meters);
              }catch{ return true; }
            };
          };
        }

        // 3) 追蹤所有推薦星星，讓清除/除錯可用
        (function trackRecoMarkers(){
          const push = (m)=>{ try{ (window.RECO_MARKERS ||= []).push(m); (window.__ALL_MARKERS__ ||= []).push(m); }catch{} };
          // 如果你有覆蓋 window.addRecoMarker，請在建立 marker 之後呼叫 push(marker)
          // 若你沒覆蓋，這裡嘗試包一層：僅在尚未包裝過時進行。
          if (typeof window.addRecoMarker === 'function' && !window.addRecoMarker.__tracked) {
            const orig = window.addRecoMarker;
            window.addRecoMarker = function wrappedAddRecoMarker(){
              const mk = orig.apply(this, arguments);
              if (mk && mk.setMap) push(mk);
              return mk;
            };
            window.addRecoMarker.__tracked = true;
          }
       })();

       // 1) 強化清除：支援 {marker} 與 marker 兩種結構；並掃 __ALL_MARKERS__ 的 __type==='reco'
      window.clearRecommendations = function clearRecommendations(){
        try {
          const kill = (m)=>{ try{ m && m.setMap && m.setMap(null); }catch{} };

          // suggestionMarkers 可能是 [Marker] 或 [{marker}]
          if (Array.isArray(window.suggestionMarkers)) {
            for (const x of window.suggestionMarkers) kill(x?.marker || x);
            window.suggestionMarkers.length = 0;
          }

          if (Array.isArray(window.RECO_MARKERS)) {
            for (const m of window.RECO_MARKERS) kill(m);
            window.RECO_MARKERS.length = 0;
          }

          // 掃全池：把 __type === 'reco' 的也清掉
          if (Array.isArray(window.__ALL_MARKERS__)) {
            for (const m of window.__ALL_MARKERS__) {
              if (m && m.__type === 'reco') kill(m);
            }
          }
          // 可見性再刷新一下
          window.applySuggestionVisibility?.();
            console.debug('[reco] CLEAR done');
          } catch(e){
            console.warn('[reco] clear error', e);
          }
        };


        window.hardClearRecommendations = function hardClearRecommendations(){
          try { window.clearRecommendations(); } catch {}
          try {
            if (Array.isArray(window.__ALL_MARKERS__)) {
              window.__ALL_MARKERS__ = window.__ALL_MARKERS__.filter(m => !(m && m.__type === 'reco'));
            }
          } catch {}
          console.debug('[reco] HARD CLEAR done');
        };
        // 2) 穩定綁定：兼容多種 ID / data-*；支援動態渲染
        (function bindRecoButtons(){
          if (document.__recoBoundOnce) return;
          document.__recoBoundOnce = true;

          // 直接綁現有節點
          const findBtn  = document.querySelector('#btn-recommend-find, button#find-recommendations, [data-role="find-recommendations"], [data-action="reco-find"]');
          const clearBtn = document.querySelector('#btn-recommend-clear, button#clear-recommendations, [data-role="clear-recommendations"], [data-action="reco-clear"]');

          findBtn && findBtn.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); window.findRecommendations?.(); }, true);
          clearBtn && clearBtn.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); window.hardClearRecommendations?.(); }, true);

          // 事件委派（因應之後 SPA 動態渲染）
            document.addEventListener('click', (ev)=>{
              const f = ev.target.closest('#btn-recommend-find, button#find-recommendations, [data-role="find-recommendations"], [data-action="reco-find"]');
            if (f){ ev.preventDefault(); ev.stopPropagation(); return void window.findRecommendations?.(); }

              const c = ev.target.closest('#btn-recommend-clear, button#clear-recommendations, [data-role="clear-recommendations"], [data-action="reco-clear"]');
              if (c){ ev.preventDefault(); ev.stopPropagation(); return void window.hardClearRecommendations?.(); }
            }, true);
          console.debug('[reco] buttons bound (find/clear)');
        })();
      })();

      async function findRecommendations() {
        const anchors = window.getAnchors?.() || [];
        const notNear = window.notNearAnchors?.(anchors, window.RECO_MIN_DIST_M) || (() => true);

        ensurePS();
        if (!window.placesService) return;

        // === inputs: 兼容新舊欄位 ID，只看 range，不看 keyword ===
        const $ = (s) => document.querySelector(s);

        const rangeInput =
          document.getElementById('rec-range-km') ||
          $("[data-role='recommend-range']") ||
          document.getElementById('recommend-range-km') ||
          document.getElementById('range-km');

        const kmNum = Number(rangeInput?.value ?? 3);
        const km    = Number.isFinite(kmNum) && kmNum > 0 ? kmNum : 3;
        const radius = Math.min(30000, Math.round(km * 1000));

        window.clearRecommendations?.();

        const stopsIdx   = buildStopIndex();
        const notInStops = makeNotInStopsFilter(stopsIdx, 250);

        // 🔹只做「無 keyword：景點推薦」
        await Promise.all(
          anchors.map(async (anchor) => {
            const req = { location: new google.maps.LatLng(anchor), radius, type: 'tourist_attraction' };
            const results = await nearbyAllPages(req);

            const base = dedupePlaces(results).filter(p =>
              notNear(p) &&           // 不要太靠近 anchor
              notInStops(p) &&        // 不與行程點重疊
              passesQuality(p)        // 品質門檻
            );

            const refined = refinePlaces(base, anchor);  // 使用 RECO_PREFS
            const take = Math.min(refined.length, window.RECO_MAX_PER_ANCHOR || refined.length);

            // types -> keyword (給 hover card 用的小標籤)
            const kwMap = {
              restaurant:'restaurant',
              cafe:'cafe',
              bar:'bar',
              bakery:'bakery',
              lodging:'hotel',
              tourist_attraction:'attraction'
            };

            refined.slice(0, take).forEach(p => {
              const types = Array.isArray(p.types) ? p.types : [];
              const kw = types.reduce((acc, t) => acc || kwMap[t], '') || 'nearby';
              addRecoMarker(p, { anchorLatLng: anchor, keyword: kw });
            });
          })
        );

        window.applySuggestionVisibility?.();
        window.rebuildSuggestionNow?.();
        window._findRecommendationsImpl = findRecommendations;
      }


      // === 回填既有星星到 suggestionMarkers + 補 hoverItem/anchor ===
      window.rebuildSuggestionNow = function rebuildSuggestionNow(){
        // 1) 找出地圖上的推薦星星
        const byType = (window.__ALL_MARKERS__ || []).filter(m => m && m.__type === 'reco');
        const byIcon = (window.__ALL_MARKERS__ || []).filter(m => {
          try {
            const ic = (typeof m.getIcon === 'function') ? m.getIcon() : m.icon;
            const path = (ic && ic.path) || '';
            return String(path).includes('M12 .587l3.668 7.431'); // 你的星星 path 前綴
          } catch(_) { return false; }
        });
        const pool =
          (window.RECO_MARKERS && window.RECO_MARKERS.length ? window.RECO_MARKERS : null) ||
          (byType.length ? byType : null) ||
          (byIcon.length ? byIcon : []);

        // 2) 直接指派（不要用 push/length=0）
        window.suggestionMarkers = pool.map(mk => ({ marker: mk }));

        // 3) 補 hoverItem / anchor
        const anchors = (typeof window.getAnchors === 'function') ? window.getAnchors() : [];
        const an = anchors[0] || null;

          pool.forEach(mk => {
          try {
            const place = mk.place || mk.__hoverItem?.details || {};
            if (!mk.__hoverItem && typeof window.makeRecoHoverItem === 'function') {
              mk.__hoverItem = window.makeRecoHoverItem(place, { anchorLatLng: an, keyword: mk.__category || '' });
            }
            if (mk.__hoverItem) mk.__hoverItem.__anchor = mk.__hoverItem.__anchor || an || null;
          } catch(_) {}
        });

        console.log('[reco] rebuilt from pool:', { pool: pool.length, sugg: window.suggestionMarkers.length });
        window.applySuggestionVisibility?.();
      };

      // 放在 whenMapsReady 裡、或檔案最後執行一次
      (function delegateRecoButtons(){
        if (document.__recoDelegated) return;
        document.__recoDelegated = true;

        document.addEventListener('click', (ev) => {
          const findBtn = ev.target.closest(
            '#btn-recommend-find, button#find-recommendations, button[data-role="find-recommendations"]'
          );
          if (findBtn) {
            ev.preventDefault(); ev.stopPropagation();
              if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
            return void window.findRecommendations?.();
          }

          const clearBtn = ev.target.closest(
            '#btn-recommend-clear, button#clear-recommendations, button[data-role="clear-recommendations"]'
          );
          if (clearBtn) {
            ev.preventDefault(); ev.stopPropagation();
            if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
            return void window.clearRecommendations?.();
          }
        }, true);

        console.debug('[reco] click delegation ON');
      })();

      // ---------------- expose & delegation ----------------
      window.findRecommendations  = findRecommendations;
      console.debug('[Reco] APIs exposed:', typeof window.findRecommendations, typeof window.clearRecommendations);

      // === RECO: visibility control (map-based, unified) ===
      window.applySuggestionVisibility = function applySuggestionVisibility(){
        const gmap = (window.nowMap && window.nowMap()) || window.map;
        if (!gmap) return;

        const zoom = gmap.getZoom?.() ?? 0;
        const tooFar = zoom < (window.SUGGEST_MIN_ZOOM ?? 8);

        const show = (m, v) => {
          try {
            if (!m) return;
            if (typeof m.setVisible === 'function') m.setVisible(v);
            // 若 marker 不在地圖上但應該可見 → 補上 map
            if (v && typeof m.getMap === 'function' && !m.getMap()) m.setMap(gmap);
          } catch(e) {}
        };

        // 兼容兩種形狀: [{marker: mk}] 或 [mk]
        (window.suggestionMarkers || []).forEach(sm => show(sm?.marker || sm, !tooFar));
        (window.RECO_MARKERS      || []).forEach(m  => show(m, !tooFar));

        console.debug('[reco] applySuggestionVisibility ok, count=',
          (window.suggestionMarkers||[]).length, '/', (window.RECO_MARKERS||[]).length);
      };

      window.__RECO_V2_READY__ = true;
      console.debug('[Reco] v2 ready');
    } catch (e) {
      console.error('[Reco] init failed:', e);
    }
    
    /* === RECO: rescue wiring + verbose logs === */
    (function recoRescue(){
      // A. 強制把按鈕重新綁一次（捕獲階段、只綁一次）
      const qFind  = '#btn-recommend-find, button#find-recommendations, button[data-role="find-recommendations"]';
      const qClear = '#btn-recommend-clear,  button#clear-recommendations, button[data-role="clear-recommendations"]';
      const bindOnce = (btn, fn, tag) => {
        if (!btn) { console.warn('[reco]', tag, 'btn not found'); return; }
        if (btn.__recoRescueBound) { console.debug('[reco]', tag, 'already bound'); return; }
        btn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation?.();
        try { fn(); } catch(err){ console.error('[reco]', tag, 'run error', err); }
      }, true);
        btn.__recoRescueBound = true;
        console.debug('[reco]', tag, 'bound');
      } ;
      bindOnce(document.querySelector(qFind),  () => window.findRecommendations?.(), 'find');
      bindOnce(document.querySelector(qClear), () => (window.hardClearRecommendations?.() ?? window.clearRecommendations?.()), 'clear');

      // === RECO: 偏好設定（可在 console 直接改） ===
      window.RECO_PREFS = window.RECO_PREFS || {
        minRating: 4.0,            // 最低星等
        minReviews: 20,            // 最少評價數
        maxKm: 0,                  // 最遠距離（公里）；0 表示不限制
        allowTypes: [],            // 只允許的類別，例如 ['restaurant','cafe']；空陣列=不限制
        sort: 'score',             // 'score' | 'rating' | 'distance' | 'reviews'
        perAnchorLimit: 30         // 每個 anchor 取幾個（再加上你的 slice 上限）
      };

      // 快速修改偏好：setRecoPrefs({ minRating:4.3, sort:'rating' })
      window.setRecoPrefs = (p={}) => Object.assign(window.RECO_PREFS, p);

      // 共用距離 & 篩選排序
      function distKmFrom(place, anchor){
        try{
          const L = place?.geometry?.location;
          const b = L?.toJSON?.() || (typeof L?.lat==='function' ? { lat:L.lat(), lng:L.lng() } : null);
          const a = anchor; if(!a || !b) return Infinity;
          const R=6371,rad=d=>d*Math.PI/180;
          const dLat=rad(b.lat-a.lat), dLng=rad(b.lng-a.lng);
          const s1=Math.sin(dLat/2), s2=Math.sin(dLng/2);
          const h=s1*s1 + Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*s2*s2;
          return 2*R*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
        }catch{ return Infinity; }
      }

      window.refinePlaces = function refinePlaces(list, anchor){
        const P = window.RECO_PREFS || {};
        const goodType = ts => !P.allowTypes?.length || (ts||[]).some(t => P.allowTypes.includes(t));

        const arr = (list||[]).filter(p=>{
          const r=+p.rating||0, n=+p.user_ratings_total||0, d=distKmFrom(p, anchor);
          const ts=Array.isArray(p.types)?p.types:[];
          if (window.RECO_BADTYPE_RX && ts.some(t=>window.RECO_BADTYPE_RX.test(t))) return false;
          if (P.minRating && r < P.minRating) return false;
          if (P.minReviews && n < P.minReviews) return false;
          if (P.maxKm && Number.isFinite(d) && d > P.maxKm) return false;
          if (!goodType(ts)) return false;
          return true;
        });

        const by=String(P.sort||'score');
        arr.sort((a,b)=>{
          const ar=+a.rating||0, br=+b.rating||0;
          const an=+a.user_ratings_total||0, bn=+b.user_ratings_total||0;
          const ad=distKmFrom(a, anchor), bd=distKmFrom(b, anchor);
          if(by==='rating')   return (br-ar)||(bn-an)||(ad-bd);
          if(by==='distance') return (ad-bd)||(br-ar)||(bn-an);
          if(by==='reviews')  return (bn-an)||(br-ar)||(ad-bd);
          const as=ar*2 + Math.log10(Math.max(1,an+1)) - (Number.isFinite(ad)?ad/10:0);
          const bs=br*2 + Math.log10(Math.max(1,bn+1)) - (Number.isFinite(bd)?bd/10:0);
          return (bs-as)||(ad-bd);
        });

        return arr.slice(0, P.perAnchorLimit || 30);
      };
      console.debug('[reco] refinePlaces hot-patch ready');

      function _prettySummary(it){
        const kw = it?.reco?.keyword || it?.keyword || it?.reco2?.keyword || '';
        const r  = Number(it?.rating);
        const n  = Number(it?.user_ratings_total || it?.userRatingsTotal);

        let km = '';
        try{
          const an=it?.__anchor, pos=it?.position;
          if(an&&pos){
            const R=6371,rad=d=>d*Math.PI/180;
            const dLat=rad(pos.lat-an.lat), dLng=rad(pos.lng-an.lng);
            const s1=Math.sin(dLat/2), s2=Math.sin(dLng/2);
            const h=s1*s1+Math.cos(rad(an.lat))*Math.cos(rad(pos.lat))*s2*s2;
            const d=2*R*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
            if(Number.isFinite(d)) km=`${d.toFixed(1)} km`;
          }
        }catch{}

        const chips=[]; if(kw)chips.push(`🔎 ${kw}`); if(km)chips.push(`📏 ${km}`); if(r)chips.push(`⭐ ${r}${n?` (${n})`:''}`);
        return { oneLine: chips.join(' · '), multi: chips.join('\n'), keyword: kw };
      }

      (function patchShowHoverCard(){
        if (typeof window.showHoverCard!=='function' || window.showHoverCard.__recoPretty) return;
        const orig=window.showHoverCard;
        window.showHoverCard = function(it, opts){
          try{
            if(it){
              const fmt=_prettySummary(it);
              const isOld=s=>!s || /Keyword:|Google\s*評分/.test(String(s));
              if(isOld(it.subtitle))    it.subtitle=fmt.oneLine;
              if(isOld(it.description)) it.description=fmt.multi;
              it.reco  = Object.assign({}, it.reco,  { keyword: fmt.keyword, reason: fmt.multi });
              it.reco2 = { keyword: fmt.keyword, reason: fmt.multi };
              it.reason = it.__reason = fmt.multi;
              if(it.details){ const ed=(it.details.editorial_summary ||= {}); ed.overview = ed.overview || fmt.multi; }
            }
          }catch(e){ console.warn('[reco] pretty showHoverCard fail', e); }
          return orig.call(this, it, opts);
        };
        window.showHoverCard.__recoPretty = true;
      })();

      // 讓 hover 卡片摘要更好看（🔎 / 📏 / ⭐）
      function decorateHoverItemForCard(it){
        try {
          if (!it) return;
          const kw = it?.reco?.keyword || it?.keyword || '';
          const r  = Number(it?.rating);
          const n  = Number(it?.user_ratings_total || it?.userRatingsTotal);
          const an = it?.__anchor;
          let km = '';

          if (an && it?.position) {
            const d = distKmFrom({ geometry:{ location:{ toJSON:()=>it.position } } }, an);
            if (Number.isFinite(d)) km = `${d.toFixed(1)} km`;
          }

          // === 建立多行說明 ===
          const lines = [];
          if (kw) lines.push(`🔎 ${kw}`);
          if (km) lines.push(`📏 ${km}`);
          if (r)  lines.push(`⭐ ${r}${n ? ` (${n})` : ''}`);
          const joined = lines.join('\n'); // ← 換行

          // === 顯示內容 ===
          it.subtitle    = lines.join(' · '); // 卡片副標保留一行 summary
          it.description = joined;            // 多行版本放在 description
          it.reason      = it.reason || joined;
          it.reco.reason = it.reco.reason || joined;

          if (it.details) {
            const ed = (it.details.editorial_summary ||= {});
            ed.overview = ed.overview || joined;
          }

        } catch (err) {
          console.warn('[reco] decorateHoverItemForCard error', err);
        }      
      }

      // B. 在 findRecommendations 前後加詳細日誌（若已經加過不會重覆）
      if (typeof window.findRecommendations === 'function' && !window.findRecommendations.__recoVerbose) {
        const orig = window.findRecommendations;
        window.findRecommendations = async function(){
          try {
            const kwInput  = document.getElementById('rec-keyword') || document.querySelector("[data-role='recommend-keyword']") || document.querySelector('#recommend-keyword');
            const rangeEl  = document.getElementById('rec-range-km') || document.querySelector("[data-role='recommend-range']")   || document.querySelector('#recommend-range-km');
            const rawKw    = (kwInput?.value || '').trim();
            const km       = Math.max(0.3, Number(rangeEl?.value || 3));
            const radius   = Math.min(30000, Math.round(km * 1000));
            const anchors  = (typeof window.getAnchors === 'function') ? window.getAnchors() : [];
            console.debug('[reco] find() start', { rawKw, km, radius, anchors });

            // 若沒有 anchors，退而用地圖中心
            if (!Array.isArray(anchors) || anchors.length === 0) {
              const c = window.map?.getCenter?.()?.toJSON?.();
              if (c) { console.warn('[reco] no anchors, fallback to map center'); window.__RECO_FORCE_ANCHORS__ = [c]; }
            } else {
              window.__RECO_FORCE_ANCHORS__ = anchors;
            }

            // PlacesService 可用性
            if (!window.placesService) {
              const gmap = window.map;
              if (gmap && window.google?.maps?.places?.PlacesService) {
                window.placesService = new google.maps.places.PlacesService(gmap);
              }
           }
            console.debug('[reco] ps ready?', !!window.placesService);

            const t0 = performance.now();
            const r  = await orig();   // 呼叫原實作
            console.debug('[reco] find() done in', Math.round(performance.now()-t0)+'ms',
                          'markers=', (window.suggestionMarkers||[]).length,
                          'recoTracked=', (window.RECO_MARKERS||[]).length);
            return r;
          } catch (e) {
           console.error('[reco] find() error', e);
          }
        };
        window.findRecommendations.__recoVerbose = true;
      }

      // C. 清除時也印出數量，確認有清
      if (typeof window.clearRecommendations === 'function' && !window.clearRecommendations.__recoVerbose) {
          const origClear = window.clearRecommendations;
          window.clearRecommendations = function(){
            const beforeA = (window.suggestionMarkers||[]).length;
            const beforeB = (window.RECO_MARKERS||[]).length;
            const r = origClear();
            console.debug('[reco] clear done, suggestionMarkers:', (window.suggestionMarkers||[]).length,
                          'RECO_MARKERS:', (window.RECO_MARKERS||[]).length, '(before', beforeA, '/', beforeB, ')');
            return r;
      };
        window.clearRecommendations.__recoVerbose = true;
      }
    })();
    
    // === RECO: auto-run once after map is idle ===
    whenMapsReady(() => {
      const run = () => window.findRecommendations?.();
        if (window.map && google?.maps?.event?.addListenerOnce) {
        google.maps.event.addListenerOnce(window.map, 'idle', run);
      } else {
        setTimeout(run, 0);
      }
    });

    // === RECO: HoverCard 補強 — 顯示 keyword / reason (防重複) ===
    if (!window.__HC_RECO_PATCH__ && typeof window.showHoverCard === 'function') {
      // 一次注入一些簡單樣式（只注一次）
      if (!document.getElementById('reco-lines-css')) {
        const css = `
          .reco-lines{ display:grid; gap:2px; margin-top:2px; }
          .reco-lines .line{ font-size:12px; color:#5b6470; line-height:1.25; display:flex; gap:6px; align-items:center; }
          .reco-lines .muted{ opacity:.8; }
        `.trim();
        const st = document.createElement('style');
        st.id = 'reco-lines-css';
        st.textContent = css;
        document.head.appendChild(st);
      }

      const kmBetween = (a,b)=>{ try{
        const R=6371, t=x=>x*Math.PI/180;
        const dLat=t(b.lat-a.lat), dLng=t(b.lng-a.lng);
        const s1=Math.sin(dLat/2), s2=Math.sin(dLng/2);
        const h=s1*s1 + Math.cos(t(a.lat))*Math.cos(t(b.lat))*s2*s2;
        return R*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
      }catch{return null;} };

      const origShow = window.showHoverCard;
      window.showHoverCard = function patchedShowHoverCard(it, opts){
        // 先照原本流程顯示卡片
        const r = origShow(it, opts);

        try {
          if (it && it.__kind === 'reco') {
            // 準備資料
            const kw  = (it.reco?.keyword || '').trim();
            const pos = it?.position || it?.details?.geometry?.location?.toJSON?.();
            const anc = it?.__anchor || null;
            const km  = (pos && anc) ? kmBetween(anc, pos) : null;
            const rVal= Number(it?.rating ?? it?.details?.rating ?? NaN);
            const nVal= Number(it?.user_ratings_total ?? it?.details?.user_ratings_total ?? NaN);
            let reason= (it.__reason || it.reco?.reason || '')
                          .replace(/\bKeyword\s*:\s*[^·]+[·]?/gi,'').trim();

            // 找到卡片容器與放文字的位置（盡量相容）
            queueMicrotask(() => {
             const card = document.querySelector('#hover-card, .hover-card, [data-role="hover-card"]') || document.body;
              const host = card.querySelector('.hc-subtitle, .hc-desc, [data-field="subtitle"], [data-field="description"]')
                        || card.querySelector('.hc-body, .content');

              if (!host) return;

              // 生成多行 DOM
              const box = document.createElement('div');
              box.className = 'reco-lines';
              if (kw) {
                const d = document.createElement('div'); d.className='line'; d.textContent = `🔎 ${kw}`; box.appendChild(d);
              }
              if (km!=null && isFinite(km)) {
                const d = document.createElement('div'); d.className='line'; d.textContent = `📏 ${km.toFixed(km<1?2:1)} km`; box.appendChild(d);
              }
              if (isFinite(rVal)) {
                const d = document.createElement('div'); d.className='line'; d.textContent = `⭐ ${rVal}${isFinite(nVal)?` (${nVal})`:''}`; box.appendChild(d);
              }
              if (reason) {
                const d = document.createElement('div'); d.className='line muted';
                d.textContent = reason; box.appendChild(d);
              }

              // 先清掉舊的單行拼字（若存在），再插入我們的多行
              // 儘量不破壞原本排版：插入到 host 的最前面
              const old = host.querySelector('.reco-lines');
              if (old) old.remove();
              host.prepend(box);
            });
          }
        } catch (e) {
          console.warn('[reco] hover multiline patch failed', e);
        }

        return r;
      };

      window.__HC_RECO_PATCH__ = true;
      console.debug('[reco] hover patch (multiline) installed');
    }
    
    (function(){
      // 小工具
      const kmBetween = (a,b)=>{ try{
        const R=6371, t=x=>x*Math.PI/180;
        const dLat=t(b.lat-a.lat), dLng=t(b.lng-a.lng);
        const s1=Math.sin(dLat/2), s2=Math.sin(dLng/2);
        const h=s1*s1 + Math.cos(t(a.lat))*Math.cos(t(b.lat))*s2*s2;
        return R*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
      }catch{return null;} };

      // 類型 → 中文詞彙（補 keyword 用）
      const TYPE_ZH = {
        restaurant:'餐廳', cafe:'咖啡', bar:'酒吧', bakery:'烘焙',
        lodging:'住宿', tourist_attraction:'景點', museum:'博物館',
        park:'公園', beach:'海灘', spa:'溫泉'
      };

      // 主函式：回傳一段中文理由字串
      window.generateRecoReason = function generateRecoReason(place, {keyword='', anchor}={}){
        const kw = (keyword||'').trim();
        const types = Array.isArray(place?.types)? place.types : [];
        const typeWord = kw || TYPE_ZH[types.find(t=>TYPE_ZH[t])||''] || '';
        const r = Number(place?.rating);
        const n = Number(place?.user_ratings_total ?? 0);
        const bs = place?.business_status;
        const pos = place?.geometry?.location?.toJSON?.();
        const km = (anchor && pos) ? kmBetween(anchor, pos) : null;

        // 取官方摘要（若有）
        let ov = place?.editorial_summary?.overview || place?.editorialSummary?.overview || '';
        // 清理太長的摘要
        if (ov && ov.length > 120) ov = ov.slice(0, 117) + '…';

        // 組裝片段：有資料才放進來
        const parts = [];
        if (typeWord) parts.push(`Keyword: ${typeWord}`);
        if (km!=null && isFinite(km)) parts.push(`距離行程點約 ${km.toFixed(km<1?2:1)} 公里`);
        if (r) parts.push(`Google 評分 ${r}★${n>0?`（${n}則）`:''}`);
        if (bs && bs !== 'OPERATIONAL') parts.push('目前可能非營業');

        // 有官方摘要 → 放在最後；沒有就只用片段
        if (ov) {
          const head = parts.length ? parts.join(' · ') : 'Recommended nearby';
          return `${head} · ${ov}`;
        } else {
          return parts.length ? parts.join(' · ') : 'Recommended nearby';
        }
      };

      // 讓 makeRecoHoverItem/ addRecoMarker 使用
      if (typeof window.makeRecoHoverItem === 'function') {
        const orig = window.makeRecoHoverItem;
        window.makeRecoHoverItem = function patchedMakeRecoHoverItem(place, opts={}){
          const it = orig(place, opts) || {};
          // 保存錨點供距離用（你的 hover patch會用到）
          it.__anchor = opts.anchorLatLng || it.__anchor || null;

          // 產生 & 覆寫理由
          const reason = window.generateRecoReason(place, { keyword: opts.keyword||'', anchor: opts.anchorLatLng });
          it.__reason = reason;
          it.reco = Object.assign({}, it.reco||{}, { keyword: (opts.keyword||'').trim(), reason });

          // 也同步到幾個常見欄位，讓卡片能直接顯示
          it.subtitle = it.subtitle || reason;
          it.description = it.description || reason;
          it.details = it.details || {};
          if (!it.details.editorial_summary) it.details.editorial_summary = { overview: reason };
          return it;
        };
        window.makeRecoHoverItem.__recoAutoReason = true;
      }
      console.debug('[reco] auto-reason generator installed');
    })();
    
    // === [INIT] 回填既有星星到 suggestionMarkers 並補上 hoverItem ===
    (function rebuildSuggestion(){
      const dst = (window.suggestionMarkers ||= []);
      dst.length = 0;
      const src = (window.RECO_MARKERS || []);
      src.forEach(mk => dst.push({ marker: mk }));

      // 沒 hoverItem 的補起來
      const anchors = (typeof window.getAnchors === 'function') ? window.getAnchors() : [];
      const an = anchors[0] || null;

      src.forEach(mk => {
        try {
          const place = mk.place || mk.__hoverItem?.details || {};
          if (!mk.__hoverItem && typeof window.makeRecoHoverItem === 'function') {
            mk.__hoverItem = window.makeRecoHoverItem(place, { anchorLatLng: an, keyword: mk.__category || '' });
          }
          if (mk.__hoverItem) mk.__hoverItem.__anchor = mk.__hoverItem.__anchor || an || null;
        } catch (e) {
          console.warn('[reco] rebuild hoverItem failed:', e);
        }
      });

      console.log('[reco] rebuilt suggestionMarkers =', dst.length);
      window.applySuggestionVisibility?.();
    })();
    
    // === Utility: 重新生成推薦點卡片欄位（手動呼叫用） ===
    window.forcePrettyAll = function(){
      (window.suggestionMarkers || []).forEach(sm => {
        const it = sm?.marker?.__hoverItem;
        if (!it) return;

        const fmt = _prettySummary(it); // ← 若你叫別名 _pretty()，這裡改成 _pretty(it)

        it.subtitle    = fmt.oneLine;
        it.description = fmt.multi;

        it.reco  = Object.assign({}, it.reco,  { keyword: fmt.keyword, reason: fmt.multi });
        it.reco2 = { keyword: fmt.keyword, reason: fmt.multi };
        it.reason = it.__reason = fmt.multi;

        if (it.details) {
          const ed = (it.details.editorial_summary ||= {});
          ed.overview = fmt.multi;
        }
      });

      console.debug('[reco] forcePrettyAll done', (window.suggestionMarkers||[]).length);
    };
    
    // === PATCH: 強化 showHoverCard（自動美化推薦點格式） ===
    (function installPrettyShowHoverCard(){
      const orig = window.showHoverCard;
      if (typeof orig !== 'function') {
        console.warn('[reco] showHoverCard not found');
        return;
      }

      // ===== 格式生成器 =====
      function pretty(it){
        const kw = it?.reco?.keyword || it?.keyword || it?.reco2?.keyword || '';
        const r  = Number(it?.rating);
        const n  = Number(it?.user_ratings_total || it?.userRatingsTotal);
        let km = '';
        try {
          const an = it?.__anchor, pos = it?.position;
          if (an && pos) {
            const R=6371,rad=d=>d*Math.PI/180;
            const dLat=rad(pos.lat-an.lat), dLng=rad(pos.lng-an.lng);
            const s1=Math.sin(dLat/2), s2=Math.sin(dLng/2);
            const h=s1*s1 + Math.cos(rad(an.lat))*Math.cos(rad(pos.lat))*s2*s2;
            const d=2*R*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
            if (Number.isFinite(d)) km = `${d.toFixed(1)} km`;
          }
        } catch {}
        const chips=[];
        if(kw) chips.push(`🔎 ${kw}`);
        if(km) chips.push(`📏 ${km}`);
        if(r)  chips.push(`⭐ ${r}${n ? ` (${n})` : ''}`);
        return { oneLine: chips.join(' · '), multi: chips.join('\n'), keyword: kw };
      }

      // ===== 主體包裝 =====
      window.showHoverCard = function patchedShowHoverCard(it, opts){
        try {
          if (it) {
            const fmt = pretty(it);
            // 一律覆蓋舊格式
            it.subtitle    = fmt.oneLine;
            it.description = fmt.multi;
            it.reco  = Object.assign({}, it.reco,  { keyword: fmt.keyword, reason: fmt.multi });
            it.reco2 = { keyword: fmt.keyword, reason: fmt.multi };
            it.reason = it.__reason = fmt.multi;
            if (it.details) {
              const ed = (it.details.editorial_summary ||= {});
              ed.overview = fmt.multi;
            }
          }
        } catch (e) {
          console.warn('[reco] pretty patch error', e);
        }
        return orig.call(this, it, opts);
      };

      window.showHoverCard.__pretty = true;
      console.debug('[reco] pretty showHoverCard installed');
    })();

    /* === Hover Card 統一行為補丁：Add / Navigate / 連結修復 ================== */
    (function patchHoverCardActionsUnified(){
      if (window.__HC_ACTIONS_UNIFIED__) return;
        window.__HC_ACTIONS_UNIFIED__ = true;

        // ---- 1) 記住最近一次 showHoverCard 的 place-like（若已有 wrapper，不重複包） ----
        const _origShow = (typeof window.showHoverCard === 'function') ? window.showHoverCard : null;
        if (_origShow && !_origShow.__wrappedByUnifiedPatch__) {
          const wrapped = function(data, opt){
            try { window.__lastHoverPlace = data?.details || data?.place || data || null; } catch {}
            const r = _origShow.apply(this, arguments);
            // 每次顯示卡片後，重新檢查是否已綁事件
            setTimeout(bindOnCard, 0);
            // ★ 顯示後修正類別徽章
            setTimeout(updateTypeBadge, 0);
          return r;
        };
        wrapped.__wrappedByUnifiedPatch__ = true;
        window.showHoverCard = wrapped;
      }

      // ---- 2) 共用 helpers ----------------------------------------------------
      function curPlace(){
        return window.__lastSelectedPlace || window.__lastHoverPlace || null;
      }

      function minimalAddToDayFallback(place){
        const day = (typeof getCurrentDay === 'function') ? Number(getCurrentDay()) || 1 : Number(window.currentDay) || 1;
        const loc = place?.geometry?.location;
        const lat = (typeof loc?.lat === 'function') ? loc.lat() : (loc?.lat ?? place?.position?.lat);
        const lng = (typeof loc?.lng === 'function') ? loc.lng() : (loc?.lng ?? place?.position?.lng);
        const seq = (Array.isArray(window.stops) ? window.stops : []).filter(s => Number(s.day ?? 1) === day).length + 1;

        const stop = {
          id: 'tmp_' + Date.now(),
          name: place.name || place.title || 'Unnamed',
          place_id: place.place_id || place.placeId,
          formatted_address: place.formatted_address || place.vicinity,
          rating: place.rating,
          user_ratings_total: place.user_ratings_total || place.userRatingsTotal,
          types: place.types,
          position: { lat: Number(lat), lng: Number(lng) },
          lat: Number(lat), lng: Number(lng),
          day, seq
        };

        if (typeof addStop === 'function') {
          Promise.resolve(addStop(stop)).catch(e=>{
            console.warn('[HC/Unified] addStop 失敗，fallback push', e);
            (window.stops ||= []).push(stop);
          });
        } else {
          (window.stops ||= []).push(stop);
        }
        try { renderTimeline?.(); } catch {}
        try { renderStopsList?.(); } catch {}
        try { recomputeRouteSmart?.(day); } catch {}
        console.log(`[HC/Unified] 已加入：${stop.name} → Day ${day} (#${stop.seq})`);
      }

      function openNavigate(p){
        if (!p) return;
        const loc = p?.geometry?.location;
        const lat = (typeof loc?.lat === 'function') ? loc.lat() : (loc?.lat ?? p?.position?.lat);
        const lng = (typeof loc?.lng === 'function') ? loc.lng() : (loc?.lng ?? p?.position?.lng);
        const pid = p.place_id || p.placeId || '';
        const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(lat+','+lng)}${pid?`&destination_place_id=${pid}`:''}`;
        window.open(url, '_blank', 'noopener');
      }

  function ensureGmapsLink(a, p, forceOverwrite = false){
    if (!p || !a) return false;

    const pid = p.place_id || p.placeId || '';
    const g   = p.geometry?.location;
    const lat = (typeof g?.lat === 'function') ? g.lat() : (g?.lat ?? p?.position?.lat);
    const lng = (typeof g?.lng === 'function') ? g.lng() : (g?.lng ?? p?.position?.lng);

    let href = '';
    if (p.url && !forceOverwrite) {
      href = p.url;                                 // 官方 URL
    } else if (pid) {
      href = `https://www.google.com/maps/place/?q=place_id:${pid}`; // place_id 直連
    } else if (lat && lng) {
      href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`; // 經緯度
    } else {
      const q = encodeURIComponent(p.name || p.formatted_address || ''); // 關鍵字
      href = `https://www.google.com/maps/search/?api=1&query=${q}`;
    }

    if (!a.href || forceOverwrite) a.href = href;
    if (!a.target) a.target = '_blank';
    a.rel = 'noopener';
    return true;
  }

  function ensureWebsiteLink(a, p){
    const site = p?.website || p?.details?.website;
    if (!site) return false;
    if (a) a.href = site;
    return true;
  }

  /* ======== ★ 新增：類別徽章修正（型別優先 + keyword 覆寫） ======== */
  const TYPE_PRIORITY = [
    'restaurant','cafe','bar','bakery',
    'lodging','hotel','resort',
    'supermarket','grocery_or_supermarket',
    'park','museum','hindu_temple','place_of_worship',
    'tourist_attraction','natural_feature'
  ];
  const TYPE_LABEL = {
    restaurant:'restaurant', cafe:'cafe', bar:'bar', bakery:'bakery',
    lodging:'hotel', hotel:'hotel', resort:'resort',
    supermarket:'supermarket', grocery_or_supermarket:'supermarket',
    park:'park', museum:'museum', hindu_temple:'temple', place_of_worship:'temple',
    tourist_attraction:'attraction', natural_feature:'attraction'
  };
  const KW_FORCE_TYPES = {
    restaurant:'restaurant', restaurants:'restaurant',
    cafe:'cafe', coffee:'cafe', bar:'bar', bakery:'bakery',
    hotel:'lodging', resort:'resort',
    temple:'hindu_temple', museum:'museum', park:'park'
  };
  function pickPrimaryType(place, kw){
    const types = Array.isArray(place?.types) ? place.types : [];
    const k = (kw||'').toLowerCase().trim();
    const force = KW_FORCE_TYPES[k];
    if (force && types.includes(force)) return force;
    for (const t of TYPE_PRIORITY) if (types.includes(t)) return t;
    return types[0] || '';
  }
  function updateTypeBadge(){
    const card = document.getElementById('hover-card');
    if (!card) return;
    const p  = curPlace() || {};
    const kw = (window.__recoFilterKw || document.getElementById('custom-query')?.value || '').toLowerCase().trim();
    const t  = pickPrimaryType(p, kw);
    const txt= TYPE_LABEL[t] || (t || '');

    // 依你的卡片 DOM 調整 selector；這裡提供多個備援
    const badge =
      card.querySelector('[data-field="type"]') ||
      card.querySelector('.hc-type') ||
      card.querySelector('.meta .type') ||
      card.querySelector('.type-badge');

    if (badge) {
      badge.textContent = txt || '';
      badge.style.display = txt ? '' : 'none';
    }
  }
  /* ======== ★ 新增結束 ======== */

  // ---- 3) 事件代理：只截 Add / Navigate；其餘 <a href> 放行（但修正連結） ----
  function onCardClick(ev){
    const btn = ev.target.closest('button, [data-action], a');
    if (!btn) return;

    // <a> 連結（Google Maps / Official Website）
    if (btn.tagName === 'A') {
      const txt = (btn.textContent || '').trim().toLowerCase();
      const p   = curPlace();
      const isGmaps = /google maps|view on google/i.test(txt) || btn.dataset?.action === 'gmaps';
      const isSite  = /official website|website/i.test(txt)   || btn.dataset?.action === 'website';
      if (isGmaps) {
        ensureGmapsLink(btn, p, true);  // 以 place_id 強制改寫
      } else if (isSite) {
        ensureWebsiteLink(btn, p);
      }
      if (!btn.getAttribute('target')) btn.setAttribute('target','_blank');
      btn.setAttribute('rel','noopener');
      return;
    }

    // 決定是否攔下 Add / Navigate
    const text = (btn.textContent || '').trim().toLowerCase();
    const cls  = btn.className || '';
    const act  = btn.dataset?.action || (
      /navigate|nav/i.test(text) || /btn-nav|hc-btn-nav/i.test(cls) ? 'navigate' :
      /(^|\s)(btn-add|hc-btn-add)(\s|$)/i.test(cls) || text === 'add' || btn.id === 'btn-add' ? 'add' : ''
    );
    if (!act) return;

    ev.preventDefault();
    ev.stopPropagation();

    const p = curPlace();
    if (!p) { console.warn('[HC/Unified] 無 place 可執行'); return; }

        if (act === 'navigate') return openNavigate(p);
        if (act === 'add') {
          if (typeof window.addToDayFromPlace === 'function') return window.addToDayFromPlace(p);
          return minimalAddToDayFallback(p);
        }
      }

      function bindOnCard(){
        const card = document.getElementById('hover-card');
        if (!card || card.__hcUnifiedBound) return;
        card.__hcUnifiedBound = true;
        card.addEventListener('click', onCardClick);

        // 既有連結補 target
        card.querySelectorAll('a').forEach(a=>{
          if (!a.getAttribute('target')) a.setAttribute('target','_blank');
          a.setAttribute('rel','noopener');
        });
      }

      // ---- 4) 初始綁定 ---------------------------------------------------------
      if (typeof whenMapsReady === 'function') whenMapsReady(bindOnCard);
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindOnCard, { once:true });
      } else {
        bindOnCard();
      }

      console.log('✅ Hover Card 統一補丁啟用（Add, Navigate, Links, Type Badge）');
    })();

    // === Fix: 行程點 Hover Card 沒圖（先以 place_id 取 Details + 轉換 photos.createUrl） ===
    (function fixHoverImagesForStops(){
      if (window.__HC_FIX_STOPS__) return; window.__HC_FIX_STOPS__ = true;

      const cache = new Map();

      function ensurePS(){
        const gmap = window.map;
        if (!window.placesService && gmap) {
          window.placesService = new google.maps.places.PlacesService(gmap);
        }
        return window.placesService;
      }

      async function ensureDetailsByPid(pid){
        if (!pid) return null;
        if (cache.has(pid)) return cache.get(pid);

        const ps = ensurePS(); if (!ps) return null;
        const req = {
          placeId: pid,
          fields: [
            'place_id','name','rating','user_ratings_total','formatted_address','types',
            'photos','url','website','opening_hours','geometry','price_level',
            'international_phone_number'
          ]
        };
        const det = await new Promise(resolve=>{
          ps.getDetails(req, (res, status)=>{
            resolve(status===google.maps.places.PlacesServiceStatus.OK ? res : null);
          });
        });

        // v3.5x 可能回傳 photos.createUrl → 統一提供 getUrl 介面
        if (det && Array.isArray(det.photos)) {
          det.photos = det.photos.map(ph =>
            (typeof ph.createUrl === 'function')
              ? { getUrl: ({maxWidth, maxHeight}={}) => ph.createUrl({maxWidth, maxHeight}) }
              : ph
          );
        }

        cache.set(pid, det || null);
        return det;
      }

      const _origShow = (typeof window.showHoverCard === 'function') ? window.showHoverCard : null;
      if (_origShow) {
        window.showHoverCard = async function(data, opt){
          try {
            const item = data?.details || data?.place || data || null;
            window.__lastHoverItem = item;
            window.__lastHoverPid  = item?.place_id || item?.pid || data?.place_id || data?.pid || item?.details?.place_id || null;

            const pid = data?.pid || data?.place_id || data?.details?.place_id;
            const hasPhotos = !!(data?.details?.photos && data.details.photos.length);
            if (pid && !hasPhotos) {
              const det = await ensureDetailsByPid(pid);
              if (det) {
                // 混入 details，並補上 rating 等常用欄位
                data.details = Object.assign({}, det, data.details || {});
                if (typeof det.rating === 'number' && data.rating == null) data.rating = det.rating;
              }
            }
          } catch (e) {
            console.warn('[HC fix] ensure details failed:', e);
          }
          return _origShow.apply(this, arguments);
        };
      }
    })();

    /* === Hover Card Linger Patch：移開不要秒關、按鈕可安心點 ================== */
    (function hoverCardLingerPatch(){
      if (window.__HC_LINGER__) return; window.__HC_LINGER__ = true;

      const DELAY = 650;        // 滑鼠離開後延遲多久再關
      const STICKY_MS = 1500;   // 點按鈕後維持多久 sticky

      // 包一層 hideHoverCard：若使用者正在卡片/按鈕上，就不關
      const _origHide = (typeof window.hideHoverCard === 'function') ? window.hideHoverCard : null;
      window.hideHoverCard = function(ms, opt){
        ms = (typeof ms === 'number') ? ms : DELAY;
        opt = opt || {};
        const card = document.getElementById('hover-card');
        if (!card) return;

        // 正在互動就不收
        if (!opt.force) {
          if (card.dataset.sticky === '1') return;
          if (card.matches(':hover')) return;
          if (card.contains(document.activeElement)) return;
        }

        clearTimeout(window.hoverHideTimer);
        window.hoverHideTimer = setTimeout(()=>{
          // 收之前再檢查一次，避免使用者剛好移回來
          if (!opt.force) {
            if (card.dataset.sticky === '1') return;
            if (card.matches(':hover')) return;
            if (card.contains(document.activeElement)) return;
          }
          if (_origHide) _origHide(0, { force:true });
          else card.style.display = 'none';
        }, ms);
      };

      function bindOnCard(){
        const card = document.getElementById('hover-card');
        if (!card || card.__lingerBound) return;
        card.__lingerBound = true;

        // 只要滑到卡片上 → 保活、清除關閉計時
        card.addEventListener('mouseenter', ()=>{
          card.dataset.hover = '1';
          clearTimeout(window.hoverHideTimer);
        });

        // 離開卡片 → 啟動延遲關閉
        card.addEventListener('mouseleave', ()=>{
          card.dataset.hover = '0';
          window.hideHoverCard(DELAY);
        });

        // 任何可點元素（Add、導航、連結…）進入/離開都保活
        card.addEventListener('mouseover', (e)=>{
          if (e.target.closest('button, a, .hc-actions, [data-action]')) {
            clearTimeout(window.hoverHideTimer);
          }
        });
        card.addEventListener('mouseout', (e)=>{
          if (e.target.closest('button, a, .hc-actions, [data-action]')) {
            window.hideHoverCard(DELAY);
          }
        });

        // 點擊 Add 或任何主要按鈕 → 短暫 sticky，避免按下瞬間被關
        card.addEventListener('mousedown', (e)=>{
          const el = e.target.closest('button, a, [data-action]');
          if (!el) return;
          card.dataset.sticky = '1';
          setTimeout(()=>{ 
            card.dataset.sticky = '0'; 
            window.hideHoverCard(DELAY);
          }, STICKY_MS);
        });
      }

      // 初始綁定（地圖就緒/DOM 載入後都試一次）
      if (typeof whenMapsReady === 'function') whenMapsReady(bindOnCard);
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindOnCard, { once:true });
      } else {
        bindOnCard();
      }

      //把所有觸發收起的地方，從「立刻收」改成「window.hideHoverCard(DELAY)」
      console.log('✅ Hover Card Linger Patch enabled (delay=%dms, sticky=%dms)', DELAY, STICKY_MS);
    })();

    // === 自動重新套用現有星星資料（載入後 2 秒執行） ===
    whenMapsReady(() => {
      setTimeout(() => {
        try {
          (window.suggestionMarkers || []).forEach(sm => {
            const it = sm?.marker?.__hoverItem;
            if (!it) return;
            const kw = it?.reco?.keyword || it?.keyword || it?.reco2?.keyword || '';
            const r  = Number(it?.rating);
            const n  = Number(it?.user_ratings_total || it?.userRatingsTotal);
            let km=''; try{
              const an=it?.__anchor, pos=it?.position;
              if(an&&pos){const R=6371,rad=d=>d*Math.PI/180;
                const dLat=rad(pos.lat-an.lat),dLng=rad(pos.lng-an.lng);
                const s1=Math.sin(dLat/2),s2=Math.sin(dLng/2);
                const h=s1*s1+Math.cos(rad(an.lat))*Math.cos(rad(pos.lat))*s2*s2;
                const d=2*R*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
                if(Number.isFinite(d)) km=`${d.toFixed(1)} km`;
              }}catch{}
            const chips=[]; if(kw)chips.push(`🔎 ${kw}`); if(km)chips.push(`📏 ${km}`); if(r)chips.push(`⭐ ${r}${n?` (${n})`:''}`);
            const fmt={oneLine:chips.join(' · '),multi:chips.join('\n')};
            it.subtitle=fmt.oneLine;
            it.description=fmt.multi;
          });
          console.debug('[reco] auto forcePrettyAll done');
        } catch(e){ console.warn(e); }
      }, 2000);
    });
  })();

  // 傳回：若 kw 是已知類別 → 回傳 types 陣列；否則 null
  function keywordToStrictTypes(kw){
    kw = (kw||'').toLowerCase().trim();
    // 單字與常見複數簡單正規化
    if (kw.endsWith('s')) kw = kw.slice(0,-1);
    return KW_TYPE_MAP[kw] || null;
  }

  // 以「型別優先」的邏輯判斷是否匹配
  function placeMatchesKeyword(place, kw){
    kw = (kw||'').toLowerCase().trim();
    if (!kw) return true;

    const strictTypes = keywordToStrictTypes(kw);
    const types = Array.isArray(place?.types) ? place.types : [];

    if (strictTypes && types.length) {
      // 只要有一個型別命中就算符合
      return strictTypes.some(t => types.includes(t));
    }
    // 否則才做文字比對（名稱/地址）
    const name = (place?.name || '').toLowerCase();
    const addr = (place?.vicinity || place?.formatted_address || '').toLowerCase();
    return name.includes(kw) || addr.includes(kw);
  }
});

// === Search Places (Autocomplete + panTo + 單一藍點標記) ===
(function setupSearchPlaces(){
  if (window.__SEARCH_PLACES_INIT__) return;   // 防重複
  window.__SEARCH_PLACES_INIT__ = true;

  function bindOnce(){
    const input   = document.getElementById('place-input');   // 你現在的 input
    const clearBtn= document.getElementById('btn-clear');     // 你的 Clear 按鈕
    if (!input) { console.warn('[SearchPlaces] #place-input not found'); return; }
    if (!window.google || !google.maps || !google.maps.places) {
      console.warn('[SearchPlaces] Google Maps Places not ready'); 
      return;
    }
    if (!window.map) {
      console.warn('[SearchPlaces] map not ready'); 
      return;
    }

    // 若專案已有全域 autocomplete 變數，沿用它
    try { if (window.autocomplete && typeof window.autocomplete.unbindAll === 'function') {
      // 可選：視需要先解除舊綁定
    }} catch(_){}

    // 建立 Autocomplete
    const ac = new google.maps.places.Autocomplete(input, {
      fields: ['place_id','geometry','name','formatted_address','photos']
    });
    ac.bindTo('bounds', map);
    window.autocomplete = ac; // 與你專案的全域慣例一致

    // 單一搜尋標記（藍點）
    function ensureSearchMarker(){
      if (!window.__searchMarker) {
        window.__searchMarker = new google.maps.Marker({
          map: (isGMap(nowMap()) ? nowMap() : null),
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#2563eb',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            scale: 10
          }
        });
      }
      return window.__searchMarker;
    }

    // 使用者選擇某個建議結果時
    ac.addListener('place_changed', async () => {   
      const place = ac.getPlace();
      if (!place || !place.geometry) {
        console.warn('[SearchPlaces] no geometry for selected place', place);
        return;
      }

      // ✅ 1) 暫存最後選到的地點，給 Add-to-Day 或其他模組用
      window.__lastSelectedPlace = place;

      const loc = place.geometry.location;

      // 2) 平移與縮放
      try { 
        const mm = nowMap();
        if (isGMap(mm)) { mm.panTo(loc); mm.setZoom(15); }
      } catch (_) {}

      // 3) 標記
      const m = ensureSearchMarker();
      m.setPosition(loc);

      // ✅ 4) 對外廣播事件（可讓其他模組監聽）
      try {
        document.dispatchEvent(new CustomEvent('ts:place-selected', {
          detail: { place, marker: m }
        }));
      } catch (_) {}

      // 5) 顯示 Hover Card（若有）
      try {
        if (typeof showHoverCard === 'function') {
          showHoverCard({
            name: place.name,
            formatted_address: place.formatted_address,
            position: (loc.toJSON?.() || { lat: loc.lat(), lng: loc.lng() }),
            details: place
          }, { compact: false, anchor: m });
        }
      } catch (_) {}

      // ✅ 6) 若你已暴露 injectAddButton（或類似函式），就順手插入「Add to Day」
      try { window.injectAddButton?.(place); } catch (_) {}

      console.log('[SearchPlaces] selected:', place.name, place.formatted_address);
    });

    // Enter 也能觸發「選取第一個建議」的體驗（若沒有選取就交給 Places 處理）
    input.addEventListener('keydown', (e)=>{
      if (e.key === 'Enter') {
        // 什麼都不做：讓 Autocomplete 的預設行為完成 place_changed
        // 這裡只保證不提交 form
        e.preventDefault();
      }
    });

    // Clear 按鈕：清除輸入與標記
    clearBtn?.addEventListener('click', ()=>{
      input.value = '';
      try { window.__searchMarker?.setMap(null); } catch(_){}
      window.__searchMarker = null;
      console.log('[SearchPlaces] cleared');
    });

    console.log('✅ Search Places ready (Autocomplete bound)');
  }

  // 等地圖就緒再綁
  if (typeof whenMapsReady === 'function') {
    whenMapsReady(bindOnce);
  } else {
    // 備援（萬一沒有 whenMapsReady）
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bindOnce, { once:true });
    } else {
      bindOnce();
    }
  }
})();

console.log('%c🧩 showHoverCard 已封裝：所有 hover 卡片都會自動補 details', 'color:#0c0');

//按鈕點擊強制導向新流程（並阻止舊流程）
(function forceBindRecoButtons(){
  const qFind  = '#btn-recommend-find, button#find-recommendations, button[data-role="find-recommendations"]';
  const qClear = '#btn-recommend-clear, button#clear-recommendations, button[data-role="clear-recommendations"]';
  const findBtn  = document.querySelector(qFind);
  const clearBtn = document.querySelector(qClear);

  // 沒有就晚點再試
  if (!findBtn || !clearBtn) { setTimeout(forceBindRecoButtons, 200); return; }

  // 以「捕獲階段 + stopImmediatePropagation」強制接管，阻止舊流程
  const bindOnce = (el, fn) => {
    if (el.__recoForced) return;
    el.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      try { fn(); } catch(e) { console.error('[reco forced] error', e); }
    }, { capture: true });
    el.__recoForced = true;
  };

  bindOnce(findBtn,  () => (typeof window.findRecommendations  === 'function' ? window.findRecommendations()  : console.warn('findRecommendations missing')));
  bindOnce(clearBtn, () => (typeof window.clearRecommendations === 'function' ? window.clearRecommendations() : console.warn('clearRecommendations missing')));

  console.debug('[reco forced] buttons bound:', !!findBtn, !!clearBtn);
})();


(function(){
  const ratingEl = document.getElementById('hc-rating');
  if (!ratingEl) return;
  const orig = ratingEl.textContent.__defineGetter__ ? null : null; // 兼容舊瀏覽器略過

  const setRating = (txt) => {
    const isNA = /^\s*★\s*N\/A/.test(txt || '');
    if (isNA && window.__lastHoverItem) {
      console.warn('[HC] 顯示了 N/A，來源 item=', {
        name: __lastHoverItem.name,
        pid: __lastHoverItem.place_id,
        hasDetails: !!__lastHoverItem.details,
        detailsName: __lastHoverItem.details?.name,
        detailsRating: __lastHoverItem.details?.rating
      });
    }
  };
})();

// === trips 點位卡片：補抓照片 + 回存到 DB（強化版對齊 point_id）===
(function patchHoverCardPhotoFix(){
  if (window.__HC_PHOTO_FIX__) return;
  window.__HC_PHOTO_FIX__ = true;

  const origShow = (typeof window.showHoverCard === 'function') ? window.showHoverCard : null;

  // 小工具
  const normName = s => (s || '').toString().trim().toLowerCase();
  const getPos = (o) => {
    const p = o?.position || o?.details?.geometry?.location || o?.marker?.getPosition?.() || o;
    const lat = typeof p?.lat === 'function' ? p.lat() : p?.lat;
    const lng = typeof p?.lng === 'function' ? p.lng() : p?.lng;
    return (isFinite(lat) && isFinite(lng)) ? { lat:+lat, lng:+lng } : null;
  };

  window.showHoverCard = async function(item, opt){
    // 讓你在 console 查
    window.__lastHoverItem = item;

    try {
      // 0) 若沒有 id/point_id，從 stops「強韌對齊」回來（seq + 名稱 + 距離）
      if (item && (!item.point_id && !item.id) && Array.isArray(window.stops)) {
        const itPos = getPos(item);
        let best = null, bestScore = -1;

        for (const s of window.stops) {
          let score = 0;
          if (typeof item.seq === 'number' && s.seq === item.seq) score += 100;                // seq 完全相同
          if (normName(item.name) && normName(item.name) === normName(s.name)) score += 50;    // 名稱相同
          const sp = getPos(s);
          if (itPos && sp) {
            const d = Math.hypot(itPos.lat - sp.lat, itPos.lng - sp.lng);
            score += 10 - Math.min(10, d * 100); // 越近分數越高（上限 +10）
          }
          if (score > bestScore) { bestScore = score; best = s; }
        }

        if (best) {
          item.point_id = best.point_id || best.db_point_id || best.id || null;
          item.id       = item.id || item.point_id;
          item.source   = item.source || best.source || 'points';
        }
      }

      // 1) 僅對「預設行程(trips/points)」來源且沒有圖片的項目補抓（排除 user_trips）
      const need = item && !item.photoUrl &&
                   (item.source === 'points' || item.point_id || item.id) &&
                   item.source !== 'user';

      if (need && typeof ensurePlaceDetails === 'function') {
        // 取 Google 詳細 + 照片
        await ensurePlaceDetails(item);

        // 若 details 有照片但 photoUrl 還沒帶出，取第一張
        if (!item.photoUrl && item.details?.photos?.length) {
          const ph = item.details.photos[0];
          item.photoUrl = (typeof ph.getUrl === 'function')
            ? ph.getUrl({ maxWidth: 1200 })
            : (typeof ph.createUrl === 'function' ? ph.createUrl({ maxWidth: 1200 }) : null);
        }

        // 2) 回存 place_id / photo_url（point_id 一律強制轉 int）
        const rawPid = item.point_id ?? item.id ?? item.db_point_id;
        const pid = Number.isFinite(parseInt(rawPid, 10)) ? parseInt(rawPid, 10) : null;
        const place_id = item.place_id || item.details?.place_id || null;
        const photoUrl = item.photoUrl || null;

        if (pid && (place_id || photoUrl)) {
          fetch('/api/points/enrich', {
            method: 'POST',
            headers: { 'Content-Type':'application/json' },
            body: JSON.stringify({ point_id: pid, place_id, photo_url: photoUrl })
          }).catch(()=>{});
        }
      }
    } catch(e){ console.debug('[HC photo-fix]', e); }

    return origShow ? origShow.apply(this, arguments) : null;
  };
})();

// --------------------------------------------------
// ✅ Street View 備援補圖 helper
// --------------------------------------------------
async function streetViewFallback(item, w = 1200, h = 800) {
  const pos = item.position || {};
  const lat = typeof pos.lat === 'function' ? pos.lat() : pos.lat;
  const lng = typeof pos.lng === 'function' ? pos.lng() : pos.lng;
  if (!isFinite(lat) || !isFinite(lng)) return null;

  const pid = parseInt(item.point_id || item.id || item.db_point_id, 10);
  const r = await fetch(`/api/points/${pid}/streetview?lat=${lat}&lng=${lng}&w=${w}&h=${h}`);
  const j = await r.json().catch(() => ({}));
  return j.ok ? j.url : null;
}

/* === TS: Load trip points by day (drop-in patch) ========================= */
(function TripPointsByDayPatch(){
  if (window.__TRIP_POINTS_BY_DAY__) return;
  window.__TRIP_POINTS_BY_DAY__ = true;

  const qs = new URLSearchParams(location.search);
  const tripId = (qs.get('trip') || '').trim();

  // helpers
  function setCurrentDay(n){ window.currentDay = Number(n) || 1; }
  function getCurrentDay(){ return Number(window.currentDay || 1); }

  function ensureArraySlots(arr, upto){
    for (let i=0;i<upto;i++) if (!Array.isArray(arr[i])) arr[i]=[];
    return arr;
  }

  function groupByDay(points){
    const by = {};
    let maxDay = 1;
    (points||[]).forEach(p=>{
      const d = Number(p.day || 1);
      if (!by[d]) by[d] = [];
      by[d].push(p);
      if (d>maxDay) maxDay = d;
    });
    // 依 seq 排序
    Object.keys(by).forEach(d=>{
      by[d].sort((a,b)=>(Number(a.seq||1)-Number(b.seq||1)));
    });
    return { by, maxDay };
  }

  function updateDayTabs(maxDay){
    const host = document.querySelector('#day-tabs');
    if (!host) return;

    // 1) 先整理全域 days & allStopsByDay
    const max = Math.max(1, Number(maxDay) || 1);
    window.days = Array.from({ length: max }, (_, i) => i + 1);

    if (!Array.isArray(window.allStopsByDay)) window.allStopsByDay = [];
    ensureArraySlots(window.allStopsByDay, max);

    // 2) 如果有共用的 renderDayTabs，就交給它畫（裡面會自帶 + Add Day）
    if (typeof window.renderDayTabs === 'function') {
      window.renderDayTabs();
      return;
    }

    // 3) 萬一 renderDayTabs 不存在，就用簡化版 + 手動補一顆 + Add Day（備援）
    host.innerHTML = '';

    for (let d = 1; d <= max; d++){
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.day = String(d);
      btn.textContent = `Day ${d}`;
      if (d === getCurrentDay()) btn.classList.add('active');

      btn.addEventListener('click', () => {
        setCurrentDay(d);
        const arr = (window.allStopsByDay?.[d-1] || []).slice();
        window.stops = arr;

        try { if (typeof renderTimeline === 'function') renderTimeline(); } catch(e){}
        try { if (typeof recomputeRouteSmart === 'function') recomputeRouteSmart(d); } catch(e){}
      });

      host.appendChild(btn);
    }

    // 3.5) 補上一顆 + Add Day 按鈕
    const add = document.createElement('button');
    add.type = 'button';
    add.id = 'btn-add-day';
    add.textContent = '+ Add Day';
    add.addEventListener('click', () => {
      const next = Math.max(...(window.days || [0]), 0) + 1;
      if (!window.days.includes(next)) window.days.push(next);
      ensureArraySlots(window.allStopsByDay, next);

      if (typeof window.setDay === 'function') {
        setDay(next);
      } else {
        setCurrentDay(next);
        updateDayTabs(next);
      }
    });
    host.appendChild(add);
  }

  async function fetchTripPoints(id){
    const res = await fetch(`/api/trips/${encodeURIComponent(id)}/points`);
    if (!res.ok) {
      const txt = await res.text().catch(()=> '');
      throw new Error(`Trip API error: ${res.status} ${res.statusText} ${txt}`);
    }
    const js = await res.json();
    if (!js.ok) throw new Error(js.error || 'Trip API failed');
    return Array.isArray(js.points) ? js.points : [];
  }

  async function applyTripFromAPI(id){
    const pts = await fetchTripPoints(id);

    // 依 day 分組 → 轉成 stops 結構
    const { by, maxDay } = groupByDay(pts);
    const allByDay = [];
    for (let d=1; d<=maxDay; d++){
      const list = (by[d] || []).map((p,idx)=>({
        id: `TP-${id}-D${d}-S${idx+1}-${p.id}`,
        name: p.name || `Stop ${idx+1}`,
        position: { lat: Number(p.lat), lng: Number(p.lng) },
        lat: Number(p.lat), lng: Number(p.lng),
        day: d,
        seq: Number(p.seq || idx+1),
        source: 'trip_points'
      }));
      allByDay.push(list);
    }

    // 填到全域：Day1 映射到 window.stops；其它放 allStopsByDay
    ensureArraySlots(allByDay, maxDay);
    window.allStopsByDay = allByDay;
    setCurrentDay(1);
    window.stops = (allByDay[0] || []).slice();

    // 更新 Day Tabs（若存在）
    updateDayTabs(maxDay);

    // 你原本的渲染 / 路線
    try { if (typeof renderTimeline==='function') renderTimeline(); } catch {}
    try { if (typeof recomputeRouteSmart==='function') recomputeRouteSmart(1); } catch {}

    // 若你有 fitBounds 之類
    try {
      if (typeof safeFitBounds==='function') {
        const b = new google.maps.LatLngBounds();
        (pts||[]).forEach(p=> { if (p.lat!=null && p.lng!=null) b.extend({lat:+p.lat,lng:+p.lng}); });
        if (!b.isEmpty()) safeFitBounds(b);
      }
    } catch {}
  }

    // 你原本的渲染 / 路線
  try { if (typeof renderTimeline==='function') renderTimeline(); } catch {}
  try { if (typeof recomputeRouteSmart==='function') recomputeRouteSmart(1); } catch {}

  // 🔵 新增：為所有行程點建立 / 套用 marker 樣式
  try {
    if (typeof restyleAllMarkers === 'function') {
      restyleAllMarkers();
    } else if (typeof restyleMarkersForDay === 'function') {
      restyleMarkersForDay(1);
    }
  } catch {}


  // 啟動：網址有 ?trip= 才載入
  if (tripId) {
    applyTripFromAPI(tripId).catch(err=>{
      console.error('loadTrip error', err);
      alert(`載入行程失敗: ${String(err.message || err)}`);
    });
  }
})();

// ================================
// 讓 Google Maps 內建 POI（地名）也能加入行程
// ================================
whenMapsReady(() => {
  if (!window.map) return;

  google.maps.event.addListener(map, "click", (e) => {
    const placeId = e.placeId;

    // 只有真正點到 Google Map POI 時才會觸發
    if (!placeId) return;

    // 阻止 Google 原本的預設 POI 彈跳氣泡
    e.stop();

    // 轉換成我們自己的 stop 物件
    const stop = {
      name: "Loading...",
      place_id: placeId,
      placeId: placeId,
      position: {
        lat: e.latLng.lat(),
        lng: e.latLng.lng()
      },
      day: getCurrentDay()
    };

    // 要先把基本資訊 show 出來（等 details 回來再更新）
    if (typeof showHoverCard === "function") {
      showHoverCard(stop, { compact: false, pin: false });
    }

    // 補 details（會自動抓照片、評分、地址）
    ensurePlaceDetails(stop).then(() => {
      // 再重新顯示一次 hover card（已經有完整資訊）
      showHoverCard(stop, { compact: false, pin: false });

      // 等待使用者按下「Add」後，由你原本的流程加入 stops 陣列
      window.__lastHoverItem = stop;
      window.__lastHoverPid = stop.place_id;
    });
  });
});

// === RECO Sticky Patch：推薦點卡片不會被亂關 ===
(function patchHideHoverForReco(){
  if (window.__RECO_STICKY_HIDE_PATCH__) return;
  window.__RECO_STICKY_HIDE_PATCH__ = true;

  const orig = (typeof window.hideHoverCard === 'function') ? window.hideHoverCard : null;
  if (!orig) {
    console.warn('[reco] hideHoverCard not found, skip sticky patch');
    return;
  }

  window.hideHoverCard = function patchedHideHoverCard(ms, opt){
    opt = opt || {};

    // 看目前記錄的 item，是不是推薦點（__kind === 'reco'）
    const cur = window.__lastHoverItem || window.__lastHoverPlace || null;
    const isReco = !!(cur && cur.__kind === 'reco');

    // 如果現在顯示的是推薦點卡片，而且這次呼叫不是「我們自己下的 forceFromReco」
    // → 直接忽略，不關卡片
    if (isReco && !opt.forceFromReco) {
      console.debug('[reco] hideHoverCard blocked for sticky reco card');
      return;
    }

    // 其他情況照原本的 hideHoverCard 跑
    return orig.apply(this, arguments);
  };

  console.debug('[reco] sticky hide patch installed');
})();

// === safeFitBoundsForDay 保護層：避免 google 尚未載入就出錯 ===
(function patchSafeFitBoundsForDay(){
  const orig = window.safeFitBoundsForDay;
  if (typeof orig !== 'function') return;

  window.safeFitBoundsForDay = function patchedSafeFitBoundsForDay(day){
    // ⭐ 注意：只能用 window.google，不能直接寫 google，才不會拋 ReferenceError
    if (!window.google || !window.google.maps) {
      // 想要完全靜音也可以把這行砍掉，或包在 TS_DEBUG 裡
      if (window.TS_DEBUG) {
        console.warn('[safeFitBoundsForDay] skip: google not ready yet');
      }
      return false;
    }

    try {
      return orig.apply(this, arguments);
    } catch (e) {
      // 這裡也只在 debug 模式印錯誤
      if (window.TS_DEBUG) {
        console.warn('[safeFitBoundsForDay] fail (wrapped)', e);
      }
      return false;
    }
  };
})();

// ==== [END PATCH BLOCK] ====
