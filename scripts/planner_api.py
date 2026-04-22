# -*- coding: utf-8 -*-
import os, json, math
from datetime import datetime
from flask import (
    Flask, request, make_response, jsonify,
    render_template
)
import pymysql

# === Resolve project root from this file (scripts/planner_api.py) ===
SCRIPT_DIR    = os.path.abspath(os.path.dirname(__file__))        # .../Project8/scripts
PROJECT_ROOT  = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))   # .../Project8
TEMPLATES_DIR = os.path.join(PROJECT_ROOT, "templates")           # .../Project8/templates
STATIC_DIR    = os.path.join(PROJECT_ROOT, "static")              # .../Project8/static

app = Flask(
    __name__,
    template_folder=TEMPLATES_DIR,   # /templates (e.g. map.html)
    static_folder=STATIC_DIR,        # /static   (css/js)
    static_url_path="/static"
)

# ===== CORS (match PHP behavior, but DO NOT force JSON for non-API) =====
ALLOWED_HEADERS = "Content-Type, Authorization, X-UID"

@app.after_request
def add_cors_headers(resp):
    resp.headers["Access-Control-Allow-Origin"]  = "*"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = ALLOWED_HEADERS
    # Only set JSON content-type for API paths. Let HTML/CSS/JS keep defaults.
    if request.path.startswith(("/planner/", "/planner_api.", "/api.py")):
        resp.headers["Content-Type"] = "application/json; charset=utf-8"
    return resp

# ====== FRONTEND PAGES ======
@app.route("/")
def home():
    return render_template("map.html")

@app.route("/map")
def map_page():
    return render_template("map.html")

# (Optional) quick path debugger
@app.route("/_debug/paths")
def _debug_paths():
    return {
        "SCRIPT_DIR": SCRIPT_DIR,
        "PROJECT_ROOT": PROJECT_ROOT,
        "TEMPLATES_DIR": TEMPLATES_DIR,
        "STATIC_DIR": STATIC_DIR,
    }

# ---------- Shared dispatcher so both API URL styles work ----------
def _dispatch_by_path(path: str):
    path = (path or "").strip().strip("/")
    if not path:
        return json_ok({"ok": True, "routes": ["trips", "trips/{id}", "user_trips", "user_trips/{id}", "ai/legs"]})

    try:
        if path == "trips" and request.method == "GET":
            return list_trips()

        if path.startswith("trips/") and request.method == "GET":
            trip_id = int(path.split("/", 1)[1])
            return get_trip(trip_id)

        if path == "trips" and request.method == "POST":
            return create_trip()

        if path == "user_trips" and request.method == "POST":
            return create_user_trip()

        if path == "user_trips" and request.method == "GET":
            return list_user_trips()

        if path.startswith("user_trips/") and request.method == "GET":
            ut_id = int(path.split("/", 1)[1])
            return get_user_trip(ut_id)

        if path.startswith("user_trips/") and request.method == "PUT":
            ut_id = int(path.split("/", 1)[1])
            return update_user_trip(ut_id)

        if path == "ai/legs" and request.method == "POST":
            return ai_legs()

        return json_err("Not found", 404)
    except ValueError:
        return json_err("Bad request", 400)
    except Exception as e:
        return json_err(f"Server error: {str(e)}", 500)

# ---------- Query-style endpoints (…?path=trips) ----------
@app.route("/planner/planner_api.py", methods=["GET", "POST", "PUT", "OPTIONS"])
@app.route("/planner/planner_api.php", methods=["GET", "POST", "PUT", "OPTIONS"])  # backward-compatible
@app.route("/api.py", methods=["GET", "POST", "PUT", "OPTIONS"])                   # optional
def api_entry():
    if request.method == "OPTIONS":
        return ("", 204)
    path = (request.args.get("path") or "").strip().strip("/")
    return _dispatch_by_path(path)

# ---------- Slash-style endpoints (/planner/planner_api.php/trips) ----------
@app.route("/planner/planner_api.py/<path:subpath>", methods=["GET", "POST", "PUT", "OPTIONS"])
@app.route("/planner/planner_api.php/<path:subpath>", methods=["GET", "POST", "PUT", "OPTIONS"])
def api_entry_slash(subpath):
    if request.method == "OPTIONS":
        return ("", 204)
    return _dispatch_by_path(subpath)

# ---------- Root-level query-style endpoints (/planner_api.php?path=...) ----------
@app.route("/planner_api.php", methods=["GET","POST","PUT","OPTIONS"])
@app.route("/planner_api.py",  methods=["GET","POST","PUT","OPTIONS"])
def api_entry_root():
    if request.method == "OPTIONS":
        return ("", 204)
    path = (request.args.get("path") or "").strip().strip("/")
    return _dispatch_by_path(path)

# ---------- Root-level slash-style endpoints (/planner_api.php/trips) ----------
@app.route("/planner_api.php/<path:subpath>", methods=["GET","POST","PUT","OPTIONS"])
@app.route("/planner_api.py/<path:subpath>",  methods=["GET","POST","PUT","OPTIONS"])
def api_entry_root_slash(subpath):
    if request.method == "OPTIONS":
        return ("", 204)
    return _dispatch_by_path(subpath)


