import multer from 'multer';
import imageService from '../services/imageService.js';

// Configure multer for memory storage
const multerConfig = {
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Only images are allowed'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1
  }
};

// Create multer instance
const upload = multer(multerConfig);

// Export middleware for single image upload
export const uploadEventImage = upload.single('image');

// Process uploaded image
export const processEventImage = async (req, res, next) => {
  try {
    if (!req.file) return next();
    
    const urls = await imageService.handleUpload(req.file, req);
    
    if (urls) {
      req.body.imageUrl = urls.imageUrl;
      req.body.thumbnailUrl = urls.thumbnailUrl;
      req.uploadedImage = urls; // Store for later use if needed
    }
    
    next();
  } catch (error) {
    console.error('Image processing error:', error);
    return res.status(400).json({ 
      message: 'Error processing image',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Error handler for multer errors
export const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large. Maximum size is 5MB.' });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ message: err.message });
    }
  }
  next(err);
};