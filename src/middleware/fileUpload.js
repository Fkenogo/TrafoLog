const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../uploads/temp');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

const photoFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/jpg'];
  cb(null, allowed.includes(file.mimetype));
};

const fileFilter = (req, file, cb) => cb(null, true);

const uploadPhotos = multer({ storage, fileFilter: photoFilter, limits: { fileSize: 10 * 1024 * 1024 } });
const uploadFile = multer({ storage, fileFilter, limits: { fileSize: 50 * 1024 * 1024 } });

module.exports = { uploadPhotos, uploadFile };
