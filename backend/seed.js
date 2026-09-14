// Jalankan dengan: node seed.js
// Membuat 3 akun contoh: superadmin, admin, dan user biasa

require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./config/db');

async function seed() {
  try {
    const akunContoh = [
      { nama: 'Super Admin', username: 'superadmin', email: 'superadmin@sewaps.com', password: 'super123', role: 'superadmin' },
      { nama: 'Admin Toko', username: 'admin', email: 'admin@sewaps.com', password: 'admin123', role: 'admin' },
      { nama: 'Budi Pelanggan', username: 'user', email: 'user@sewaps.com', password: 'user123', role: 'user' }
    ];

    for (const akun of akunContoh) {
      const [existing] = await db.query('SELECT id FROM users WHERE username = ?', [akun.username]);
      if (existing.length > 0) {
        console.log(`Akun '${akun.username}' sudah ada, dilewati.`);
        continue;
      }

      const [roleRow] = await db.query('SELECT id FROM roles WHERE nama_role = ?', [akun.role]);
      const hashed = await bcrypt.hash(akun.password, 10);

      await db.query(
        `INSERT INTO users (nama_lengkap, username, email, password, role_id) VALUES (?, ?, ?, ?, ?)`,
        [akun.nama, akun.username, akun.email, hashed, roleRow[0].id]
      );
      console.log(`Akun '${akun.username}' (${akun.role}) berhasil dibuat. Password: ${akun.password}`);
    }

    console.log('\nSeeding selesai! Silakan login menggunakan salah satu akun di atas.');
    process.exit(0);
  } catch (err) {
    console.error('Gagal seeding:', err);
    process.exit(1);
  }
}

seed();
