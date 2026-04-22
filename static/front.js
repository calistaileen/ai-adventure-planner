// Tandai halaman ini sebagai "home" (front page) -> dipakai CSS
document.querySelector('main.front')?.classList.add('home');

// Year in footer
const y = document.getElementById("year");
if (y) y.textContent = new Date().getFullYear();

/* ===== Kebab menu (⋮) ===== */
const popover = document.getElementById("menuPopover");
const btnMenu = document.querySelector(".menu-btn");

if (btnMenu && popover) {
  btnMenu.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    popover.classList.toggle("show");
  });

  document.addEventListener("click", (e) => {
    if (!popover.contains(e.target) && !btnMenu.contains(e.target)) {
      popover.classList.remove("show");
    }
  });
}

/* ===== Menu item actions ===== */
const bind = (id, handler) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("click", (e)=>{ e.preventDefault(); handler(); });
};

// Logout
const lg = document.getElementById("logoutBtn");
if (lg) lg.addEventListener("click", ()=>{
  sessionStorage.removeItem("ts_user");
  alert("Logged out.");
  window.location.href = "login.html";
});

/* ===== Filter Popular Destinations by country (grid dummy lama) ===== */
const grid = document.getElementById("destGrid");
const select = document.getElementById("country");
if (select && grid) {
  select.addEventListener("change", ()=>{
    const val = select.value;
    [...grid.children].forEach(card=>{
      if(!val){ card.style.display = ""; return; }
      card.style.display = card.textContent.includes(val) ? "" : "none";
    });
  });
}

/* ===== Search → redirect ===== */
const searchBtn = document.getElementById("searchBtn");
if (searchBtn && select) {
  searchBtn.addEventListener("click", ()=>{
    const val = select.value;
    if (!val) { alert("Please select a country first."); return; }
    window.location.href = `regions.html?country=${encodeURIComponent(val)}`;
  });
}

/* ===== Custom dropdown (tanpa highlight biru) ===== */
(function initCustomDropdown() {
  const wrap = document.querySelector('.front .select-wrap');
  const native = document.getElementById('country');
  if (!wrap || !native) return;

  const dd = document.createElement('div');
  dd.className = 'ts-dd';
  dd.innerHTML = `
    <button type="button" class="ts-dd__trigger">
      <span class="ts-dd__value">${native.options[native.selectedIndex]?.text || 'Select a country'}</span>
      <span class="ts-dd__caret">▾</span>
    </button>
    <ul class="ts-dd__list"></ul>
  `;
  wrap.appendChild(dd);

  const list = dd.querySelector('.ts-dd__list');
  const valueEl = dd.querySelector('.ts-dd__value');
  const trigger = dd.querySelector('.ts-dd__trigger');

  [...native.options].forEach(opt => {
    const li = document.createElement('li');
    li.className = 'ts-dd__option' + (opt.selected ? ' is-selected' : '');
    li.dataset.value = opt.value;
    li.textContent = opt.textContent;
    li.setAttribute('role','option');
    if (opt.disabled) li.setAttribute('aria-disabled','true');
    list.appendChild(li);
  });

  const open = () => dd.classList.add('is-open');
  const close = () => dd.classList.remove('is-open');

  trigger.addEventListener('click', (e)=>{ e.preventDefault(); dd.classList.contains('is-open') ? close() : open(); });
  document.addEventListener('click', (e)=>{ if (!dd.contains(e.target)) close(); });
  document.addEventListener('keydown', (e)=>{ if (e.key==='Escape' || e.key==='Tab') close(); });

  list.addEventListener('click', (e)=>{
    const li = e.target.closest('.ts-dd__option');
    if (!li || li.getAttribute('aria-disabled')==='true') return;

    list.querySelectorAll('.ts-dd__option').forEach(x=>x.classList.remove('is-selected'));
    li.classList.add('is-selected');
    valueEl.textContent = li.textContent;

    native.value = li.dataset.value;
    native.dispatchEvent(new Event('change', { bubbles:true }));
    close();
  });
})();

