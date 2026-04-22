// /static/register.js
document.getElementById("regForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const username  = document.getElementById("username").value.trim();
  const email     = document.getElementById("email").value.trim();
  const full_name = document.getElementById("full_name").value.trim();
  const password  = document.getElementById("password").value;
  const repass    = document.getElementById("repass").value;
  const btn       = document.getElementById("submitBtn");

  if (password !== repass) {
    alert("Passwords do not match.");
    return;
  }
  if (!full_name) {
    alert("Full name is required.");
    return;
  }

  btn.disabled = true;
  const oldText = btn.textContent;
  btn.textContent = "Creating…";

  try {
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, email, password, full_name })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data && (data.error || data.message);
      throw new Error(msg || `HTTP ${res.status}`);
    }

    alert("Registration successful! Please login.");
    window.location.href = "/login.html";
  } catch (err) {
    alert(String(err.message || err));
  } finally {
    btn.disabled = false;
    btn.textContent = oldText;
  }
});
