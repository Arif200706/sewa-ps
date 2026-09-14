-- =========================================================
-- DATABASE: sewa_ps
-- Sistem Sewa PlayStation (PS3, PS4, PS5)
-- =========================================================


-- =========================================================
-- TABEL ROLES (user, admin, superadmin)
-- =========================================================
CREATE TABLE roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nama_role ENUM('user', 'admin', 'superadmin') NOT NULL UNIQUE
);

INSERT INTO roles (nama_role) VALUES ('user'), ('admin'), ('superadmin');

-- =========================================================
-- TABEL USERS
-- =========================================================
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nama_lengkap VARCHAR(100) NOT NULL,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    no_telp VARCHAR(20),
    role_id INT NOT NULL DEFAULT 1,
    status ENUM('aktif', 'nonaktif') DEFAULT 'aktif',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NULL,
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- =========================================================
-- TABEL JENIS PS (PS3, PS4, PS5) BESERTA HARGA PER JAM
-- =========================================================
CREATE TABLE jenis_ps (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nama_ps VARCHAR(20) NOT NULL UNIQUE,   -- PS3, PS4, PS5
    harga_per_jam INT NOT NULL,
    deskripsi VARCHAR(255),
    gambar VARCHAR(255)
);

INSERT INTO jenis_ps (nama_ps, harga_per_jam, deskripsi) VALUES
('PS3', 5000, 'PlayStation 3 - Cocok untuk main santai & retro gaming'),
('PS4', 10000, 'PlayStation 4 - Grafis lebih baik, koleksi game lebih luas'),
('PS5', 25000, 'PlayStation 5 - Performa next-gen, loading super cepat, ray tracing');

-- =========================================================
-- TABEL UNIT PS (bilik/unit fisik yang tersedia di rental)
-- =========================================================
-- Catatan: status di sini HANYA menandai kondisi fisik unit (tersedia untuk
-- dibooking / sedang diperbaiki). Ketersediaan per JAM tidak disimpan di
-- kolom ini, melainkan dihitung langsung dari tabel transaksi_sewa
-- (lihat fungsi cekBentrokJadwal di backend) supaya satu unit tetap bisa
-- disewa banyak orang secara bergantian selama jamnya tidak bentrok.
CREATE TABLE unit_ps (
    id INT AUTO_INCREMENT PRIMARY KEY,
    jenis_ps_id INT NOT NULL,
    kode_unit VARCHAR(20) NOT NULL UNIQUE,  -- contoh: PS5-01, PS4-02
    status ENUM('tersedia', 'maintenance') DEFAULT 'tersedia',
    FOREIGN KEY (jenis_ps_id) REFERENCES jenis_ps(id)
);

INSERT INTO unit_ps (jenis_ps_id, kode_unit, status) VALUES
(1, 'PS3-01', 'tersedia'),
(1, 'PS3-02', 'tersedia'),
(2, 'PS4-01', 'tersedia'),
(2, 'PS4-02', 'tersedia'),
(3, 'PS5-01', 'tersedia'),
(3, 'PS5-02', 'tersedia');

-- =========================================================
-- TABEL TRANSAKSI SEWA
-- =========================================================
CREATE TABLE transaksi_sewa (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    unit_ps_id INT NOT NULL,
    jam_mulai DATETIME NOT NULL,
    lama_sewa_jam INT NOT NULL,          -- durasi dalam jam
    total_harga INT NOT NULL,
    status ENUM('menunggu', 'berlangsung', 'selesai', 'dibatalkan') DEFAULT 'menunggu',
    dikonfirmasi_oleh INT NULL,          -- id admin/superadmin yang konfirmasi

    -- ===== Kolom pembayaran QRIS (via payment gateway Midtrans) =====
    status_pembayaran ENUM('belum_bayar', 'menunggu_pembayaran', 'lunas', 'gagal') DEFAULT 'belum_bayar',
    midtrans_order_id VARCHAR(100) NULL,   -- order_id unik yang dikirim ke Midtrans
    qris_url TEXT NULL,                    -- URL gambar QR code dari Midtrans
    dibayar_at TIMESTAMP NULL,             -- waktu pembayaran dikonfirmasi lunas
    pembayaran_dikonfirmasi_oleh INT NULL, -- id admin/superadmin yang konfirmasi manual (NULL jika via webhook Midtrans otomatis)

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (unit_ps_id) REFERENCES unit_ps(id),
    FOREIGN KEY (dikonfirmasi_oleh) REFERENCES users(id),
    FOREIGN KEY (pembayaran_dikonfirmasi_oleh) REFERENCES users(id)
);

-- Index ini mempercepat query pengecekan bentrok jadwal (per unit + jam)
CREATE INDEX idx_transaksi_unit_jam ON transaksi_sewa (unit_ps_id, jam_mulai, status);

-- =========================================================
-- TABEL LOG AKTIVITAS (khusus admin & superadmin)
-- =========================================================
CREATE TABLE log_aktivitas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    aksi VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- =========================================================
-- SEED AKUN AWAL
-- Password asli sebelum di-hash bcrypt:
--   superadmin -> super123
--   admin      -> admin123
--   user       -> user123
-- (password di bawah sudah dalam bentuk hash bcrypt, dibuat oleh backend seeder)
-- Jalankan backend/seed.js untuk generate otomatis, atau ganti manual.
-- =========================================================
