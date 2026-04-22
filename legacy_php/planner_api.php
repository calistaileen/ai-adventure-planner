<?php

function current_user_token() {
  if (!empty($_SERVER['HTTP_X_UID'])) return $_SERVER['HTTP_X_UID'];
  if (!empty($_GET['uid'])) return $_GET['uid'];
  if (!empty($_COOKIE['uid'])) return $_COOKIE['uid'];
  return null;
}

// api.php — Travel Planner backend (table: trips + trip_points + points)

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *'); // 前後端不同 port/domain 需要 CORS
header('Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-UID');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') 
  { http_response_code(204); exit; }

//若沒帶 path，回簡單的說明
if (!isset($_GET['path']) && empty($_SERVER['PATH_INFO'])) {
  send_json(['ok' => true, 'routes' => ['trips','trips/{id}','user_trips','user_trips/{id}','ai/legs']]);
}


// === DB 連線（依你的 XAMPP/MAMP 設定修改） ===
$DB_HOST = getenv('DB_HOST') ?: '127.0.0.1';
$DB_USER = getenv('DB_USER') ?: 'root';
$DB_PASS = getenv('DB_PASS') ?: '';              // XAMPP/MAMP 常見是空字串
$DB_NAME = getenv('DB_NAME') ?: 'travel_planner';
$DB_PORT = getenv('DB_PORT') ?: '3306';

