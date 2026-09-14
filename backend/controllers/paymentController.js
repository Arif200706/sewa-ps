const db = require('../config/db');

// =========================================================
// PEMBAYARAN QRIS STATIS + KONFIRMASI MANUAL ADMIN/SUPERADMIN
// =========================================================
// Website ini TIDAK lagi generate kode QRIS otomatis lewat payment
// gateway (Midtrans). Sebagai gantinya, satu gambar QRIS statis milik
// pemilik rental ditampilkan ke semua user (lihat frontend/img/qris.jpg).
// Setelah user scan & transfer sendiri, admin/superadmin yang mengecek
// mutasi/bukti transfer lalu mengonfirmasi (atau menolak) pembayaran
// secara manual lewat dashboard mereka.
// =========================================================

// [USER] Menandai transaksi sebagai "menunggu konfirmasi pembayaran"
// setelah user scan QRIS statis & transfer sendiri secara manual.
exports.buatPembayaranQris = async (req, res) => {
  try {
    const { transaksi_id } = req.body;
    const user_id = req.user.id;

    if (!transaksi_id) {
      return res.status(400).json({ message: 'transaksi_id wajib diisi.' });
    }

    const [rows] = await db.query(
      `SELECT * FROM transaksi_sewa WHERE id = ? AND user_id = ?`,
      [transaksi_id, user_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Transaksi tidak ditemukan.' });
    }

    const trx = rows[0];

    if (trx.status_pembayaran === 'lunas') {
      return res.status(400).json({ message: 'Transaksi ini sudah lunas.' });
    }
    if (trx.status === 'dibatalkan') {
      return res.status(400).json({ message: 'Transaksi ini sudah dibatalkan, tidak bisa dibayar.' });
    }

    await db.query(
      `UPDATE transaksi_sewa SET status_pembayaran = 'menunggu_pembayaran' WHERE id = ?`,
      [trx.id]
    );

    res.json({
      message: 'Silakan scan QRIS dan transfer. Pembayaran akan dicek & dikonfirmasi oleh admin.',
      total_harga: trx.total_harga
    });
  } catch (err) {
    console.error('Gagal menandai pembayaran QRIS:', err.message);
    res.status(500).json({ message: 'Gagal memproses permintaan pembayaran.', detail: err.message });
  }
};

// [USER] Cek status pembayaran terkini (dipakai frontend untuk polling,
// supaya begitu admin konfirmasi lunas, layar user otomatis update).
exports.cekStatusPembayaran = async (req, res) => {
  const { id } = req.params;
  const [rows] = await db.query(
    `SELECT id, status, status_pembayaran, total_harga FROM transaksi_sewa WHERE id = ? AND user_id = ?`,
    [id, req.user.id]
  );
  if (rows.length === 0) return res.status(404).json({ message: 'Transaksi tidak ditemukan.' });
  res.json(rows[0]);
};

// [ADMIN & SUPERADMIN] Konfirmasi manual bahwa pelanggan sudah bayar
// (setelah admin cek sendiri mutasi/bukti transfer QRIS, atau bayar tunai).
exports.konfirmasiPembayaranManual = async (req, res) => {
  const { id } = req.params;

  const [rows] = await db.query('SELECT * FROM transaksi_sewa WHERE id = ?', [id]);
  if (rows.length === 0) {
    return res.status(404).json({ message: 'Transaksi tidak ditemukan.' });
  }

  const trx = rows[0];
  if (trx.status_pembayaran === 'lunas') {
    return res.status(400).json({ message: 'Transaksi ini sudah tercatat lunas.' });
  }

  await db.query(
    `UPDATE transaksi_sewa
     SET status_pembayaran = 'lunas', dibayar_at = NOW(), pembayaran_dikonfirmasi_oleh = ?
     WHERE id = ?`,
    [req.user.id, id]
  );

  await db.query(
    'INSERT INTO log_aktivitas (user_id, aksi) VALUES (?, ?)',
    [req.user.id, `Konfirmasi manual pembayaran LUNAS untuk transaksi #${id}`]
  );

  res.json({ message: `Pembayaran untuk transaksi #${id} berhasil dikonfirmasi LUNAS.` });
};

// [ADMIN & SUPERADMIN] Tandai pembayaran gagal/ditolak secara manual
// (misalnya bukti transfer palsu, atau salah nominal).
exports.tolakPembayaranManual = async (req, res) => {
  const { id } = req.params;

  const [rows] = await db.query('SELECT * FROM transaksi_sewa WHERE id = ?', [id]);
  if (rows.length === 0) {
    return res.status(404).json({ message: 'Transaksi tidak ditemukan.' });
  }

  const trx = rows[0];
  if (trx.status_pembayaran === 'lunas') {
    return res.status(400).json({ message: 'Transaksi ini sudah lunas, tidak bisa ditolak.' });
  }

  await db.query(
    `UPDATE transaksi_sewa
     SET status_pembayaran = 'gagal', pembayaran_dikonfirmasi_oleh = ?
     WHERE id = ?`,
    [req.user.id, id]
  );

  await db.query(
    'INSERT INTO log_aktivitas (user_id, aksi) VALUES (?, ?)',
    [req.user.id, `Menolak/menandai GAGAL pembayaran untuk transaksi #${id}`]
  );

  res.json({ message: `Pembayaran untuk transaksi #${id} ditandai GAGAL.` });
};
