# ==============================================================
#                   IMPORTS & APP SETUP
# ==============================================================
import os, re, json
import time
import requests
import pymysql
from flask import Flask, jsonify, request, send_from_directory, session, render_template, jsonify
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename

GMAPS_KEY = os.getenv("GOOGLE_MAPS_API_KEY") or os.getenv("GOOGLE_API_KEY") or ""
print("[DEBUG] GMAPS_KEY loaded? ", bool(GMAPS_KEY))

COST_API_KEY = os.getenv("COST_API_KEY")
COST_API_HOST = os.getenv("COST_API_HOST")

# === OSM / Overpass 設定 ===
OSM_USER_AGENT = "TrailSeekerStudentProject/1.0 (https://github.com/calistalileen/-12-, contact: a44525844@gmail.com)"
OVERPASS_URL  = os.getenv("OVERPASS_URL", "https://overpass-api.de/api/interpreter")

PRICE_KEYS = ("price", "charge", "fee", "fare", "min_price", "max_price")

# 簡單的 in-memory 快取：同一個 city/country 不要每次都重算
_COST_CACHE = {}

# --- ENV (.env) ---
from dotenv import load_dotenv
load_dotenv()  # baca variabel dari .env jika ada
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()

# === PATH DASAR ===
APP_DIR       = os.path.dirname(os.path.abspath(__file__))
TEMPLATES_DIR = os.path.join(APP_DIR, "templates")
STATIC_DIR    = os.path.join(APP_DIR, "static")

# === FLASK APP ===
app = Flask(
    __name__,
    template_folder=TEMPLATES_DIR,
    static_folder=STATIC_DIR,
    static_url_path="/static",
)
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024   # 10 MB
UPLOAD_FOLDER = os.path.join("static", "uploads")
ALLOWED_EXT = {"png", "jpg", "jpeg", "webp"}
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXT

# ====== DB connection ======
import pymysql, os
def get_db():
    return pymysql.connect(
        host=os.getenv("DB_HOST", "127.0.0.1"),
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASS", ""),
        database=os.getenv("DB_NAME", "travel_planner"),
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=True,
    )
    

# ===== 工具 =====
def _uid_token():
    # 供匿名／未登入使用者辨識
    return request.headers.get('X-UID') or request.cookies.get('uid') or None


# 🔑 SECRET KEY (ganti di production)
app.config["SECRET_KEY"] = "fd9a640e-ab28-4c87-a276-f5bbd79b94e7"

# CORS (batasi sesuai kebutuhan di production) + dukung cookies
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

# === DB CONFIG & HELPER ===
DB = dict(
    host="localhost",
    user="root",            # sesuaikan
    password="",            # sesuaikan
    database="travel_planner",
    port=3306,
    cursorclass=pymysql.cursors.DictCursor,
)
def db():
    return pymysql.connect(**DB)

# 取用者資訊
def current_actor():
    """回傳 (user_id:int, user_token:str)
       - 若 X-UID/cookie uid 是數字 -> 當成 user_id，token 為空字串
       - 若是 UUID/其他字串 -> user_id=0，token=原字串
    """
    from flask import request
    tok = (request.headers.get("X-UID") or request.cookies.get("uid") or "").strip()
    if tok.isdigit():
        return int(tok), ""          # 正式登入用戶
    return 0, tok                    # 匿名/客人用戶（token 存字串 UID）

def dict_cursor(conn):
    """Return a dictionary-like cursor for different MySQL drivers."""
    try:
        # mysql-connector-python
        return conn.cursor(dictionary=True)
    except TypeError:
        # PyMySQL
        try:
            import pymysql
            return conn.cursor(pymysql.cursors.DictCursor)
        except Exception:
            # MySQLdb (最後保險；若沒有 DictCursor，就退回一般 cursor)
            return conn.cursor()
        
def get_usd_rate(from_currency: str) -> float:
    """
    使用 Frankfurter API (免費，來源為 ECB 官方匯率)，
    將 from_currency 換成 USD。
    不需要任何 API Key。
    """
    from_currency = (from_currency or "").upper()

    # 本來就是 USD 就直接回傳 1
    if not from_currency or from_currency == "USD":
        return 1.0

    try:
        # 1 單位 from_currency 換成 USD
        url = f"https://api.frankfurter.app/latest?from={from_currency}&to=USD"
        r = requests.get(url, timeout=10)
        r.raise_for_status()
        data = r.json()
        # 回傳格式範例：
        # {"amount":1.0,"base":"JPY","date":"2025-01-31","rates":{"USD":0.0068}}
        rate = float(data["rates"]["USD"])
        print(f"[FX] 1 {from_currency} = {rate} USD")
        return rate
    except Exception as e:
        print("[FX] error when fetching FX for", from_currency, "->", e)
        # 出錯就先用 1.0 當作 fallback，避免整個功能壞掉
        return 1.0

# 國家 → 貨幣代碼（只先列出你可能用到的，可再自行增加）
COUNTRY_CURRENCY = {
    # Thailand
    "Thailand": "THB",
    "ไทย": "THB",
    "ประเทศไทย": "THB",

    # Malaysia
    "Malaysia": "MYR",
    "ماليزيا": "MYR",          # 有些 geocoder 可能回阿拉伯語
    "马来西亚": "MYR",
    "Malaysia,Malaysia": "MYR",

    # Indonesia
    "Indonesia": "IDR",
    "Indonesia,Indonesia": "IDR",
    "Indonesia, Asia": "IDR",
    "Indonesia,South-East Asia": "IDR",
    "Indonesia, Asia Tenggara": "IDR",
    "印度尼西亚": "IDR",

    # fallback example
    "Japan": "JPY",
    "日本": "JPY",
    "台湾": "TWD",
    "臺灣": "TWD",
    "Taiwan": "TWD"
}

# 國家 → 物價指數係數（大致來自 OECD PPP，相對美國=1.0，大略值）
# 這個主要用來在 OSM 資料不足時，對 base price 做縮放；你可以再調整。
COUNTRY_PRICE_INDEX = {

    # === Southeast Asia main markets ===
    "Thailand": 0.45,
    "ประเทศไทย": 0.45,
    "ไทย": 0.45,

    "Malaysia": 0.55,
    "马来西亚": 0.55,
    "ماليزيا": 0.55,

    "Indonesia": 0.40,
    "印度尼西亚": 0.40,
    "Indonesia,Asia": 0.40,
    "Indonesia,South-East Asia": 0.40,

    # --- Other you used before ---
    "Japan": 1.20,
    "日本": 1.20,
    "Taiwan": 0.65,
    "台湾": 0.65,
    "臺灣": 0.65,
    "United States": 1.00,
    "USA": 1.00,
}

def geocode_city_osm(city: str, country: str):
    """
    用 Nominatim 取得城市中心座標與標準化國家名稱。
    會先對 city / country 做一些修正（處理「West Java 印尼」「Trat 泰國」這類混在一起的情況）。
    回傳 (lat, lon, country_name) 或 None。
    """
    import time
    time.sleep(1.1)  # 避免 Nominatim 過度頻繁被 403 ban

    raw_city    = (city or "").strip()
    raw_country = (country or "").strip()

    # --- 1) 處理 city=country= "West Java 印尼" / "Trat 泰國" 這種情況 ---
    # ex: "West Java 印尼" -> ["West","Java","印尼"] -> city="West Java", country="印尼"
    if raw_city == raw_country and " " in raw_country:
        parts = [p for p in raw_country.replace("，", " ").split(" ") if p.strip()]
        if len(parts) >= 2:
            raw_city    = " ".join(parts[:-1])   # 前面全部當 city
            raw_country = parts[-1]             # 最後一段當 country
            print("[OSM geocode] split mixed city/country:", raw_city, "|", raw_country)

    # --- 2) 國名 mapping（含中/泰/印/馬 文） ---
    country_map = {
        # Thailand
        "Thailand": "Thailand",
        "ไทย": "Thailand",
        "ประเทศไทย": "Thailand",
        "泰國": "Thailand",

        # Malaysia
        "Malaysia": "Malaysia",
        "马来西亚": "Malaysia",
        "馬來西亞": "Malaysia",

        # Indonesia
        "Indonesia": "Indonesia",
        "印度尼西亚": "Indonesia",
        "印尼": "Indonesia",
        "Indonesia,Asia": "Indonesia",
        "Indonesia, Asia": "Indonesia",

        # Taiwan / Japan （如果之後用得到）
        "Taiwan": "Taiwan",
        "臺灣": "Taiwan",
        "台湾": "Taiwan",
        "Japan": "Japan",
        "日本": "Japan",
    }

    norm_country = country_map.get(raw_country, raw_country)

    # --- 3) city 正常化 ---
    norm_city = raw_city
    if not norm_city or norm_city == norm_country:
        norm_city = norm_country

    print(f"[OSM geocode] final query city={norm_city}, country={norm_country}")

    url = "https://nominatim.openstreetmap.org/search"
    params = {
        "city": norm_city,
        "country": norm_country,
        "format": "json",
        "limit": 1,
    }
    headers = {"User-Agent": OSM_USER_AGENT}

    try:
        r = requests.get(url, params=params, headers=headers, timeout=10)
        r.raise_for_status()
        arr = r.json()

        # --- 4) 如果 city+country 找不到，再退回只用 country 試一次（所有國家通用） ---
        if not arr:
            print("[OSM geocode] no results for", norm_city, norm_country, "- retry with country only")
            params2 = {
                "country": norm_country,
                "format": "json",
                "limit": 1,
            }
            r2 = requests.get(url, params=params2, headers=headers, timeout=10)
            r2.raise_for_status()
            arr2 = r2.json()
            if not arr2:
                print("[OSM geocode] still no results for country", norm_country)
                return None
            item = arr2[0]
        else:
            item = arr[0]

        lat = float(item["lat"])
        lon = float(item["lon"])
        display_name = item.get("display_name", "")

        parts = [p.strip() for p in display_name.split(",") if p.strip()]
        country_name = parts[-1] if parts else norm_country
        print("[OSM geocode] hit:", display_name, "| country_name:", country_name)
        return lat, lon, country_name

    except Exception as e:
        print("[OSM geocode] error:", e)
        return None
    
def _parse_price_value(val: str):
    """
    從字串中盡量抽出數字，支援 '80-150 THB', '¥800', '200 JPY', '3.5$' 等。
    回傳 float 或 None。
    """
    if not isinstance(val, str):
        try:
            return float(val)
        except Exception:
            return None

    s = val.strip()
    if not s:
        return None

    # 先把常見貨幣符號去掉，還有文字
    s = s.replace(",", "")
    # 轉成小寫方便處理
    low = s.lower()

    # range: '80-150', '80–150', '80 to 150'
    for sep in ("-", "–", "to"):
        if sep in low:
            parts = [p.strip() for p in re.split(r"-|–|to", low) if p.strip()]
            nums = []
            for p in parts:
                m = re.search(r"(\d+(\.\d+)?)", p)
                if m:
                    nums.append(float(m.group(1)))
            if nums:
                return sum(nums) / len(nums)

    # 單一數字: 抓第一個數字
    m = re.search(r"(\d+(\.\d+)?)", low)
    if m:
        try:
            return float(m.group(1))
        except Exception:
            return None
    return None