try {
  $pdo = new PDO(
    "mysql:host=$DB_HOST;port=$DB_PORT;dbname=$DB_NAME;charset=utf8mb4",
    $DB_USER, $DB_PASS,
    [
      PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]
  );
} catch (PDOException $e) {
  http_response_code(500);
  echo json_encode(['error' => 'DB connect failed', 'detail' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
  exit;
}

// 解析路徑：支援兩種寫法：
// 1) /planner_api.php?path=user_trips/123
// 2) /planner_api.php/user_trips/123  （PHP 內建伺服器會放在 PATH_INFO）
$path = $_GET['path'] ?? '';
if ($path === '' && !empty($_SERVER['PATH_INFO'])) {
  $path = ltrim($_SERVER['PATH_INFO'], '/');
}
$parts = explode('/', trim($path, '/'));

function send_json($data, $code = 200){
  http_response_code($code);
  echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

// ===== /trips（列表） =====
if (!empty($parts[0]) && $parts[0] === 'trips' && count($parts) === 1) {
  $stmt = $pdo->query("SELECT id, title FROM trips ORDER BY id");
  $rows = $stmt->fetchAll();
  send_json(['items' => array_map(fn($r) => [
    'id'    => (int)$r['id'],
    'title' => $r['title'],
  ], $rows)]);
}

// GET /trips/{id} 取得行程與點位（依 seq 排序）
if (count($parts) === 2 && $parts[0] === 'trips') {
  $tripId = (int)$parts[1];

  // 1) 取行程
  $stmt = $pdo->prepare('SELECT id, title FROM trips WHERE id = ?');
  $stmt->execute([$tripId]);
  $trip = $stmt->fetch();
  if (!$trip) send_json(['error' => 'Trip not found'], 404);

  // 2) 取行程的點位（join trip_points → points，依 seq）
  $sql = "SELECT p.name, p.lat, p.lng
          FROM trip_points tp
          JOIN points p ON p.id = tp.point_id
          WHERE tp.trip_id = ?
          ORDER BY tp.seq";
  $stmt = $pdo->prepare($sql);
  $stmt->execute([$tripId]);
  $rows = $stmt->fetchAll();

  $points = array_map(fn($r) => [
    'name' => $r['name'],
    'lat'  => (float)$r['lat'],
    'lng'  => (float)$r['lng'],
  ], $rows);

  send_json([
    'id'     => (int)$trip['id'],
    'title'  => $trip['title'],
    'points' => $points,
  ]);
}

// === POST /trips ===
if ($_SERVER['REQUEST_METHOD'] === 'POST' && preg_match('#^trips$#', $path)) {
    $input = json_decode(file_get_contents('php://input'), true);
    $title = $input['title'] ?? '未命名行程';
    $country = $input['country'] ?? 'Unknown';
    $region = $input['region'] ?? '';
    $notes = $input['notes'] ?? '';
    $itinerary = implode(',', array_map(fn($p)=>$p['name'], $input['points'] ?? []));

    $stmt = $pdo->prepare("INSERT INTO trips (title, country, region, notes, itinerary, source, curation_status) VALUES (?,?,?,?,?,'manual','published')");
    $stmt->execute([$title, $country, $region, $notes, $itinerary]);
    $tripId = $pdo->lastInsertId();

    // 同步儲存 trip_points
    $points = $input['points'] ?? [];
    $seq = 1;
    foreach ($points as $p) {
        $pid = null;
        // 若資料庫已有此點，則查找 id
        if (isset($p['lat'], $p['lng'])) {
            $stmt2 = $pdo->prepare("SELECT id FROM points WHERE ABS(lat-?)<0.0001 AND ABS(lng-?)<0.0001 LIMIT 1");
            $stmt2->execute([$p['lat'], $p['lng']]);
            $pid = $stmt2->fetchColumn();
        }
        // 若沒有則新建
        if (!$pid) {
            $stmt3 = $pdo->prepare("INSERT INTO points (name, country, region, city, lat, lng) VALUES (?,?,?,?,?,?)");
            $stmt3->execute([$p['name'] ?? '未命名', $country, $region, '', $p['lat'], $p['lng']]);
            $pid = $pdo->lastInsertId();
        }
        $stmt4 = $pdo->prepare("INSERT INTO trip_points (trip_id, point_id, seq) VALUES (?,?,?)");
        $stmt4->execute([$tripId, $pid, $seq++]);
    }

    echo json_encode(['success'=>true, 'trip_id'=>$tripId]);
    exit;
}

//建立顧客行程
if ($_SERVER['REQUEST_METHOD']==='POST' && preg_match('#^user_trips$#', $path)) {
  $token = current_user_token();
  if (!$token) send_json(['error'=>'missing user_token'], 400);

  $body = json_decode(file_get_contents('php://input'), true) ?: [];
  $title = trim($body['title'] ?? '未命名行程');
  $notes = $body['notes'] ?? null;
  $base  = isset($body['base_trip_id']) ? (int)$body['base_trip_id'] : null;
  $pts   = is_array($body['points'] ?? null) ? $body['points'] : [];
  if (!$pts) send_json(['error'=>'points required'], 400);

  $pdo->prepare("INSERT INTO user_trips (user_id,user_token,title,notes,base_trip_id) VALUES (NULL,?,?,?,?)")
      ->execute([$token,$title,$notes,$base]);
  $id = (int)$pdo->lastInsertId();

  $seq = 1;
  $stmt = $pdo->prepare("INSERT INTO user_trip_points (user_trip_id,seq,name,lat,lng,place_id,meta_json)
                         VALUES (?,?,?,?,?,?,?)");
  foreach ($pts as $p) {
    $name  = trim($p['name'] ?? '未命名');
    $lat   = (float)($p['lat'] ?? 0);
    $lng   = (float)($p['lng'] ?? 0);
    $place = $p['placeId'] ?? null;

    $pp = $p;
    if (!isset($pp['seq'])) $pp['seq'] = $seq;
    if (!isset($pp['day'])) $pp['day'] = $pp['day'] ?? 1;
    $meta = build_meta_json_from_point($pp);

    $stmt->execute([$id, $seq++, $name, $lat, $lng, $place, $meta]);
  }
  send_json(['success'=>true, 'user_trip_id'=>$id], 201);
}

//列出自己的行程
if ($_SERVER['REQUEST_METHOD']==='GET' && preg_match('#^user_trips$#', $path)) {
  $token = current_user_token();
  if (!$token) send_json(['items'=>[]]);
  $q = $pdo->prepare("SELECT id,title,created_at,updated_at FROM user_trips WHERE user_token=? ORDER BY updated_at DESC");
  $q->execute([$token]);
  send_json(['items'=>$q->fetchAll(PDO::FETCH_ASSOC)]);
}

//讀取單一行程
if ($_SERVER['REQUEST_METHOD']==='GET' && preg_match('#^user_trips/(\d+)$#', $path,$m)) {
  $id = (int)$m[1];
  $q = $pdo->prepare("SELECT id,user_token,title,notes,base_trip_id FROM user_trips WHERE id=?");
  $q->execute([$id]);
  $trip = $q->fetch(PDO::FETCH_ASSOC);
  if (!$trip) send_json(['error'=>'not found'],404);

  $token = current_user_token();
  if ($token && $trip['user_token'] !== $token) send_json(['error'=>'forbidden'],403);

  $p = $pdo->prepare("SELECT seq,name,lat,lng,place_id,meta_json FROM user_trip_points WHERE user_trip_id=? ORDER BY seq");
  $p->execute([$id]);

  $points = $p->fetchAll(PDO::FETCH_ASSOC); // 注意：是 PDO::FETCH_ASSOC，中間是底線

  // 先把資料放到變數（用 array()，避免隱藏字元/短陣列解析問題）
  $response = array(
    'trip'   => $trip,
    'points' => $points
  );

  send_json($response);
}

// === POST /ai/legs ：根據 stops 推薦每段交通模式 ===
if ($_SERVER['REQUEST_METHOD']==='POST' && preg_match('#^ai/legs$#', $path)) {
  $body = json_decode(file_get_contents('php://input'), true) ?: [];
  $stops = $body['stops'] ?? [];
  $prefs = $body['prefs'] ?? [];
  $day   = $body['day'] ?? 1;

  // --- 1) 建立系統/使用者提示與 JSON Schema（你之後可接真實 LLM） ---
  $schema = [
    'type'=>'object',
    'properties'=>[
      'legs'=>[
        'type'=>'array',
        'items'=>[
          'type'=>'object',
          'properties'=>[
            'mode'=>['type'=>'string'], // DRIVING/WALKING/BICYCLING/TRANSIT/FLIGHT/TRAIN/BUS/FERRY/MANUAL
            'departAt'=>['type'=>['string','null']], // ISO 8601
            'manualDistanceKm'=>['type'=>['number','null']],
            'manualDurationMin'=>['type'=>['number','null']],
            'bufferMin'=>['type'=>['number','null']],
            'cruiseKmh'=>['type'=>['number','null']],
            'notes'=>['type'=>['string','null']]
          ],
          'required'=>['mode']
        ]
      ]
    ],
    'required'=>['legs']
  ];

  // --- 2) 這裡你可呼叫真實 LLM。現階段先用簡單 heuristic 產生假結果讓前端串起來 ---
  $legs = [];
  for ($i=1; $i<count($stops); $i++){
    $A = $stops[$i-1]; $B = $stops[$i];
    $dKm = 2 * 6371 * asin(sqrt(
      pow(sin(deg2rad(($B['lat']-$A['lat'])/2)),2) +
      cos(deg2rad($A['lat'])) * cos(deg2rad($B['lat'])) *
      pow(sin(deg2rad(($B['lng']-$A['lng'])/2)),2)
    ));
    // 極簡規則：<1km 走路、<5km 單車、<200km 開車、>=200km 飛機（僅示範）
    if ($dKm < 1) {
      $legs[] = ['mode'=>'WALKING','notes'=>"距離約 ".round($dKm,1)."km，建議步行"];
    } else if ($dKm < 5) {
      $legs[] = ['mode'=>'BICYCLING','notes'=>"距離約 ".round($dKm,1)."km，建議單車"];
    } else if ($dKm < 200) {
      $legs[] = ['mode'=>'DRIVING','notes'=>"距離約 ".round($dKm,0)."km，建議開車/計程車"];
    } else {
      $legs[] = ['mode'=>'FLIGHT','notes'=>"距離約 ".round($dKm,0)."km，建議飛機（直線估算）"];
    }
  }

  // 回傳符合 schema 的物件
  send_json(['legs'=>$legs]);
}

//覆寫更新
if ($_SERVER['REQUEST_METHOD']==='PUT' && preg_match('#^user_trips/(\d+)$#',$path,$m)) {
  $id = (int)$m[1];
  $token = current_user_token();
  if (!$token) send_json(['error'=>'missing user_token'],400);

  $q=$pdo->prepare("SELECT user_token FROM user_trips WHERE id=?");
  $q->execute([$id]);
  $owner=$q->fetchColumn();
  if(!$owner) send_json(['error'=>'not found'],404);
  if($owner!==$token) send_json(['error'=>'forbidden'],403);

  $body = json_decode(file_get_contents('php://input'), true) ?: [];
  if (isset($body['title'])) $pdo->prepare("UPDATE user_trips SET title=?,updated_at=NOW() WHERE id=?")->execute([trim($body['title']),$id]);
  if (array_key_exists('notes',$body)) $pdo->prepare("UPDATE user_trips SET notes=?,updated_at=NOW() WHERE id=?")->execute([$body['notes'],$id]);

  if (isset($body['points']) && is_array($body['points'])) {
    $pdo->prepare("DELETE FROM user_trip_points WHERE user_trip_id=?")->execute([$id]);
    $stmt=$pdo->prepare("INSERT INTO user_trip_points (user_trip_id,seq,name,lat,lng,place_id,meta_json) VALUES (?,?,?,?,?,?,?)");
    $seq=1;
    foreach ($body['points'] as $p) {
      $name  = trim($p['name'] ?? '未命名');
      $lat   = (float)($p['lat'] ?? 0);
      $lng   = (float)($p['lng'] ?? 0);
      $place = $p['placeId'] ?? null;

      // ✅ 先補 seq/day 再組 meta_json（與 POST 同步）
      $pp = $p;
      if (!isset($pp['seq'])) $pp['seq'] = $seq;
      if (!isset($pp['day'])) $pp['day'] = $pp['day'] ?? 1;
      $meta = build_meta_json_from_point($pp);

      $stmt->execute([$id,$seq++,$name,$lat,$lng,$place,$meta]);
    }
  }
  send_json(['success'=>true,'user_trip_id'=>$id]);
}

// 其他路徑
send_json(['error' => 'Not found'], 404);


// 將前端的點資料組成 meta_json（合併：既有欄位 + leg + stayMin + day + seq + 客戶端 meta_json）
function build_meta_json_from_point($p){
  // 你原本就存的欄位
  $meta = [
    'rating'           => $p['rating']           ?? null,
    'userRatingsTotal' => $p['userRatingsTotal'] ?? null,
    'photoUrl'         => $p['photoUrl']         ?? null,
    'badges'           => $p['badges']           ?? [],
  ];

  // 交通與停留資訊
  if (array_key_exists('leg', $p))     $meta['leg']     = $p['leg'];
  if (array_key_exists('stayMin', $p)) $meta['stayMin'] = $p['stayMin'];

  // ✅ 加上分日與順序（讓前端回讀能還原）
  if (isset($p['day'])) $meta['day'] = (int)$p['day'];
  if (isset($p['seq'])) $meta['seq'] = (int)$p['seq'];

  // 若前端已經有組好的 meta_json（字串或陣列），就跟上面合併（前端優先）
  if (isset($p['meta_json'])) {
    $fromClient = null;
    if (is_string($p['meta_json'])) {
      $tmp = json_decode($p['meta_json'], true);
      if (is_array($tmp)) $fromClient = $tmp;
    } elseif (is_array($p['meta_json'])) {
      $fromClient = $p['meta_json'];
    }
    if (is_array($fromClient)) {
      // 用客戶端的值覆蓋（例如客戶端自己帶的 day/seq/leg/stayMin）
      $meta = array_replace($meta, $fromClient);
    }
  }

  return json_encode($meta, JSON_UNESCAPED_UNICODE);
}

