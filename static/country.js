// country.js — render regions list for a given country
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("year").textContent = new Date().getFullYear();

  const params  = new URLSearchParams(location.search);
  const country = params.get("country") || "Indonesia";

  // Header text
  const INFO = {
    Indonesia: { desc: "Archipelago of islands, volcanoes, jungles, and beaches." },
    Malaysia:  { desc: "A blend of modern cities, rainforests, and tropical islands." },
    Thailand:  { desc: "Temples, street food, islands, and mountain adventures." }
  };
  const titleEl = document.getElementById("countryTitle");
  const descEl  = document.getElementById("countryDesc");
  titleEl.textContent = `${country} — Regions`;
  descEl.textContent  = INFO[country]?.desc || "Beautiful places and unique culture.";

  // Links
  document.getElementById("plannerLink").href = `planner.html?country=${encodeURIComponent(country)}`;

  // Fetch & render regions
  const listEl   = document.getElementById("regionList");
  const statusEl = document.getElementById("regionStatus");

  fetch(`/api/regions?country=${encodeURIComponent(country)}`)
    .then(r => r.ok ? r.json() : r.text().then(t => Promise.reject(new Error(t || r.status))))
    .then(data => {
      const items = data.items || data.data || []; // support both shapes
      listEl.innerHTML = "";
      if (!items.length) {
        statusEl.textContent = "No regions found.";
        return;
      }
      statusEl.textContent = `Showing ${items.length} regions`;

      // items could be array of strings OR objects with {region, trip_count}
      items.forEach(row => {
        const region = typeof row === "string" ? row : (row.region || row.name || "");
        if (!region) return;

        const a = document.createElement("a");
        a.className = "dest-card";
        a.href = `places.html?country=${encodeURIComponent(country)}&region=${encodeURIComponent(region)}`;
        a.style.textDecoration = "none";
        a.innerHTML = `
          <div style="display:grid;gap:6px;justify-items:center;text-align:center">
            <strong>${region}</strong>
            <span class="small">Top spots and hidden gems in ${region}.</span>
          </div>`;
        listEl.appendChild(a);
      });
    })
    .catch(err => {
      statusEl.textContent = "Failed to load regions: " + err.message;
      console.error(err);
    });
});
