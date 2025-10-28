import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import adminRoutes from './routes/admin.js';
import anylisticsRoutes from './routes/analytics.js';
import authRoutes from './routes/auth.js';
import eventRoutes from './routes/events.js';
import registrationRoutes from './routes/registrations.js';
import paymentRoutes from './routes/payments.js';
import notificationRoutes from './routes/notifications.js';
import profileRoutes from './routes/profile.js';
import categoriesRouter from './routes/categories.js';  

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();
  
  // Middleware
  app.use(cors());
  app.use(morgan('dev'));
  app.use(express.json());
  
  // Serve static files (uploaded images) - ONLY ONCE
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

  // Health check
  app.get('/health', (_req, res) => {
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // API Routes - ORDER MATTERS!
  app.use('/api/admin', adminRoutes);
  app.use('/api/profile', profileRoutes);  
  app.use('/api/analytics', anylisticsRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/events', eventRoutes);
  app.use('/api/registrations', registrationRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/categories', categoriesRouter); 
  // 404 handler - MUST BE AFTER all routes
  app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
  });

  // Error handler - MUST BE LAST
  app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
      message: err.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  });

  return app;
}