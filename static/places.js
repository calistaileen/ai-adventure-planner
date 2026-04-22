// places.js — 2 from DB (random by PROVINCE) + 1/2 from AI (save on click)

document.addEventListener("DOMContentLoaded", () => {
  // ===== small utils =====
  const setText = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  const qs = new URLSearchParams(location.search);

  // ===== query params =====
  const country  = (qs.get("country")  || "Indonesia").trim();
  const province = (qs.get("province") || "").trim();
  const region   = (qs.get("region")   || "").trim(); // fallback visual
  const limitDB  = 2;

  // ===== dynamic background by province / region =====
  (function setDynamicBackground() {
    // pakai province dulu, kalau kosong pakai region
    const bgKey = province || region;
    if (!bgKey) return;

    // file kamu: /static/images/Provinces/<Nama>.png
    // contoh: /static/images/Provinces/Bali.png
    const fileUrl = `/static/images/Provinces/${encodeURIComponent(bgKey)}.png`;

    document.body.style.background =
      `url('${fileUrl}') center top / cover fixed no-repeat`;
  })();

  // ===== header text =====
  const heading = province ? `${province} — Trips` : (region ? `${region} — Trips` : "Trips");
  setText("title", heading);
  setText("subtitle", province
    ? `Top spots and hidden gems in ${province}.`
    : (region ? `Top spots and hidden gems in ${region}.` : "")
  );

  // ===== nav links (optional) =====
  const backLink    = document.getElementById("backLink");
  const plannerLink = document.getElementById("plannerLink");
  if (backLink)    backLink.href    = `country.html?country=${encodeURIComponent(country)}`;
  if (plannerLink) plannerLink.href = `planner.html?country=${encodeURIComponent(country)}&province=${encodeURIComponent(province)}`;

  // ===== containers =====
  const grid   = document.getElementById("tripGrid");
  const status = document.getElementById("tripStatus");
  if (grid && !grid.classList.contains("dest-grid")) grid.classList.add("dest-grid");

  if (!country) { if (status) status.textContent = "Please choose a country first."; return; }
  if (!province && !region) { if (status) status.textContent = "Please provide a province (preferred) or region."; return; }

  // ===== card renderer =====
  function tripCard(t, opts = {}) {
    const isAI   = !!opts.ai || !!t._unsaved;
    const title  = t.title || "Untitled Trip";
    const dur    = t.suggested_duration ? String(t.suggested_duration).trim() : "";
    const season = t.best_season ? String(t.best_season).trim() : "";
    const stops  = (t.itinerary || "").toString().split(",").map(s => s.trim()).filter(Boolean).slice(0, 6).join(", ");
    const badge  = isAI ? "AI suggestion" : (opts.badge || "");

    const wrap = document.createElement("div");
    wrap.className = "dest-card";

    const h = document.createElement("strong");
    h.textContent = title;
    wrap.appendChild(h);

    if (badge) {
      const b = document.createElement("span");
      b.className = "small";
      b.style.display = "inline-block";
      b.style.margin = "4px 0 6px";
      b.style.opacity = "0.8";
      b.textContent = badge;
      wrap.appendChild(b);
    }

    if (dur)    { const r = document.createElement("div"); r.className = "small"; r.textContent = `Duration: ${dur}`;  wrap.appendChild(r); }
    if (season) { const r = document.createElement("div"); r.className = "small"; r.textContent = `Best season: ${season}`; wrap.appendChild(r); }
    if (stops)  { const r = document.createElement("div"); r.className = "small"; r.textContent = `Stops: ${stops}`; wrap.appendChild(r); }

    const btn = document.createElement("a");
    btn.className = "saved-view-btn";
    btn.textContent = "View on Map";

    if (isAI) {
      // AI trip — save to DB on click, then go to map
      btn.href = "#";
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        btn.textContent = "Saving…";
        btn.setAttribute("aria-busy", "true");
        try {
          const res = await fetch("/api/trips/ai/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ trip: t, province: t.province || province })
          });
          const data = await res.json();
          if (!res.ok || !data.ok) throw new Error(data.error || "Save failed");
          const id = data.id || (data.item && data.item.id);
          if (!id) throw new Error("Invalid insert id");
          location.href = `/map?trip=${encodeURIComponent(id)}`; // keep your current map URL style
        } catch (err) {
          alert("Save failed: " + err.message);
          btn.textContent = "View on Map";
          btn.removeAttribute("aria-busy");
        }
      });
    } else {
      // DB trip — direct link
      btn.href = `/map?trip=${encodeURIComponent(t.id)}`;
    }

    wrap.appendChild(btn);
    return wrap;
  }

  // ===== API helpers =====
  const API_BASE = "/api";

  function dbUrl() {
    const p = new URLSearchParams();
    p.set("country", country);
    if (province) p.set("province", province); else if (region) p.set("region", region);
    p.set("limit", String(limitDB));
    p.set("rand", "1");
    return `${API_BASE}/trips?${p.toString()}`;
  }

  async function getDbTrips() {
    const r = await fetch(dbUrl(), { cache: "no-store" });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    const data = await r.json();
    return Array.isArray(data.items) ? data.items.slice(0, 2) : [];
  }

  async function getAiTrips(need = 1) {
    const res = await fetch(`${API_BASE}/trips/ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country, province, n: need })
    });
    const j = await res.json().catch(() => ({}));
    console.log("AI trips response:", res.status, j);
    if (!res.ok || !j.ok) throw new Error(j.error || `AI HTTP ${res.status}`);
    const items = Array.isArray(j.items) ? j.items : (Array.isArray(j.trips) ? j.trips : []);
    return items.slice(0, need).map(it => ({ ...it, _unsaved: true, province: it.province || province }));
  }

  // ===== main loader =====
  (async () => {
    try {
      if (grid) grid.innerHTML = "";
      if (status) status.textContent = "Loading trips…";

      // 0–2 from DB
      const dbTrips = await getDbTrips();
      if (grid) dbTrips.forEach(t => grid.appendChild(tripCard(t)));

      // decide how many AI we need
      const needAi = (dbTrips.length >= 2) ? 1 : 2;
      if (status) status.textContent = `Loaded ${dbTrips.length} from DB. Generating ${needAi} AI…`;

      // fetch AI trips
      let aiTrips = [];
      try { aiTrips = await getAiTrips(needAi); } catch (e) { console.warn("AI trips failed:", e); }

      // compose final list for UI text only
      const totalShown = dbTrips.length + aiTrips.length;

      // render AI cards
      if (grid && aiTrips.length) {
        aiTrips.forEach(t => grid.appendChild(tripCard(t, { ai: true })));
      }

      if (status) {
        if (aiTrips.length) {
          status.textContent = `Showing ${dbTrips.length} from DB (province) + ${aiTrips.length} AI suggestion${aiTrips.length>1?'s':''} — total ${totalShown}.`;
        } else {
          status.textContent = `Showing ${dbTrips.length} from DB (province).`;
        }
      }
    } catch (err) {
      console.error(err);
      if (status) status.textContent = "Failed to load trips: " + err.message;
    }
  })();
});

// ============================
// UNIVERSAL BACKGROUND VIDEO
// ============================

(function () {
    const params = new URLSearchParams(location.search);
    let province = params.get("province") || params.get("region");

    // kalau tidak ada province → stop
    if (!province) return;

    // buat <video> element kalau belum ada
    let video = document.getElementById("bgVideo");
    if (!video) {
        video = document.createElement("video");
        video.id = "bgVideo";
        video.autoplay = true;
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        document.body.prepend(video);
    }

    // NORMALISASI NAMA FILE KE FORMAT VIDEO KAMU
    let fileName = province
        .toLowerCase()
        .replace(/ /g, "_")            // spasi → underscore
        .replace(/–/g, "_")            // dash panjang → underscore
        .replace(/-/g, "_")            // dash → underscore
        .replace(/[()]/g, "")          // hapus kurung
        .replace(/__+/g, "_");         // ulang underscore → normal

    // BUAT PATH VIDEO
    const src = `/static/videos/${fileName}.mp4`;

    // UPDATE VIDEO SRC
    video.innerHTML = "";
    const source = document.createElement("source");
    source.src = src;
    source.type = "video/mp4";
    video.appendChild(source);

    // PLAY VIDEO
    video.load();
    video.play().catch(() => {});
})();