def overpass_collect_prices(lat: float, lon: float, radius_deg: float = 0.25):
    """
    在 (lat,lon) 周圍盒子範圍內，收集餐廳/咖啡/景點/交通的標記價格。
    回傳 dict: { 'food': [..], 'cafe': [..], 'attraction': [..], 'museum': [..], 'bus': [..] }
    單位：當地原始貨幣。
    """
    south = lat - radius_deg
    north = lat + radius_deg
    west  = lon - radius_deg
    east  = lon + radius_deg
    bbox  = f"{south},{west},{north},{east}"

    headers = {"User-Agent": OSM_USER_AGENT}
    out = { "food": [], "cafe": [], "attraction": [], "museum": [], "bus": [] }

    def run_query(selector: str):
        data = f"[out:json][timeout:25];node{selector}({bbox});out tags;"
        try:
            r = requests.post(OVERPASS_URL, data={"data": data}, headers=headers, timeout=25)
            r.raise_for_status()
            return r.json().get("elements", [])
        except Exception as e:
            print("[Overpass] error for", selector, ":", e)
            return []

    # 餐廳
    for el in run_query('["amenity"="restaurant"]'):
        tags = el.get("tags", {})
        for k in PRICE_KEYS:
            if k in tags:
                v = _parse_price_value(tags[k])
                if v is not None:
                    out["food"].append(v)
                    break

    # 咖啡
    for el in run_query('["amenity"="cafe"]'):
        tags = el.get("tags", {})
        for k in PRICE_KEYS:
            if k in tags:
                v = _parse_price_value(tags[k])
                if v is not None:
                    out["cafe"].append(v)
                    break

    # 景點
    for el in run_query('["tourism"="attraction"]'):
        tags = el.get("tags", {})
        for k in PRICE_KEYS:
            if k in tags:
                v = _parse_price_value(tags[k])
                if v is not None:
                    out["attraction"].append(v)
                    break

    # 博物館
    for el in run_query('["tourism"="museum"]'):
        tags = el.get("tags", {})
        for k in PRICE_KEYS:
            if k in tags:
                v = _parse_price_value(tags[k])
                if v is not None:
                    out["museum"].append(v)
                    break

    # 大眾運輸 / bus fare
    for el in run_query('["highway"="bus_stop"]'):
        tags = el.get("tags", {})
        for k in PRICE_KEYS:
            if k in tags:
                v = _parse_price_value(tags[k])
                if v is not None:
                    out["bus"].append(v)
                    break

    print("=== [OSM DEBUG] raw price samples ===")
    for k, arr in out.items():
        if arr:
            print(f"{k}: {len(arr)} samples, first few:", arr[:5])
        else:
            print(f"{k}: no price tags")

    return out

def get_price_index(country_name: str) -> float:
    """
    取得該國大略物價係數（相對美國=1.0）。
    如果查不到，就回傳 1.0。
    """
    if not country_name:
        return 1.0
    return COUNTRY_PRICE_INDEX.get(country_name, 1.0)


def fetch_cost_profile(city, country):
    """
    使用:
      1) OSM Nominatim 取得城市座標 + 標準化國家名稱
      2) Overpass API 抓該區域實際餐廳/咖啡/景點/交通價格（當地貨幣）
      3) 國家物價係數 (PPP-like index) 做補強
      4) 匯率 API 換算成 USD（僅 OSM 資料需要換匯）
    回傳符合 COST_CONFIG 格式的 profile。
    """

    # --- Step 0: 簡單快取（同一個 city+country 不要每次都重算） ---
    key = ((city or "").strip().lower(), (country or "").strip().lower())
    cached = _COST_CACHE.get(key)
    if cached is not None:
        print("[COST] use cached cost_profile for", key)
        return cached

    # --- Step 1: Geocode city ---
    geo = geocode_city_osm(city, country)
    if not geo:
        print("[COST] geocode failed, fallback to generic profile")
        profile = _fallback_profile_usd()
        _COST_CACHE[key] = profile   # 把 fallback 也一起快取
        return profile

    lat, lon, country_name = geo
    print("[COST] geocoded:", city, country, "->", lat, lon, "| country_name:", country_name)

    # --- Step 2: OSM Overpass price samples (local currency) ---
    samples = overpass_collect_prices(lat, lon)

    def avg_or_none(arr):
        return (sum(arr) / len(arr)) if arr else None

    # 先抓 OSM 原始 local 價格
    food_osm   = avg_or_none(samples["food"])
    cafe_osm   = avg_or_none(samples["cafe"])
    attr_osm   = avg_or_none(samples["attraction"])
    museum_osm = avg_or_none(samples["museum"])
    bus_osm    = avg_or_none(samples["bus"])

    print("=== [OSM DEBUG] OSM averages (local) ===")
    print("food_osm   :", food_osm)
    print("cafe_osm   :", cafe_osm)
    print("attr_osm   :", attr_osm)
    print("museum_osm :", museum_osm)
    print("bus_osm    :", bus_osm)

    # 判斷是否有 OSM 價格
    has_food_osm   = food_osm   is not None
    has_cafe_osm   = cafe_osm   is not None
    has_attr_osm   = attr_osm   is not None
    has_museum_osm = museum_osm is not None
    has_bus_osm    = bus_osm    is not None

    # --- Step 3: PPP-like 物價倍率 ---
    idx = get_price_index(country_name)
    print("[COST] price index for", country_name, "=", idx)

    # fallback 美金基準
    BASE_MEAL      = 10.0
    BASE_COFFEE    = 4.0
    BASE_ATTR      = 12.0
    BASE_MUSEUM    = 15.0
    BASE_BUS       = 2.5

    # 混合 Local + PPP：local 代表 OSM 的「當地貨幣」
    # fallback 代表「USD 基準 × 物價倍率 idx」
    food_local   = food_osm   if has_food_osm   else BASE_MEAL   * idx
    cafe_local   = cafe_osm   if has_cafe_osm   else BASE_COFFEE * idx
    attr_local   = attr_osm   if has_attr_osm   else BASE_ATTR   * idx
    museum_local = museum_osm if has_museum_osm else BASE_MUSEUM * idx
    bus_local    = bus_osm    if has_bus_osm    else BASE_BUS    * idx

    print("=== [COST DEBUG] blended local prices ===")
    print("food_local   (final):", food_local)
    print("cafe_local   (final):", cafe_local)
    print("attr_local   (final):", attr_local)
    print("museum_local (final):", museum_local)
    print("bus_local    (final):", bus_local)

    # --- Step 4: 決定該國貨幣代碼 ---
    cur_code = COUNTRY_CURRENCY.get(country_name, "USD")
    print("[COST] currency code for", country_name, "=", cur_code)

    # --- Step 5: 匯率（只有 OSM 資料需要 FX）---
    rate_to_usd = get_usd_rate(cur_code)
    print("[COST] FX 1", cur_code, "=", rate_to_usd, "USD")

    # 重點：fallback 已是 USD，不可再乘匯率 ⚠️
    def convert(local, has_osm):
        if has_osm and cur_code != "USD":
            return local * rate_to_usd
        return local  # fallback → 保持 USD

    meal_usd       = convert(food_local,   has_food_osm)
    cappuccino_usd = convert(cafe_local,   has_cafe_osm)
    attraction_usd = convert(attr_local,   has_attr_osm)
    museum_usd     = convert(museum_local, has_museum_osm)
    bus_leg_usd    = convert(bus_local,    has_bus_osm)

    print("=== [COST DEBUG] prices in USD ===")
    print("meal_usd       :", meal_usd)
    print("cappuccino_usd :", cappuccino_usd)
    print("attraction_usd :", attraction_usd)
    print("museum_usd     :", museum_usd)
    print("bus_leg_usd    :", bus_leg_usd)

    # --- Step 6: 組成 profile（全部 USD）---
    profile = {
        "currency": "USD",
        "placeByPriceLevel": {
            0: 0,
            1: meal_usd,
            2: meal_usd * 1.6,
            3: meal_usd * 2.4,
            4: meal_usd * 3.2
        },
        "placeCategoryDefaults": {
            "FOOD":       meal_usd,
            "CAFE":       cappuccino_usd,
            "ATTRACTION": attraction_usd,
            "MUSEUM":     museum_usd,
            "SHOPPING":   meal_usd * 1.2,
            "OTHER":      meal_usd * 0.5
        },
        "transport": {
            "BUS": {"perLeg": bus_leg_usd},
            "TAXI": {
                "base":  bus_leg_usd * 2.0,
                "perKm": bus_leg_usd * 0.8,
                "min":   bus_leg_usd * 3.5
            }
        }
    }

    print("=== [COST DEBUG] Final Profile (USD) ===")
    try:
        print(json.dumps(profile, indent=2))
    except Exception:
        print(profile)

    # ⭐ 把結果存進快取，下次同一個 city/country 直接使用
    _COST_CACHE[key] = profile
    return profile


def _fallback_profile_usd():
    """
    當 geocode 或 OSM / FX 失敗時的保底配置（純 USD 基準）。
    """
    meal = 15.0
    cappuccino = 4.0
    bus = 2.5
    return {
        "currency": "USD",
        "placeByPriceLevel": {
            0: 0,
            1: meal,
            2: meal * 1.6,
            3: meal * 2.4,
            4: meal * 3.2
        },
        "placeCategoryDefaults": {
            "FOOD":       meal,
            "CAFE":       cappuccino,
            "ATTRACTION": meal * 0.8,
            "MUSEUM":     meal,
            "SHOPPING":   meal * 1.2,
            "OTHER":      meal * 0.5
        },
        "transport": {
            "BUS": {"perLeg": bus},
            "TAXI": {
                "base":  bus * 2.0,
                "perKm": bus * 0.8,
                "min":   bus * 3.5
            }
        }
    }


@app.get("/api/budget_profile")
def api_budget_profile():
    """
    前端傳 city / country 進來，我回傳物價資料。
    """
    city = request.args.get("city")
    country = request.args.get("country")
    if not city or not country:
        return jsonify({"ok": False, "error": "missing city/country"}), 400

    profile = fetch_cost_profile(city, country)
    if not profile:
        return jsonify({"ok": False, "error": "failed_fetch"}), 500

    return jsonify({
        "ok": True,
        "city": city,
        "country": country,
        "profile": profile
    })

# ==============================================================
# USER TRIPS: CREATE / UPDATE / LIST / GET / DELETE（統一版）
# ==============================================================

