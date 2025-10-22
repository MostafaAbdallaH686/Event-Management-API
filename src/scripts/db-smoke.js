import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧪 Database Smoke Test\n');
  console.log('=' .repeat(50));

  try {
    // Test connection
    await prisma.$connect();
    console.log('✅ Database connection: SUCCESS\n');

    // Test queries
    console.log('📊 Testing queries...\n');

    const userCount = await prisma.user.count();
    console.log(`   Users: ${userCount}`);

    const categoryCount = await prisma.category.count();
    console.log(`   Categories: ${categoryCount}`);

    const eventCount = await prisma.event.count();
    console.log(`   Events: ${eventCount}`);

    const registrationCount = await prisma.registration.count();
    console.log(`   Registrations: ${registrationCount}`);

    console.log('\n✅ All queries: SUCCESS');

    // List users
    if (userCount > 0) {
      console.log('\n👥 Users in database:');
      const users = await prisma.user.findMany({
        select: {
          username: true,
          email: true,
          role: true,
        },
      });
      users.forEach(user => {
        console.log(`   - ${user.username} (${user.email}) - ${user.role}`);
      });
    }

    console.log('\n' + '=' .repeat(50));
    console.log('✨ Smoke test PASSED!\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Smoke test FAILED!');
    console.error('Error:', error.message);
    console.error('\nDetails:', error);
    process.exit(1);
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });