const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { verifyToken, authorizeRoles } = require('../middleware/auth');

// User menandai transaksinya sudah discan/ditransfer via QRIS statis,
// status berubah jadi "menunggu_pembayaran" sampai dikonfirmasi admin.
router.post('/qris', verifyToken, paymentController.buatPembayaranQris);

// User polling status pembayaran (untuk update UI otomatis)
router.get('/status/:id', verifyToken, paymentController.cekStatusPembayaran);

// [ADMIN & SUPERADMIN] Konfirmasi/tolak pembayaran secara manual, dipakai
// saat admin sudah memverifikasi sendiri bahwa pelanggan sudah/belum bayar.
router.put(
  '/:id/konfirmasi',
  verifyToken,
  authorizeRoles('admin', 'superadmin'),
  paymentController.konfirmasiPembayaranManual
);
router.put(
  '/:id/tolak',
  verifyToken,
  authorizeRoles('admin', 'superadmin'),
  paymentController.tolakPembayaranManual
);

module.exports = router;