# ====== DB connection ======
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

# ====== Auth token (X-UID / uid) ======
def current_user_token():
    token = request.headers.get("X-UID") or request.args.get("uid") or request.cookies.get("uid")
    return token

# ====== Helpers ======
def json_ok(data, code=200):
    return make_response(json.dumps(data, ensure_ascii=False, default=str), code)

def json_err(msg, code=400):
    return json_ok({"error": msg}, code)

def row_map_point(r):
    return {"name": r.get("name"), "lat": float(r.get("lat")), "lng": float(r.get("lng"))}

def build_meta_json_from_point(p: dict) -> str:
    meta = {
        "rating":           p.get("rating"),
        "userRatingsTotal": p.get("userRatingsTotal"),
        "photoUrl":         p.get("photoUrl"),
        "badges":           p.get("badges", []),
    }
    if "leg" in p:     meta["leg"] = p["leg"]
    if "stayMin" in p: meta["stayMin"] = p["stayMin"]

    # ✅ 補上分日與順序（很重要）
    if "day" in p: meta["day"] = int(p["day"])
    if "seq" in p: meta["seq"] = int(p["seq"])


    # 與客戶端傳來的 meta_json 合併（保留客製欄位）
    if "meta_json" in p:
        client = None
        mj = p["meta_json"]
        if isinstance(mj, str):
            try: client = json.loads(mj)
            except Exception: client = None
        elif isinstance(mj, dict):
            client = mj
        if isinstance(client, dict):
            meta.update(client)

    return json.dumps(meta, ensure_ascii=False)


def haversine_km(a, b):
    to_rad = lambda x: (x * math.pi / 180.0)
    R = 6371.0
    dlat = to_rad(b["lat"] - a["lat"])
    dlng = to_rad(b["lng"] - a["lng"])
    la1, la2 = to_rad(a["lat"]), to_rad(b["lat"])
    h = math.sin(dlat/2)**2 + math.cos(la1)*math.cos(la2)*math.sin(dlng/2)**2
    return 2 * R * math.asin(math.sqrt(h))

def guess_cruise_kmh(mode):
    return 120 if mode == "TRAIN" else 60 if mode == "BUS" else 35 if mode == "FERRY" else 800

def guess_buffer_min(mode):
    return 90 if mode == "FLIGHT" else 20 if mode == "TRAIN" else 10

# ===== trips =====
def list_trips():
    with get_db() as conn, conn.cursor() as cur:
        cur.execute("SELECT id, title FROM trips ORDER BY id")
        rows = cur.fetchall()
        items = [{"id": int(r["id"]), "title": r["title"]} for r in rows]
    return json_ok({"items": items})

def get_trip(trip_id: int):
    with get_db() as conn, conn.cursor() as cur:
        cur.execute("SELECT id, title FROM trips WHERE id=%s", (trip_id,))
        trip = cur.fetchone()
        if not trip:
            return json_err("Trip not found", 404)

        sql = """
        SELECT p.name, p.lat, p.lng
        FROM trip_points tp
        JOIN points p ON p.id = tp.point_id
        WHERE tp.trip_id = %s
        ORDER BY tp.seq
        """
        cur.execute(sql, (trip_id,))
        rows = cur.fetchall()
        points = [row_map_point(r) for r in rows]

    return json_ok({"id": int(trip["id"]), "title": trip["title"], "points": points})

def create_trip():
    body = request.get_json(silent=True) or {}
    title   = body.get("title", "Untitled Trip")
    country = body.get("country", "Unknown")
    region  = body.get("region", "")
    notes   = body.get("notes", "")
    pts     = body.get("points", []) or []
    itinerary = ",".join([str(p.get("name") or "") for p in pts])

    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            "INSERT INTO trips (title, country, region, notes, itinerary, source, curation_status) VALUES (%s,%s,%s,%s,%s,'manual','published')",
            (title, country, region, notes, itinerary)
        )
        trip_id = cur.lastrowid

        seq = 1
        for p in pts:
            pid = None
            if ("lat" in p) and ("lng" in p):
                cur.execute(
                    "SELECT id FROM points WHERE ABS(lat-%s)<0.0001 AND ABS(lng-%s)<0.0001 LIMIT 1",
                    (p["lat"], p["lng"])
                )
                row = cur.fetchone()
                pid = row["id"] if row else None

            if not pid:
                cur.execute(
                    "INSERT INTO points (name, country, region, city, lat, lng) VALUES (%s,%s,%s,%s,%s,%s)",
                    (p.get("name") or "Untitled", country, region, "", p.get("lat"), p.get("lng"))
                )
                pid = cur.lastrowid

            cur.execute(
                "INSERT INTO trip_points (trip_id, point_id, seq) VALUES (%s,%s,%s)",
                (trip_id, pid, seq)
            )
            seq += 1

    return json_ok({"success": True, "trip_id": int(trip_id)})

