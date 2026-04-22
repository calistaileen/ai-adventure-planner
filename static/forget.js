// ========== Captcha setup ==========
const qEl = document.getElementById("question");
const ansEl = document.getElementById("answer");
const btnRefresh = document.getElementById("btnRefresh");

let a = 0, b = 0, correct = 0;

function newQuestion() {
  a = Math.floor(Math.random() * 9) + 1;
  b = Math.floor(Math.random() * 9) + 1;
  correct = a + b;
  qEl.textContent = `${a} + ${b} = ?`;
  ansEl.value = "";
  ansEl.focus();
}
btnRefresh.addEventListener("click", newQuestion);
newQuestion();

// ========== Helper: call backend ==========
async function updatePassword(email, newpass) {
  const res = await fetch("/api/password_reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, new_password: newpass })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

// ========== Submit handler ==========
const form = document.getElementById("fpForm");
const submitBtn = form.querySelector('button[type="submit"]');

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email   = document.getElementById("email").value.trim();
  const newpass = document.getElementById("newpass").value;
  const repass  = document.getElementById("repass").value;
  const answer  = Number(ansEl.value);

  if (newpass !== repass) {
    alert("Passwords do not match.");
    return;
  }
  if (answer !== correct) {
    alert("Captcha incorrect. New question generated.");
    newQuestion();
    return;
  }

  submitBtn.disabled = true;
  const oldText = submitBtn.textContent;
  submitBtn.textContent = "Updating...";

  try {
    await updatePassword(email, newpass);
    alert("Password updated! Redirecting to login...");
    window.location.href = "login.html";
  } catch (err) {
    alert(err.message || "Failed to update password");
    newQuestion();
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = oldText;
  }
});