@app.post("/api/user_trips")
def create_or_update_user_trip():
    conn = get_db()
    uid  = current_user_id()     # 可能為 None（未登入）
    tok  = _request_uid()        # 綁定匿名或登入使用者

    data  = request.get_json(silent=True) or {}
    title = (data.get("title") or "Untitled Trip").strip()

    # 把前端行程物件通通裝進 notes (字串 JSON)
    payload = {
        "title": title,
        "notes": data.get("notes"),
        "stops": data.get("stops") or data.get("points") or [],
        "days":  data.get("days") or [],
        "meta":  data.get("meta") or {},
    }
    notes_json   = json.dumps(payload, ensure_ascii=False)
    base_trip_id = data.get("base_trip_id")

    try:
        with conn.cursor() as cur:
            # 先找：同一使用者(或同 token) + 同標題 是否已存在
            cur.execute("""
                SELECT id, updated_at
                FROM user_trips
                WHERE (user_id <=> %s OR user_token = %s)
                  AND title = %s
                LIMIT 1
            """, (uid, tok, title))
            exist = cur.fetchone()

            if exist:
                # 覆蓋同名
                cur.execute("""
                    UPDATE user_trips
                    SET notes = %s, updated_at = NOW()
                    WHERE id = %s
                """, (notes_json, exist["id"]))

                resp = jsonify({
                    "ok": True,
                    "id": exist["id"],
                    "user_trip_id": exist["id"],     # 兼容前端
                    "title": title,
                    "created": False,
                    "updated": True,
                    "overwrote_title": True,
                    "previous_updated_at": (
                        exist["updated_at"].isoformat() if exist.get("updated_at") else None
                    )
                })
                resp.headers["X-Overwrite-Notice"] = "overwrote_existing_title"
                return resp, 200

            # 沒有同名 → 新增
            cur.execute("""
                INSERT INTO user_trips (user_id, user_token, title, notes, base_trip_id, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, NOW(), NOW())
            """, (uid, tok, title, notes_json, base_trip_id))
            new_id = cur.lastrowid

        return jsonify({
            "ok": True,
            "id": new_id,
            "user_trip_id": new_id,   # 兼容前端
            "title": title,
            "created": True,
            "updated": False,
            "overwrote_title": False
        }), 201

    except Exception as e:
        # 直接把錯誤訊息丟回前端，方便你除錯
        return jsonify({"ok": False, "error": f"{type(e).__name__}: {e}"}), 500


# ==============================================================
#                   🟣 API: SAVED ITINERARIES
# ==============================================================
@app.get("/api/user_trips")
def api_user_trips_list():
    """
    List all saved itineraries for the current logged-in user.

    Response:
      {
        "ok": true,
        "items": [
          {
            "id": 1,
            "title": "...",
            "rating": 4,
            "review": "...",
            "photo_url": "...",
            "base_trip_id": 21,
            "created_at": "2025-10-19T06:30:54",
            "updated_at": "2025-10-19T06:30:54",
            "notes": {... or raw string ...}
          },
          ...
        ],
        "count": N
      }
    """
    if "user_id" not in session:
        return jsonify({"ok": False, "error": "UNAUTHORIZED"}), 401

    uid = session["user_id"]
    conn = None
    try:
        conn = db()
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, user_id, title, notes, rating, review, photo_url,
                       base_trip_id, created_at, updated_at
                FROM user_trips
                WHERE user_id = %s
                ORDER BY updated_at DESC
                """,
                (uid,),
            )
            rows = cur.fetchall() or []

        items = []
        for r in rows:
            # coba parse notes sebagai JSON (kalau formatnya JSON string)
            notes_obj = None
            raw_notes = r.get("notes")
            if isinstance(raw_notes, str):
                try:
                    notes_obj = json.loads(raw_notes)
                except Exception:
                    notes_obj = None

            item = {
                "id": r["id"],
                "title": r["title"],
                "rating": r.get("rating"),
                "review": r.get("review"),
                "photo_url": r.get("photo_url"),
                "base_trip_id": r.get("base_trip_id"),
                "created_at": (
                    r.get("created_at").isoformat() if r.get("created_at") else None
                ),
                "updated_at": (
                    r.get("updated_at").isoformat() if r.get("updated_at") else None
                ),
                # untuk frontend: kalau berhasil parse JSON kirim objeknya,
                # kalau tidak, kirim string mentahnya
                "notes": notes_obj if notes_obj is not None else raw_notes,
            }
            items.append(item)

        return jsonify({"ok": True, "items": items, "count": len(items)})

    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500
    finally:
        try:
            if conn:
                conn.close()
        except:
            pass

@app.post("/api/user_trips/save")
def api_user_trips_save():
    """
    Create new saved itinerary for current user.

    Supports two payload styles:
    A) Map editor:
        {
          "title": "...",
          "notes": "...",
          "base_trip_id": 123,
          "stops": [
            {"name": "...", "lat": ..., "lng": ..., "day": 1, "seq": 1, "place_id": "...", "extra": {...}}
          ]
        }

    B) Legacy Ellie chatbot:
        { "trip": { "title": "...", "country": "...", "region": "...", "note": "...",
                    "ai_model": "...", "days": [...] } }
    """
    if "user_id" not in session:
        return jsonify({"ok": False, "error": "UNAUTHORIZED"}), 401

    uid = session["user_id"]
    data = request.get_json(silent=True) or {}

    # --- Branch B: legacy Ellie format (has "trip" wrapper) ---
    if isinstance(data.get("trip"), dict):
        trip = data["trip"]

        title   = (trip.get("title") or "").strip()
        country = (trip.get("country") or "").strip()
        region  = (trip.get("region") or "").strip()
        note    = (trip.get("note") or "").strip()
        days    = trip.get("days") or []
        model   = (trip.get("ai_model") or "").strip()

        if not title:
            return jsonify({"ok": False, "error": "title required"}), 400

        notes_obj = {
            "country": country,
            "region": region,
            "note": note,
            "source": "ai",
            "ai_model": model,
        }
        notes_str = json.dumps(notes_obj, ensure_ascii=False)

        conn = None
        try:
            conn = db()
            with conn.cursor() as cur:
                # header
                cur.execute(
                    """
                    INSERT INTO user_trips (user_id, user_token, title, notes, base_trip_id)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (uid, "", title, notes_str, None),
                )
                conn.commit()
                new_trip_id = cur.lastrowid

                # 1 row per day, lat/lng placeholder
                if days:
                    rows = []
                    for d in days:
                        day_num = int(d.get("day") or 0) or (len(rows) + 1)
                        day_title = (d.get("title") or f"Day {day_num}").strip()
                        items = d.get("items") or []
                        meta = {
                            "day": day_num,
                            "items": items,
                            "country": country,
                            "region": region,
                        }
                        rows.append(
                            (
                                new_trip_id,
                                day_num,
                                day_title,
                                0.0,
                                0.0,
                                None,
                                json.dumps(meta, ensure_ascii=False),
                            )
                        )
                    cur.executemany(
                        """
                        INSERT INTO user_trip_points
                          (user_trip_id, seq, name, lat, lng, place_id, meta_json)
                        VALUES (%s,%s,%s,%s,%s,%s,%s)
                        """,
                        rows,
                    )
                    conn.commit()

            return jsonify({"ok": True, "trip_id": new_trip_id})
        except Exception as e:
            return jsonify({"ok": False, "error": str(e)}), 500
        finally:
            try:
                if conn:
                    conn.close()
            except:
                pass

    # --- Branch A: map editor format (no "trip" wrapper) ---
    t = data
    title = (t.get("title") or "").strip()
    notes = (t.get("notes") or "").strip()
    base_trip_id = t.get("base_trip_id")
    # accept both "stops" and legacy "points"
    stops = t.get("stops")
    if stops is None:
        stops = t.get("points") or []

    if not title:
        return jsonify({"ok": False, "error": "title required"}), 400
    if not isinstance(stops, list) or not stops:
        return jsonify({"ok": False, "error": "at least one stop required"}), 400

    conn = None
    try:
        conn = db()
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO user_trips (user_id, user_token, title, notes, base_trip_id)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (uid, "", title, notes, base_trip_id),
            )
            conn.commit()
            new_trip_id = cur.lastrowid

            rows = []
            seq = 1
            for s in stops:
                if not isinstance(s, dict):
                    continue
                name = (s.get("name") or "").strip()
                if not name:
                    continue

                # parse lat/lng safely
                lat = s.get("lat")
                lng = s.get("lng")
                try:
                    lat = float(lat) if lat not in (None, "") else None
                    lng = float(lng) if lng not in (None, "") else None
                except Exception:
                    lat = lng = None

                # day + meta
                day = s.get("day")
                try:
                    day = int(day) if day not in (None, "") else 1
                except Exception:
                    day = 1

                place_id = (s.get("place_id") or "").strip() or None
                extra = s.get("extra") or {}
                if not isinstance(extra, dict):
                    extra = {}
                meta = {"day": day}
                meta.update(extra)

                # override seq if client sends it, else auto
                client_seq = s.get("seq")
                if isinstance(client_seq, (int, float)) and client_seq > 0:
                    seq_val = int(client_seq)
                else:
                    seq_val = seq
                seq += 1

                rows.append(
                    (
                        new_trip_id,
                        seq_val,
                        name,
                        lat,
                        lng,
                        place_id,
                        json.dumps(meta, ensure_ascii=False),
                    )
                )

            if rows:
                cur.executemany(
                    """
                    INSERT INTO user_trip_points
                      (user_trip_id, seq, name, lat, lng, place_id, meta_json)
                    VALUES (%s,%s,%s,%s,%s,%s,%s)
                    """,
                    rows,
                )
                conn.commit()

        return jsonify({"ok": True, "trip_id": new_trip_id})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500
    finally:
        try:
            if conn:
                conn.close()
        except:
            pass

@app.get("/api/popular_regions")
def api_popular_regions():
    """
    Popular regions based on ratings in user_trips.

    Hanya ambil:
      - user_trips.rating IS NOT NULL dan > 0
      - country & region tidak kosong

    Optional query params:
      - country: filter by user_trips.country
      - limit:   max number of regions (default 6, max 30)
    """
    country = (request.args.get("country") or "").strip()

    # limit safety
    try:
        limit = int(request.args.get("limit") or 6)
    except ValueError:
        limit = 6
    limit = max(1, min(limit, 30))

    where_clauses = [
        "rating IS NOT NULL",
        "rating > 0",
        "country IS NOT NULL",
        "country <> ''",
        "region IS NOT NULL",
        "region <> ''"
    ]
    params = []

    if country:
        where_clauses.append("country = %s")
        params.append(country)

    where_sql = "WHERE " + " AND ".join(where_clauses)

    sql = f"""
        SELECT
            country,
            region,
            AVG(rating) AS avg_rating,
            COUNT(*)    AS rating_count,
            MIN(created_at) AS first_rated_at,
            MAX(updated_at) AS last_rated_at
        FROM user_trips
        {where_sql}
        GROUP BY country, region
        ORDER BY
            avg_rating DESC,
            rating_count DESC,
            last_rated_at DESC
        LIMIT %s
    """

    conn = None
    try:
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute(sql, (*params, limit))
            rows = cur.fetchall() or []

        items = []
        for r in rows:
            items.append({
                "country":       r["country"],
                "region":        r["region"],
                "avg_rating":    float(r["avg_rating"]) if r["avg_rating"] is not None else None,
                "rating_count":  int(r["rating_count"]) if r["rating_count"] is not None else 0,
                "first_rated_at": r["first_rated_at"].isoformat() if r.get("first_rated_at") else None,
                "last_rated_at":  r["last_rated_at"].isoformat() if r.get("last_rated_at") else None,
            })

        return jsonify({"ok": True, "items": items, "count": len(items)})
    except Exception as e:
        return jsonify({"ok": False, "error": f"{type(e).__name__}: {e}"}), 500
    finally:
        try:
            if conn:
                conn.close()
        except:
            pass

