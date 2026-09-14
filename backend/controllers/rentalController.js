const db = require('../config/db');

// [USER] Lihat semua jenis PS & harga
exports.getJenisPS = async (req, res) => {
  const [rows] = await db.query('SELECT * FROM jenis_ps');
  res.json(rows);
};

// Helper: cek apakah sebuah unit bentrok jadwal pada rentang waktu tertentu.
// Bentrok = ada transaksi lain (belum selesai/dibatalkan) di unit yang sama
// yang rentang waktunya beririsan dengan rentang waktu yang diminta.
// Rumus overlap: existing.mulai < baru.selesai  DAN  existing.selesai > baru.mulai
async function cekBentrokJadwal(unit_ps_id, jam_mulai, lama_sewa_jam, excludeTransaksiId = null) {
  let query = `
    SELECT id, jam_mulai, lama_sewa_jam, status,
           DATE_ADD(jam_mulai, INTERVAL lama_sewa_jam HOUR) AS jam_selesai
    FROM transaksi_sewa
    WHERE unit_ps_id = ?
      AND status IN ('menunggu', 'berlangsung')
      AND jam_mulai < DATE_ADD(?, INTERVAL ? HOUR)
      AND DATE_ADD(jam_mulai, INTERVAL lama_sewa_jam HOUR) > ?`;
  const params = [unit_ps_id, jam_mulai, lama_sewa_jam, jam_mulai];

  if (excludeTransaksiId) {
    query += ' AND id != ?';
    params.push(excludeTransaksiId);
  }

  const [rows] = await db.query(query, params);
  return rows; // array kosong = tidak bentrok, tidak kosong = bentrok
}

// [USER] Lihat unit PS yang tersedia (bisa filter by jenis, dan opsional
// filter berdasarkan jam_mulai + lama_sewa_jam supaya hanya menampilkan
// unit yang BENAR-BENAR kosong di jam tersebut)
exports.getUnitTersedia = async (req, res) => {
  const { jenis, jam_mulai, lama_sewa_jam } = req.query;

  let query = `
    SELECT u.id, u.kode_unit, u.status, j.nama_ps, j.harga_per_jam
    FROM unit_ps u JOIN jenis_ps j ON u.jenis_ps_id = j.id
    WHERE u.status = 'tersedia'`;
  const params = [];
  if (jenis) {
    query += ' AND j.nama_ps = ?';
    params.push(jenis);
  }
  const [rows] = await db.query(query, params);

  // Jika user sudah memilih jam_mulai & durasi, saring unit yang bentrok jadwal
  if (jam_mulai && lama_sewa_jam) {
    const hasil = [];
    for (const unit of rows) {
      const bentrok = await cekBentrokJadwal(unit.id, jam_mulai, lama_sewa_jam);
      hasil.push({ ...unit, tersedia_di_jam_ini: bentrok.length === 0 });
    }
    return res.json(hasil);
  }

  // Tanpa filter jam: tampilkan semua unit (status ketersediaan riil dicek saat submit)
  res.json(rows.map(u => ({ ...u, tersedia_di_jam_ini: null })));
};

// [USER] Lihat jadwal (jam-jam yang sudah dibooking) untuk satu unit tertentu,
// supaya user tahu jam mana saja yang sudah "dikunci" oleh sewa lain.
exports.getJadwalUnit = async (req, res) => {
  const { id } = req.params; // unit_ps_id
  const { tanggal } = req.query; // format: YYYY-MM-DD (opsional)

  let query = `
    SELECT t.id, t.jam_mulai, t.lama_sewa_jam, t.status,
           DATE_ADD(t.jam_mulai, INTERVAL t.lama_sewa_jam HOUR) AS jam_selesai
    FROM transaksi_sewa t
    WHERE t.unit_ps_id = ? AND t.status IN ('menunggu', 'berlangsung')`;
  const params = [id];

  if (tanggal) {
    query += ' AND DATE(t.jam_mulai) = ?';
    params.push(tanggal);
  }

  query += ' ORDER BY t.jam_mulai ASC';

  const [rows] = await db.query(query, params);
  res.json(rows);
};

