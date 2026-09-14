const jwt = require('jsonwebtoken');
require('dotenv').config();

// Middleware: memastikan user sudah login (token valid)
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Token tidak ditemukan. Silakan login terlebih dahulu.' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Token tidak valid atau sudah kedaluwarsa.' });
    }
    req.user = decoded; // { id, username, role }
    next();
  });
}

// Middleware: membatasi akses berdasarkan role tertentu
// Contoh penggunaan: authorizeRoles('admin', 'superadmin')
function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Akses ditolak. Anda tidak memiliki izin untuk aksi ini.' });
    }
    next();
  };
}

module.exports = { verifyToken, authorizeRoles };
