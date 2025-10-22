Write-Host "🚀 Complete Event Management API Setup" -ForegroundColor Cyan
Write-Host "=" * 60

# 1. Install dependencies
Write-Host "`n📦 Installing dependencies..." -ForegroundColor Yellow
npm install

# 2. Start MySQL
Write-Host "`n🐬 Starting MySQL..." -ForegroundColor Yellow
docker-compose up -d mysql
Write-Host "⏳ Waiting 30 seconds..."
Start-Sleep -Seconds 30

# 3. Create database
Write-Host "`n🗄️ Creating database..." -ForegroundColor Yellow
docker exec event-mysql mysql -u root -ppassword -e "CREATE DATABASE IF NOT EXISTS event_management;"

# 4. Generate Prisma Client
Write-Host "`n🔧 Generating Prisma Client..." -ForegroundColor Yellow
npx prisma generate

# 5. Push schema
Write-Host "`n📋 Pushing schema to database..." -ForegroundColor Yellow
npx prisma db push

# 6. Seed database
Write-Host "`n🌱 Seeding database..." -ForegroundColor Yellow
npm run db:seed

# 7. Test database
Write-Host "`n🧪 Testing database..." -ForegroundColor Yellow
npm run db:smoke

Write-Host "`n" + "=" * 60
Write-Host "✨ Setup Complete!" -ForegroundColor Green
Write-Host "`nNext: npm run dev" -ForegroundColor Cyan