Write-Host "🔧 Fixing import statements..." -ForegroundColor Cyan

# Fix prisma.js
@"
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

export default prisma;
export { prisma };
"@ | Out-File -FilePath src/prisma.js -Encoding UTF8

Write-Host "✅ Fixed src/prisma.js" -ForegroundColor Green

# Restart nodemon
Write-Host "`n🚀 Restart your server with: npm run dev" -ForegroundColor Yellow