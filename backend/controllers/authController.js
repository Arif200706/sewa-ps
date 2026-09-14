const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
require('dotenv').config();

// REGISTER (default role: user)
exports.register = async (req, res) => {
  try {
    const { nama_lengkap, username, email, password, no_telp } = req.body;

    if (!nama_lengkap || !username || !email || !password) {
      return res.status(400).json({ message: 'Semua field wajib diisi.' });
    }

    const [existing] = await db.query(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Username atau email sudah digunakan.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // role_id 1 = user (default, tidak bisa mendaftar sebagai admin/superadmin)
    await db.query(
      `INSERT INTO users (nama_lengkap, username, email, password, no_telp, role_id)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [nama_lengkap, username, email, hashedPassword, no_telp || null]
    );

    res.status(201).json({ message: 'Registrasi berhasil. Silakan login.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan server saat registrasi.' });
  }
};

// LOGIN
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username dan password wajib diisi.' });
    }

    const [rows] = await db.query(
      `SELECT u.id, u.nama_lengkap, u.username, u.email, u.password, u.status, r.nama_role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.username = ?`,
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Username atau password salah.' });
    }

    const user = rows[0];

    if (user.status === 'nonaktif') {
      return res.status(403).json({ message: 'Akun Anda dinonaktifkan. Hubungi admin.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Username atau password salah.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.nama_role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      message: 'Login berhasil',
      token,
      user: {
        id: user.id,
        nama_lengkap: user.nama_lengkap,
        username: user.username,
        email: user.email,
        role: user.nama_role
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan server saat login.' });
  }
};

// GET PROFIL (user yang sedang login)
exports.getProfile = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT u.id, u.nama_lengkap, u.username, u.email, u.no_telp, r.nama_role
       FROM users u JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'User tidak ditemukan.' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
};
