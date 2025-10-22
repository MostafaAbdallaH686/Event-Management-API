import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';

// Ensure upload directory exists
const uploadDir = 'uploads/avatars';
await fs.mkdir(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Not an image! Please upload only images.'), false);
    }
  },
});

export const uploadAvatar = upload.single('avatar');

export const processAvatar = async (req, res, next) => {
  try {
    if (!req.file) return next();

    const filename = `avatar-${req.user.id}-${Date.now()}.jpeg`;
    const filepath = path.join(uploadDir, filename);

    // Process and save avatar (square crop)
    await sharp(req.file.buffer)
      .resize(300, 300, { 
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 90 })
      .toFile(filepath);

    // Generate URL - Store in req.uploadedAvatar instead of req.body
    const avatarUrl = `${req.protocol}://${req.get('host')}/uploads/avatars/${filename}`;
    req.uploadedAvatar = avatarUrl;
    
    next();
  } catch (error) {
    console.error('Avatar processing error:', error);
    return res.status(400).json({ message: 'Error processing avatar' });
  }
};