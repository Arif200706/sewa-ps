require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const rentalRoutes = require('./routes/rentalRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', rentalRoutes);
app.use('/api/pembayaran', paymentRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'API Sewa PS3/PS4/PS5 aktif 🎮' });
});

// app.listen HANYA dijalankan pas dev lokal (npm run dev / npm start).
// Di Vercel, file ini di-load sebagai serverless function lewat
// module.exports di bawah — Vercel sendiri yang urus "menyalakan" server-nya
// setiap ada request masuk, jadi app.listen tidak diperlukan di situ.
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
  });
}

module.exports = app;
