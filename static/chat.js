/* ===== TrailSeeker Chat — Client (Ellie) ===== */
document.addEventListener("DOMContentLoaded", () => {
  const API_URL  = "/api/chat";
  const chatLog  = document.getElementById("chatLog");
  const userInput= document.getElementById("chatInput");
  const sendBtn  = document.getElementById("chatSend");
  if (!chatLog || !userInput || !sendBtn) return;

  const history = [];
  let lastTrips = null;
  window.lastTrips = null;

  // --- Simple conversation state ---
  let selectedCountry = null;   // "Indonesia" | "Malaysia" | "Thailand"
  let selectedRegion  = null;   // city/region text
  let askedPrefs      = false;  // already asked for (type, duration, budget)?

  function syncStateToWindow(){
    window.selectedCountry = selectedCountry;
    window.selectedRegion  = selectedRegion;
    window.lastTrips       = lastTrips;
  }

  // ===== Helper constants =====
  const ALLOWED_COUNTRIES = ["Indonesia","Malaysia","Thailand"];
  const COUNTRY_HINTS = {
    Indonesia: ["Bali", "Java", "North Sumatra"],
    Malaysia:  ["Penang", "Langkawi", "Sabah"],
    Thailand:  ["Chiang Mai", "Phuket", "Krabi"],
  };
  function fmtList(arr){
    if (!arr || !arr.length) return "";
    if (arr.length === 1) return arr[0];
    if (arr.length === 2) return `${arr[0]} and ${arr[1]}`;
    return `${arr.slice(0,-1).join(", ")}, and ${arr[arr.length-1]}`;
  }
  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => (
      {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]
    ));
  }

  // ===== UI helpers =====
  function addMsg(role, html) {
    const wrap = document.createElement("div");
    wrap.className = `msg ${role === "user" ? "user" : "bot"}`;
    const who = role === "user" ? "You" : "Ellie";
    wrap.innerHTML = `<strong>${who}:</strong> ${html}`;
    chatLog.appendChild(wrap);
    chatLog.scrollTop = chatLog.scrollHeight;
  }
  function addMsgText(role, text) { addMsg(role, escapeHtml(text)); }
  function setBusy(b){ userInput.disabled=b; sendBtn.disabled=b; }

  // ===== Chips (pilihan cepat) =====
  function addChoices(options) {
    const box = document.createElement("div");
    box.className = "choices";
    options.forEach(opt => {
      const btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = opt.label;
      btn.dataset.value = opt.value ?? opt.label;
      btn.addEventListener("click", () => {
        addMsgText("user", opt.label);
        history.push({ role: "user", content: opt.value || opt.label });
        box.closest(".msg.bot")?.remove();

        const val = (opt.value || opt.label).trim();

        // === START: handler untuk sapaan awal ===
        if (/cannot find/i.test(val)) {
          addMsg("bot", "I can help you search. Which country do you want to go?");
          addChoices([
            { label: "Indonesia", value: "Indonesia" },
            { label: "Malaysia",  value: "Malaysia"  },
            { label: "Thailand",  value: "Thailand"  },
          ]);
          return;
        }
        if (/saved itinerary/i.test(val)) {
          addMsg("bot", "You can find your saved itineraries on the “Saved Itinerary” page. Do you want me to locate a specific one?");
          addChoices([
            { label: "Yes, help me find it", value: "Help me find my saved itinerary" },
            { label: "Open Saved Itinerary", value: "Open Saved Itinerary" },
            { label: "No, thanks", value: "No, thanks" },
          ]);
          return;
        }
        if (/^others$/i.test(val)) {
          // reset mini state agar user bebas bertanya
          selectedCountry = null;
          selectedRegion  = null;
          askedPrefs      = false;
          addMsg("bot", "Please type your question below.");
          userInput.focus();
          return;
        }
        // === END: handler untuk sapaan awal ===

        // === Jika user klik negara ===
        if (ALLOWED_COUNTRIES.includes(val)) {
          selectedCountry = val;
          selectedRegion  = null;
          askedPrefs      = false;
          syncStateToWindow();

          const examples = COUNTRY_HINTS[val] || [];
          const tip = examples.length ? ` (e.g., ${fmtList(examples)})` : "";
          addMsg("bot", `Great. Which city/region in <b>${val}</b> are you interested in?${tip}`);
          userInput.placeholder = `Type a city/region in ${val}…`;
          return;
        }

        // === Jika user pilih trip (1 atau 2) ===
        if (/^\d+$/.test(val) && lastTrips) {
          const idx = parseInt(val, 10) - 1;
          showTrip(idx);
          return;
        }

        // === Opsi lainnya kirim ke backend ===
        sendToBackend(opt.value || opt.label);
      });
      box.appendChild(btn);
    });
    const host = document.createElement("div");
    host.className = "msg bot";
    host.innerHTML = "<strong>Ellie:</strong> ";
    host.appendChild(box);
    chatLog.appendChild(host);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  // ===== Sapaan awal =====
  function showWelcome() {
    if (chatLog.children.length > 0) return;
    addMsg("bot", "Hi, I am <b>Ellie</b>, your assistant. What can I help?");
    addChoices([
      { label: "I cannot find the place I want to go", value: "I cannot find the place I want to go" },
      { label: "Where I can find my saved itinerary", value: "Where I can find my saved itinerary" },
      { label: "Others", value: "Others" }
    ]);
  }

  // ===== Parsing helper jika reply berisi ```json ... ``` =====
  function parseTripsFromReply(replyText) {
    if (!replyText) return null;
    // ambil isi di dalam code fences ```json ... ``` atau ``` ... ```
    let m = replyText.match(/```(?:json)?\s*([\s\S]*?)```/i);
    let raw = m ? m[1] : replyText;

    // coba JSON.parse; jika gagal, abort
    try {
      const obj = JSON.parse(raw);
      // normalisasi: ambil array 2 trip teratas
      if (Array.isArray(obj) && obj.length) {
        return obj.slice(0,2).map(t => ({
          title:   t.title || "Suggested Trip",
          country: t.country || "",
          region:  t.region || t.province || "",
          province:t.province || t.region || "",
          days:    Array.isArray(t.days) ? t.days : [],
          note:    t.note || "",
          points:  Array.isArray(t.points) ? t.points : []
        }));
      }
    } catch (e) {
      return null;
    }
    return null;
  }

  // ===== Input manual =====
  sendBtn.addEventListener("click", onSend);
  userInput.addEventListener("keydown", (e)=>{
    if(e.key==="Enter"){
      e.preventDefault();
      onSend();
    }
  });

  function onSend() {
    const text = (userInput.value || "").trim();
    if (!text) return;
    addMsgText("user", text);
    history.push({ role: "user", content: text });
    userInput.value = "";

    const normalized = text.trim();

    // 1) User mengetik negara langsung
    if (ALLOWED_COUNTRIES.includes(normalized)) {
      selectedCountry = normalized;
      selectedRegion  = null;
      askedPrefs      = false;
      syncStateToWindow();

      const examples = COUNTRY_HINTS[normalized] || [];
      const tip = examples.length ? ` (e.g., ${fmtList(examples)})` : "";
      addMsg("bot", `Great. Which city/region in <b>${normalized}</b> are you interested in?${tip}`);
      userInput.placeholder = `Type a city/region in ${normalized}…`;
      return;
    }

    // 2) Jika negara sudah dipilih tapi region belum → anggap ini city/region
    if (selectedCountry && !selectedRegion) {
      selectedRegion = normalized;
      askedPrefs = true;
      syncStateToWindow();
      addMsg("bot",
        "Got it. Please provide the <b>type of travel</b>, <b>duration</b>, and <b>budget</b> (e.g., <i>waterfalls, 5d4n, NTD 20000</i>)."
      );
      userInput.placeholder = "Type, duration, and budget…";
      return;
    }

    // 3) Jika sudah minta preferensi → anggap ini preferences
    if (selectedCountry && selectedRegion && askedPrefs) {
      const prefsText = normalized;
      const ctx = {
        country: selectedCountry,
        region: selectedRegion,
        prefs: prefsText
      };
      sendToBackend(
        `Country: ${selectedCountry}\nRegion: ${selectedRegion}\nPreferences: ${prefsText}`,
        ctx
      );
      return;
    }

    // 4) Default: kirim biasa
    sendToBackend(text);
  }

  // ===== Kirim ke backend =====
  async function sendToBackend(text, ctx) {
    setBusy(true);
    try {
      const payload = ctx ? { history: history.slice(-10), ctx } : { message: text, history: history.slice(-10) };
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      console.log("[AI SAVE] response =", data);

      // 1) Jika backend sudah kirim trips terstruktur, pakai itu
      let trips = Array.isArray(data.trips) ? data.trips : null;

      // 2) Jika belum ada, coba parse dari reply yang berupa code block JSON
      if (!trips && data.reply) {
        const parsed = parseTripsFromReply(data.reply);
        if (parsed && parsed.length) {
          trips = parsed;
        }
      }

      // 3) Render: kalau ada trips → tampilkan opsi judul; JANGAN tampilkan blob JSON
      if (trips && trips.length) {
        lastTrips = trips;
        syncStateToWindow();
        addMsg("bot", "Here are two trips that match your criteria. Which one do you prefer?");
        addChoices(lastTrips.map((t,i)=>({
          label: `${i+1}) ${t.title}`,
          value: String(i+1)
        })));
      } else {
        // Jika tidak ada trips, tampilkan reply biasa (bukan JSON)
        const reply = data.reply || (data.ok ? data.reply : "");
        if (reply) {
          // cegah menampilkan code-fenced JSON mentah yang panjang
          if (/```/.test(reply) && /[\[\{].*[\]\}]/s.test(reply)) {
            addMsg("bot", "I prepared options based on your request. Please choose one.");
          } else {
            addMsg("bot", escapeHtml(reply));
            history.push({ role: "assistant", content: reply });
          }
        }
      }
    } catch (err) {
      addMsg("bot", `Network error. <span class="small">(${escapeHtml(String(err))})</span>`);
    } finally {
      setBusy(false);
    }
  }

  function showTrip(i) {
    if (!lastTrips || !lastTrips[i]) return;
    const t = lastTrips[i];

    let rows = "";
    if (Array.isArray(t.days) && t.days.length) {
      rows = t.days.map(d => {
        const items = (d.items || []).map(li => `<li>${escapeHtml(li)}</li>`).join("");
        return `
          <tr>
            <td class="col-day"><b>Day ${escapeHtml(d.day)}</b></td>
            <td>
              ${d.title ? `<div class="day-title"><b>${escapeHtml(d.title)}</b></div>` : ""}
              <ul class="day-list">${items}</ul>
            </td>
          </tr>`;
      }).join("");
    } else if (Array.isArray(t.points) && t.points.length) {
      const items = t.points.map(p => `<li>${escapeHtml(p.name || "")}</li>`).join("");
      rows = `
        <tr>
          <td class="col-day"><b>Highlights</b></td>
          <td><ul class="day-list">${items}</ul></td>
        </tr>`;
    } else {
      rows = `<tr><td colspan="2">No details available.</td></tr>`;
    }

    const html = `
      <div class="trip-card">
        <div class="trip-title">⭐ <b>${escapeHtml(t.title)}</b></div>
        <div class="trip-sub"><b>${escapeHtml(t.country || "")}</b>${t.region ? " — " + escapeHtml(t.region) : ""}</div>
        <table class="trip-table">
          <thead><tr><th>Day</th><th>Plan</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        ${t.note ? `<div class="trip-note"><b>Note:</b> ${escapeHtml(t.note)}</div>` : ""}
        <div class="trip-actions">
          <button class="btn-primary btn-view-map" type="button" data-trip-index="${i}">View on Map</button>
        </div>
      </div>`;
    addMsg("bot", html);
  }

  function buildTripPayload(t) {
    const points = Array.isArray(t.points) ? t.points : [];
    let itinerary_text = "";
    if ((!points.length) && Array.isArray(t.days) && t.days.length) {
      const items = [];
      t.days.forEach(d => (d.items || []).forEach(s => items.push(String(s))));
      itinerary_text = items.join(", ");
    }

    // 從 state 或 window 取後援（兩邊都試，誰有用誰）
    const uiCountry = String((selectedCountry ?? window.selectedCountry ?? "")).trim();
    const uiRegion  = String((selectedRegion  ?? window.selectedRegion  ?? "")).trim();

    const country  = String(t.country || uiCountry || "Indonesia").trim();
    const province = String((t.province || t.region || uiRegion || "")).trim();
    const region   = String((t.region   || province || uiRegion || "")).trim();

    return {
      title:    t.title || "AI Trip",
      country,
      province,   // 一定不空
      region,
      duration: t.duration || "",
      season:   t.season || "",
      note:     t.note || "",
      points,
      itinerary_text,
      // ★ 多帶 days 回後端（字串 items 也照傳）
      days: Array.isArray(t.days) ? t.days.map(d => ({
        items: (d.items || []).map(x => typeof x === "string" ? x : (x?.name || x?.title || ""))
      })) : []
    };
  }
  window.buildTripPayload = buildTripPayload;

  // ===== 將 AI 結果送到 /api/trips/ai/save，成功後直接開地圖 =====
  async function saveAiTripAndOpenMap(aiPlan) {
    const payload = { trip: aiPlan, province: aiPlan.province };

    const res = await fetch("/api/trips/ai/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const txt = await res.text().catch(()=>"");
      throw new Error(`HTTP ${res.status} ${res.statusText} ${txt}`);
    }
    const data = await res.json();
    const tripId = data?.trip_id ?? data?.id ?? data?.item?.id ?? null;
    if (!data?.ok || !tripId) throw new Error(data?.error || "Save failed");

    // 直接跳地圖
    window.location.assign(`/map.html?trip=${encodeURIComponent(tripId)}`);
  }

  // ===== Klik "View on Map" → save → redirect =====
  chatLog.addEventListener("click", async (e) => {
    const btn = e.target.closest(".btn-view-map");
    if (!btn) return;

    const i = parseInt(btn.dataset.tripIndex, 10);
    if (!lastTrips || !lastTrips[i]) return;
    const t = lastTrips[i];

    if (btn.disabled) return;
    btn.disabled = true;
    const oldText = btn.textContent;
    btn.textContent = "Preparing…";

    try {
      const payload = buildTripPayload(t);

      // 基本檢查（沒有 points 也要至少有 itinerary_text）
      const hasPoints = Array.isArray(payload.points) && payload.points.length > 0;
      const hasItineraryText = !!(payload.itinerary_text && payload.itinerary_text.trim());
      if (!payload.country || !payload.province || (!hasPoints && !hasItineraryText)) {
        btn.disabled = false;
        btn.textContent = oldText;
        addMsg("bot", "I couldn't detect real places yet. Please select a trip or refine the request.");
        return;
      }

      await saveAiTripAndOpenMap(payload);
    } catch (err) {
      addMsg("bot", `Failed to open map: ${escapeHtml(String(err))}`);
      btn.disabled = false;
      btn.textContent = oldText;
    }
  });

  // === Jalankan sapaan awal saat halaman dibuka ===
  showWelcome();
});