# Alias agar map.js yang pakai POST /api/user_trips juga tetap jalan
@app.post("/api/user_trips")
def api_user_trips_create_alias():
    return api_user_trips_save()


@app.get("/api/user_trips/<int:trip_id>")
def api_user_trips_detail(trip_id):
    """
    Load one saved itinerary for current user.

    Response:
      { ok: true, trip: { ..., points: [...], days: [...] } }
    """
    if "user_id" not in session:
        return jsonify({"ok": False, "error": "UNAUTHORIZED"}), 401
    uid = session["user_id"]

    conn = None
    try:
        conn = db()
        with conn.cursor() as cur:
            # header
            cur.execute(
                """
                SELECT id, user_id, title, notes, rating, review, photo_url,
                       base_trip_id, created_at, updated_at
                FROM user_trips
                WHERE id=%s AND user_id=%s
                LIMIT 1
                """,
                (trip_id, uid),
            )
            trip = cur.fetchone()
            if not trip:
                return jsonify({"ok": False, "error": "NOT_FOUND"}), 404

            # points rows
            cur.execute(
                """
                SELECT id, user_trip_id, seq, name, lat, lng, place_id, meta_json, created_at
                FROM user_trip_points
                WHERE user_trip_id=%s
                ORDER BY seq ASC, id ASC
                """,
                (trip_id,),
            )
            rows = cur.fetchall()

        # parse notes JSON kalau bisa
        notes_obj = None
        nval = trip.get("notes")
        if isinstance(nval, str):
            try:
                notes_obj = json.loads(nval)
            except Exception:
                notes_obj = None

        # build normalized points for map
        points = []
        for r in rows:
            meta = {}
            if r.get("meta_json"):
                try:
                    meta = json.loads(r["meta_json"])
                except Exception:
                    meta = {}
            if not isinstance(meta, dict):
                meta = {}

            day = meta.get("day") or 1
            try:
                day = int(day)
            except Exception:
                day = 1

            lat = r.get("lat")
            lng = r.get("lng")
            try:
                lat = float(lat) if lat not in (None, "") else None
                lng = float(lng) if lng not in (None, "") else None
            except Exception:
                lat = lng = None

            points.append(
                {
                    "id": r["id"],
                    "user_trip_id": r["user_trip_id"],
                    "name": r["name"],
                    "lat": lat,
                    "lng": lng,
                    "seq": r["seq"],
                    "day": day,
                    "place_id": r.get("place_id"),
                    "meta": meta,
                }
            )

        # final payload
        trip_payload = {
            **trip,
            "notes_obj": notes_obj,
            "points": points,
            "days": rows,
        }

        return jsonify({"ok": True, "trip": trip_payload})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500
    finally:
        try:
            if conn:
                conn.close()
        except:
            pass


@app.put("/api/user_trips/<int:trip_id>/review")
def update_user_trip_review(trip_id: int):
    """
    Update rating / review / photo_url untuk user_trip tertentu.
    Hanya boleh diakses oleh pemilik trip (user_id / user_token yang sama).
    """
    conn = get_db()
    uid  = current_user_id()
    tok  = _request_uid()

    data = request.get_json(silent=True) or {}

    # --- rating (1-5) ---
    rating = data.get("rating")
    if rating is not None:
        try:
            rating = int(rating)
        except Exception:
            rating = None

    if rating is not None:
        if rating < 1:
            rating = 1
        if rating > 5:
            rating = 5

    # --- review & photo_url (string, bisa kosong) ---
    review    = (data.get("review") or "").strip() or None
    photo_url = (data.get("photo_url") or "").strip() or None
    country = (data.get("country") or "").strip() or None
    region  = (data.get("region")  or "").strip() or None


    try:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE user_trips
                SET
                    rating     = %s,
                    review     = %s,
                    photo_url  = %s,
                    country    = %s,
                    region     = %s,
                    updated_at = NOW()
                WHERE id=%s AND (user_id <=> %s OR user_token=%s)
            """, (rating, review, photo_url, country, region, trip_id, uid, tok))



            if cur.rowcount == 0:
                return jsonify({"ok": False, "error": "not_found_or_no_permission"}), 404

        return jsonify({
            "ok": True,
            "id": trip_id,
            "rating": rating,
            "review": review,
            "photo_url": photo_url,
            "country": country,
            "region": region,
        })
    except Exception as e:
        return jsonify({"ok": False, "error": f"{type(e).__name__}: {e}"}), 500
    
@app.post("/api/upload_photo")
def upload_photo():
    if "file" not in request.files:
        return jsonify({"ok": False, "error": "no_file"}), 400

    file = request.files["file"]

    if file.filename == "":
        return jsonify({"ok": False, "error": "empty_filename"}), 400

    if not allowed_file(file.filename):
        return jsonify({"ok": False, "error": "invalid_format"}), 400

    filename = secure_filename(file.filename)

    save_path = os.path.join(UPLOAD_FOLDER, filename)
    file.save(save_path)

    url_path = f"/static/uploads/{filename}"

    return jsonify({"ok": True, "url": url_path})

@app.route("/api/user_trips/<int:trip_id>", methods=["DELETE"])
def delete_user_trip(trip_id):
    conn = get_db()
    try:
        # 允許兩種身分：登入 user_id 或匿名 uid token（X-UID / cookie: uid）
        uid = current_user_id()     # 可能是 None
        tok = _request_uid()        # 統一從 header/cookie/_uid_token 取

        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, user_id, user_token FROM user_trips WHERE id=%s LIMIT 1",
                (trip_id,)
            )
            row = cur.fetchone()
            if not row:
                return jsonify({"ok": False, "error": "not_found"}), 404

            # 權限檢查：有 user_id 就比對 user_id；否則比對 user_token
            if row["user_id"]:
                if not uid or int(uid) != int(row["user_id"]):
                    return jsonify({"ok": False, "error": "forbidden"}), 403
            else:
                if not tok or tok != (row["user_token"] or ""):
                    return jsonify({"ok": False, "error": "forbidden"}), 403

            # 先刪子表（若存在）
            try:
                cur.execute("DELETE FROM user_trip_points WHERE user_trip_id=%s", (trip_id,))
            except Exception:
                pass  # 沒這張表就略過

            # 刪主表
            cur.execute("DELETE FROM user_trips WHERE id=%s", (trip_id,))

        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"ok": False, "error": f"{type(e).__name__}: {e}"}), 500
    finally:
        try:
            conn.close()
        except:
            pass


@app.post("/api/user_trips/<int:trip_id>/delete")
def delete_user_trip_via_post(trip_id):
    # 直接呼叫上面的函式邏輯
    with app.test_request_context(method="DELETE"):
        return delete_user_trip(trip_id)


# ==============================================================
# Trip points endpoint（耐撞版：強制 DictCursor、day 欄位自動降級）
# ==============================================================
@app.get("/api/trips/<int:trip_id>/points")
def api_trip_points(trip_id: int):
    """
    回傳：
      { ok: True, trip_id, points: [ { id, name, lat, lng, day, seq } ] }
    來源：trip_points JOIN points；依 day, seq 排序
    """
    conn = None
    try:
        conn = get_db()
        cur  = dict_cursor(conn)   # ← 確保是 DictCursor

        # 主查：trip_points + points
        cur.execute("""
            SELECT
              p.id   AS point_id,
              p.name AS name,
              p.lat  AS lat,
              p.lng  AS lng,
              tp.day AS day,
              tp.seq AS seq
            FROM trip_points tp
            JOIN points p ON p.id = tp.point_id
            WHERE tp.trip_id = %s
            ORDER BY tp.day ASC, tp.seq ASC, p.id ASC
        """, (trip_id,))
        rows = cur.fetchall() or []

        points = [{
          "id":  r["point_id"],
          "name": r["name"],
          "lat": float(r["lat"]),
          "lng": float(r["lng"]),
          "day": int(r["day"] or 1),
          "seq": int(r["seq"] or 1),
        } for r in rows]

        return jsonify({ "ok": True, "trip_id": trip_id, "points": points })

    except Exception as e:
        return jsonify({ "ok": False, "error": f"{type(e).__name__}: {e}" }), 500
    finally:
        try:
            if conn: conn.close()
        except:
            pass


# ==============================================================
#                   OPENAI HELPER (GLOBAL)
# ==============================================================
def call_openai(messages, model="gpt-4o-mini", temperature=0.6, max_tokens=500):
    """
    messages: list[{"role": "system"|"user"|"assistant", "content": str}]
    return: string teks balasan model
    """
    if not OPENAI_API_KEY:
        # mode offline agar UI tetap jalan saat dev
        return ("(Offline) Set OPENAI_API_KEY untuk mengaktifkan AI. "
                "Contoh: I can guide you. Choose a country: Indonesia, Malaysia, Thailand.")

    try:
        from openai import OpenAI  # import di dalam fungsi agar aman jika package belum terpasang saat dev
        client = OpenAI(api_key=OPENAI_API_KEY)
        resp = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return (resp.choices[0].message.content or "").strip()
    except Exception as e:
        return f"(OpenAI error) {e}"


# === VALIDATOR & HELPERS ===
email_re = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

def get_user_by_email(conn, email):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT user_id, username, email, password_hash, full_name
            FROM users WHERE email=%s LIMIT 1
        """, (email,))
        return cur.fetchone()

