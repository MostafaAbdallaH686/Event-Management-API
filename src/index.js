import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app.js';
import prisma from './prisma.js';

const port = process.env.PORT || 8080;

async function initServices() {
  // Initialize mailer if the module exists
  try {
    const { initMailer } = await import('./services/mailer.js');
    await initMailer();
    console.log('✅ Mailer initialized');
  } catch (error) {
    console.log('⚠️ Mailer not initialized:', error.message);
  }
}

async function main() {
  try {
    // Connect to database with retries
    let retries = 5;
    while (retries > 0) {
      try {
        await prisma.$connect();
        console.log('✅ Database connected');
        break;
      } catch (error) {
        retries--;
        console.log(`Database connection failed. Retries left: ${retries}`);
        console.error('Error:', error.message);
        if (retries === 0) throw error;
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    // Initialize other services
    await initServices();

    // Create and start Express app
    const app = createApp();
    
    app.listen(port, '0.0.0.0', () => {
      console.log(`🚀 API running on port ${port}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🏥 Health check: http://0.0.0.0:${port}/health`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('SIGTERM received, shutting down gracefully...');
      await prisma.$disconnect();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();