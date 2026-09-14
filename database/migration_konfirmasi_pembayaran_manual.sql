-- =========================================================
-- MIGRASI: kolom untuk konfirmasi pembayaran manual oleh admin/superadmin
-- Jalankan ini SAJA jika database sewa_ps kamu sudah ada sebelumnya.
-- (Kalau baru setup dari nol, cukup jalankan database/schema.sql yang
-- sudah memuat kolom ini, tidak perlu jalankan file ini lagi.)
-- =========================================================

USE sewa_ps;

ALTER TABLE transaksi_sewa
  ADD COLUMN pembayaran_dikonfirmasi_oleh INT NULL AFTER dibayar_at,
  ADD CONSTRAINT fk_pembayaran_dikonfirmasi_oleh
    FOREIGN KEY (pembayaran_dikonfirmasi_oleh) REFERENCES users(id);