def get_user_by_username(conn, username):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT user_id, username, email, password_hash, full_name
            FROM users WHERE username=%s LIMIT 1
        """, (username,))
        return cur.fetchone()

# ==============================================================
#           Helpers: clean POIs & Google Geocoding
# ==============================================================

# --- Non-POI blacklist (buang aktivitas non-destinasi)
NON_POI_RE = re.compile(
    r"(?i)\b(check-?in|check out|hotel|hostel|resort|lodge|breakfast|lunch|dinner|meal|"
    r"relax|free time|rest|swimming|shopping|transfer|travel to|airport|station|port|photo stop)\b"
)

def filter_poi(points):
    """
    Filter array of {name, lat?, lng?} → hanya POI wisata (tanpa check-in, hotel, dll).
    """
    out = []
    for p in points or []:
        name = (p.get("name") or "").strip()
        if not name or NON_POI_RE.search(name):
            continue
        lat = p.get("lat"); lng = p.get("lng")
        try:
            lat = float(lat) if lat not in (None, "") else None
            lng = float(lng) if lng not in (None, "") else None
        except Exception:
            lat = lng = None
        out.append({"name": name, "lat": lat, "lng": lng})
    return out

# --- Country bounding boxes (kasar) ---
COUNTRY_BBOX = {
    "Indonesia": {"lat_min": -11.0, "lat_max": 6.5,  "lng_min": 95.0,  "lng_max": 141.5},
    "Malaysia":  {"lat_min": 0.8,   "lat_max": 7.5,  "lng_min": 99.6,  "lng_max": 120.0},
    "Thailand":  {"lat_min": 5.5,   "lat_max": 20.5, "lng_min": 97.4,  "lng_max": 105.0},
}

def is_valid_poi_name(name: str) -> bool:
    if not name or len(name.strip()) < 3:
        return False
    return not NON_POI_RE.search(name)

def within_bbox(lat: float, lng: float, country: str) -> bool:
    box = COUNTRY_BBOX.get((country or "").strip())
    if not box or lat is None or lng is None:
        return False
    return (box["lat_min"] <= lat <= box["lat_max"]) and (box["lng_min"] <= lng <= box["lng_max"])

def _row_get(row, key, default=None):
    if not row:
        return default
    if isinstance(row, dict):
        return row.get(key, default)
    try:
        return getattr(row, key, default)
    except Exception:
        return default

def _get_point_by_name(cur, name: str):
    cur.execute("SELECT id, lat, lng FROM points WHERE LOWER(name)=LOWER(%s) LIMIT 1", (name,))
    return cur.fetchone()

def _find_or_create_point_with_coords(cur, country: str, province: str, name: str, lat, lng):
    """
    Cari point berdasarkan nama; jika belum ada → buat baru minimal dengan name, lat, lng.
    Country / province tidak dipakai di tabel points versi sekarang.
    """
    existing = _get_point_by_name(cur, name)
    if existing:
        pid = _row_get(existing, "id")
        # Optionally update coords if keduanya 0/None & kita punya koordinat baru
        old_lat = _row_get(existing, "lat")
        old_lng = _row_get(existing, "lng")
        if (old_lat in (None, 0, 0.0) or old_lng in (None, 0, 0.0)) and (lat not in (None, "") and lng not in (None, "")):
            try:
                cur.execute(
                    "UPDATE points SET lat=%s, lng=%s WHERE id=%s",
                    (float(lat), float(lng), pid),
                )
            except Exception:
                pass
        return pid

    # create minimal
    try:
        lat_val = float(lat) if lat not in (None, "") else None
        lng_val = float(lng) if lng not in (None, "") else None
    except Exception:
        lat_val = lng_val = None

    cur.execute(
        "INSERT INTO points (name, lat, lng) VALUES (%s,%s,%s)",
        (name, lat_val, lng_val),
    )
    return cur.lastrowid

def _save_trip_points_from_array(trip_id: int, country: str, province: str, points: list):
    """
    Simpan relasi trip->points ke trip_points(trip_id, point_id, day, seq) berurutan mulai 1.
    Untuk sekarang semua day=1; nanti bisa dikembangkan jika Ellie mengirim day.
    """
    if not points:
        return
    conn2 = db()
    try:
        with conn2.cursor() as cur:
            seq = 1
            for p in points:
                name = (p.get("name") or "").strip()
                if not name:
                    continue
                try:
                    lat = float(p.get("lat")) if p.get("lat") not in (None, "") else None
                    lng = float(p.get("lng")) if p.get("lng") not in (None, "") else None
                except Exception:
                    lat = lng = None

                pid = _find_or_create_point_with_coords(cur, country, province, name, lat, lng)
                day_val = 1  # simple: semua di Day 1

                cur.execute(
                    "INSERT INTO trip_points (trip_id, point_id, day, seq) VALUES (%s,%s,%s,%s)",
                    (trip_id, pid, day_val, seq),
                )
                seq += 1
        conn2.commit()
    finally:
        try:
            conn2.close()
        except Exception:
            pass

def _save_trip_points_for_itinerary(trip_id: int, country: str, province: str, itinerary: str):
    """
    Fallback jika hanya ada itinerary text → pecah nama tempat, buat point bila belum ada,
    lalu insert ke trip_points(trip_id, point_id, day, seq) semuanya di Day 1.
    """
    names = parse_itinerary_names(itinerary)
    if not names:
        return
    conn2 = db()
    try:
        with conn2.cursor() as cur:
            seq = 1
            for nm in names:
                nm = (nm or "").strip()
                if not nm:
                    continue
                cur.execute("SELECT id FROM points WHERE LOWER(name)=LOWER(%s) LIMIT 1", (nm,))
                r = cur.fetchone()
                if r:
                    pid = _row_get(r, "id")
                else:
                    cur.execute("INSERT INTO points (name, lat, lng) VALUES (%s,%s,%s)", (nm, None, None))
                    pid = cur.lastrowid

                cur.execute(
                    "INSERT INTO trip_points (trip_id, point_id, day, seq) VALUES (%s,%s,%s,%s)",
                    (trip_id, pid, 1, seq),
                )
                seq += 1
        conn2.commit()
    finally:
        try:
            conn2.close()
        except Exception:
            pass

# ========= Google Geocoding Helpers =========
_GOOGLE_CACHE = {}  # very simple in-memory cache

def geocode_place(name: str, country: str = "", region: str = ""):
    if not GMAPS_KEY:
        print("[GEOCODE] GMAPS_KEY is empty, skip geocoding for:", name)
        return (None, None)
    key = (name.strip().lower(), country.strip().lower(), region.strip().lower())
    if key in _GOOGLE_CACHE:
        return _GOOGLE_CACHE[key]

    address = name.strip()
    hint = ", ".join([p for p in [region.strip(), country.strip()] if p])
    if hint:
        address = f"{address}, {hint}"

    params = {"address": address, "key": GMAPS_KEY}
    cc = (country or "").strip().lower()
    cc_map = {"indonesia": "ID", "malaysia": "MY", "thailand": "TH"}
    if cc in cc_map:
        params["components"] = f"country:{cc_map[cc]}"

    try:
        print("[GEOCODE] querying:", address, params.get("components"))
        r = requests.get(
            "https://maps.googleapis.com/maps/api/geocode/json",
            params=params,
            timeout=8,
        )
        js = r.json()
        print("[GEOCODE] status:", js.get("status"), js.get("error_message"))
        if js.get("results"):
            loc = js["results"][0]["geometry"]["location"]
            lat, lng = float(loc["lat"]), float(loc["lng"])
            _GOOGLE_CACHE[key] = (lat, lng)
            return (lat, lng)
    except Exception as e:
        print("Geocode error:", e)

    _GOOGLE_CACHE[key] = (None, None)
    return (None, None)


def enrich_points_with_google(points: list, country: str, region: str):
    """
    For each point dict {name, lat?, lng?}, fill lat/lng using Google if missing.
    Returns new list of points (keeps the original order).
    """
    enriched = []
    for p in points or []:
        name = (p.get("name") or "").strip()
        if not name:
            continue
        lat = p.get("lat"); lng = p.get("lng")
        try:
            lat = float(lat) if lat not in (None, "") else None
            lng = float(lng) if lng not in (None, "") else None
        except Exception:
            lat = lng = None

        if lat is None or lng is None:
            glat, glng = geocode_place(name, country=country, region=region)
            lat = glat if glat is not None else lat
            lng = glng if glng is not None else lng

        enriched.append({"name": name, "lat": lat, "lng": lng})
    return enriched

def parse_itinerary_names(text: str):
    """
    Turn a comma-separated itinerary text into a list of POI names
    while filtering out non-POI terms via NON_POI_RE.
    """
    names = []
    for raw in (text or "").split(","):
        n = raw.strip()
        if not n or NON_POI_RE.search(n):
            continue
        # Remove generic words like 'Day 1', 'Return to', etc (light clean)
        n = re.sub(r"(?i)\b(day\s*\d+|return to|transfer to|back to)\b", "", n).strip(",;: ").strip()
        if n and n not in names:
            names.append(n)
    return names
# ==============================================================
#                   ROUTES HALAMAN
# ==============================================================

@app.get("/")
def home():
    return render_template("login.html")

@app.get("/login")
@app.get("/login.html")
def login_page():
    return render_template("login.html")

@app.get("/index")
@app.get("/index.html")
def index_page():
    return render_template("index.html")

# Chat page (di-handle juga oleh router generik, tapi eksplisitkan saja)
@app.get("/chat")
@app.get("/chat.html")
def chat_page():
    return render_template("chat.html")

@app.get("/map")
@app.get("/map.html")
def map_page():
    return render_template("map.html", gmaps_key=GMAPS_KEY)


# Router generik
@app.get("/<path:filename>")
def serve_any(filename):
    if "." not in filename:
        candidate = f"{filename}.html"
        t1 = os.path.join(TEMPLATES_DIR, candidate)
        if os.path.exists(t1):
            return render_template(candidate)
    if filename.endswith(".html"):
        t2 = os.path.join(TEMPLATES_DIR, filename)
        if os.path.exists(t2):
            return render_template(filename)
    s1 = os.path.join(STATIC_DIR, filename)
    if os.path.exists(s1):
        return send_from_directory(STATIC_DIR, filename)
    r1 = os.path.join(APP_DIR, filename)
    if os.path.exists(r1):
        return send_from_directory(APP_DIR, filename)
    return "404 Not Found", 404

# ==============================================================
#                   API: DESTINATION POINTS (existing)
# ==============================================================

# --- Health check for frontend auto-detect ---
@app.get("/api/ping")
def api_ping():
    return jsonify({"ok": True, "ping": "pong"})

@app.get("/api/points")
def api_points():
    country = (request.args.get("country") or "").strip()
    try:
        limit = int(request.args.get("limit", 9))
    except ValueError:
        return jsonify({"error": "invalid limit"}), 400
    limit = max(1, min(limit, 50))

    try:
        conn = db()
        with conn.cursor() as cur:
            cur.execute("""
                SELECT name, region, city
                FROM points
                WHERE country=%s
                ORDER BY id DESC
                LIMIT %s
            """, (country, limit))
            rows = cur.fetchall()
        return jsonify({"items": rows})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        try: conn.close()
        except: pass

# ==============================================================
#                   🔵 API: REGIONS & TRIPS (DB)
# ==============================================================

# === REPLACE: /api/regions now returns distinct provinces ===
@app.get("/api/regions")
def api_regions_as_provinces():
    from flask import request, jsonify
    country = (request.args.get("country") or "").strip()
    if not country:
        return jsonify({"ok": False, "error": "country is required"}), 400

    sql = """
        SELECT province AS province, COUNT(*) AS cnt
        FROM trips
        WHERE country = %s
          AND province IS NOT NULL
          AND province <> ''
        GROUP BY province
        ORDER BY province ASC
    """

    conn = None
    try:
        conn = db()
        with conn.cursor() as cur:
            cur.execute(sql, (country,))
            rows = cur.fetchall()
        items = [{"province": r["province"], "count": int(r["cnt"])} for r in rows]
        return jsonify({"ok": True, "items": items, "count": len(items)})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500
    finally:
        try:
            if conn: conn.close()
        except:
            pass


# === STRICT DB-ONLY: list trips (random), filter by province if provided ===
@app.get("/api/trips")
def api_trips_list_db_only():
    from flask import request, jsonify
    country  = (request.args.get("country") or "").strip()
    province = (request.args.get("province") or "").strip()   # <<-- pakai province
    region   = (request.args.get("region") or "").strip()     # opsional (fallback)
    limit    = max(1, min(int(request.args.get("limit") or 2), 100))
    rand     = (request.args.get("rand") or "1") in ("1", "true", "yes")  # default: random

    where, params = [], []
    if country:
        where.append("country = %s");  params.append(country)
    # Utamakan province; kalau kosong, baru pakai region (biar backward compatible)
    if province:
        where.append("province = %s"); params.append(province)
    elif region:
        where.append("region = %s");   params.append(region)

    where_sql = ("WHERE " + " AND ".join(where)) if where else ""
    order_sql = "ORDER BY RAND()" if rand else "ORDER BY id DESC"

    sql = f"""
        SELECT id, title, country, province, region, best_season,
               suggested_duration, notes, itinerary, source, curation_status
        FROM trips
        {where_sql}
        {order_sql}
        LIMIT %s
    """

    conn = None
    try:
        conn = db()
        with conn.cursor() as cur:
            cur.execute(sql, (*params, limit))
            rows = cur.fetchall()
        return jsonify({"ok": True, "items": rows, "count": len(rows)})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500
    finally:
        try:
            if conn: conn.close()
        except:
            pass

# === Get single trip by ID ===
@app.get("/api/trips/<int:trip_id>")
def api_trip_detail(trip_id):
    conn = None
    try:
        conn = db()
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, title, country, province, region, best_season,
                       suggested_duration, notes, itinerary, source, curation_status
                FROM trips
                WHERE id = %s
            """, (trip_id,))
            row = cur.fetchone()
            if not row:
                return jsonify({"ok": False, "error": f"Trip {trip_id} not found"}), 404
            return jsonify({"ok": True, "item": row})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500
    finally:
        try:
            if conn: conn.close()
        except:
            pass


