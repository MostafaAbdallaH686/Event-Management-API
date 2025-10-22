import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';

class ImageService {
  constructor() {
    this.uploadDir = 'uploads/events';
    this.thumbnailPrefix = 'thumb-';
    this.imageConfig = {
      main: { width: 1200, height: 800, quality: 90 },
      thumbnail: { width: 400, height: 300, quality: 80 }
    };
  }

  async ensureUploadDir() {
    await fs.mkdir(this.uploadDir, { recursive: true });
  }

  generateFilename(originalName = '') {
    const timestamp = Date.now();
    const uuid = randomUUID().split('-')[0];
    return `event-${timestamp}-${uuid}.jpeg`;
  }

  getImageUrls(filename, req) {
    const protocol = req.protocol;
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;
    
    return {
      imageUrl: `${baseUrl}/uploads/events/${filename}`,
      thumbnailUrl: `${baseUrl}/uploads/events/${this.thumbnailPrefix}${filename}`
    };
  }

  async processImage(buffer, filename) {
    const filepath = path.join(this.uploadDir, filename);
    
    await sharp(buffer)
      .resize(this.imageConfig.main.width, this.imageConfig.main.height, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: this.imageConfig.main.quality })
      .toFile(filepath);
    
    return filepath;
  }

  async processThumbnail(buffer, filename) {
    const thumbnailFilename = `${this.thumbnailPrefix}${filename}`;
    const thumbnailPath = path.join(this.uploadDir, thumbnailFilename);
    
    await sharp(buffer)
      .resize(this.imageConfig.thumbnail.width, this.imageConfig.thumbnail.height, {
        fit: 'cover'
      })
      .jpeg({ quality: this.imageConfig.thumbnail.quality })
      .toFile(thumbnailPath);
    
    return thumbnailPath;
  }

  async deleteImage(imageUrl) {
    if (!imageUrl || !imageUrl.includes('/uploads/events/')) return;
    
    try {
      const filename = imageUrl.split('/uploads/events/').pop();
      const filepath = path.join(this.uploadDir, filename);
      const thumbnailPath = path.join(this.uploadDir, `${this.thumbnailPrefix}${filename}`);
      
      await fs.unlink(filepath).catch(() => {});
      await fs.unlink(thumbnailPath).catch(() => {});
    } catch (error) {
      console.error('Error deleting image:', error);
    }
  }

  async handleUpload(file, req) {
    if (!file) return null;
    
    await this.ensureUploadDir();
    const filename = this.generateFilename(file.originalname);
    
    // Process both main image and thumbnail
    await Promise.all([
      this.processImage(file.buffer, filename),
      this.processThumbnail(file.buffer, filename)
    ]);
    
    return this.getImageUrls(filename, req);
  }
}

export default new ImageService();