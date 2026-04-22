// rate.js — rating & review page for user_trips

(function RatePage() {

  const REGION_OPTIONS = {
    Indonesia: [
      "Sumatra",
      "Java",
      "Bali",
      "Nusa Tenggara",
      "West Nusa Tenggara",
      "Kalimantan",
      "Sulawesi",
      "Maluku",
      "Papua",
    ],
    Malaysia: [
      "Northern Peninsula",
      "Central–South Peninsula",
      "East Coast Peninsula",
      "Sabah (Borneo)",
      "Sarawak (Borneo)",
    ],
    Thailand: [
      "Northern Thailand",
      "Northeastern Thailand (Isan)",
      "Central Thailand",
      "Eastern Thailand",
      "Southern Thailand",
    ],
  };

  const params      = new URLSearchParams(window.location.search);
  const tripId      = params.get("user_trip") || params.get("id");

  const titleEl     = document.getElementById("tripTitle");
  const metaEl      = document.getElementById("tripMeta");
  const starRow     = document.getElementById("starRow");
  const ratingHint  = document.getElementById("ratingHint");
  const ratingError = document.getElementById("ratingError");
  const reviewInput = document.getElementById("reviewInput");
  const photoInput  = document.getElementById("photoInput");
  const photoPreview= document.getElementById("photoPreview");
  const photoError  = document.getElementById("photoError");
  const btnSave     = document.getElementById("btnSaveReview");
  const btnBack     = document.getElementById("btnBackSaved");
  const countrySelect   = document.getElementById("countrySelect");
  const regionSelect    = document.getElementById("regionSelect");
  const destinationError= document.getElementById("destinationError");


  if (!titleEl) {
    // Not on rate page
    return;
  }

  let currentRating = 0;
  let currentPhotoUrl = null;

  if (!tripId) {
    titleEl.textContent = "Trip not found";
    metaEl.textContent  = "Missing user_trip id in URL.";
    if (btnSave) btnSave.disabled = true;
    return;
  }

  // ===== Helpers =====
  function escapeHTML(str) {
    return (str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function setRating(n) {
    currentRating = n;
    const stars = starRow ? starRow.querySelectorAll(".star") : [];
    stars.forEach((star) => {
      const value = Number(star.dataset.value) || 0;
      if (value <= n) {
        star.classList.add("selected");
      } else {
        star.classList.remove("selected");
      }
    });

    if (ratingHint) {
      if (!n) {
        ratingHint.textContent = "Tap a star to rate this trip.";
      } else {
        ratingHint.textContent = `You rate ${n} star${n > 1 ? "s" : ""}.`;
      }
    }
    if (ratingError) ratingError.style.display = "none";
  }

  function showError(el, msg) {
    if (!el) return;
    el.textContent = msg || "";
    el.style.display = msg ? "block" : "none";
  }

  // ===== Load trip info =====
  fetch(`/api/user_trips/${encodeURIComponent(tripId)}`)
    .then((r) => r.json())
    .then((data) => {
      if (!data || data.ok === false) {
        throw new Error((data && data.error) || "Failed to load trip");
      }
      const trip = data.trip || {};

      const title   = trip.title || "My Trip";
      const created = trip.updated_at || trip.created_at || "";

      // notes / points untuk hitung hari & destinasi
      const notes = (trip.notes_obj && typeof trip.notes_obj === "object")
        ? trip.notes_obj
        : (trip.notes && typeof trip.notes === "object" ? trip.notes : null);

      const stops   = notes && Array.isArray(notes.stops)
        ? notes.stops
        : (Array.isArray(trip.points) ? trip.points : []);

      const daysArr = notes && Array.isArray(notes.days) ? notes.days : [];

      const destCount = stops.length;
      let dayCount = 0;
      if (daysArr.length) {
        dayCount = daysArr.length;
      } else if (destCount) {
        const daySet = new Set();
        stops.forEach((s) => {
          const d = Number(s.day || s.day_index || s.day_no || 1) || 1;
          daySet.add(d);
        });
        dayCount = daySet.size || 1;
      }

      const metaParts = [];
      if (dayCount) metaParts.push(`${dayCount} day${dayCount > 1 ? "s" : ""}`);
      if (destCount) metaParts.push(`${destCount} destination${destCount > 1 ? "s" : ""}`);
      const metaText = metaParts.join(" • ");

      titleEl.textContent = title;
      metaEl.textContent  = metaText || (created ? `Saved: ${created}` : "");

      // Prefill rating / review / photo
      if (typeof trip.rating === "number" && trip.rating >= 1 && trip.rating <= 5) {
        setRating(trip.rating);
      } else {
        setRating(0);
      }

      if (reviewInput) {
        reviewInput.value = trip.review || "";
      }

      currentPhotoUrl = trip.photo_url || null;
      if (currentPhotoUrl && photoPreview) {
        photoPreview.src = currentPhotoUrl;
        photoPreview.style.display = "block";
      }
    })
    .catch((err) => {
      console.error(err);
      titleEl.textContent = "Trip not found";
      metaEl.textContent  = "Failed to load itinerary.";
      if (btnSave) btnSave.disabled = true;
    });
      function populateRegions(country, selectedRegion) {
    if (!regionSelect) return;

    regionSelect.innerHTML = '<option value="">Select region</option>';

    if (!country || !REGION_OPTIONS[country]) {
      regionSelect.disabled = true;
      return;
    }

    const options = REGION_OPTIONS[country];
    regionSelect.disabled = false;

    options.forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      if (selectedRegion && selectedRegion === name) {
        opt.selected = true;
      }
      regionSelect.appendChild(opt);
    });
  }
    if (countrySelect) {
    countrySelect.addEventListener("change", () => {
      const c = countrySelect.value || "";
      populateRegions(c, "");
      if (destinationError) destinationError.style.display = "none";
    });
  }

  if (regionSelect) {
    regionSelect.addEventListener("change", () => {
      if (destinationError) destinationError.style.display = "none";
    });
  }


  // ===== Rating star click =====
  if (starRow) {
    starRow.addEventListener("click", (e) => {
      const star = e.target.closest(".star");
      if (!star) return;
      const val = Number(star.dataset.value) || 0;
      setRating(val);
    });
  }

  // ===== Photo upload =====
  if (photoInput) {
    photoInput.addEventListener("change", () => {
      const file = photoInput.files && photoInput.files[0];
      if (!file) return;

      showError(photoError, "");
      if (!file.type.startsWith("image/")) {
        showError(photoError, "Please choose an image file.");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);

      fetch("/api/upload_photo", {
        method: "POST",
        body: formData,
      })
        .then((r) => r.json())
        .then((data) => {
          if (!data || data.ok === false) {
            throw new Error((data && data.error) || "Upload failed");
          }
          currentPhotoUrl = data.url;

          if (photoPreview) {
            photoPreview.src = currentPhotoUrl;
            photoPreview.style.display = "block";
          }
        })
        .catch((err) => {
          console.error(err);
          showError(photoError, "Failed to upload photo. Please try again.");
        });
    });
  }

  // ===== Save review =====
    if (btnSave) {
        btnSave.addEventListener("click", () => {
        if (!tripId) return;

        const selectedCountry = countrySelect ? countrySelect.value.trim() : "";
        const selectedRegion  = regionSelect ? regionSelect.value.trim() : "";

        // Wajib pilih country & region
        if (!selectedCountry || !selectedRegion) {
            if (destinationError) {
            destinationError.textContent = "Please choose country and region.";
            destinationError.style.display = "block";
            }
            return;
        }

        if (!currentRating) {
            if (ratingError) {
            ratingError.textContent = "Please select a rating.";
            ratingError.style.display = "block";
            }
            return;
        }

        const payload = {
            rating: currentRating,
            review: (reviewInput && reviewInput.value) || "",
            photo_url: currentPhotoUrl || "",
            country: selectedCountry,
            region: selectedRegion,
        };


      btnSave.disabled = true;
      btnSave.textContent = "Saving...";

      fetch(`/api/user_trips/${encodeURIComponent(tripId)}/review`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
        .then((r) => r.json())
        .then((data) => {
          if (!data || data.ok === false) {
            throw new Error((data && data.error) || "Save failed");
          }
          alert("Thank you! Your rating has been saved.");
          window.location.href = `saved.html?id=${encodeURIComponent(tripId)}`;
        })
        .catch((err) => {
          console.error(err);
          alert("Failed to save rating. Please try again.");
        })
        .finally(() => {
          btnSave.disabled = false;
          btnSave.textContent = "Save rating";
        });
    });
  }

  // ===== Back button =====
  if (btnBack) {
    btnBack.addEventListener("click", () => {
      window.location.href = "/saved.html";
    });
  }
})();