# =====================================================================
# 🔒 Province whitelist + normalizer (tempel sekali di app.py)
# =====================================================================
ALLOWED_PROVINCES = [
    "Bali",
    "Central Thailand",
    "Central–South Peninsula",
    "East Coast Peninsula",
    "Eastern Thailand",
    "Java",
    "Kalimantan",
    "Maluku",
    "Northeastern Thailand (Isan)",
    "Northern Peninsula",
    "Northern Thailand",
    "Nusa Tenggara",
    "Papua",
    "Sabah (Borneo)",
    "Sarawak (Borneo)",
    "Southern Thailand",
    "Sulawesi",
    "Sumatra",
    "West Nusa Tenggara",
]

PROVINCE_ALIASES = {
    # dash variations
    "central-south peninsula": "Central–South Peninsula",
    "central – south peninsula": "Central–South Peninsula",
    "central south peninsula": "Central–South Peninsula",
    # Sumatra variants
    "north sumatra": "Sumatra",
    "west sumatra": "Sumatra",
    # Thailand variants
    "isan": "Northeastern Thailand (Isan)",
    "northeastern thailand": "Northeastern Thailand (Isan)",
    # Nusa Tenggara variants
    "west nusa tenggara (ntb)": "West Nusa Tenggara",
    # Borneo states
    "sabah": "Sabah (Borneo)",
    "sarawak": "Sarawak (Borneo)",
}

def _canon_province_name(s: str | None) -> str | None:
    if not s:
        return None
    raw = str(s).strip()
    # exact
    for p in ALLOWED_PROVINCES:
        if raw.lower() == p.lower():
            return p
    # alias
    k = raw.lower().replace("—", "-").replace("–", "-").replace("  ", " ").strip()
    if k in PROVINCE_ALIASES:
        return PROVINCE_ALIASES[k]
    # tolerant dash
    for p in ALLOWED_PROVINCES:
        if k == p.lower().replace("—", "-").replace("–", "-"):
            return p
    return None

def canonical_province(ai_value: str | None, requested: str | None) -> str | None:
    """
    Prefer `requested` (from client) if valid; else normalize AI's value.
    Fallback to requested (even if not valid) to keep UX predictable.
    """
    hit = _canon_province_name(requested)
    if hit:
        return hit
    hit = _canon_province_name(ai_value)
    if hit:
        return hit
    return requested or None

def _clamp(val, maxlen=100):
    """
    簡易防呆函式：
    - 若 val 為 None，回傳空字串
    - 若為非字串，先轉字串
    - 長度超過 maxlen 時自動截斷
    """
    if val is None:
        return ""
    s = str(val).strip()
    return s[:maxlen]

# =====================================================================

@app.post("/api/trips/ai")
def api_trips_ai_generate_only():
    import os, json, re
    from flask import request, jsonify

    data = request.get_json(silent=True) or {}

    # basic inputs dari frontend
    country      = (data.get("country") or "Indonesia").strip()
    province_req = (data.get("province") or "").strip()

    # jumlah AI trip yang diminta (1 atau 2) – from places.js
    n_raw = data.get("n")
    try:
        n = int(n_raw) if n_raw is not None else 1
    except (TypeError, ValueError):
        n = 1
    if n < 1:
        n = 1
    if n > 2:
        n = 2

    # optional, buat future flow chatbot/filters
    trip_type = (data.get("type") or "general").strip()
    duration  = (data.get("duration") or "2-3 days").strip()
    budget    = (data.get("budget") or "mid").strip()

    if not province_req:
        return jsonify({"ok": False, "error": "province is required"}), 400

    # prompt mirip project11_app, tapi tambah type/duration/budget
    system = (
        "You are a travel planner. Return EXACTLY 2 trips as STRICT JSON object "
        "with key 'trips' and value = array of 2 trip objects. No prose, no "
        "markdown fences. Schema per trip: "
        "{title, country, province, region, best_season, suggested_duration, "
        "notes, itinerary}. itinerary must be a short comma-separated list "
        "of 3–6 stops. Set 'region' equal to the same value as 'province'."
    )

    user = (
        "Generate two realistic trips.\n"
        f"country={country}\n"
        f"province={province_req}\n"
        f"type={trip_type}\n"
        f"duration={duration}\n"
        f"budget={budget}\n"
        "style=hidden gems, practical."
    )

    def _clamp(v, length):
        return (v or "").strip()[:length]

    def _offline_payload():
        # fallback kalau tidak ada / gagal OpenAI – tetap kasih 2 trip
        prov = _canon_province_name(province_req) or province_req
        return {
            "trips": [
                {
                    "title": f"Highlights of {prov}",
                    "country": country,
                    "province": prov,
                    "region": prov,
                    "best_season": "May – September",
                    "suggested_duration": duration,
                    "notes": "Start early and check local conditions.",
                    "itinerary": "Stop A, Stop B, Stop C",
                },
                {
                    "title": f"{prov} Essentials",
                    "country": country,
                    "province": prov,
                    "region": prov,
                    "best_season": "May – September",
                    "suggested_duration": duration,
                    "notes": "Expect traffic at peak hours.",
                    "itinerary": "Stop D, Stop E, Stop F",
                },
            ]
        }

    def call_model():
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            # tidak ada API key → langsung pakai dummy
            return _offline_payload()

        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.6,
            max_tokens=700,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        )
        txt = (resp.choices[0].message.content or "").strip()
        txt = txt.replace("```json", "").replace("```", "").strip()

        try:
            m = re.search(r"{.*}", txt, flags=re.S)
            obj = json.loads(m.group(0) if m else txt)
        except Exception:
            # kalau parsing gagal → fallback ke dummy
            return _offline_payload()
        return obj

    # panggil model / dummy
    payload = call_model()
    trips = (payload.get("trips") or [])[:2]

    if not trips:
        # kalau aneh banget sampai kosong juga → paksa dummy
        payload = _offline_payload()
        trips = (payload.get("trips") or [])[:2]

    # Normalisasi untuk frontend
    normalized = []
    for t in trips:
        prov = canonical_province(t.get("province"), province_req) or province_req
        normalized.append({
            "title":              _clamp(t.get("title"), 150),
            "country":            _clamp(t.get("country") or country, 50) or country,
            "province":           _clamp(prov, 100),
            "region":             _clamp(prov, 100),
            "best_season":        _clamp(t.get("best_season"), 50),
            "suggested_duration": _clamp(t.get("suggested_duration") or duration, 20),
            "notes":              (t.get("notes") or "").strip(),
            "itinerary":          (t.get("itinerary") or "").strip(),
            "_unsaved": True,  # penting buat places.js -> ini belum ada id
        })

    # places.js pakai j.items, tapi kita kirim j.trips juga biar fleksibel
    normalized_for_needed = normalized[:n]
    return jsonify({
        "ok": True,
        "items": normalized_for_needed,  # ⬅️ dipakai places.js
        "trips": normalized,             # ⬅️ cadangan kalau dipakai tempat lain
        "saved": False
    })

# --- Non-POI blacklist for Ellie/AI trips ---
NON_POI_RE = re.compile(
    r"(?i)\b("
    r"check-?in|check ?out|hotel|hostel|resort|villa|guesthouse|homestay|lodge|"
    r"breakfast|lunch|dinner|brunch|meal|restaurant|cafe|coffee shop|"
    r"relax|free time|leisure time|rest|chill|enjoy the view|"
    r"shopping|souvenir|market visit|transfer|travel to|drive to|"
    r"airport|station|harbor|port|ferry|photo stop"
    r")\b"
)

def filter_poi(points):
    """
    Filter raw points from AI and keep only real POIs.
    Input: list of objects with at least {name}
    Output: list of {name, lat?, lng?}
    """
    out = []
    for p in points or []:
        name = (p.get("name") or "").strip()
        if not name or NON_POI_RE.search(name):
            continue
        lat = p.get("lat")
        lng = p.get("lng")
        try:
            lat = float(lat) if lat not in (None, "") else None
            lng = float(lng) if lng not in (None, "") else None
        except Exception:
            lat = lng = None
        out.append({"name": name, "lat": lat, "lng": lng})
    return out


def enrich_points_with_google(points: list, country: str, region: str):
    """
    Ensure every point has lat/lng by calling Google when needed.
    Input: list of {name, lat?, lng?}
    Output: list of {name, lat, lng} with floats.
    """
    enriched = []
    for p in points or []:
        name = (p.get("name") or "").strip()
        if not name:
            continue

        lat = p.get("lat")
        lng = p.get("lng")
        try:
            lat = float(lat) if lat not in (None, "") else None
            lng = float(lng) if lng not in (None, "") else None
        except Exception:
            lat = lng = None

        if lat is None or lng is None:
            glat, glng = geocode_place(name, country=country, region=region)
            lat = glat if glat is not None else lat
            lng = glng if glng is not None else lng

        enriched.append({"name": name, "lat": lat, "lng": lng})
    return enriched


def parse_itinerary_names(text: str):
    """
    Turn a comma / newline separated itinerary into a list of POI names,
    filtering out generic non-POI phrases via NON_POI_RE.
    """
    names = []
    raw_parts = re.split(r"[\n;,]", text or "")
    for raw in raw_parts:
        n = raw.strip()
        if not n or NON_POI_RE.search(n):
            continue
        # remove things like 'Day 1', 'Return to', etc.
        n = re.sub(
            r"(?i)\b(day\s*\d+|return to|transfer to|back to)\b",
            "",
            n,
        )
        n = n.strip(" ,;:-")
        if n and n not in names:
            names.append(n)
    return names


def _get_point_by_name(cur, name: str):
    """Find point by name (case-insensitive)."""
    cur.execute(
        "SELECT id, lat, lng FROM points WHERE LOWER(name)=LOWER(%s) LIMIT 1",
        (name,),
    )
    return cur.fetchone()


