// static/login.js
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const emailInput = document.getElementById("email");
  const passInput  = document.getElementById("password");
  const errBox = document.getElementById("loginError");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (errBox) { errBox.style.display = "none"; errBox.textContent = ""; }

    const identifier = (emailInput.value || "").trim();
    const password   = (passInput.value  || "").trim();
    if (!identifier || !password) {
      if (errBox) { errBox.textContent = "Please fill in both fields."; errBox.style.display = "block"; }
      else alert("Please fill in both fields.");
      return;
    }

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();

      if (res.ok && data.ok) {
        // simpan data user biar bisa dipakai front.js
        sessionStorage.setItem("ts_user", JSON.stringify(data.user || data.data));

        // ✅ arahkan ke halaman utama setelah login
        window.location.href = "/index.html";
      } else {
        const msg = data?.error || "Login failed.";
        if (errBox) { errBox.textContent = msg; errBox.style.display = "block"; }
        else alert(msg);
      }
    } catch (err) {
      console.error(err);
      if (errBox) {
        errBox.textContent = "Server error. Please try again later.";
        errBox.style.display = "block";
      } else alert("Server error. Please try again later.");
    }
  });
});

