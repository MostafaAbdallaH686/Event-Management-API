import 'dotenv/config';
import { createApp } from './app.js';
import prisma from './prisma.js';

const port = process.env.PORT || 8080;

async function main() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected');

    // Create and start app
    const app = createApp();
    
    app.listen(port, () => {
      console.log(`🚀 API running on http://localhost:${port}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🏥 Health check: http://localhost:${port}/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
  // Clean expired tokens every hour
setInterval(async () => {
  try {
    const result = await prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (result.count > 0) {
      console.log(`🧹 Cleaned ${result.count} expired refresh tokens`);
    }
  } catch (err) {
    console.error('Token cleanup error:', err);
  }
}, 60 * 60 * 1000); // 1 hour
}

main();