// [USER] Buat pesanan sewa baru
exports.buatSewa = async (req, res) => {
  try {
    const { unit_ps_id, jam_mulai, lama_sewa_jam } = req.body;
    const user_id = req.user.id;

    if (!unit_ps_id || !jam_mulai || !lama_sewa_jam) {
      return res.status(400).json({ message: 'Data sewa belum lengkap.' });
    }
    if (Number(lama_sewa_jam) <= 0) {
      return res.status(400).json({ message: 'Lama sewa tidak valid.' });
    }
    if (new Date(jam_mulai) < new Date()) {
      return res.status(400).json({ message: 'Jam mulai tidak boleh di waktu yang sudah lewat.' });
    }

    const [unitRows] = await db.query(
      `SELECT u.status, j.harga_per_jam FROM unit_ps u
       JOIN jenis_ps j ON u.jenis_ps_id = j.id WHERE u.id = ?`,
      [unit_ps_id]
    );

    if (unitRows.length === 0) return res.status(404).json({ message: 'Unit PS tidak ditemukan.' });
    if (unitRows[0].status === 'maintenance') {
      return res.status(400).json({ message: 'Unit PS sedang dalam perbaikan (maintenance).' });
    }

    // ---- INI BAGIAN UTAMA: cek bentrok jadwal sebelum booking dibuat ----
    const bentrok = await cekBentrokJadwal(unit_ps_id, jam_mulai, lama_sewa_jam);
    if (bentrok.length > 0) {
      const b = bentrok[0];
      const mulai = new Date(b.jam_mulai).toLocaleString('id-ID');
      const selesai = new Date(b.jam_selesai).toLocaleString('id-ID');
      return res.status(409).json({
        message: `Unit ini sudah disewa orang lain pada jam tersebut (terpakai ${mulai} s/d ${selesai}). Silakan pilih jam lain atau unit lain.`,
        bentrok_dengan: bentrok
      });
    }
    // ----------------------------------------------------------------------

    const total_harga = unitRows[0].harga_per_jam * lama_sewa_jam;

    const [insertResult] = await db.query(
      `INSERT INTO transaksi_sewa (user_id, unit_ps_id, jam_mulai, lama_sewa_jam, total_harga, status)
       VALUES (?, ?, ?, ?, ?, 'menunggu')`,
      [user_id, unit_ps_id, jam_mulai, lama_sewa_jam, total_harga]
    );

    res.status(201).json({
      message: 'Pesanan sewa berhasil dibuat, menunggu konfirmasi admin.',
      transaksi_id: insertResult.insertId,
      total_harga
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
};

// [USER] Lihat riwayat sewa milik sendiri
exports.riwayatSewaSaya = async (req, res) => {
  const [rows] = await db.query(
    `SELECT t.id, j.nama_ps, u.kode_unit, t.jam_mulai, t.lama_sewa_jam, t.total_harga,
            t.status, t.status_pembayaran
     FROM transaksi_sewa t
     JOIN unit_ps u ON t.unit_ps_id = u.id
     JOIN jenis_ps j ON u.jenis_ps_id = j.id
     WHERE t.user_id = ? ORDER BY t.created_at DESC`,
    [req.user.id]
  );
  res.json(rows);
};

// [ADMIN & SUPERADMIN] Lihat semua transaksi
exports.getSemuaTransaksi = async (req, res) => {
  const [rows] = await db.query(
    `SELECT t.id, us.nama_lengkap, j.nama_ps, un.kode_unit, t.jam_mulai,
            t.lama_sewa_jam, t.total_harga, t.status, t.status_pembayaran
     FROM transaksi_sewa t
     JOIN users us ON t.user_id = us.id
     JOIN unit_ps un ON t.unit_ps_id = un.id
     JOIN jenis_ps j ON un.jenis_ps_id = j.id
     ORDER BY t.created_at DESC`
  );
  res.json(rows);
};

// [ADMIN & SUPERADMIN] Konfirmasi / update status transaksi
exports.updateStatusTransaksi = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'berlangsung', 'selesai', 'dibatalkan'

  const validStatus = ['menunggu', 'berlangsung', 'selesai', 'dibatalkan'];
  if (!validStatus.includes(status)) {
    return res.status(400).json({ message: 'Status tidak valid.' });
  }

  const [trx] = await db.query('SELECT unit_ps_id FROM transaksi_sewa WHERE id = ?', [id]);
  if (trx.length === 0) return res.status(404).json({ message: 'Transaksi tidak ditemukan.' });

  await db.query(
    'UPDATE transaksi_sewa SET status = ?, dikonfirmasi_oleh = ? WHERE id = ?',
    [status, req.user.id, id]
  );

  // Catatan: unit_ps.status TIDAK lagi diubah otomatis di sini, karena
  // ketersediaan unit sekarang dihitung per jam (lihat cekBentrokJadwal),
  // bukan status global "disewa/tersedia". unit_ps.status kini hanya
  // dipakai untuk menandai unit yang sedang 'maintenance'.

  await db.query(
    'INSERT INTO log_aktivitas (user_id, aksi) VALUES (?, ?)',
    [req.user.id, `Mengubah status transaksi #${id} menjadi ${status}`]
  );

  res.json({ message: `Status transaksi berhasil diubah menjadi ${status}.` });
};

// [SUPERADMIN] Kelola data admin (lihat semua user + role)
exports.getSemuaUser = async (req, res) => {
  const [rows] = await db.query(
    `SELECT u.id, u.nama_lengkap, u.username, u.email, u.status, r.nama_role
     FROM users u JOIN roles r ON u.role_id = r.id ORDER BY u.id`
  );
  res.json(rows);
};

// [SUPERADMIN] Ubah role user (contoh: naikkan user jadi admin)
exports.ubahRoleUser = async (req, res) => {
  const { id } = req.params;
  const { role } = req.body; // 'user', 'admin', 'superadmin'

  const [roleRow] = await db.query('SELECT id FROM roles WHERE nama_role = ?', [role]);
  if (roleRow.length === 0) return res.status(400).json({ message: 'Role tidak valid.' });

  await db.query('UPDATE users SET role_id = ? WHERE id = ?', [roleRow[0].id, id]);

  await db.query(
    'INSERT INTO log_aktivitas (user_id, aksi) VALUES (?, ?)',
    [req.user.id, `Mengubah role user #${id} menjadi ${role}`]
  );

  res.json({ message: 'Role user berhasil diubah.' });
};

// [SUPERADMIN] Aktifkan / nonaktifkan akun user
exports.ubahStatusUser = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'aktif', 'nonaktif'

  if (!['aktif', 'nonaktif'].includes(status)) {
    return res.status(400).json({ message: 'Status tidak valid.' });
  }

  await db.query('UPDATE users SET status = ? WHERE id = ?', [status, id]);
  res.json({ message: 'Status user berhasil diubah.' });
};
