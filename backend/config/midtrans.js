require('dotenv').config();
const midtransClient = require('midtrans-client');

// Core API dipakai (bukan Snap) supaya kita bisa ambil gambar QRIS langsung
// dan menampilkannya dengan tampilan sendiri di frontend, tanpa redirect
// atau popup bawaan Midtrans.
const coreApi = new midtransClient.CoreApi({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY
});

module.exports = coreApi;
