// =========================================================
// KONFIGURASI
// =========================================================
// Saat dites lokal (buka file langsung / Live Server), backend jalan
// terpisah di port 5000. Setelah di-deploy ke Vercel, frontend & backend
// satu domain yang sama, jadi cukup path relatif "/api".
const isLokal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = isLokal ? 'http://localhost:5000/api' : '/api';

// =========================================================
// GENERATE PARTIKEL CAHAYA MELAYANG (efek "rame" ala PS5)
// =========================================================
function buatPartikel() {
  const container = document.getElementById('particles');
  if (!container) return;

  const warna = ['#00c8ff', '#ff2e9f', '#38ffb0', '#ffd75e'];
  const jumlah = 35;

  for (let i = 0; i < jumlah; i++) {
    const p = document.createElement('span');
    const size = Math.random() * 4 + 3;
    p.style.left = Math.random() * 100 + 'vw';
    p.style.width = size + 'px';
    p.style.height = size + 'px';
    p.style.background = warna[Math.floor(Math.random() * warna.length)];
    p.style.boxShadow = `0 0 10px 2px ${p.style.background}`;
    p.style.animationDuration = (Math.random() * 6 + 6) + 's';
    p.style.animationDelay = (Math.random() * 6) + 's';
    container.appendChild(p);
  }
}
buatPartikel();

// =========================================================
// LOGIN FORM HANDLER
// =========================================================
const loginForm = document.getElementById('loginForm');

if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('errorMsg');
    errorMsg.textContent = '';

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!res.ok) {
        errorMsg.textContent = data.message || 'Login gagal.';
        return;
      }

      // Simpan token & data user
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Redirect sesuai role
      switch (data.user.role) {
        case 'superadmin':
          window.location.href = 'dashboard-superadmin.html';
          break;
        case 'admin':
          window.location.href = 'dashboard-admin.html';
          break;
        default:
          window.location.href = 'dashboard-user.html';
      }
    } catch (err) {
      errorMsg.textContent = 'Tidak dapat terhubung ke server. Pastikan backend berjalan.';
      console.error(err);
    }
  });
}

// =========================================================
// FUNGSI UMUM: PROTEKSI HALAMAN & LOGOUT (dipakai di dashboard)
// =========================================================
function cekLogin(roleYangDiizinkan) {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  if (!token || !user) {
    window.location.href = 'index.html';
    return null;
  }

  if (roleYangDiizinkan && !roleYangDiizinkan.includes(user.role)) {
    alert('Anda tidak memiliki akses ke halaman ini.');
    window.location.href = 'index.html';
    return null;
  }

  return user;
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'index.html';
}

async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
  return res.json();
}