/* ===== Back to top ===== */
(function addBackToTop(){
  const row = document.querySelector('.front .start-panel .start-row');
  if (!row) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'back-top-btn';
  btn.textContent = 'Back to top';
  row.appendChild(btn);

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();

/* ===== Foto untuk grid lama (tetap aman meski tersembunyi di home) ===== */
(function attachDestinationPhotos(){
  const grid = document.getElementById('destGrid');
  if (!grid) return;

  const imgBase = '/static/images/destinations/';
  const photos = new Map([
    ['Bali',              imgBase + 'bali.jpg'],
    ['Yogyakarta',        imgBase + 'yogyakarta.jpg'],
    ['Bandung',           imgBase + 'bandung.jpg'],
    ['Kuala Lumpur',      imgBase + 'kuala-lumpur.jpg'],
    ['Penang',            imgBase + 'penang.jpg'],
    ['Langkawi',          imgBase + 'langkawi.jpg'],
    ['Bangkok',           imgBase + 'bangkok.jpg'],
    ['Chiang Mai',        imgBase + 'chiang-mai.jpg'],
    ['Phuket',            imgBase + 'phuket.jpg'],
  ]);

  [...grid.children].forEach(card => {
    const name = card.textContent.trim();
    const key = [...photos.keys()].find(k => name.includes(k));
    if (!key) return;

    if (!card.classList.contains('photo')) {
      const label = document.createElement('span');
      label.className = 'dest-label';
      label.textContent = name;
      card.textContent = '';
      card.appendChild(label);
      card.setAttribute('aria-label', name);
      card.classList.add('photo');
    }
    card.style.backgroundImage = `url("${photos.get(key)}")`;
  });
})();

/* ===== Popular Destinations — 9 provinces (3 per country, random) ===== */
(function initProvincesPopular() {
  const track = document.getElementById("popularTrack");
  if (!track) return;

  // Cari tombol prev/next dalam wrapper terdekat
  const wrap = track.closest(".carousel-wrap") || document;
  const btnPrev = wrap.querySelector(".carousel-btn.prev");
  const btnNext = wrap.querySelector(".carousel-btn.next");

  const COUNTRIES = ["Indonesia", "Thailand", "Malaysia"];

  const shuffle = (a) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // Ambil region yang SUDAH punya rating di user_trips (via /api/popular_regions)
  async function fetchPopularRegions(country, limit = 3) {
    try {
      const r = await fetch(
        `/api/popular_regions?country=${encodeURIComponent(country)}&limit=${limit}`,
        { cache: "no-store" }
      );
      if (!r.ok) return [];
      const j = await r.json();
      if (!j || j.ok === false) return [];

      const items = j.items || [];
      const regions = items
        .map((x) => (x.region || x.province || x.name || "").trim())
        .filter(Boolean);

      // buang duplikat
      return [...new Set(regions)];
    } catch (err) {
      console.error("fetchPopularRegions error:", err);
      return [];
    }
  }

  // Fallback (belum kepakai sekarang, tapi disimpan untuk masa depan)
  async function fetchProvinces(country) {
    try {
      const r = await fetch(
        `/api/regions?country=${encodeURIComponent(country)}`,
        { cache: "no-store" }
      );
      if (r.ok) {
        const j = await r.json();
        const items = (j && j.items) || [];
        const names = items
          .map((x) => (x.province || x.region || x.name || "").trim())
          .filter(Boolean);
        if (names.length) return names;
      }
    } catch (_) {}

    try {
      const r = await fetch(
        `/api/provinces?country=${encodeURIComponent(country)}`,
        { cache: "no-store" }
      );
      if (r.ok) {
        const j = await r.json();
        if (Array.isArray(j)) {
          if (!j.length) return [];
          if (typeof j[0] === "string") return j;
          return j
            .map((x) => x.province || x.region || x.name)
            .filter(Boolean);
        }
        if (Array.isArray(j.items))
          return j.items
            .map((x) => x.province || x.region || x.name)
            .filter(Boolean);
      }
    } catch (_) {}

    return [];
  }

  // Generate kandidat path gambar berdasarkan nama province
  function imageCandidates(province) {
    const bases = ["/static/images/Provinces/", "/static/images/provinces/"];
    const raw = String(province).trim();
    const forms = [
      raw,
      raw.toLowerCase(),
      raw.toUpperCase(),
      raw.replace(/\s+/g, "_"),
      raw.replace(/\s+/g, "-"),
      raw.replace(/\s+/g, "_").toLowerCase(),
      raw.replace(/\s+/g, "-").toLowerCase(),
    ];
    const exts = [".png", ".jpg", ".jpeg", ".webp"];
    const out = [];
    bases.forEach((b) =>
      forms.forEach((f) => exts.forEach((ext) => out.push(`${b}${f}${ext}`)))
    );
    return out;
  }

  function cardHTML(country, province) {
    const srcs = imageCandidates(province);
    const first = srcs[0];
    const rest = srcs.slice(1);
    const href = `places.html?country=${encodeURIComponent(
      country
    )}&province=${encodeURIComponent(province)}`;
    const label = `${province}, ${country}`;
    return `
      <a class="dest-card" href="${href}" title="${label}">
        <div class="dest-img"
             style="background-image:url('${first}');"
             data-srcs='${JSON.stringify(rest)}'></div>
      </a>
    `;
  }

  // Cek fallback gambar bila file pertama 404
  function attachImgFallbacks(scope) {
    scope.querySelectorAll(".dest-img").forEach((div) => {
      let queue;
      try {
        queue = JSON.parse(div.getAttribute("data-srcs") || "[]");
      } catch {
        queue = [];
      }
      if (!queue.length) return;

      let currentUrl = div.style.backgroundImage.replace(
        /^url\(['"]?|['"]?\)$/g,
        ""
      );
      if (!currentUrl || currentUrl === "none") {
        currentUrl = queue.shift();
        div.style.backgroundImage = `url('${currentUrl}')`;
      }

      const img = new Image();
      img.onload = () => {};
      img.onerror = () => {
        const next = queue.shift();
        if (next) {
          div.style.backgroundImage = `url('${next}')`;
          div.setAttribute("data-srcs", JSON.stringify(queue));
          attachImgFallbacks(scope);
        } else {
          div.style.backgroundColor = "#eee";
          div.style.backgroundImage = "none";
        }
      };
      img.src = currentUrl;
    });
  }

  // Tombol panah kiri/kanan carousel
  function initNav() {
    const card = track.querySelector(".dest-card");
    if (!card) return;
    const step = () => {
      const w = card.getBoundingClientRect().width;
      const gap = parseFloat(getComputedStyle(track).gap || "24");
      return Math.ceil(w + gap);
    };
    if (btnPrev)
      btnPrev.addEventListener("click", () =>
        track.scrollBy({ left: -step(), behavior: "smooth" })
      );
    if (btnNext)
      btnNext.addEventListener("click", () =>
        track.scrollBy({ left: step(), behavior: "smooth" })
      );
  }

  // Muat data dan render kartu
  (async () => {
    try {
      const perCountry = await Promise.all(
        COUNTRIES.map(async (c) => {
          const regions = await fetchPopularRegions(c, 3);
          // setiap region -> 1 card kandidat
          return regions.map((p) => ({ country: c, province: p }));
        })
      );

      const all = shuffle(perCountry.flat())
        .filter((x) => x && x.province)
        .slice(0, 9);

      if (!all.length) {
        track.innerHTML =
          '<div class="muted">No popular destinations yet. Rate a trip to see popular regions here.</div>';
        return;
      }

      track.innerHTML = all
        .map((x) => cardHTML(x.country, x.province))
        .join("");

      attachImgFallbacks(track);
      initNav();
    } catch (err) {
      console.error(err);
      track.innerHTML =
        '<div class="error">Failed to load popular destinations.</div>';
    }
  })();
})();


/* ===== Background slideshow for hero panel ===== */
document.addEventListener("DOMContentLoaded", () => {
  const hero = document.querySelector(".hero.panel");
  if (!hero) return;

  // Daftar gambar dari folder Provinces
  const images = [
    "Bali.png",
    "Java.png",
    "Papua.png",
    "Kalimantan.png",
    "Sulawesi.png",
    "Maluku.png",
    "Nusa Tenggara.png",
    "East Coast Peninsula.png",
    "Northern Peninsula.png",
    "Sabah (Borneo).png",
    "Sarawak (Borneo).png"
  ].map(name => `/static/images/Provinces/${name}`);

  let index = 0;
  const changeBg = () => {
    hero.style.backgroundImage = `url('${images[index]}')`;
    index = (index + 1) % images.length;
  };

});
/* ===== Simple Review System ===== */
document.addEventListener("DOMContentLoaded", () => {
  const stars = document.querySelectorAll("#reviewRating span");
  const form = document.getElementById("reviewForm");
  const list = document.getElementById("reviewsList");
  const photoInput = document.getElementById("reviewPhoto");
  const photoPreview = document.getElementById("photoPreview");
  let rating = 0;

  // Klik bintang
  stars.forEach(star => {
    star.addEventListener("click", () => {
      rating = star.dataset.value;
      stars.forEach(s => s.classList.remove("selected"));
      star.classList.add("selected");
      let next = star.nextElementSibling;
      while (next) { next.classList.add("selected"); next = next.nextElementSibling; }
    });
  });

  // Preview foto
  photoInput.addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      photoPreview.innerHTML = `<img src="${e.target.result}" alt="Preview"/>`;
    };
    reader.readAsDataURL(file);
  });

  // Submit form
  form.addEventListener("submit", e => {
    e.preventDefault();
    const name = document.getElementById("reviewName").value.trim();
    const text = document.getElementById("reviewText").value.trim();
    const photoSrc = photoPreview.querySelector("img")?.src || "";

    const item = document.createElement("div");
    item.classList.add("review-item");
    item.innerHTML = `
      <div class="review-header">
        <span class="review-name">${name}</span>
        <span class="review-date">${new Date().toLocaleDateString()}</span>
      </div>
      <div class="review-stars">${"★".repeat(rating)}${"☆".repeat(5 - rating)}</div>
      <p>${text}</p>
      ${photoSrc ? `<img src="${photoSrc}" class="review-photo"/>` : ""}
    `;
    list.prepend(item);

    form.reset();
    photoPreview.innerHTML = "";
    stars.forEach(s => s.classList.remove("selected"));
    rating = 0;
  });
});
// Matikan fungsi background slideshow
const hero = document.querySelector(".hero.panel");
if (hero) hero.style.backgroundImage = "none";