# ===== user_trips =====
def create_user_trip():
    token = current_user_token()
    if not token:
        return json_err("missing user_token", 400)

    body  = request.get_json(silent=True) or {}
    title = (body.get("title") or "Untitled Trip").strip()
    notes = body.get("notes")
    base  = int(body.get("base_trip_id")) if body.get("base_trip_id") is not None else None
    pts   = body.get("points") or []
    if not pts:
        return json_err("points required", 400)

    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            "INSERT INTO user_trips (user_id, user_token, title, notes, base_trip_id) VALUES (NULL,%s,%s,%s,%s)",
            (token, title, notes, base)
        )
        uid = int(cur.lastrowid)

        sql = """INSERT INTO user_trip_points (user_trip_id, seq, name, lat, lng, place_id, meta_json)
                 VALUES (%s,%s,%s,%s,%s,%s,%s)"""
        seq = 1
        for p in pts:
            name  = (p.get("name") or "Untitled").strip()
            lat   = float(p.get("lat") or 0)
            lng   = float(p.get("lng") or 0)
            place = p.get("placeId")
            meta  = build_meta_json_from_point(p)
            cur.execute(sql, (uid, seq, name, lat, lng, place, meta))
            seq += 1

    return json_ok({"success": True, "user_trip_id": uid}, 201)

def list_user_trips():
    token = current_user_token()
    if not token:
        return json_ok({"items": []})
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT id,title,created_at,updated_at FROM user_trips WHERE user_token=%s ORDER BY updated_at DESC",
            (token,)
        )
        items = cur.fetchall()
    return json_ok({"items": items})

def get_user_trip(ut_id: int):
    with get_db() as conn, conn.cursor() as cur:
        cur.execute("SELECT id,user_token,title,notes,base_trip_id FROM user_trips WHERE id=%s", (ut_id,))
        trip = cur.fetchone()
        if not trip:
            return json_err("not found", 404)

        token = current_user_token()
        if token and trip["user_token"] != token:
            return json_err("forbidden", 403)

        cur.execute(
            "SELECT seq,name,lat,lng,place_id,meta_json FROM user_trip_points WHERE user_trip_id=%s ORDER BY seq",
            (ut_id,)
        )
        points = cur.fetchall()

    return json_ok({"trip": trip, "points": points})

def update_user_trip(ut_id: int):
    token = current_user_token()
    if not token:
        return json_err("missing user_token", 400)

    body = request.get_json(silent=True) or {}

    with get_db() as conn, conn.cursor() as cur:
        cur.execute("SELECT user_token FROM user_trips WHERE id=%s", (ut_id,))
        row = cur.fetchone()
        if not row:
            return json_err("not found", 404)
        if row["user_token"] != token:
            return json_err("forbidden", 403)

        if "title" in body:
            cur.execute("UPDATE user_trips SET title=%s, updated_at=NOW() WHERE id=%s", (body["title"].strip(), ut_id))
        if "notes" in body:
            cur.execute("UPDATE user_trips SET notes=%s, updated_at=NOW() WHERE id=%s", (body["notes"], ut_id))

        if isinstance(body.get("points"), list):
            cur.execute("DELETE FROM user_trip_points WHERE user_trip_id=%s", (ut_id,))
            sql = """INSERT INTO user_trip_points (user_trip_id, seq, name, lat, lng, place_id, meta_json)
                     VALUES (%s,%s,%s,%s,%s,%s,%s)"""
            seq = 1
            for p in body["points"]:
                name  = (p.get("name") or "Untitled").strip()
                lat   = float(p.get("lat") or 0)
                lng   = float(p.get("lng") or 0)
                place = p.get("placeId")
                meta  = build_meta_json_from_point(p)
                cur.execute(sql, (ut_id, seq, name, lat, lng, place, meta))
                seq += 1

    return json_ok({"success": True, "user_trip_id": ut_id})

# ===== AI/legs (heuristic identical to the PHP version) =====
def ai_legs():
    body  = request.get_json(silent=True) or {}
    stops = body.get("stops") or []
    legs = []
    for i in range(1, len(stops)):
        A, B = stops[i-1], stops[i]
        dkm = haversine_km({"lat": A["lat"], "lng": A["lng"]},
                           {"lat": B["lat"], "lng": B["lng"]})
        if dkm < 1:
            legs.append({"mode": "WALKING", "notes": f"Distance ~ {round(dkm,1)} km — walking recommended"})
        elif dkm < 5:
            legs.append({"mode": "BICYCLING", "notes": f"Distance ~ {round(dkm,1)} km — bicycling recommended"})
        elif dkm < 200:
            legs.append({"mode": "DRIVING", "notes": f"Distance ~ {round(dkm,0)} km — car/taxi recommended"})
        else:
            legs.append({"mode": "FLIGHT", "notes": f"Distance ~ {round(dkm,0)} km — flight recommended (great-circle estimate)"})
    return json_ok({"legs": legs})

# ===== Main (development) =====
if __name__ == "__main__":
    # Run from project root or anywhere:
    #   python scripts\planner_api.py
    port = int(os.getenv("PORT", "8000"))
    app.run(host="127.0.0.1", port=port, debug=True)