def _find_or_create_point_with_coords(cur, country, province, name: str, lat, lng):
    """
    Ensure a point exists in points(name, lat, lng, ...).
    If exists and lat/lng missing, update them (optionally with Google).
    """
    name = (name or "").strip()
    if not name:
        return None

    rec = _get_point_by_name(cur, name)
    if rec:
        pid = rec["id"]
        plat = rec.get("lat")
        plng = rec.get("lng")
        # fill coords if currently null/zero and new coords are available
        try:
            plat_f = float(plat) if plat is not None else None
            plng_f = float(plng) if plng is not None else None
        except Exception:
            plat_f = plng_f = None

        if (plat_f in (None, 0.0) or plng_f in (None, 0.0)) and (
            lat is not None and lng is not None
        ):
            cur.execute(
                "UPDATE points SET lat=%s, lng=%s WHERE id=%s",
                (lat, lng, pid),
            )
        return pid

    # if we still don't have coords, try to geocode
    if lat is None or lng is None:
        glat, glng = geocode_place(name, country=country, region=province)
        if glat is not None and glng is not None:
            lat, lng = glat, glng

    # final fallback (DB columns are NOT NULL)
    if lat is None:
        lat = 0.0
    if lng is None:
        lng = 0.0

    cur.execute(
        "INSERT INTO points (name, lat, lng) VALUES (%s,%s,%s)",
        (name, lat, lng),
    )
    return cur.lastrowid


def _save_trip_points_from_array(trip_id: int, country: str, province: str, points: list):
    """
    Save relations trip->points into trip_points(trip_id, point_id, day, seq).
    All points are placed on day=1, seq from 1..N.
    """
    if not points:
        return

    conn2 = db()
    try:
        with conn2.cursor() as cur:
            seq = 1
            for p in points:
                name = (p.get("name") or "").strip()
                if not name:
                    continue

                lat = p.get("lat")
                lng = p.get("lng")
                try:
                    lat = float(lat) if lat not in (None, "") else None
                    lng = float(lng) if lng not in (None, "") else None
                except Exception:
                    lat = lng = None

                pid = _find_or_create_point_with_coords(
                    cur, country, province, name, lat, lng
                )
                if pid is None:
                    continue

                cur.execute(
                    "INSERT INTO trip_points (trip_id, point_id, day, seq) "
                    "VALUES (%s,%s,%s,%s)",
                    (trip_id, pid, 1, seq),
                )
                seq += 1
        conn2.commit()
    finally:
        try:
            conn2.close()
        except Exception:
            pass


def _split_itinerary(itin: str):
    """Split itinerary text into unique stop names."""
    if not itin:
        return []
    raw = re.split(r"[\n,]| - ", str(itin))
    stops = [s.strip() for s in raw if s and s.strip()]
    seen, out = set(), []
    for s in stops:
        k = s.lower()
        if k not in seen:
            seen.add(k)
            out.append(s)
    return out


def _save_trip_points_for_itinerary(trip_id: int, country: str, province: str, itinerary: str):
    """
    Fallback if we only have itinerary text.
    Split into POI names and save to trip_points (day=1).
    """
    stops = _split_itinerary(itinerary)
    if not stops:
        return

    conn2 = db()
    try:
        with conn2.cursor() as cur:
            seq = 1
            for stop in stops:
                nm = (stop or "").strip()
                if not nm:
                    continue

                # create / update point with coords via Google
                pid = _find_or_create_point_with_coords(
                    cur, country, province, nm, None, None
                )
                if pid is None:
                    continue

                cur.execute(
                    "INSERT INTO trip_points (trip_id, point_id, day, seq) "
                    "VALUES (%s,%s,%s,%s)",
                    (trip_id, pid, 1, seq),
                )
                seq += 1
        conn2.commit()
    finally:
        try:
            conn2.close()
        except Exception:
            pass


# ===================== /api/trips/ai/save — SAVE AI TRIP + AUTO BUILD POINTS =====================
@app.post("/api/trips/ai/save")  # no trailing slash
def api_trips_ai_save():
    """
    Save AI trip (POI-only or with itinerary) into DB.

    Accepts body in two shapes:
      A) { "trip": { ... } }
      B) { ... }   (trip object directly)

    - Filters out non-POI activities (hotel, check-in, meals, etc.)
    - Fills missing coordinates using Google Geocoding (GMAPS_KEY)
    - Inserts into `trips` (source='ai') and `trip_points`.
    """
    try:
        # ===== 1) Read & normalize incoming payload =====
        data = request.get_json(force=True, silent=True) or {}

        # Allow both {trip:{...}} and {...}
        t = data.get("trip") if isinstance(data.get("trip"), dict) else data
        if not isinstance(t, dict):
            return jsonify({
                "ok": False,
                "error": "invalid trip payload (not a JSON object)"
            }), 400

        # alias normalization (frontend may send note/season/duration/itinerary_text)
        def _s(v):
            return (v or "").strip()

        t_title   = _s(t.get("title") or "AI Trip")
        t_country = _s(t.get("country") or data.get("country") or "Indonesia")
        t_prov    = _s(t.get("province") or data.get("province") or t.get("region") or "")
        t_region  = _s(t.get("region") or t_prov)
        t_bseason = _s(t.get("best_season") or t.get("season"))
        t_sdur    = _s(t.get("suggested_duration") or t.get("duration"))
        t_notes   = _s(t.get("notes") or t.get("note"))
        t_itin    = _s(t.get("itinerary") or t.get("itinerary_text"))

        if not t_title or not t_country:
            return jsonify({
                "ok": False,
                "error": "invalid trip payload: missing title/country"
            }), 400

        # points[] can be empty (we will fallback to itinerary text)
        points_payload = filter_poi(t.get("points") or [])
        raw_itinerary  = t_itin

        # ===== 2) Province normalization (to your 19 macro-provinces) =====
        # fallback: use region when province is empty
        if not t_prov:
            t_prov = t_region

        norm_prov   = canonical_province(t_prov, t_region) or t_region or t_prov
        norm_region = norm_prov or t_region

        if not norm_prov:
            return jsonify({
                "ok": False,
                "error": "province required (cannot normalize)"
            }), 400

        # ===== 3) Enrich points with Google Geocoding (POI-only friendly) =====
        enriched_points = []
        if points_payload:
            # AI sends list of POI names (may or may not have lat/lng)
            enriched_points = enrich_points_with_google(
                points_payload,
                t_country,
                norm_prov,
            )
        elif raw_itinerary:
            # AI sends only itinerary text → extract POI names and geocode
            names   = parse_itinerary_names(raw_itinerary)
            derived = [{"name": n} for n in names]
            enriched_points = enrich_points_with_google(
                derived,
                t_country,
                norm_prov,
            )

        # Debug log (visible in terminal)
        print(
            "[/api/trips/ai/save] title=%r country=%r prov=%r points=%d"
            % (
                t_title,
                t_country,
                norm_prov,
                len(enriched_points) or len(points_payload) or 0,
            )
        )

        # Build final itinerary text from cleaned POIs
        if enriched_points:
            final_itinerary = ", ".join(p["name"] for p in enriched_points)
        elif points_payload:
            final_itinerary = ", ".join(p["name"] for p in points_payload)
        else:
            final_itinerary = raw_itinerary

        # ===== 4) Clamp & prepare trip record =====
        nt = {
            "title":              _clamp(t_title, 150),
            "country":            _clamp(t_country, 50),
            "province":           _clamp(norm_prov, 100),
            "region":             _clamp(norm_region, 100),
            "best_season":        _clamp(t_bseason, 50),
            "suggested_duration": _clamp(t_sdur, 20),
            "notes":              t_notes,
            "itinerary":          final_itinerary,
        }

        # ===== 5) Insert into trips (source='ai') =====
        conn = db()
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO trips
                      (title, country, province, region,
                       best_season, suggested_duration, notes, itinerary, source)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,'ai')
                    """,
                    (
                        nt["title"],
                        nt["country"],
                        nt["province"],
                        nt["region"],
                        nt["best_season"],
                        nt["suggested_duration"],
                        nt["notes"],
                        nt["itinerary"],
                    ),
                )
                new_id = cur.lastrowid
            conn.commit()

        # ===== 6) Save trip_points relations =====
        if enriched_points:
            _save_trip_points_from_array(
                new_id,
                nt["country"],
                nt["province"],
                enriched_points,
            )
        elif points_payload:
            _save_trip_points_from_array(
                new_id,
                nt["country"],
                nt["province"],
                points_payload,
            )
        elif nt["itinerary"]:
            _save_trip_points_for_itinerary(
                new_id,
                nt["country"],
                nt["province"],
                nt["itinerary"],
            )
        else:
            return jsonify({
                "ok": False,
                "error": "no points or itinerary text to save",
            }), 400

        # ===== 7) Return response used by chat.js / map.js =====
        return jsonify({
            "ok": True,
            "id": new_id,
            "trip_id": new_id,  # important for redirect in chat.js
            "item": {**nt, "id": new_id, "_unsaved": False},
        }), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"ok": False, "error": str(e)}), 500

# ==============================================================
#                   API: AUTHENTICATION (existing)
# ==============================================================

@app.post("/api/register")
def api_register():
    data = request.get_json(silent=True) or {}
    username  = (data.get("username") or "").strip()
    email     = (data.get("email") or "").strip().lower()
    password  = data.get("password") or ""
    full_name = (data.get("full_name") or "").strip()

    if not username or not email or not password or not full_name:
        return jsonify({"error": "username, email, password, full_name are required"}), 400
    if not email_re.match(email):
        return jsonify({"error": "invalid email"}), 400
    if len(username) < 3:
        return jsonify({"error": "username too short"}), 400
    if len(password) < 6:
        return jsonify({"error": "password must be at least 6 chars"}), 400

    try:
        conn = db()
        if get_user_by_email(conn, email):
            return jsonify({"error": "email already registered"}), 409
        if get_user_by_username(conn, username):
            return jsonify({"error": "username already taken"}), 409

        pw_hash = generate_password_hash(password)
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO users (username, email, password_hash, full_name) VALUES (%s,%s,%s,%s)",
                (username, email, pw_hash, full_name),
            )
            conn.commit()
            uid = cur.lastrowid

        session.clear()
        session["user_id"]  = uid
        session["username"] = username
        session["email"]    = email
        session["full_name"]= full_name

        return jsonify({"ok": True, "user": {
            "user_id": uid, "username": username,
            "email": email, "full_name": full_name
        }})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        try: conn.close()
        except: pass

@app.post("/api/login")
def api_login():
    data = request.get_json(silent=True) or {}
    identifier = (data.get("identifier") or "").strip().lower()
    password   = data.get("password") or ""
    if not identifier or not password:
        return jsonify({"error": "identifier and password are required"}), 400

    try:
        conn = db()
        user = get_user_by_email(conn, identifier) or get_user_by_username(conn, identifier)
        if not user or not check_password_hash(user["password_hash"], password):
            return jsonify({"error": "invalid credentials"}), 401

        session.clear()
        session["user_id"]  = user["user_id"]
        session["username"] = user["username"]
        session["email"]    = user["email"]
        session["full_name"]= user["full_name"]

        user_payload = {
            "user_id": user["user_id"],
            "username": user["username"],
            "email": user["email"],
            "full_name": user["full_name"],
        }
        return jsonify({"ok": True, "user": user_payload, "data": user_payload})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        try: conn.close()
        except: pass

@app.post("/api/password_reset")
def api_password_reset():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    new_password = data.get("new_password") or ""

    if not email or not new_password:
        return jsonify({"ok": False, "error": "email and new_password are required"}), 400
    if len(new_password) < 6:
        return jsonify({"ok": False, "error": "password must be at least 6 characters"}), 400

    try:
        pwd_hash = generate_password_hash(new_password)
        conn = db()
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE users
                SET password_hash=%s
                WHERE email=%s
                LIMIT 1
            """, (pwd_hash, email))
            conn.commit()
            if cur.rowcount == 0:
                return jsonify({"ok": False, "error": "email not found"}), 404

        return jsonify({"ok": True, "message": "password updated"})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500
    finally:
        try: conn.close()
        except: pass

