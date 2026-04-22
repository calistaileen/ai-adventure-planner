// saved.js — handle Saved Itineraries page
// - Load list of user_trips
// - Support actions: view (👁), edit in map (✏️), rate (⭐), delete (🗑)
// - Show detail itinerary (for PDF) when ?id=.

(function SavedPage() {
  const listEl        = document.getElementById('savedList');
  const emptyMsg      = document.getElementById('emptyMsg');
  const detailBox     = document.getElementById('tripDetail');
  const detailSection = document.getElementById('detailSection');
  const pageTitle     = document.getElementById('pageTitle');

  // Kalau bukan di saved.html, keluar saja
  if (!listEl && !detailBox) {
    return;
  }

  const qs       = new URLSearchParams(window.location.search);
  const detailId = qs.get('id');

  if (detailId) {
    // ==== MODE DETAIL ====
    if (listEl)   listEl.style.display   = 'none';
    if (emptyMsg) emptyMsg.style.display = 'none';
    if (pageTitle)     pageTitle.textContent        = 'Itinerary Detail';
    if (detailSection) detailSection.style.display  = 'block';
    loadDetail(detailId);
  } else {
    // ==== MODE LIST ====
    if (detailSection) detailSection.style.display = 'none';
    loadList();
  }

  // ===== Helpers =====
  function escapeHTML(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ==========================
  // LIST MODE
  // ==========================
  function loadList() {
    if (!listEl) return;

    fetch('/api/user_trips')
      .then(r => r.json())
      .then(data => {
        if (!data) throw new Error('No response');
        if (data.ok === false) throw new Error(data.error || 'Failed to load');

        const trips = data.trips || data.items || data.data || [];
        if (!Array.isArray(trips) || !trips.length) {
          listEl.innerHTML = '';
          if (emptyMsg) emptyMsg.style.display = 'block';
          return;
        }

        if (emptyMsg) emptyMsg.style.display = 'none';
        listEl.innerHTML = trips.map(cardHTML).join('');
      })
      .catch(err => {
        console.error(err);
        if (emptyMsg) {
          emptyMsg.textContent = 'Failed to load itineraries.';
          emptyMsg.style.display = 'block';
        }
      });
  }

  function cardHTML(t) {
    const id      = t.id || t.trip_id || t.user_trip_id;
    const title   = t.title || t.name || 'My Trip';
    const created = t.updated_at || t.created_at || t.createdAt || '';

    // Notes JSON dari backend (sudah di-parse di API list)
    const notes   = (t.notes && typeof t.notes === 'object') ? t.notes : null;
    const stops   = notes && Array.isArray(notes.stops) ? notes.stops : [];
    const daysArr = notes && Array.isArray(notes.days)  ? notes.days  : [];

    // Hitung total destinasi
    const destCount = stops.length;

    // Hitung total hari
    let dayCount = 0;
    if (daysArr.length) {
      dayCount = daysArr.length;
    } else if (stops.length) {
      const daySet = new Set();
      stops.forEach((s) => {
        const d = Number(s.day || s.day_index || s.day_no || 1) || 1;
        daySet.add(d);
      });
      dayCount = daySet.size || 1;
    }

    // Line 1: Saved time
    const lineSaved = created ? `Saved: ${created}` : '';

    // Line 2: "3 days • 5 destinations"
    const lineParts = [];
    if (dayCount) {
      lineParts.push(`${dayCount} day${dayCount > 1 ? 's' : ''}`);
    }
    if (destCount) {
      lineParts.push(`${destCount} destination${destCount > 1 ? 's' : ''}`);
    }
    const lineInfo = lineParts.join(' • ');

    // Ringkasan nama destinasi (max 3 + "+x more")
    let destSummary = '';
    if (stops.length) {
      const names = stops
        .map(s => s.name || s.title || s.label)
        .filter(Boolean);
      const uniqueNames = [...new Set(names)];
      const preview = uniqueNames.slice(0, 3);
      destSummary = preview.join(', ');
      const remaining = uniqueNames.length - preview.length;
      if (remaining > 0) {
        destSummary += ` +${remaining} more`;
      }
    }

    return `
      <article class="card trip-card" data-id="${id}">
        <div class="card-body">
          <h3 class="card-title">${escapeHTML(title)}</h3>
          ${lineSaved ? `<p class="card-meta small">${escapeHTML(lineSaved)}</p>` : ''}
          ${lineInfo  ? `<p class="card-meta small">${escapeHTML(lineInfo)}</p>`  : ''}
          ${destSummary
            ? `<p class="dest-summary small">Destinations: ${escapeHTML(destSummary)}</p>`
            : ''
          }
        </div>
        <div class="card-footer">
          <div class="btn-row">
            <button class="btn icon-btn js-view"  data-id="${id}" title="View itinerary">👁</button>
            <button class="btn icon-btn js-edit"  data-id="${id}" title="Edit on map">✏️</button>
            <button class="btn icon-btn js-rate"  data-id="${id}" title="Rate this trip">⭐</button>
            <button class="btn icon-btn js-delete" data-id="${id}" title="Delete itinerary">🗑</button>
          </div>
        </div>
      </article>
    `;
  }

  // ==========================
  // DETAIL MODE
  // ==========================
  function loadDetail(id) {
    if (!detailBox) return;

    detailBox.innerHTML = '<p class="small">Loading itinerary...</p>';

    fetch(`/api/user_trips/${encodeURIComponent(id)}`)
      .then(r => r.json())
      .then(data => {
        if (!data) throw new Error('No response');
        if (data.ok === false) throw new Error(data.error || 'Failed to load detail');
        if (!data.trip) throw new Error('Trip not found');

        const trip = data.trip;

        // notes_obj dari backend (sudah di-parse)
        const notes = (trip.notes_obj && typeof trip.notes_obj === 'object')
          ? trip.notes_obj
          : (trip.notes && typeof trip.notes === 'object' ? trip.notes : null);

        const stops = notes && Array.isArray(notes.stops)
          ? notes.stops
          : (Array.isArray(trip.points) ? trip.points : []);

        const daysArr = notes && Array.isArray(notes.days) ? notes.days : [];

        detailBox.innerHTML = buildDetailHTML(trip, stops, daysArr);
      })
      .catch(err => {
        console.error(err);
        detailBox.innerHTML = '<p class="small">Failed to load itinerary detail.</p>';
      });
  }
function buildDetailHTML(trip, stops, daysArr) {
  const title   = trip.title || 'My Trip';
  const created = trip.updated_at || trip.created_at || '';

  // Biarkan rating/review/photo tetap bisa dipakai untuk logika lain,
  // tapi TIDAK dipakai di tampilan view.
  const rating  = trip.rating;
  const review  = trip.review;
  const photo   = trip.photo_url;

  const destCount = Array.isArray(stops) ? stops.length : 0;

  let dayCount = 0;
  if (Array.isArray(daysArr) && daysArr.length) {
    dayCount = daysArr.length;
  } else if (stops && stops.length) {
    const daySet = new Set();
    stops.forEach((s) => {
      const d = Number(s.day || s.day_index || s.day_no || 1) || 1;
      daySet.add(d);
    });
    dayCount = daySet.size || 1;
  }

  const lineParts = [];
  if (dayCount) lineParts.push(`${dayCount} day${dayCount > 1 ? 's' : ''}`);
  if (destCount) lineParts.push(`${destCount} destination${destCount > 1 ? 's' : ''}`);
  const lineInfo = lineParts.join(' • ');

  // Group stops by day
  const dayMap = new Map();
  (stops || []).forEach((s) => {
    let d = Number(s.day || s.day_index || s.day_no || 1);
    if (!d || d < 1) d = 1;
    if (!dayMap.has(d)) dayMap.set(d, []);
    dayMap.get(d).push(s);
  });
  const sortedDays = Array.from(dayMap.keys()).sort((a, b) => a - b);

  const dayBlocks = sortedDays.map((d) => {
    const dayStops = dayMap.get(d) || [];

    const rows = dayStops.map((s, idx) => {
      const name = s.name || s.title || s.label || `Stop ${idx + 1}`;
      const city = s.city || s.region || '';
      const desc = s.note || s.description || s.address || '';

      return `
        <tr>
          <td class="day-col-index">${idx + 1}</td>
          <td class="day-col-name">
            <strong>${escapeHTML(name)}</strong>
            ${city ? `<div class="day-col-city">${escapeHTML(city)}</div>` : ''}
          </td>
          <td class="day-col-notes">
            ${desc ? escapeHTML(desc) : ''}
          </td>
        </tr>
      `;
    }).join('');

    return `
      <section class="day-block">
        <h3 class="day-title">Day ${d}</h3>
        ${
          rows
            ? `
              <table class="day-table">
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>Destination</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows}
                </tbody>
              </table>
            `
            : '<p class="small">No stops for this day.</p>'
        }
      </section>
    `;
  }).join('');

  const scheduleHTML = dayBlocks || '<p class="small">No stops in this itinerary yet.</p>';

  // Header sekarang HANYA title + saved + summary, TANPA foto, rating, review
  return `
    <article class="card trip-detail-card">
      <header class="card-body">
        <h2 class="card-title">${escapeHTML(title)}</h2>
        ${created ? `<p class="card-meta small">Saved: ${escapeHTML(created)}</p>` : ''}
        ${lineInfo ? `<p class="card-meta small">${escapeHTML(lineInfo)}</p>` : ''}
      </header>
      <section class="card-body">
        <h3 class="section-subtitle">Day-by-day schedule</h3>
        <div class="day-list">
          ${scheduleHTML}
        </div>
      </section>
    </article>
  `;
}


  // ==========================
  // GLOBAL BUTTON HANDLERS
  // ==========================
  document.addEventListener('click', (e) => {
    const viewBtn = e.target.closest('.js-view');
    const editBtn = e.target.closest('.js-edit');
    const rateBtn = e.target.closest('.js-rate');
    const delBtn  = e.target.closest('.js-delete');

    if (viewBtn) {
      const id = viewBtn.dataset.id;
      if (!id) return;
      // 👁 View → saved.html?id=.
      window.location.href = `saved.html?id=${encodeURIComponent(id)}`;
      return;
    }

    if (editBtn) {
      const id = editBtn.dataset.id;
      if (!id) return;
      // ✏️ Edit → map.html?user_trip=.
      window.location.href = `map.html?user_trip=${encodeURIComponent(id)}`;
      return;
    }

    if (rateBtn) {
      const id = rateBtn.dataset.id;
      if (!id) return;
      // ⭐ Rate → rate.html?user_trip=.
      window.location.href = `rate.html?user_trip=${encodeURIComponent(id)}`;
      return;
    }

    if (delBtn) {
      const id = delBtn.dataset.id;
      if (!id) return;
      if (!confirm('Delete this itinerary? This action cannot be undone.')) return;
      deleteTrip(id);
      return;
    }
  });

  function deleteTrip(id) {
    fetch(`/api/user_trips/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    })
      .then(r => r.json())
      .then(data => {
        if (!data) throw new Error('No response');
        if (data.ok === false) throw new Error(data.error || 'Delete failed');
        // Refresh list atau balik ke list
        if (!window.location.search.includes('id=')) {
          loadList();
        } else {
          window.location.href = 'saved.html';
        }
      })
      .catch(err => {
        console.error(err);
        alert('Failed to delete itinerary.');
      });
  }

})();
