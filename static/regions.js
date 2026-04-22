// /static/regions.js
// Provinces page: keeps old grid rendering AND adds image-only slider rendering
document.addEventListener('DOMContentLoaded', () => {
  const qs = new URLSearchParams(location.search);
  const country = (qs.get('country') || '').trim();
  if (!country) return;

  // (opsional) header teks
  const titleEl = document.getElementById('title');
  const subtitleEl = document.getElementById('subtitle');
  if (titleEl) titleEl.textContent = `${country} — Provinces`;
  if (subtitleEl) subtitleEl.textContent = `Pick a province in ${country}.`;

  // Target lama (grid teks) — dipertahankan
  const grid =
    document.getElementById('grid') ||
    document.getElementById('regionGrid') ||
    document.getElementById('regionsGrid') ||
    document.querySelector('.region-grid');

  // Target slider baru
  const carouselTrack = document.getElementById('provinceCarousel');
  const btnPrev = document.querySelector('.carousel-btn.prev');
  const btnNext = document.querySelector('.carousel-btn.next');

  const statusEl = document.getElementById('status') || document.getElementById('provInfo');
  const countEl = document.getElementById('regionCount');
  const API_BASE = '/api';

  const setStatus = (msg) => { if (statusEl) statusEl.textContent = msg; };

  // ====== Ambil daftar province ======
  async function fetchProvincesFromRegionsAPI() {
    const url = `${API_BASE}/regions?country=${encodeURIComponent(country)}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const data = await res.json();
    const rows = (data && data.ok && Array.isArray(data.items)) ? data.items : [];
    return rows
      .map(r => ({
        name: String(r.province ?? '').trim(),
        count: Number(r.count ?? r.cnt ?? 0),
      }))
      .filter(x => x.name);
  }

  async function fetchProvincesFromTripsFallback() {
    const url = `${API_BASE}/trips?country=${encodeURIComponent(country)}&limit=200&rand=0`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const data = await res.json();
    const trips = (data && data.ok && Array.isArray(data.items)) ? data.items : [];
    const map = new Map();
    trips.forEach(t => {
      const prov = String(t.province ?? '').trim();
      if (prov) {
        const key = prov.toLowerCase();
        map.set(key, { name: prov, count: (map.get(key)?.count || 0) + 1 });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  // ====== Tampilan lama: kartu teks untuk grid ======
  function provinceCard(p) {
    const a = document.createElement('a');
    a.className = 'region-card';
    a.href = `places.html?country=${encodeURIComponent(country)}&province=${encodeURIComponent(p.name)}`;

    const h = document.createElement('div');
    h.className = 'region-name';
    h.textContent = p.name;

    const s = document.createElement('div');
    s.className = 'region-sub';
    s.textContent = `Top spots and hidden gems in ${p.name}.`;

    a.appendChild(h);
    a.appendChild(s);
    return a;
  }

  // ====== SLIDER: generator kandidat nama file di /static/images/Provinces/ ======
  function candidateImagePaths(provinceName) {
    const baseFolders = [
      '/static/images/Provinces/', // sesuai yang kamu simpan
      '/static/images/provinces/', // jaga-jaga beda kapital
      '/static/img/provinces/'     // jaga-jaga folder lama
    ];

    const raw = String(provinceName).trim();
    const forms = new Set([
      raw,                       // "West Nusa Tenggara"
      raw.toLowerCase(),         // "west nusa tenggara"
      raw.toUpperCase(),         // "WEST NUSA TENGGARA"
      raw.replace(/\s+/g, '_'),  // "West_Nusa_Tenggara"
      raw.replace(/\s+/g, '-').toLowerCase(), // "west-nusa-tenggara"
      raw.replace(/\s+/g, '_').toLowerCase()  // "west_nusa_tenggara"
    ]);

    const exts = ['.png', '.jpg', '.jpeg'];

    const candidates = [];
    for (const dir of baseFolders) {
      for (const f of forms) {
        for (const ext of exts) {
          candidates.push(`${dir}${f}${ext}`);
        }
      }
    }
    return candidates;
  }

  // load img dengan fallback berantai (tanpa overlay teks)
  function imgWithFallbackHTML(p) {
    const href = `places.html?country=${encodeURIComponent(country)}&province=${encodeURIComponent(p.name)}`;
    const candidates = candidateImagePaths(p.name);
    const first = candidates[0];
    const rest = candidates.slice(1);
    // simpan kandidat di data-srcs, lalu onerror akan mencoba yang berikutnya
    return `
      <a class="province-card" href="${href}" title="${p.name}">
        <img src="${first}" alt="${p.name}" loading="lazy"
             data-srcs='${JSON.stringify(rest)}'
             onerror="(function(el){try{var list=JSON.parse(el.getAttribute('data-srcs')||'[]');if(list.length){el.src=list.shift();el.setAttribute('data-srcs',JSON.stringify(list));}else{el.onerror=null;}}catch(e){el.onerror=null;}})(this)">
      </a>
    `;
  }

  function renderCarousel(provinces) {
    if (!carouselTrack) return;
    carouselTrack.innerHTML = provinces.map(imgWithFallbackHTML).join('');

    const step = () => {
      const card = carouselTrack.querySelector('.province-card');
      if (!card) return 380;
      const w = card.getBoundingClientRect().width;
      const gap = parseFloat(getComputedStyle(carouselTrack).gap || '24');
      return Math.ceil(w + gap);
    };

    if (btnPrev) btnPrev.addEventListener('click', () => {
      carouselTrack.scrollBy({ left: -step(), behavior: 'smooth' });
    });
    if (btnNext) btnNext.addEventListener('click', () => {
      carouselTrack.scrollBy({ left: step(), behavior: 'smooth' });
    });
  }

  (async () => {
    try {
      if (grid) grid.innerHTML = '';
      if (carouselTrack) carouselTrack.innerHTML = '';
      setStatus('Loading provinces…');

      let provinces = [];
      try {
        const viaAPI = await fetchProvincesFromRegionsAPI();
        if (viaAPI.length) {
          provinces = viaAPI;
          setStatus(`Loaded ${provinces.length} provinces from API.`);
        }
      } catch { /* ignore; try fallback */ }

      if (!provinces.length) {
        provinces = await fetchProvincesFromTripsFallback();
        setStatus(`Loaded ${provinces.length} provinces from trips (fallback).`);
      }

      if (!provinces.length) {
        setStatus('No provinces found for this country.');
        if (grid) grid.innerHTML = '<div class="muted">No provinces found.</div>';
        return;
      }

      // Jika ada elemen slider, pakai slider; kalau tidak, pakai grid lama
      if (carouselTrack) {
        renderCarousel(provinces);
      } else if (grid) {
        provinces.forEach(p => grid.appendChild(provinceCard(p)));
      }

      if (countEl) countEl.textContent = `Showing ${provinces.length} provinces`;
    } catch (err) {
      console.error(err);
      setStatus(`Failed to load provinces: ${err.message}`);
      if (grid) grid.innerHTML = `<div class="error">Failed to load provinces.</div>`;
    }
  })();
});