@app.get("/api/me")
def api_me():
    if "user_id" not in session:
        return jsonify({"ok": False, "user": None})
    return jsonify({"ok": True, "user": {
        "user_id": session["user_id"],
        "username": session.get("username"),
        "email": session.get("email"),
        "full_name": session.get("full_name"),
    }})

@app.post("/api/logout")
def api_logout():
    session.clear()
    return jsonify({"ok": True})


@app.post("/api/ai/legs")
def api_ai_legs():
    """根據名稱/距離，建議每一段的交通模式（著重判斷 FERRY）。"""
    from flask import jsonify, request
    import math, re
    data  = request.get_json(silent=True) or {}
    stops = data.get("stops") or []
    legs  = []

    def hav_km(a,b):
        R=6371.0
        lat1=math.radians(float(a["lat"])); lon1=math.radians(float(a["lng"]))
        lat2=math.radians(float(b["lat"])); lon2=math.radians(float(b["lng"]))
        dlat=lat2-lat1; dlon=lon2-lon1
        s=math.sin(dlat/2)**2+math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
        return 2*R*math.asin(math.sqrt(s))

    def norm(s: str) -> str:
        s = (s or "").lower()
        s = s.replace("–","-").replace("—","-")
        s = re.sub(r"\s+", " ", s)
        return s

    # 擴充關鍵字（含你當前行程會出現的名字）
    HINTS = (
        "island","港","碼頭","harbor","harbour","port",
        "penida","nusa","gili","lombok","bali","ferry",
        "sanur","padang bai","padangbai","jemeluk","amed"
    )
    MIN_WATER_KM = 12  # >12km 幾乎必為跨海（無橋）

    for i in range(1, len(stops)):
        A, B = stops[i-1], stops[i]
        nameA, nameB = norm(A.get("name")), norm(B.get("name"))
        dist = hav_km(A, B)

        has_hint = any(k in nameA or k in nameB for k in HINTS)
        # 特判：任何含「penida」的段、或 penida↔(sanur|padang bai) 必為渡輪
        penida_pair = ("penida" in nameA or "penida" in nameB) and \
                      (("sanur" in nameA or "sanur" in nameB) or ("padang bai" in nameA or "padang bai" in nameB))

        if penida_pair or (has_hint and dist > MIN_WATER_KM):
            cruise_kmh = 35
            buffer_min = 30
            minutes = round((dist / cruise_kmh) * 60) + buffer_min
            legs.append({
                "index": i,
                "mode": "FERRY",
                "manualDistanceKm": round(dist, 1),
                "manualDurationMin": minutes,
                "cruiseKmh": cruise_kmh,
                "bufferMin": buffer_min,
                "label": "auto:ferry"
            })
        else:
            legs.append({"index": i, "mode": None})

    return jsonify({"ok": True, "legs": legs})


# ==============================================================
#                   🟣 API: CHATBOT (Ellie)
# ==============================================================



SYSTEM_PROMPT = """You are Ellie, a concise customer-service chatbot for a travel planner.
Style: short messages (<=3 sentences). English only. Countries: Indonesia, Malaysia, Thailand.
When user provides type, duration, and budget, return at most 2 trips in JSON with days split by day:
[{
  "title": "...",
  "country": "...",
  "region": "...",
  "days": [
    {"day": 1, "title": "Day 1 title", "items": ["...", "..."]},
    {"day": 2, "title": "Day 2 title", "items": ["...", "..."]},
    {"day": 3, "title": "Day 3 title", "items": ["...", "..."]}
  ],
  "note": "one-line note"
}]
No prices/booking. Reply in pure JSON only when asked to return trips."""

@app.post("/api/chat")
def api_chat():
    """
    Menerima 2 format:

    A) Guided flow Ellie (dipakai chat.js baru):
       {
         "history":[{role,content}...],
         "ctx":{ "country":"", "region":"", "prefs":"" }
       }
       → balikan:
       {
         "reply": "Here are two trips that match your criteria. Which one do you prefer?",
         "trips": [
           {
             "title": "...",
             "country": "...",
             "region": "...",
             "note": "...",
             "days": [],          # selalu kosong (tidak pakai harian)
             "points": [ {"name": "POI 1"}, ... ]
           },
           ...
         ]
       }

    B) Chat umum:
       { "message":"...", "history":[{role,content}...] }
       → balikan: { "ok": true, "reply": "..." }
    """
    data = request.get_json(silent=True) or {}

    # --------- Cabang A: format dengan ctx (generate 2 trips POI-only) ---------
    ctx = data.get("ctx")
    if isinstance(ctx, dict):
        history = data.get("history") or []
        country = (ctx.get("country") or "").strip()
        region  = (ctx.get("region")  or "").strip()
        prefs   = (ctx.get("prefs")   or "").strip()   # type + duration + budget

        ALLOWED = {"Indonesia", "Malaysia", "Thailand"}
        if country and country not in ALLOWED:
            country = ""

        want_ai_trips = bool(country and region and prefs)

        if want_ai_trips:
            user_prompt = (
                "Return EXACTLY 2 trips in PURE JSON array only (no explanations, no markdown). "
                "The entire response MUST be a single JSON array, like:\n"
                "[{\"title\":\"...\", ...}, {\"title\":\"...\", ...}]\n\n"
                "Each trip object MUST include ONLY these fields:\n"
                "  - title  (string)\n"
                "  - country (\"Indonesia\" or \"Malaysia\" or \"Thailand\")\n"
                "  - region  (macro-province / province name)\n"
                "  - note    (one short sentence)\n"
                "  - points  (array of 4-6 REAL tourist POIs ONLY),\n"
                "    where each point is an object: {\"name\": \"place name\"}\n\n"
                "Very important rules for points:\n"
                "  * Use concise, map-ready place names.\n"
                "  * DO NOT include any of these in points: hotels, hostels, resorts,\n"
                "    villas, guesthouses, restaurants, cafes, meals, breakfast, lunch,\n"
                "    dinner, shopping, transfers, airports, stations, ports, generic\n"
                "    activities like \"relax at the beach\" or \"free time\".\n"
                "  * Only put destinations (waterfalls, temples, viewpoints, beaches, etc.).\n\n"
                f"User constraints:\n"
                f"- Country: {country}\n"
                f"- Region: {region}\n"
                f"- Preferences (type, duration, budget): {prefs}\n"
                "Again: respond with JSON array only. No markdown, no comments, no text outside the array."
            )

            messages = [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ]
            content = call_openai(messages)

            # --- Parse JSON array dari output model ---
            trips = []
            try:
                text = (content or "").strip()
                # buang fences & markdown umum
                text = (
                    text.replace("```json", "")
                        .replace("```", "")
                        .replace("\r", " ")
                        .replace("\n", " ")
                        .replace("\\n", " ")
                        .strip()
                )
                # jika ada awalan "json:" dsb
                if text.lower().startswith("json"):
                    pos = text.find("[")
                    if pos != -1:
                        text = text[pos:]
                # ambil blok [ ... ]
                m = re.search(r"\[.*\]", text, re.S)
                if m:
                    text = m.group(0)
                # normalisasi kutip fancy
                text = (
                    text.replace("“", '"')
                        .replace("”", '"')
                        .replace("’", "'")
                        .strip()
                )
                trips = json.loads(text)
            except Exception as e:
                print("⚠️ Parse error /api/chat (ctx):", e, "\nRaw text:", (content or "")[:400])
                # PENTING: fallback TIDAK mengirim JSON mentah, hanya pesan pendek
                return jsonify({
                    "reply": "Sorry, I couldn't generate map-ready trips for that request. "
                             "Please try changing the region or your preferences."
                })

            # --- Sanitasi & POI-only: bersihkan points dari non-destinasi ---
            cleaned = []
            if isinstance(trips, list):
                for t in trips[:2]:
                    if not isinstance(t, dict):
                        continue

                    raw_points = t.get("points") or []
                    pois = []
                    for p in raw_points:
                        if isinstance(p, dict):
                            nm = str(p.get("name") or "").strip()
                        else:
                            nm = str(p).strip()
                        if not nm or NON_POI_RE.search(nm):
                            continue
                        pois.append({"name": nm})

                    # minimal 3 POI supaya masuk akal
                    if len(pois) < 3:
                        continue

                    cleaned.append({
                        "title":   t.get("title") or "Suggested Trip",
                        "country": t.get("country") or country or "",
                        "region":  t.get("region") or region or "",
                        "days":    [],              # <-- PAKSA kosong
                        "note":    t.get("note") or "",
                        "points":  pois,            # <-- hanya POI
                    })

            if cleaned:
                return jsonify({
                    "reply": "Here are two trips that match your criteria. Which one do you prefer?",
                    "trips": cleaned,
                })

            # Jika tidak ada trip valid → jangan kirim JSON mentah
            return jsonify({
                "reply": "I couldn't find enough destination ideas for that request. "
                         "Please try another region or different preferences."
            })

        # Kalau ctx belum lengkap → small talk biasa
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        for h in history[-10:]:
            r = h.get("role")
            c = (h.get("content") or "").strip()
            if r in ("user", "assistant") and c:
                messages.append({"role": r, "content": c})
        reply = call_openai(messages)
        return jsonify({"reply": reply})

    # --------- Cabang B: format umum {message, history} ---------
    message = (data.get("message") or "").strip()
    history = data.get("history") or []

    msgs = [{"role": "system", "content": SYSTEM_PROMPT}]
    for h in history[-10:]:
        r = h.get("role")
        c = (h.get("content") or "").strip()
        if r in ("user", "assistant") and c:
            msgs.append({"role": r, "content": c})
    if message:
        msgs.append({"role": "user", "content": message})

    reply = call_openai(msgs)
    return jsonify({"ok": True, "reply": reply})
# ===== Helpers for user identity =====
from flask import session, request, jsonify
import json

def current_user_id():
    """回傳登入者的 user_id；未登入回 None。"""
    return session.get("user_id")

def _uid_token():
    """匿名/未登入用的客製識別（來自前端 localStorage → X-UID / cookie uid）"""
    return (request.headers.get("X-UID") or request.cookies.get("uid") or "").strip() or None

def _request_uid():
    """
    統一取得請求端的 UID：
    優先讀 Header: X-UID -> Cookie: uid -> 最後退回 _uid_token()
    """
    uid = request.headers.get("X-UID")
    if uid:
        return uid
    uid = request.cookies.get("uid")
    if uid:
        return uid
    try:
        return _uid_token()
    except Exception:
        return None



# ==============================================================
#                       RUN SERVER
# ==============================================================

if __name__ == "__main__":
    app.run(debug=True, port=5000)
