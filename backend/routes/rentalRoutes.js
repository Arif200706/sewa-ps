const express = require('express');
const router = express.Router();
const rentalController = require('../controllers/rentalController');
const { verifyToken, authorizeRoles } = require('../middleware/auth');

// ---------- Akses: semua role yang sudah login ----------
router.get('/jenis-ps', verifyToken, rentalController.getJenisPS);
router.get('/unit-tersedia', verifyToken, rentalController.getUnitTersedia);
router.get('/unit/:id/jadwal', verifyToken, rentalController.getJadwalUnit);

// ---------- Akses: khusus 'user' ----------
router.post('/sewa', verifyToken, authorizeRoles('user'), rentalController.buatSewa);
router.get('/riwayat-saya', verifyToken, authorizeRoles('user'), rentalController.riwayatSewaSaya);

// ---------- Akses: 'admin' & 'superadmin' ----------
router.get(
  '/transaksi',
  verifyToken,
  authorizeRoles('admin', 'superadmin'),
  rentalController.getSemuaTransaksi
);
router.put(
  '/transaksi/:id/status',
  verifyToken,
  authorizeRoles('admin', 'superadmin'),
  rentalController.updateStatusTransaksi
);

// ---------- Akses: khusus 'superadmin' ----------
router.get(
  '/users',
  verifyToken,
  authorizeRoles('superadmin'),
  rentalController.getSemuaUser
);
router.put(
  '/users/:id/role',
  verifyToken,
  authorizeRoles('superadmin'),
  rentalController.ubahRoleUser
);
router.put(
  '/users/:id/status',
  verifyToken,
  authorizeRoles('superadmin'),
  rentalController.ubahStatusUser
);

module.exports = router;
