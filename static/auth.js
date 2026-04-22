// auth.js
const API_BASE = ""; // same origin

async function apiPost(path, payload){
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(()=>({}));
  if(!res.ok || data.ok === false){
    throw new Error(data.message || `HTTP ${res.status}`);
  }
  return data;
}

// Register
async function registerUser({username, email, full_name="", password}){
  return apiPost("/api/register", {username, email, full_name, password});
}

// Login (username ATAU email)
async function loginUser({identifier, password}){
  return apiPost("/api/login", {identifier, password});
}

// Reset password (captcha sudah diverifikasi di frontend)
async function updatePassword(email, new_password){
  return apiPost("/api/reset_password", {email, new_password});
}
