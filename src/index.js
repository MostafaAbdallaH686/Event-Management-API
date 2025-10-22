import 'dotenv/config';
import { createApp } from './app.js';
import prisma from './prisma.js';

const port = process.env.PORT || 8080;

async function main() {
  try {
    let retries = 5;
    while (retries > 0) {
      try {
        await prisma.$connect();
        console.log('✅ Database connected');
        break;
      } catch (error) {
        retries--;
        console.log(`Database connection failed. Retries left: ${retries}`);
        if (retries === 0) throw error;
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    const app = createApp();
    
    app.listen(port, '0.0.0.0', () => {
      console.log(`🚀 API running on port ${port}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🏥 Health check: http://localhost:${port}/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

main();